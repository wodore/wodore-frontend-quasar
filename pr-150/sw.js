// Self-destructing service worker: the legacy preview SW at this scope
// served the OLD cached app shell for every /pr-150/<hash>/ navigation.
// This replacement unregisters itself and wipes all caches, then the
// per-commit builds (each with their own narrow scope) serve directly.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.all(clients.map((c) => c.navigate(c.url)));
    })()
  );
});
