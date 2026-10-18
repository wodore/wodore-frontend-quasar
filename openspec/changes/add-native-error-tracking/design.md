## Context

PR #292 shipped JS-only Sentry error tracking (`@sentry/vue` in the
WebView), PR #296 published sourcemaps, PR #297 added the `platform`
tag. The known blind spot on Android: anything outside the WebView or
outside the JS lifecycle — native crashes (Capacitor plugin
Java/Kotlin, `MainActivity`, the Android runtime), startup crashes
before the WebView loads, ANRs, and events lost on offline app-kill
(in-memory queue). The `@sentry/capacitor` SDK wraps the native
Android/iOS Sentry SDKs and routes WebView JS events through the
native layer, closing all of these at once.

This change is intentionally **deferred**: adopted when the trigger
criteria (D6) are met, not now.

## Goals / Non-Goals

**Goals:**

- Capture native crashes, startup crashes, ANRs on Android.
- Persist events offline (disk cache, flush on restart).
- Release health (crash-free sessions/users) per Play Store rollout.
- Keep the web/PWA integration byte-identical (plain `@sentry/vue`,
  published maps, `WODORE_SENTRY_DSN`).
- Preserve the privacy posture and the Vue component/route context.

**Non-Goals:**

- iOS (the app ships Android only).
- Session replay, user identification.
- Changing the web deployment, its DSN, or the sourcemap strategy.
- Backend changes.

## Decisions

**D1 — SDK shape: `@sentry/capacitor` forwarding to `@sentry/vue`.**
`Sentry.init(options, SentryVue.init)` keeps the Vue integration
(component names, router context) while adding the native layer.
Version coupling is the gate: `@sentry/capacitor` 4.4.0 peer-depends
on `@sentry/vue` 10.x, but we ship 11.8 — adoption requires either a
wrapper release compatible with v11 or pinning `@sentry/vue` down
(accepting the v11 `dataCollection` posture differences; the privacy
recipe must be re-verified against the pinned major's options).

**D2 — Separate Sentry project + `WODORE_SENTRY_NATIVE_DSN`.** Native
events mixed with web events would drown the web signal and the Play
release cadence lags per-push web deploys; the earlier one-project
decision explicitly reserved this split for exactly this case. The
native DSN is baked at APK build time (Capacitor env is build-time by
design). Web keeps `WODORE_SENTRY_DSN` untouched — rollback of the
native side never touches the web side.

**D3 — Conditional init via dynamic import.** The service grows a
native path: `Capacitor.isNativePlatform()` → `import()` the
`@sentry/capacitor` wrapper module → wrapper init; otherwise the
existing path runs. The dynamic import keeps the native SDK (and its
native peer) out of the web bundle entirely — zero web cost.

**D4 — Symbolication via CI uploads.** Native stacks need the
ProGuard/R8 mapping uploaded per build (android workflow step + auth
token secret); the APK's WebView JS needs its sourcemaps uploaded at
build (scraping cannot reach the device-internal origin — the known
Android exception from the published-maps decision, PR #296). Release
= commit hash on both, matching the existing scheme.

**D5 — Same privacy recipe.** The v10-parity `dataCollection` config,
no `setUser`, and the OIDC/PII caveats documented in AGENTS.md apply
verbatim to the wrapper init; native enrichments (device context) are
kept at SDK defaults minus anything identity-bearing.

**D6 — Data-driven trigger criteria (why this is deferred).** Adopt
when the existing telemetry shows Android users dying without a
matching WebView event — concretely: repeated user reports of
freezes/crashes with no `platform:android` JS events around the
report time, or Play Console vitals showing crash/ANR rates our Sentry
cannot corroborate. Until then the JS-only integration plus the
platform tag is the right cost/benefit point.

## Risks / Trade-offs

- [@sentry/vue major pin required] → blocked on wrapper release
  cadence; re-verify the privacy options against the pinned major
  before rollout.
- [APK size +1–2 MB] → accepted for field-diagnosable native crashes.
- [Two SDK layers in the APK (wrapper + vue SDK)] → wrapper forwards
  to the framework SDK; only one JS client exists at runtime.
- [Native project quota/noise from old Play releases] → release =
  commit hash groups old-train crashes separately, same as the web
  stale-APK pattern.
- [CI secrets for mapping uploads] → same secret-management path as
  the existing android signing keystore.

## Migration Plan

1. Confirm trigger criteria (D6) with platform-tagged telemetry.
2. Pin/align SDK versions; add `@sentry/capacitor`; wire the
   conditional init behind the native DSN gate.
3. Create the native Sentry project; set `WODORE_SENTRY_NATIVE_DSN`
   in the android build env; add CI mapping/sourcemap uploads.
4. Preview-APK validation (stg variant), then RC.
5. Rollout: production builds pick it up on the next release train.

**Rollback**: unset `WODORE_SENTRY_NATIVE_DSN` in the android build
env and ship the next build — the native SDK stays in the APK but
never initializes (same DSN-gate semantics as the web side).

## Open Questions

- Wrapper release compatible with `@sentry/vue` 11 — timeline.
- Whether release health should use the Play `versionCode` dimension
  in addition to the commit hash (Play staged rollouts are per
  versionCode, not per commit).
- Better Stack parity for release health/ANR ingestion (vendor trial
  outcome applies here too).
