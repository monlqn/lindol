import { useEffect, useState } from 'react';

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

// Captures the PWA install opportunity and detects the platform so the UI can show
// the right guidance:
//  - Android / desktop Chrome/Edge: a real `beforeinstallprompt` we can trigger (canInstall).
//  - iOS Safari: manual "Add to Home Screen" instructions (isIOS).
//  - iOS non-Safari (Chrome/Firefox/Edge): must switch to Safari first (iosNeedsSafari),
//    because only installed-Safari supports a real PWA + push on iOS.
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

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOSDevice = /iphone|ipad|ipod/i.test(ua);
  const isIOS = isIOSDevice && !isStandalone();
  const iosNeedsSafari = isIOS && /(crios|fxios|edgios)/i.test(ua); // iOS but not Safari

  const promptInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
  };

  return { canInstall: !!deferred, installed, isIOS, iosNeedsSafari, promptInstall };
}
