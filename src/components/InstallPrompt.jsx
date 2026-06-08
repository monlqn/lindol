import { useState } from 'react';
import { useInstallPrompt } from '../lib/useInstallPrompt.js';

const KEY = 'lindol:install-dismissed';

// A dismissible bar inviting the user to install the PWA (home-screen + offline + push).
export default function InstallPrompt() {
  const { canInstall, installed, isIOS, iosNeedsSafari, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  });

  if (installed || dismissed) return null;
  if (!canInstall && !isIOS) return null; // nothing useful to offer (e.g. desktop non-Chrome)

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="install-bar">
      <div className="install-txt">
        <b>Install LINDOL</b>
        {isIOS ? (
          iosNeedsSafari ? (
            <span>Open this page in <b>Safari</b>, then Share → <b>“Add to Home Screen.”</b> Other iPhone browsers can’t install it.</span>
          ) : (
            <span>
              Tap{' '}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" style={{ verticalAlign: '-2px' }}>
                <path d="M12 16V4M8 8l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
              </svg>{' '}
              <b>Share</b>, then <b>“Add to Home Screen”</b> — for offline access + alerts.
            </span>
          )
        ) : (
          <span>Add it to your home screen for offline access + aftershock alerts.</span>
        )}
      </div>
      {canInstall && <button className="install-btn" onClick={promptInstall}>Install</button>}
      <button className="install-x" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
