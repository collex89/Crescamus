import { useEffect, useState } from 'react';
import {
  readInstallState,
  writeInstallState,
  runningInstalled,
  iosCanAddToHomeScreen,
  canPromptInstall,
  promptInstall,
  useInstallEvents,
} from '../lib/install';

// Invites people using Crescamus in a browser to install it to their home
// screen, every so often rather than on every visit. (The "Get app" buttons
// in components/GetAppButton.jsx are the always-available version.)
//
// Android / desktop Chrome hands the page a `beforeinstallprompt` event that
// opens the real install dialog; iPhone has no such API, so there the card
// shows the two taps instead (Share, then Add to Home Screen). Installing
// matters most on iPhone: web push -- prayer reminders -- only works there
// for Home Screen apps.

const SHOW_AFTER_MS = 10_000;
const DAY_MS = 86_400_000;

// Asked again 3 days after "Not now", backing off to 14 days once someone
// has said no three times.
function dueToShow() {
  const { installed, dismissedAt, dismissCount = 0 } = readInstallState();
  if (installed) return false;
  if (!dismissedAt) return true;
  const waitDays = dismissCount >= 3 ? 14 : 3;
  return Date.now() - dismissedAt > waitDays * DAY_MS;
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
  const installEventTick = useInstallEvents();

  useEffect(() => {
    if (!enabled || runningInstalled() || !dueToShow()) return;
    const timer = setTimeout(() => {
      if (canPromptInstall()) setMode('install');
      else if (iosCanAddToHomeScreen()) setMode('ios');
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [enabled, installEventTick]);

  // Installed (or the event used up by a "Get app" button) while the card
  // was up.
  useEffect(() => {
    if (readInstallState().installed) setMode(null);
    else if (mode === 'install' && !canPromptInstall()) setMode(null);
  }, [installEventTick, mode]);

  if (!enabled || !mode) return null;

  const dismiss = () => {
    const state = readInstallState();
    writeInstallState({ ...state, dismissedAt: Date.now(), dismissCount: (state.dismissCount || 0) + 1 });
    setMode(null);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setMode(null);
    else dismiss();
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
