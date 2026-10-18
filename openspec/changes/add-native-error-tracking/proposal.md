## Why

The frontend error tracking shipped in PR #292 is **JS-only**: it sees
errors inside the Capacitor WebView and nothing else. On Android, a
whole class of failures is invisible to it — native crashes in Capacitor
plugin Java/Kotlin code, crashes in `MainActivity` or the Android
runtime, startup crashes before the WebView finishes loading the JS,
ANRs (app not responding), and events lost because the app was killed
while offline (the browser SDK's queue is in-memory). The `platform`
tag from PR #297 gives the triage dimension; once it shows users
dying without a matching WebView event, the native SDK is what closes
that blind spot.

Deferred deliberately (decision 2026-10): the JS-only integration has
no field data yet, and the native SDK is the heaviest possible step —
this change is the ready-to-implement proposal for when the trigger
criteria (design.md D6) are met.

## What Changes

- **`@sentry/capacitor`** (wrapper over the native Android/iOS Sentry
  SDKs) initialized **on Capacitor builds only**, forwarding to
  `@sentry/vue` so Vue component/route context is preserved:
  `Sentry.init(options, SentryVue.init)`. The web/PWA path stays on
  plain `@sentry/vue`, byte-identical behavior.
- **Own Sentry project + DSN** (`WODORE_SENTRY_NATIVE_DSN`, baked at
  APK build time): mixed native events and the Play Store release
  cadence justify the separation — this is the one case where a third
  project earns its keep (see the PR #292 discussion). Web keeps
  `WODORE_SENTRY_DSN` untouched.
- **New native capabilities**: native crash capture with stacks,
  startup crashes, ANR detection, offline event persistence (disk
  cache, sent on restart), release health (crash-free sessions/users
  per Play rollout), richer device context.
- **Symbolication plumbing in CI**: ProGuard/R8 mapping upload for
  native stacks, and JS sourcemap upload for the APK's WebView bundle
  (scraping cannot reach the APK's device-internal origin — the known
  Android exception to the published-maps strategy from PR #296).
- **Same privacy posture**: the v10-parity `dataCollection` recipe and
  no-`setUser` rule reapplied to the wrapper init.

Non-goals: iOS (the app ships Android only), session replay, any change
to the web/PWA integration or its published-sourcemaps strategy,
backend changes.

## Capabilities

### New Capabilities

- `error-tracking` (extension): native crash/startup/ANR capture,
  offline persistence, release health, and the native-project split
  for Capacitor builds.

### Modified Capabilities

(none — web behavior is untouched; the delta adds requirements to the
existing `error-tracking` spec.)

## Impact

- **Dependencies**: `@sentry/capacitor` — note the version coupling:
  4.4.0 peer-depends on `@sentry/vue` 10.x while we ship 11.8; either
  a compatible wrapper release is required or `@sentry/vue` is pinned
  down at adoption time (design.md D1).
- **Code**: `src/services/sentry.ts` grows a conditional native init
  path (`Capacitor.isNativePlatform()` → dynamic import, so the web
  bundle never carries the native SDK); `src/env.d.ts`, EJS inline env
  entries for the native DSN.
- **Build**: gradle picks up the Sentry native dependency; CI gains
  ProGuard-mapping and APK-sourcemap upload steps (new secrets).
- **APK size**: ~1–2 MB native SDK growth.
- **Ops**: third Sentry project at the vendor (or the Better Stack
  equivalent), its own alert routing.
