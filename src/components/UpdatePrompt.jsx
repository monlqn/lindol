import { useRegisterSW } from 'virtual:pwa-register/react';

// Shows an "Update" button when a newer build has been deployed but the installed
// app is still running a cached version (PWA prompt-on-update).
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Poll for a newer build every 60s so the Update button appears while the app
    // is open - no force-close/reopen needed.
    onRegisteredSW(_swUrl, registration) {
      if (registration) setInterval(() => registration.update(), 60_000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-bar" role="status">
      <span>A new version of LINDOL is available.</span>
      <button className="update-btn" onClick={() => updateServiceWorker(true)}>Update</button>
      <button className="update-x" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">✕</button>
    </div>
  );
}
