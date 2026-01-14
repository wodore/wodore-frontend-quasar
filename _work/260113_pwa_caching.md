# Quasar PWA Update & Reload Behavior

**Implementation Task Summary**

## Status

- Status: ✅ **Implemented & Tested**
- Last updated: 2026-01-14
- Version: 0.4.4

## Objective

Ensure a Quasar-based PWA:

- Always loads the **latest `index.html` when online** (no "open twice" issue after deploy)
- Handles **mid-session updates** gracefully by notifying the user and reloading **only on user action**

This task assumes the implementer is familiar with Quasar, Workbox, and Service Worker lifecycles.

## Scope of Work

### 1. Initial Load Freshness (Post-Deploy)

**Goal:**
The first visit after a new deployment should immediately use the latest app version.

**Conceptual requirements:**

- Treat **navigation requests (`index.html`) as network-first**
  - Online: fetch from network (ETag/304 revalidation is sufficient)
  - Offline: fall back to cached app shell
- Avoid cache-first or precache-only handling for navigations
- Static assets can remain aggressively cached

**Expected result:**

- No need to open the PWA twice to see updates
- Old Service Worker presence is acceptable; reloads are allowed

### 2. Mid-Session Update Handling

**Goal:**
Do not disrupt the user while interacting with the app.

**Conceptual requirements:**

- Detect when a **new Service Worker is installed and waiting**
- Display a non-intrusive UI notification:
  - Example text:
    > "A new version of this app is available."
- Provide a **Reload / Update** button
- On user action:
  1. Activate the waiting Service Worker
  2. Reload the page exactly once

**Constraints:**

- No automatic reloads
- No background reloads
- Reload must be user-initiated

### 3. Implementation Guidelines

- Prefer **Quasar PWA configuration + Workbox options** (`GenerateSW`) where possible
- Use `register-service-worker.js` for lifecycle handling and UI integration
- Introduce a **custom Service Worker (`InjectManifest`) only if**:
  - Network-first navigation behavior cannot be reliably achieved via config
  - More explicit control over navigation routing is required

## Current Implementation

### Service Worker Configuration

**`quasar.config.ts`:**

- Uses `pwa.workboxMode: 'InjectManifest'`
- **Critical**: `extendInjectManifestOptions` excludes `index.html` from precache
  - This ensures `index.html` is handled by `NetworkFirst` navigation route instead
  - Without this, precached `index.html` would always be served from cache

**`src-pwa/custom-service-worker.ts`:**

- `precacheAndRoute(self.__WB_MANIFEST)` - precaches all assets EXCEPT `index.html`
- `cleanupOutdatedCaches()` - removes old cache versions
- Navigation requests use `NetworkFirst` with:
  - `cacheName: 'navigations'`
  - `networkTimeoutSeconds: 2` - falls back to cache after 2 seconds
- `skipWaiting()` is only triggered via `SKIP_WAITING` message (user action)

### Update Detection & Notifications

**`src-pwa/register-service-worker.ts`:**

- Polls `registration.update()` every hour
- Detects waiting SW on `updatefound`, compares `WODORE_APP_VERSION` via message channel
- **Version comparison logic**:
  - Major version change (0.x → 1.x) → Always notify
  - Minor version change (0.4.x → 0.5.x) → Notify (because major is 0)
  - Patch version change (0.4.4 → 0.4.5) → No notification
  - Failed version parsing → Notify (safe default)
- Waits 2 seconds before showing notification (lets user settle)

**`src/boot/pwa-update.ts` + `src/composables/usePwaUpdate.ts`:**

- Shows a Quasar notify banner with Update/Later actions
- Update action posts `SKIP_WAITING`, then reloads once
- Notification persists until user acts (timeout: 0)

### Nginx Configuration

**`docker/nginx-default.conf`:**

