import { useState } from 'react';
import { useInstallPrompt } from '../lib/useInstallPrompt.js';

const KEY = 'lindol:install-dismissed';

// A dismissible bar inviting the user to install the PWA (home-screen + offline + push).
export default function InstallPrompt() {
  const { canInstall, installed, isIOS, promptInstall } = useInstallPrompt();
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
        <span>
          {isIOS
            ? 'Tap the Share button, then “Add to Home Screen” — for offline access + aftershock alerts.'
            : 'Add it to your home screen for offline access + aftershock alerts.'}
        </span>
      </div>
      {canInstall && <button className="install-btn" onClick={promptInstall}>Install</button>}
      <button className="install-x" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
