// Real reminder scheduling using the browser Notification API.
//
// Honest limitation: this fires while Crescamus is open in a browser tab (or
// backgrounded, on platforms that keep JS timers alive) — it is not a true
// always-on push notification that survives the app being fully closed.
// That requires a native app + push infrastructure, which is a later phase
// (see project notes). This is still a real, working reminder system for
// anyone who keeps the app open or pinned, which is the honest scope for a
// web app today.

const CHECK_INTERVAL_MS = 20000; // check every 20s

export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.requestPermission();
}

// Mobile browsers (Chrome/Android in particular) reject the direct
// `new Notification()` constructor outside a service worker context — it's
// desktop-only in practice. Registering this once up front means fire()
// below has a ServiceWorkerRegistration to call showNotification() on,
// which is the pathway that actually works on phones.
async function ensureServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

// applicationServerKey wants a Uint8Array, not the base64url string VAPID
// keys are normally handed out as.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

// Subscribes this browser to Web Push so reminders can arrive even with the
// app fully closed (see supabase/functions/send-reminder-pushes). Returns
// the subscription in the plain shape api.upsertPushSubscription expects,
// or null if push isn't supported/permitted here — callers should treat
// that as "background push isn't available on this device," not an error;
// the tab-open scheduler below still works regardless.
export async function subscribeToPushNotifications() {
  if (typeof window === 'undefined' || !('PushManager' in window)) return null;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  const reg = await ensureServiceWorker();
  if (!reg) return null;

  try {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }
    const json = subscription.toJSON();
    return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
  } catch {
    return null; // permission denied, browser quirk, etc. -- fail quietly
  }
}

export function getDeviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function nowMinutesSinceMidnight() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutesSinceMidnight(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// A reminder is "due" once the clock has reached its target time, not only
// in the exact minute it lands on. A tab that gets throttled or briefly
// suspended (screen lock, app switch, laptop sleep) can miss the one 20s
// check that coincides with the exact target minute; without a grace window
// that reminder would silently never fire for the rest of the day. The
// window is capped so enabling a reminder hours after its time has passed
// doesn't trigger a stale, surprising notification.
const CATCH_UP_WINDOW_MINUTES = 90;

function isDue(targetHHMM, nowMin) {
  const targetMin = toMinutesSinceMidnight(targetHHMM);
  return nowMin >= targetMin && nowMin - targetMin <= CATCH_UP_WINDOW_MINUTES;
}

// --- Alarm tone (Web Audio API) ---------------------------------------
// A browser notification only ever plays one short system ping — there's
// no way to make it ring for a minute like an alarm clock. To get that,
// synthesize a repeating bell tone directly and play it alongside the
// notification, independent of Notification permission entirely (it only
// needs the AudioContext to have been unlocked by a prior user gesture).

let audioCtx = null;

export function unlockAlarmAudio() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
}

// One soft bell strike — a sine tone with a quick attack and slow decay,
// closer to a small chapel bell than a harsh digital beep.
function ringBell(ctx, when) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, when);
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.35, when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 1.4);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + 1.5);
}

// Rings a repeating bell for roughly `durationMs` (default ~1 minute), like
// an alarm. Tapping anywhere in the app silences it early, same as tapping
// a real alarm clock. All strikes are scheduled up front against the audio
// clock (not setTimeout), so timing holds even if the main thread is busy.
function playAlarmTone(durationMs = 60000) {
  if (!audioCtx) unlockAlarmAudio();
  if (!audioCtx) return; // Web Audio unsupported — the notification alone will have to do
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  const startTime = audioCtx.currentTime + 0.05;
  const intervalSec = 2;
  const strikes = Math.ceil(durationMs / 1000 / intervalSec);
  for (let i = 0; i < strikes; i++) {
    ringBell(audioCtx, startTime + i * intervalSec);
  }

  const timeoutId = setTimeout(stop, durationMs);
  window.addEventListener('pointerdown', stop, { once: true });

  function stop() {
    clearTimeout(timeoutId);
    window.removeEventListener('pointerdown', stop);
    // Cut off any strikes still scheduled ahead by suspending — resumes
    // transparently the next time an alarm needs to play.
    audioCtx.suspend().catch(() => {});
  }
}

async function fire(title, body) {
  playAlarmTone();

  if (getNotificationPermission() !== 'granted') return;
  const options = { body, icon: '/logo.svg', badge: '/logo.svg' };

  // Prefer the service worker pathway — it's the one that actually works on
  // mobile. Desktop browsers support both, but showNotification() works
  // fine there too, so there's no need to branch on platform.
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    // Fall through to the direct constructor below.
  }

  try {
    new Notification(title, options);
  } catch {
    // No usable notification pathway on this browser — fail silently
    // rather than break the scheduler loop.
  }
}

const LITURGICAL_PRAYERS = {
  morning: { label: 'Morning Prayer', body: 'Offer your day to God. Time for Morning Prayer.' },
  angelus: { label: 'The Angelus', body: 'Time to pray the Angelus.' },
  rosary: { label: 'The Holy Rosary', body: 'Time to pray the Rosary.' },
  evening: { label: 'Evening Examen', body: 'Time for your evening examination of conscience.' }
};

// Starts the interval that checks reminders against the clock. Returns a
// cleanup function. `getState` is called fresh on every tick so the
// scheduler always sees current toggles/times/intentions without needing
// to be restarted when they change.
export function startReminderScheduler(getState) {
  ensureServiceWorker();

  // key -> "YYYY-M-D" last fired. Firing is once-per-day per key regardless
  // of how many ticks land inside the catch-up window.
  const lastFiredDay = new Map();

  const alreadyFiredToday = (key) => lastFiredDay.get(key) === todayStr();
  const markFiredToday = (key) => lastFiredDay.set(key, todayStr());

  const tick = () => {
    const nowMin = nowMinutesSinceMidnight();
    const { remindersEnabled, reminderTimes, personalPrayers } = getState();

    // Fixed schedule: Divine Mercy Chaplet, 3am and 3pm, in whatever
    // timezone the device is actually in — not user-editable.
    if (remindersEnabled?.mercy) {
      for (const t of ['03:00', '15:00']) {
        const key = `mercy-${t}`;
        if (isDue(t, nowMin) && !alreadyFiredToday(key)) {
          markFiredToday(key);
          fire('Divine Mercy Chaplet', 'The Hour of Great Mercy. Time to pray the Chaplet of Divine Mercy.');
        }
      }
    }

    for (const [key, meta] of Object.entries(LITURGICAL_PRAYERS)) {
      const time = reminderTimes?.[key];
      if (remindersEnabled?.[key] && time && isDue(time, nowMin) && !alreadyFiredToday(key)) {
        markFiredToday(key);
        fire(meta.label, meta.body);
      }
    }

    for (const intention of personalPrayers || []) {
      const fireKey = `intention-${intention.id}`;
      if (
        intention.reminder_enabled &&
        intention.reminder_time &&
        !intention.completed &&
        isDue(intention.reminder_time, nowMin) &&
        !alreadyFiredToday(fireKey)
      ) {
        markFiredToday(fireKey);
        fire('Prayer Intention', intention.text);
      }
    }
  };

  const id = setInterval(tick, CHECK_INTERVAL_MS);
  return () => clearInterval(id);
}
