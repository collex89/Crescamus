import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  readInstallState,
  runningInstalled,
  canPromptInstall,
  promptInstall,
  installPlatform,
  useInstallEvents,
} from '../lib/install';

// The always-available "Get app" button (header when signed in, welcome
// screen when not). Where the browser allows it -- Chrome, Edge and Samsung
// Internet on Android, Chrome/Edge on desktop -- one tap opens the real
// install dialog. Everywhere else (iPhone, in-app browsers like Instagram's,
// or Chrome when it isn't offering an install right now) it opens a sheet
// with the exact taps for that browser.

function DownloadIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

const Key = ({ children }) => <span className="get-app-key">{children}</span>;

function siteUrl() {
  return `${window.location.origin}/`;
}

// Android only: asks the system to open this page in Chrome, which (unlike
// Instagram's or Facebook's built-in browser) can install it.
function openInChromeHref() {
  return `intent://${window.location.host}/#Intent;scheme=https;package=com.android.chrome;end`;
}

function instructionsFor(platform) {
  switch (platform) {
    case 'ios':
      return {
        title: 'Add Crescamus to your Home Screen',
        intro: 'iPhone installs web apps from the Share menu. It takes three taps:',
        steps: [
          <>Tap the <Key><ShareIcon /> Share</Key> button. In Safari it's at the bottom of the screen; in Chrome it's at the top right.</>,
          <>Scroll down and tap <Key>Add to Home Screen</Key></>,
          <>Tap <Key>Add</Key>. Crescamus appears on your Home Screen like any other app.</>,
        ],
      };
    case 'ios-other':
      return {
        title: 'Open Crescamus in Safari first',
        intro: "This browser can't add apps to your Home Screen, but Safari can.",
        steps: [
          <>If you're in Instagram or Facebook, tap <Key>•••</Key> at the top and choose <Key>Open in browser</Key>. Otherwise copy the link below and paste it into Safari.</>,
          <>In Safari, tap <Key><ShareIcon /> Share</Key>, then <Key>Add to Home Screen</Key></>,
        ],
        copyLink: true,
      };
    case 'android-in-app':
      return {
        title: 'Open Crescamus in Chrome',
        intro: "This app's built-in browser can't install apps. Open the page in Chrome and you can install it in one tap.",
        steps: [
          <>Tap <Key>Open in Chrome</Key> below.</>,
          <>If nothing happens, tap <Key><DotsIcon /></Key> at the top and choose <Key>Open in Chrome</Key> or <Key>Open in browser</Key></>,
          <>In Chrome, tap <Key>Get app</Key> again.</>,
        ],
        openInChrome: true,
        copyLink: true,
      };
    case 'android-samsung':
      return {
        title: 'Install Crescamus',
        intro: 'In Samsung Internet:',
        steps: [
          <>Tap the <Key>☰</Key> menu at the bottom right.</>,
          <>Tap <Key>Add page to</Key>, then <Key>Home screen</Key></>,
        ],
      };
    case 'android-firefox':
      return {
        title: 'Install Crescamus',
        intro: 'In Firefox:',
        steps: [
          <>Tap the <Key><DotsIcon /></Key> menu.</>,
          <>Tap <Key>Add app to Home screen</Key> (or <Key>Install</Key>)</>,
        ],
      };
    case 'android':
      return {
        title: 'Install Crescamus',
        intro: 'Your browser can install it from its menu:',
        steps: [
          <>Tap the <Key><DotsIcon /></Key> menu at the top right.</>,
          <>Tap <Key>Install app</Key> or <Key>Add to Home screen</Key></>,
          <>Tap <Key>Install</Key>. Crescamus appears with your other apps.</>,
        ],
      };
    default:
      return {
        title: 'Get Crescamus on your phone',
        intro: 'Open crescamus.app on your phone and tap Get app. To install it on this computer instead:',
        steps: [
          <>In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose <Key>Install Crescamus</Key></>,
          <>In Safari on a Mac, choose <Key>File</Key> then <Key>Add to Dock</Key></>,
        ],
        copyLink: true,
      };
  }
}

function InstallHelpSheet({ onClose }) {
  const [copied, setCopied] = useState(false);
  const help = instructionsFor(installPlatform());

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl());
      setCopied(true);
    } catch {
      window.prompt('Copy this link:', siteUrl());
    }
  };

  return createPortal(
    <div className="get-app-overlay animate-fade-in" onClick={onClose}>
      <div className="get-app-sheet animate-slide-up" role="dialog" aria-modal="true" aria-label={help.title} onClick={(e) => e.stopPropagation()}>
        <div className="get-app-sheet-header">
          <img src="/icons/icon-192.png" alt="" className="get-app-sheet-icon" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <h3>{help.title}</h3>
        <p className="get-app-intro">{help.intro}</p>
        <ol className="get-app-steps">
          {help.steps.map((step, i) => (
            <li key={i}><span className="get-app-step-num">{i + 1}</span><span>{step}</span></li>
          ))}
        </ol>
        <div className="get-app-sheet-actions">
          {help.openInChrome && (
            <a className="get-app-primary" href={openInChromeHref()}>Open in Chrome</a>
          )}
          {help.copyLink && (
            <button type="button" className={help.openInChrome ? 'get-app-secondary' : 'get-app-primary'} onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          )}
          {!help.openInChrome && !help.copyLink && (
            <button type="button" className="get-app-primary" onClick={onClose}>Got it</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function GetAppButton({ variant = 'header' }) {
  const [helpOpen, setHelpOpen] = useState(false);
  useInstallEvents(); // re-render when an install event arrives or is used

  // Hidden inside the installed app. Also hidden after an install from this
  // browser -- unless Chrome is offering the install again, which it only
  // does once the app has been removed.
  if (runningInstalled()) return null;
  if (readInstallState().installed && !canPromptInstall()) return null;

  const handleClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable') setHelpOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className={variant === 'welcome' ? 'get-app-welcome-btn' : 'get-app-header-btn'}
        onClick={handleClick}
        aria-label="Get the Crescamus app"
      >
        <DownloadIcon size={variant === 'welcome' ? 18 : 16} />
        {variant === 'welcome' ? (
          <span>Get the app</span>
        ) : (
          <span className="get-app-header-label"><span className="get-app-header-get">Get </span><span className="get-app-header-app">app</span></span>
        )}
      </button>
      {helpOpen && <InstallHelpSheet onClose={() => setHelpOpen(false)} />}
    </>
  );
}
