# Quasar PWA Update & Reload Behavior

**Implementation Task Summary**

## Status

- Status: ⚠️ **Partially Implemented - Update Notification Not Working**
- Last updated: 2026-01-14
- Version: 0.0.4

## Objective

Ensure a Quasar-based PWA:

- Always loads the **latest `index.html` when online** (no "open twice" issue after deploy)
- Handles **mid-session updates** gracefully by notifying the user and reloading **only on user action**

This task assumes the implementer is familiar with Quasar, Workbox, and Service Worker lifecycles.

## Scope of Work

### 1. Initial Load Freshness (Post-Deploy) ✅ COMPLETE

**Goal:**
The first visit after a new deployment should immediately use the latest app version.

**Status:** ✅ **WORKING**

- Navigation requests (`index.html`) use `NetworkFirst` strategy
- `index.html` is excluded from precache via `quasar.config.ts` → `extendInjectManifestOptions`
- Nginx sets `Cache-Control: no-store, no-cache` for `index.html`, `manifest.json`, and `sw.js`
- **Result**: Every page load fetches fresh `index.html` from network ✅

### 2. Mid-Session Update Handling ⚠️ INCOMPLETE

**Goal:**
Do not disrupt the user while interacting with the app. Notify user of updates and reload only on user action.

**Status:** ⚠️ **NOTIFICATION NOT SHOWING**

**Implemented:**

- Service worker detects version changes
- Version comparison logic (major/minor changes trigger notification)
- Update notification UI with "Update Now" and "Later" buttons
- Debug logging added for troubleshooting

**Issue:**

- Update notification does not appear when new version is deployed
- `registration.update()` call does not trigger `updatefound` event
- Service worker may not be detecting file changes correctly

**Testing:**

- Browser refresh works correctly - loads new version immediately ✅
- Manual `window.pwaDebug.checkUpdate()` added for testing
- Debug functions available: `window.pwaDebug.getInfo()`, `window.pwaDebug.checkUpdate()`

**Next Steps to Fix:**

1. Verify service worker file actually changes between deployments (byte-level)
2. Check if browser is caching the service worker file itself
3. Test with different versions to ensure version comparison works
4. May need to add cache-busting query parameter to service worker script tag
5. Consider using `workbox-window` for more reliable update detection

## Current Implementation

### Service Worker Configuration

**`quasar.config.ts`:**

- Uses `pwa.workboxMode: 'InjectManifest'`
- **Critical**: `extendInjectManifestOptions` excludes `index.html` from precache

  ```typescript
  extendInjectManifestOptions(options) {
    if (!options.globIgnores) {
      options.globIgnores = [];
    }
    options.globIgnores.push('index.html');
  }
  ```

**`src-pwa/custom-service-worker.ts`:**

- `precacheAndRoute(self.__WB_MANIFEST)` - precaches all assets EXCEPT `index.html`
- `cleanupOutdatedCaches()` - removes old cache versions
- Navigation requests use `NetworkFirst` with:
  - `cacheName: 'navigations'`
  - `networkTimeoutSeconds: 2` - falls back to cache after 2 seconds
- `skipWaiting()` is only triggered via `SKIP_WAITING` message (user action)
- **Debug logging added** for all message events

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
- **Debug logging added** for all lifecycle events
- **Debug functions exposed**: `window.pwaDebug.checkUpdate()`, `window.pwaDebug.getInfo()`

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

- Fixed nginx config file mapping (nginx-local.conf → local, nginx-proxy.conf → proxy)
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

- **Service Worker Update Detection Issues**
  <https://stackoverflow.com/questions/55179693/service-worker-update-does-not-work>
  <https://redfin.engineering/how-to-fix-the-refresh-button-on-progressive-web-apps-1b402a24f26c>

## Acceptance Criteria

- ✅ First online visit after deploy loads the new version immediately
- ❌ Mid-session update shows a clear reload prompt (NOT WORKING - browser refresh required)
- ✅ Reload only happens after explicit user action
- ✅ Behavior is consistent across desktop browser, mobile browser, and installed PWA
- ✅ Offline functionality maintained (NetworkFirst falls back to cache after 2s)

## Implementation Notes

### Why `index.html` Must Be Excluded from Precache ✅

The **precache takes precedence over navigation routes** in Workbox. If `index.html` is in the precache:

1. Service Worker serves precached version immediately
2. `NetworkFirst` navigation route is never reached
3. Nginx `Cache-Control` headers are ignored by service worker
4. User always sees stale `index.html` until service worker updates

