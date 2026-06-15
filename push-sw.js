/* global self, clients */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Aftershock reported';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'lindol-aftershock',
    renotify: true,
    // As attention-grabbing as a web app is allowed to be:
    requireInteraction: true,                       // stays on the lock screen until dismissed
    vibrate: [600, 200, 600, 200, 600, 200, 900],   // insistent buzz pattern
    silent: false,                                  // play the notification sound
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever open our own origin: don't let a push payload (e.g. if the VAPID key
  // ever leaked) turn a notification tap into an open-redirect to an arbitrary site.
  let url = '/';
  try {
    const u = new URL(event.notification.data?.url || '/', self.location.origin);
    if (u.origin === self.location.origin) url = u.href;
  } catch { /* keep the safe default */ }
  event.waitUntil(clients.openWindow(url));
});
