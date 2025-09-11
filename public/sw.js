// Kill-switch Service Worker: unregisters itself and clears caches
self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // Clear all caches
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (e) {}
    try {
      await self.clients.claim();
      // Unregister this service worker
      await self.registration.unregister();
      // Refresh open pages to detach from SW
      const clientList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientList) {
        client.navigate(client.url);
      }
    } catch (e) {}
  })());
});

// Do not intercept any requests
self.addEventListener('fetch', () => {});

// No-op for push/message events
self.addEventListener('push', () => {});
self.addEventListener('message', () => {});