- `index.html`: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0`
- `manifest.json`: Same no-cache headers
- `service-worker.js`: Same no-cache headers
- Assets in `/assets/`: Aggressive caching (1 year, immutable)
- Workbox files: Aggressive caching (1 year, immutable)

**Multi-layer protection:**

1. Nginx prevents browser HTTP cache
2. Service Worker `NetworkFirst` respects HTTP cache headers
3. Service Worker never precaches `index.html`

### Docker Configuration

**`docker/entrypoint.sh`:**

- Fixed nginx config file mapping (nginx-local.conf → local)
- Added `*.json` to file patterns for variable replacement
- This ensures `manifest.json` placeholders are replaced at runtime

## Out of Scope / Non-Goals

- No need to preserve old sessions across reloads
- No need to support seamless hot-swapping without reload
- No requirement to prevent SW reload during critical flows beyond user confirmation

## Reference Documentation

- **Quasar PWA Guide**
  <https://quasar.dev/quasar-cli-vite/developing-pwa/introduction>

- **Workbox Navigation & Runtime Caching**
  <https://developer.chrome.com/docs/workbox/modules/workbox-routing/>
  <https://developer.chrome.com/docs/workbox/modules/workbox-strategies/>

- **Service Worker lifecycle & update flow**
  <https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers>
  <https://developer.chrome.com/docs/workbox/service-worker-lifecycle/>

## Acceptance Criteria

- ✅ First online visit after deploy loads the new version immediately
- ✅ Mid-session update shows a clear reload prompt (for major/minor version changes)
- ✅ Reload only happens after explicit user action
- ✅ Behavior is consistent across desktop browser, mobile browser, and installed PWA
- ✅ Offline functionality maintained (NetworkFirst falls back to cache after 2s)

## Implementation Notes

### Why `index.html` Must Be Excluded from Precache

The **precache takes precedence over navigation routes** in Workbox. If `index.html` is in the precache:

1. Service Worker serves precached version immediately
2. `NetworkFirst` navigation route is never reached
3. Nginx `Cache-Control` headers are ignored by service worker
4. User always sees stale `index.html` until service worker updates

**Solution**: Exclude `index.html` from precache via `quasar.config.ts` → `extendInjectManifestOptions` → add to `globIgnores`.

### Version Testing

To test update notifications:

```bash
# Change minor version (0.4.4 → 0.5.0)
echo "WODORE_APP_VERSION=0.5.0" >> .env.local
yarn build:pwa && yarn docker:build
```

Patch version changes (0.4.4 → 0.4.5) will **not** show notifications by design.

### Update Detection Mechanisms

1. **Automatic**: Browser checks `sw.js` for byte changes on:

   - Page navigation
   - Focus events (browser-dependent)
   - Periodic checks (browser-dependent, typically ~24h)

2. **Manual**: `setInterval` every hour calls `registration.update()`

3. **User-triggered**: Developer can call `navigator.serviceWorker.ready.then(reg => reg.update())`

## Troubleshooting

### No Update Notification Appearing

- Check if version actually changed: `grep WODORE_APP_VERSION .env`
- Patch version changes don't trigger notifications (by design)
- Clear browser devtools: Application → Service Workers → Unregister
- Check browser console for errors

### Stale Content Still Showing

- Verify `index.html` not in precache: `grep -o '"url":"index.html"' dist/pwa/sw.js`
- Check nginx headers: `curl -I http://localhost:9000/index.html`
- Verify service worker active: DevTools → Application → Service Workers

### Offline Not Working

- Check `NetworkFirst` is registered: DevTools → Application → Service Workers → Inspect
- Verify cache has entries: DevTools → Application → Cache Storage
- Check `networkTimeoutSeconds` is set (2s)

## Future Improvements (Optional)

- Consider notifying on patch versions for critical security updates
- Add "What's new" changelog in update notification
- Implement "Reload after X minutes of inactivity" option
- Add analytics to track update acceptance rates
- Consider using `workbox-window` for more fine-grained control
