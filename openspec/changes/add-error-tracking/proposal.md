## Why

Frontend failures in production are invisible: the PWA and the Capacitor
Android app run on user devices with no telemetry, so render crashes,
unhandled promise rejections, and boot-time errors are only ever reported
anecdotally. The backend just added Sentry-protocol error tracking
(openspec `add-error-tracking`, PR #335) — the frontend should mirror it:
same DSN-gated activation, same release/environment attribution, same
privacy-safe defaults, same vendor-neutral stance (the DSN decides the
destination — sentry.io or Better Stack — never a code change).

## What Changes

- **`@sentry/vue` error tracking** for the Quasar app: unhandled Vue
  errors (via the app error handler), `window.onerror` and
  `unhandledrejection` are captured with component/route context.
- **Activation is DSN-gated**: no `WODORE_SENTRY_DSN` (runtime env) →
  `Sentry.init` is never called and no telemetry leaves the browser.
  Development, test, CI, and PR previews set no DSN and are unaffected.
- **Release and environment tagging** from values the build/deploy
  already produces: `release = WODORE_GIT_HASH` (commit hash baked at
  build), `environment = WODORE_ENV` (production/staging/…), package
  semver as an `app_version` event tag — one release scheme across
  environments, mirroring the backend exactly.
- **Runtime-configurable through the existing env plumbing**: the DSN is
  read via `services/runtimeEnv.ts` (`getEnv`), so docker deployments
  swap it per environment at container start (`/env.js` + replace_vars,
  no rebuild) and Capacitor builds bake it inline at build time. One code
  path covers web and Android.
- **Performance tracing is opt-in, errors-only by default**:
  `WODORE_SENTRY_TRACES_SAMPLE_RATE` (runtime env, default `0`) can
  enable pageload/navigation transactions later — the Vue Router tracing
  integration is only wired when the rate is > 0.
- **Privacy-safe defaults**: `sendDefaultPii: false` (no user identities,
  IPs, cookies, or request bodies attached to events).

Non-goals: service-worker-side error capture (the SW is a separate
JS context; page-level hooks cannot see it), sourcemap upload to a
vendor (needs the vendor decision + CI secret; tracked as a rollout
task), session replay / RUM, replacing Umami page analytics, any backend
change.

## Capabilities

### New Capabilities

- `error-tracking`: frontend error tracking lifecycle — activation
  gating, release/environment attribution, event capture semantics,
  performance-tracing opt-in with sampling, and PII defaults.

### Modified Capabilities

(none)

## Impact

- **Dependencies**: add `@sentry/vue` (runtime dependency; pnpm-lock
  updated).
- **Boot**: new `src/boot/sentry.ts`, first entry in the boot list
  (client-only), so errors raised by later boot files are captured —
  mirroring the backend's "sentry first in the settings include list".
- **Configuration**: new env vars `WODORE_SENTRY_DSN` (activation) and
  `WODORE_SENTRY_TRACES_SAMPLE_RATE` (optional, default `0`), plumbed
  through `quasar.config.ts` (`build.env`), `public/env.js`
  (`@@VAR@@` placeholders), `index.html` (dev/Capacitor inline EJS) and
  typed in `src/env.d.ts`. `.env` needs the empty-default keys added so
  replace_vars knows them (agent sessions cannot write the protected
  `.env` — user adds two lines).
- **Runtime**: works in PWA/docker (runtime env.js), dev and Capacitor
  builds (EJS inline); SSR server-side stays uncovered (client-only
  boot — the deployed target is PWA/docker).
- **No changes** to: UI components, routing behavior, API usage, the
  service worker, or the Umami analytics setup.
