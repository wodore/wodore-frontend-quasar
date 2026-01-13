# Quasar PWA Update & Reload Behavior

**Implementation Task Summary**

## Status

- Status: implemented
- Last updated: 2026-01-14

## Objective

Ensure a Quasar-based PWA:

- Always loads the **latest `index.html` when online** (no “open twice” issue after deploy)
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
    > “A new version of this app is available.”
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

- `quasar.config.ts` uses `pwa.workboxMode: 'InjectManifest'`.
- `src-pwa/custom-service-worker.ts`:
  - `precacheAndRoute(self.__WB_MANIFEST)` + `cleanupOutdatedCaches()`.
  - Navigation requests use `NetworkFirst` with `cacheName: 'navigations'`.
  - `skipWaiting()` is only triggered via `SKIP_WAITING` message (user action).
- `src-pwa/register-service-worker.ts`:
  - Polls `registration.update()` every hour.
  - Detects waiting SW on `updatefound`, compares `WODORE_APP_VERSION` via message channel.
  - Prompts update for major version changes (or when version parsing fails).
- `src/boot/pwa-update.ts` + `src/composables/usePwaUpdate.ts`:
  - Shows a Quasar notify banner with Update/Later actions.
  - Update action posts `SKIP_WAITING`, then reloads once.

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

- First online visit after deploy loads the new version immediately
- Mid-session update shows a clear reload prompt
- Reload only happens after explicit user action
- Behavior is consistent across desktop browser, mobile browser, and installed PWA
