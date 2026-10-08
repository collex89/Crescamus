import { useEffect, useState } from 'react';

// Invites people using Crescamus in a browser to install it to their home
// screen, every so often rather than on every visit.
//
// Android / desktop Chrome hands the page a `beforeinstallprompt` event that
// opens the real install dialog; iPhone has no such API, so there the card
// shows the two taps instead (Share, then Add to Home Screen). Installing
// matters most on iPhone: web push -- prayer reminders -- only works there
// for Home Screen apps.

const STORAGE_KEY = 'crescamus-install-prompt';
const SHOW_AFTER_MS = 10_000;
const DAY_MS = 86_400_000;

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked -- worst case it asks again next visit.
  }
}

// Asked again 3 days after "Not now", backing off to 14 days once someone
// has said no three times.
function dueToShow() {
  const { installed, dismissedAt, dismissCount = 0 } = readState();
  if (installed) return false;
  if (!dismissedAt) return true;
  const waitDays = dismissCount >= 3 ? 14 : 3;
  return Date.now() - dismissedAt > waitDays * DAY_MS;
}

// Already running as the installed app: Home Screen web app, desktop/Android
// installed PWA, or the Play Store build (a TWA, launched from android-app://).
function runningInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

// iPhone/iPad browsers that actually have "Add to Home Screen" in their
// Share sheet: Safari, and Chrome for iOS. In-app browsers (Instagram,
// Facebook, ...) don't, so sending people looking for it there would just
// frustrate them.
function iosCanAddToHomeScreen() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  if (/FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|GSA\//.test(ua)) return false;
  return /Safari\//.test(ua);
}

// Chrome can fire beforeinstallprompt before React has mounted anything, so
// it's caught at module load (this file is imported before the first render)
// and handed to whichever component instance is listening.
let deferredInstallEvent = null;
const subscribers = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // our card replaces Chrome's own mini-infobar
    deferredInstallEvent = event;
    subscribers.forEach((notify) => notify());
  });
  window.addEventListener('appinstalled', () => {
    writeState({ ...readState(), installed: true });
    deferredInstallEvent = null;
    subscribers.forEach((notify) => notify());
  });
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export default function InstallPrompt({ enabled, aboveNav }) {
  const [mode, setMode] = useState(null); // 'install' | 'ios' | null
  const [installEventTick, setInstallEventTick] = useState(0);

  useEffect(() => {
    const notify = () => setInstallEventTick((n) => n + 1);
    subscribers.add(notify);
    return () => subscribers.delete(notify);
  }, []);

  useEffect(() => {
    if (!enabled || runningInstalled() || !dueToShow()) return;
    const timer = setTimeout(() => {
      if (deferredInstallEvent) setMode('install');
      else if (iosCanAddToHomeScreen()) setMode('ios');
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [enabled, installEventTick]);

  // Installed from elsewhere (Chrome's menu) while the card was up.
  useEffect(() => {
    if (readState().installed) setMode(null);
  }, [installEventTick]);

  if (!enabled || !mode) return null;

  const dismiss = () => {
    const { dismissCount = 0 } = readState();
    writeState({ ...readState(), dismissedAt: Date.now(), dismissCount: dismissCount + 1 });
    setMode(null);
  };

  const install = async () => {
    const event = deferredInstallEvent;
    if (!event) return dismiss();
    deferredInstallEvent = null; // each event can only prompt once
    event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      writeState({ ...readState(), installed: true });
      setMode(null);
    } else {
      dismiss();
    }
  };

  return (
    <div className={`install-prompt animate-slide-up ${aboveNav ? 'above-nav' : ''}`} role="dialog" aria-label="Install Crescamus">
      <img src="/icons/icon-192.png" alt="" className="install-prompt-icon" />
      <div className="install-prompt-body">
        <h4>Get the Crescamus app</h4>
        {mode === 'install' ? (
          <p>Install it on your home screen. It opens full screen, works offline, and sends your prayer reminders.</p>
        ) : (
          <p>
            Add it to your Home Screen to open it like an app and get prayer reminders. Tap{' '}
            <span className="install-prompt-share"><ShareIcon /> Share</span>, then <strong>Add to Home Screen</strong>.
          </p>
        )}
        <div className="install-prompt-actions">
          {mode === 'install' ? (
            <>
              <button type="button" className="install-prompt-secondary" onClick={dismiss}>Not now</button>
              <button type="button" className="install-prompt-primary" onClick={install}>Install</button>
            </>
          ) : (
            <button type="button" className="install-prompt-primary" onClick={dismiss}>Got it</button>
          )}
        </div>
      </div>
    </div>
  );
}
