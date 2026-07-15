// Minimal service worker whose only job is to give the browser a
// ServiceWorkerRegistration to call showNotification() on. Mobile browsers
// (Chrome/Android in particular) reject the direct `new Notification()`
// constructor outside a service worker context, so prayer reminders need
// this to fire on phones at all. No caching or offline support — that's a
// separate, later concern.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
