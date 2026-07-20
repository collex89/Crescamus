// Two jobs:
// 1. Give the browser a ServiceWorkerRegistration to call showNotification()
//    on -- mobile browsers (Chrome/Android in particular) reject the direct
//    `new Notification()` constructor outside a service worker context, so
//    prayer reminders need this to fire on phones at all.
// 2. Basic offline support: same-origin static assets (the JS/CSS bundle,
//    icons, audio, lazily-loaded Bible chapter JSON, etc.) are cached as
//    they're fetched, so a repeat visit -- including fully offline -- can
//    still load the app shell and anything already read. This is a runtime
//    cache, not a build-time precache: nothing is fetched up front, it just
//    remembers what actually got used, which matches how the app already
//    lazy-loads Bible chapters rather than shipping the whole Bible at once.

const CACHE_NAME = 'crescamus-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave Supabase/API/font calls alone

  if (request.mode === 'navigate') {
    // Network-first for the page itself -- always prefer the live app over
    // a stale cached shell, but don't leave someone stranded if they're
    // offline.
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          // clone() has to happen in this same tick, before the response
          // body can be read by anything else -- a Response body can only
          // be consumed once, so cloning it after any await risks losing
          // the race against the browser already reading the original to
          // satisfy the page's own fetch.
          const responseClone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)));
          return response;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for everything else same-origin: answer from
  // cache instantly if we have it, and refresh the cache in the background
  // so the next visit gets whatever changed.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
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

// Background push delivery (see supabase/functions/send-reminder-pushes).
// If the app is already open in some tab, its own JS scheduler
// (src/lib/reminders.js) is already handling this reminder -- with a nicer
// alarm tone than a plain notification can give -- so showing this one too
// would just be a duplicate. Only show it when nothing is open.
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = { title: 'Crescamus', body: 'Time for prayer.' };
      try {
        if (event.data) payload = event.data.json();
      } catch {
        // Non-JSON push payload -- fall back to the default above.
      }

      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clientList.length > 0) return;

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      });
    })()
  );
});
