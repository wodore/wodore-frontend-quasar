## Context

The backend added Sentry-protocol error tracking (openspec
`add-error-tracking`, PR #335): DSN-gated `sentry_sdk.init`, release =
`GIT_HASH`, environment from deploy config, semver as `app_version` tag,
`send_default_pii=False`, tracing opt-in via `SENTRY_TRACES_SAMPLE_RATE`.
That change explicitly listed "frontend error tracking / RUM for the
Quasar app" as a separate change — this is it.

The frontend today has no error telemetry at all: uncaught errors land in
the browser console (or silently in a released Android WebView) and are
never aggregated. The only analytics is Umami page tracking
(`WdAnalytics.vue`, gated on `WODORE_UMAMI_WEBSITE_ID`), which has no
error concept.

Relevant existing infrastructure this builds on:

- **Runtime env plumbing** (`services/runtimeEnv.ts`): `getEnv()` prefers
  `window.__WODORE_RUNTIME_ENV__` — set by `/env.js` (`@@VAR@@`
  placeholders rewritten by `replace_vars` at container start, served
  no-store) in docker builds, or inline-EJS-baked in index.html for
  dev/Capacitor builds — and falls back to build-time Vite defines
  (`quasar.config.ts` `build.env`). One accessor therefore covers
  per-environment docker config (no rebuild) and baked Capacitor config
  (build-time).
- **Build identity**: `quasar.config.ts` already computes
  `WODORE_GIT_HASH` (docker `--build-arg GIT_HASH` / `git rev-parse`)
  and `WODORE_APP_VERSION` (package semver) as build-time defines.
- **Boot files** (`src/boot/`) run in listed order before the app mounts,
  receiving `{ app, router }` — the natural init hook for a Vue SDK.

## Goals / Non-Goals

**Goals:**

- Capture unhandled frontend errors (Vue render/lifecycle errors,
  `window.onerror`, `unhandledrejection`) with component and route
  context, in the web/PWA deployment and the Capacitor Android app.
- Mirror the backend's semantics exactly: DSN-gated activation,
  release = commit hash, environment attribution, `app_version` tag,
  PII-off, vendor-neutral DSN, rollback by unsetting the DSN.
- Keep dev/test/CI/preview telemetry-free with zero behavior change.
- Errors-only by default; performance tracing strictly opt-in via a
  runtime env var (default `0`).

**Non-Goals:**

- Service-worker-side capture (separate JS context; page-level hooks
  cannot see SW errors).
- SSR server-side capture (the deployed target is PWA/docker; the boot
  is client-only).
- Sourcemap upload to a vendor (deferred to the vendor rollout — needs
  CI secret + vendor decision; see Open Questions).
- Session replay / RUM, release health, user identification, replacing
  Umami analytics.
- Any backend change.

## Decisions

**D1 — SDK: `@sentry/vue` (official Vue SDK), v11.**
Alternatives: `@sentry/browser` (no Vue awareness — no component names,
no app error handler, weaker context) or a hand-rolled `window.onerror`
forwarder (no dedup, breadcrumbs, release tagging, or vendor tooling).
The Vue SDK hooks `app.config.errorHandler`, attaches component/route
context and works in plain browser + WebView without framework-specific
setup. Version: `^11` (current 11.8.0), matching the backend's ">=2.72,<3"
spirit of a pinned major.

**D2 — Init in a boot file, first in the boot list, client-only.**
`src/boot/sentry.ts` wraps a service function (mirrors the locale
service/boot split: logic testable without Quasar). The boot list order
becomes `sentry` → `i18n` → … so the global error hooks are installed
before later boot files run — the frontend equivalent of the backend
loading its sentry settings component FIRST. `{ server: false }` keeps
SSR builds safe (the SDK is browser-only; an SSR server would need
`@sentry/node`, out of scope). Limitation accepted: module-evaluation
errors that occur _before_ the boot phase are not captured — boot is the
earliest app-level hook Quasar offers; global hooks installed there still
catch everything from that point on.

**D3 — Activation gate reads the runtime env (`WODORE_SENTRY_DSN`).**
No DSN → `Sentry.init` is never called; nothing loads, nothing leaves the
browser. The DSN is read via `getEnv()`, i.e. runtime `/env.js` in docker
(swappable per environment at container start, no rebuild) and EJS-baked
inline for dev/Capacitor builds (baked at build time). Namespaced with
the `WODORE_` prefix like every other frontend var (the backend's
`SENTRY_DSN` lives in a different process/config domain — reusing the
bare name would invite accidental cross-contamination of .env files).
Unrewritten `@@…@@` placeholders and empty strings are treated as "no
DSN" by `getEnv`'s `isUsable` — a misconfigured container degrades to
telemetry-free, never to a broken app.

**D4 — Attribution: `release = WODORE_GIT_HASH`, `environment =
WODORE_ENV`, `app_version` tag.**
Same scheme as the backend: the commit hash is deploy-exact (docker
build arg; Capacitor release builds build from the tagged commit), one
release scheme across environments so cross-env correlation works.
`WODORE_ENV` (development/staging/preview/production) is a runtime value
in docker and baked for Capacitor. The package semver rides along as an
`app_version` event tag stamped in `beforeSend`/`beforeSendTransaction`
(the JS SDK has no `defaultTags` init option — same workaround as the
backend's `_stamp_app_version`).

Resolution boundary (review B1): git hash and semver are build identity
and MUST be read via _static_ `process.env.X` expressions (Vite inlines
only static text; `WdVersionsPanel.vue` is the established pattern) —
`getEnv`'s dynamic `process.env[name]` fallback cannot reach them in
the browser bundle (its stand-in for `process.env` compiles to an empty
object), and the two keys are deliberately absent from `env.js`/the
inline EJS because they are not runtime-swappable. Runtime-swappable
values (DSN, rate, environment) go through `getEnv`.

**D5 — Errors-only default; tracing integration wired only when the
rate is > 0.**
`WODORE_SENTRY_TRACES_SAMPLE_RATE` (runtime env, string → parsed float,
default `0`; invalid values clamp to `0`). At `0` no tracing integration
is attached and no transactions are created — exactly the backend's
"errors-only mode", chosen as the _default_ here (product call): web
traffic volume and privacy posture make tracing a deliberate later
opt-in, and RUM-quality data is not needed to fix crashes. When enabled
later, `browserTracingIntegration({ router })` provides pageload and
navigation transactions with the Vue Router. Asymmetry noted: docker can
flip the rate per environment at container start; Capacitor builds bake
it (enabling tracing for Android requires a rebuild).

**D6 — PII off; no user identification.**
v11 removed `sendDefaultPii` (its `dataCollection` defaults COLLECT),
so the init pins the migration guide's v10-parity recipe: `userInfo`/
`cookies`/`httpBodies` off; `httpHeaders`/`urlQueryParams` as deny-lists
filtering IP-bearing keys and the OIDC authorization params (`code`,
`state`, `iss` — the SDK's built-in sensitive-key filter misses those,
and they sit in `window.location` right after the OIDC redirect). The
frontend additionally never calls `Sentry.setUser` — authenticated
users stay anonymous. Same residual caveat as the backend: PII that app
code writes _into_ error messages or URLs still flows into events.

**D7 — Static import, console breadcrumbs stay on.**
The SDK is imported statically (~40 KB gz) so hooks install
synchronously at boot rather than after an async chunk fetch — bundle
cost is noise next to MapLibre. The default console integration keeps
`console.*` as breadcrumbs (the app has no logging framework; console is
the breadcrumb trail). `logErrors` stays at its default so dev-mode
console output is unchanged when a DSN is present.

## Risks / Trade-offs

- [Minified stack traces until sourcemaps are uploaded] → vendor
  decision pending (Open Questions); component names from the Vue SDK
  still identify the failing component. Deliberately NOT shipping
  'hidden' sourcemaps in the docker image — nginx would serve them and
  disclose original source publicly.
- [SDK bundle cost for builds that never set a DSN (PR previews)] →
  accepted (see D7); previews are read-only demos, not production.
- [Stale DSN baked into a released Android APK until the next build] →
  inherent to store distribution; rollback for Android = ship a build
  without the DSN. Web rollback is config-only (unset DSN, redeploy).
- [Vue SDK + Quasar interplay] → `Sentry.init({ app })` attaches to the
  same app instance Quasar creates; verified via unit tests on the init
  contract and a staging smoke check (tasks §4).
- [Quota/noise from bots and 4xx-flavored client errors] → inbound
  filters at the vendor during rollout (same as backend task 5.2).

## Migration Plan

1. Merge the change (code is inert everywhere: no DSN configured).
2. Add the empty-default keys to `.env` (`WODORE_SENTRY_DSN=`,
   `WODORE_SENTRY_TRACES_SAMPLE_RATE=0`) — required for `replace_vars`
   to know the placeholders (`.env` is protected for agent sessions; the
   user adds them).
3. Set `WODORE_SENTRY_DSN` in the staging deployment env (Infisical);
   verify events arrive with correct release/environment/tags (tasks §4).
4. Roll out production the same way.
5. Later, optionally: enable tracing via `WODORE_SENTRY_TRACES_SAMPLE_RATE`
   (docker: runtime flip; Android: rebuild), and sourcemap upload once
   the vendor is decided.

**Rollback**: unset `WODORE_SENTRY_DSN` (and the rate) and redeploy —
no code change. Switching vendor = swap the DSN.

## Open Questions

- Vendor: sentry.io vs Better Stack (shared with the backend's open
  decision — same account can host both projects; decide during the
  staging trial).
- Sourcemap upload mechanics per vendor (CI secret + build step for
  docker; Capacitor builds would need the map files shipped or uploaded
  from CI).
- If/when to enable tracing, and at what rate.
