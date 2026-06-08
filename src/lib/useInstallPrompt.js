import { useEffect, useState } from 'react';

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// Captures the PWA install opportunity. On Android/Chrome we get a deferred
// `beforeinstallprompt` we can trigger from a button; iOS Safari has no such
// event, so we surface manual "Add to Home Screen" instructions instead.
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS = typeof navigator !== 'undefined'
    && /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();

  const promptInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  };

  return { canInstall: !!deferred, installed, isIOS, promptInstall };
}