**Solution**: Exclude `index.html` from precache via `quasar.config.ts` → `extendInjectManifestOptions` → add to `globIgnores`.

**Verification**: `grep -o '"url":"index.html"' dist/pwa/sw.js` should return nothing.

### Version Testing

To test update notifications:

```bash
# Change minor version (0.4.4 → 0.5.0)
echo "WODORE_APP_VERSION=0.5.0" >> .env.local
yarn build:pwa && yarn docker:build
```

Patch version changes (0.4.4 → 0.4.5) will **not** show notifications by design.

### Debug Functions

Available in browser console:

```javascript
// Check service worker state
window.pwaDebug.getInfo();

// Manually trigger update check
window.pwaDebug.checkUpdate();

// Or directly
navigator.serviceWorker.getRegistration().then(reg => reg.update());
```

## Troubleshooting

### Update Notification Not Appearing ❌

**Current Issue**: The `updatefound` event is not firing when a new service worker is deployed.

**Possible Causes:**

1. **Service worker file hasn't changed** - Browser compares byte-by-byte. If content is identical (even with same version number), no update is detected.
2. **Browser is caching service worker file** - Despite nginx headers, browser may cache the SW file itself
3. **Service worker scope issues** - SW may not be controlling the page correctly
4. **Update timing** - Update check may happen before new SW is deployed to server

**Diagnostic Steps:**

1. Check browser console for debug messages (look for `[PWA]` prefix)
2. Run `window.pwaDebug.getInfo()` to see SW states
3. Run `window.pwaDebug.checkUpdate()` to manually trigger update check
4. Check DevTools → Application → Service Workers:
   - Is there a waiting service worker?
   - What's the status of the active service worker?
5. Compare service worker file hashes between deployments:

   ```bash
   sha256sum dist/pwa/sw.js
   ```

**Workaround**: User can refresh the page to get updates (working correctly ✅)

### Stale Content Still Showing ✅ FIXED

**Solution**: Verify `index.html` not in precache:

```bash
grep -o '"url":"index.html"' dist/pwa/sw.js
# Should return nothing
```

Check nginx headers:

```bash
curl -I http://localhost:9000/index.html
# Should include: Cache-Control: no-store, no-cache, ...
```

### Offline Not Working ✅ WORKING

**Verification**:

- Check `NetworkFirst` is registered: DevTools → Application → Service Workers → Inspect
- Verify cache has entries: DevTools → Application → Cache Storage
- Check `networkTimeoutSeconds` is set (2s)

## Future Improvements

### Critical (to fix update notification)

1. **Investigate why `updatefound` doesn't fire**:
   - Add logging to confirm SW file actually changes between deployments
   - Consider adding cache-busting to SW script tag: `sw.js?v=${hash}`
   - Test with `workbox-window` library for more reliable update detection
   - Check if service worker registration scope is correct

2. **Alternative update detection**:
   - Poll server for version endpoint periodically
   - Use ETag/Last-Modified headers on index.html
   - Consider using `navigator.serviceWorker.addEventListener('controllerchange')`

3. **Simplify version comparison**:
   - Show notification for ANY version change (not just major/minor)
   - Add option to configure update notification behavior

### Optional

- Consider notifying on patch versions for critical security updates
- Add "What's new" changelog in update notification
- Implement "Reload after X minutes of inactivity" option
- Add analytics to track update acceptance rates
- Consider using `workbox-window` for more fine-grained control
- Add skip-waiting logic for critical updates only

## Files Modified

1. `quasar.config.ts` - Added `extendInjectManifestOptions` to exclude `index.html` from precache
2. `src-pwa/custom-service-worker.ts` - Added debug logging for message events
3. `src-pwa/register-service-worker.ts` - Added debug logging and debug functions
4. `docker/entrypoint.sh` - Fixed nginx config mapping and added `*.json` to patterns
5. `_work/260113_pwa_caching.md` - This documentation file

## Known Issues

1. **Update notification not appearing** - Users must refresh browser to see updates (mitigated by fact that refresh works correctly)
2. **Service worker update detection unreliable** - Browser may not detect SW file changes
3. **Version comparison logic may be too strict** - Only shows notification for major/minor changes

## Related Issues

- Docker build fixed (nginx config mapping, JSON variable replacement)
- Service worker excludes `index.html` from precache
- Debug logging added throughout PWA lifecycle
