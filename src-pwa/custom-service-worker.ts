/*
 * This file (which will be your service worker)
 * is picked up by the build system ONLY if
 * quasar.config file > pwa > workboxMode is set to "InjectManifest"
 */

declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & { skipWaiting: () => void };

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

const SW_APP_VERSION = process.env.WODORE_APP_VERSION || '';

// NOTE: We don't call skipWaiting() here to avoid disrupting user sessions
// The new SW will wait until the user triggers a reload
clientsClaim();

// Use with precache injection
// Note: index.html is excluded from precache via quasar.config.ts > extendInjectManifestOptions
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// Handle navigation requests with NetworkFirst strategy
// This ensures we always get the latest index.html when online
if (process.env.MODE !== 'ssr' || process.env.PROD) {
  // NetworkFirst for navigation requests (index.html)
  // Online: Try network first, fall back to cache
  // Offline: Use cache immediately
  const networkFirstHandler = new NetworkFirst({
    cacheName: 'navigations',
    networkTimeoutSeconds: 2, // After 2 seconds, fall back to cache
  });

  const navigationRoute = new NavigationRoute(networkFirstHandler, {
    denylist: [
      new RegExp(process.env.PWA_SERVICE_WORKER_REGEX),
      /workbox-(.)*\.js$/,
    ],
  });

  registerRoute(navigationRoute);
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log(
      '[SW] User clicked "Update now" - skipping waiting and activating',
    );
    // User has clicked "Update now" - skip waiting and activate
    self.skipWaiting();
    return;
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    console.log('[SW] Version requested, sending:', SW_APP_VERSION);
    event.ports?.[0]?.postMessage({ version: SW_APP_VERSION });
  }
});
