import { useEffect, useState } from 'react';

// Shared install-to-home-screen state, used by both the occasional
// "Get the Crescamus app" card (components/InstallPrompt.jsx) and the
// always-there "Get app" buttons (components/GetAppButton.jsx).
//
// Android / desktop Chrome and Edge hand the page a `beforeinstallprompt`
// event that opens the browser's real install dialog -- that's the one-tap
// install. iPhone has no such API (Apple only allows Share > Add to Home
// Screen), and in-app browsers like Instagram's can't install anything, so
// those get step-by-step help instead.

export const INSTALL_STORAGE_KEY = 'crescamus-install-prompt';

export function readInstallState() {
  try {
    return JSON.parse(localStorage.getItem(INSTALL_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function writeInstallState(state) {
  try {
    localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked -- worst case we offer the install again.
  }
}

// Already running as the installed app: Home Screen web app, desktop/Android
// installed PWA, or the Play Store build (a TWA, launched from android-app://).
export function runningInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|LinkedInApp|GSA\/|Snapchat|TikTok|musical_ly|WhatsApp/;

function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// iPhone/iPad browsers that actually have "Add to Home Screen" in their
// Share sheet: Safari, and Chrome for iOS. In-app browsers (Instagram,
// Facebook, ...) don't, so sending people looking for it there would just
// frustrate them.
export function iosCanAddToHomeScreen() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  if (IN_APP_BROWSER.test(ua)) return false;
  return /Safari\//.test(ua);
}

// Which set of instructions to show when there's no one-tap install event.
export function installPlatform() {
  const ua = navigator.userAgent;
  if (isIOS()) return iosCanAddToHomeScreen() ? 'ios' : 'ios-other';
  if (/Android/.test(ua)) {
    if (IN_APP_BROWSER.test(ua) || /; wv\)/.test(ua)) return 'android-in-app';
    if (/SamsungBrowser/.test(ua)) return 'android-samsung';
    if (/Firefox/.test(ua)) return 'android-firefox';
    return 'android';
  }
  return 'desktop';
}

// Chrome can fire beforeinstallprompt before React has mounted anything, so
// it's caught at module load (this file is imported before the first render)
// and handed to whichever component is listening.
let deferredInstallEvent = null;
const subscribers = new Set();
const notifyAll = () => subscribers.forEach((notify) => notify());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // our own buttons replace Chrome's mini-infobar
    deferredInstallEvent = event;
    notifyAll();
  });
  window.addEventListener('appinstalled', () => {
    writeInstallState({ ...readInstallState(), installed: true });
    deferredInstallEvent = null;
    notifyAll();
  });
}

export function canPromptInstall() {
  return deferredInstallEvent !== null;
}

// Opens the browser's own install dialog. Resolves to 'accepted',
// 'dismissed', or 'unavailable' (no event to use -- show instructions).
export async function promptInstall() {
  const event = deferredInstallEvent;
  if (!event) return 'unavailable';
  deferredInstallEvent = null; // each event can only prompt once
  event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') {
    writeInstallState({ ...readInstallState(), installed: true });
  }
  notifyAll();
  return outcome;
}

// Re-renders the caller whenever an install event arrives, is used up, or
// the app gets installed.
export function useInstallEvents() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const notify = () => setTick((n) => n + 1);
    subscribers.add(notify);
    return () => subscribers.delete(notify);
  }, []);
  return tick;
}
