## 1. Preconditions (data-driven gate — design.md D6)

- [ ] 1.1 Confirm trigger criteria with platform-tagged telemetry: Android users dying without matching `platform:android` WebView events, or Play Console vitals crash/ANR rates Sentry cannot corroborate
- [ ] 1.2 Resolve the SDK coupling: `@sentry/capacitor` release compatible with `@sentry/vue` 11, or decision to pin `@sentry/vue` to 10.x (re-verify the privacy `dataCollection` recipe against the pinned major)

## 2. Service wiring

- [ ] 2.1 Add `@sentry/capacitor`; extend `src/services/sentry.ts` with a conditional native path (`Capacitor.isNativePlatform()` → dynamic import of the wrapper → `Sentry.init(options, SentryVue.init)`) so the web bundle never carries the native SDK
- [ ] 2.2 Reapply the privacy posture on the wrapper init (PII-off data collection, no `setUser`); keep `platform` tagging and `app_version` stamping
- [ ] 2.3 Plumb `WODORE_SENTRY_NATIVE_DSN` (env typings, index.html EJS inline for capacitor builds)

## 3. Build & CI

- [ ] 3.1 Verify gradle picks up the Sentry native dependency; measure APK size delta (~1–2 MB expected)
- [ ] 3.2 CI (android workflow): ProGuard/R8 mapping upload per build (auth-token secret, same management path as the signing keystore)
- [ ] 3.3 CI: upload the APK's WebView JS sourcemaps per build (scraping cannot reach the device origin — PR #296 follow-up)

## 4. Tests

- [ ] 4.1 Unit: native path selects the wrapper init when `isNativePlatform()` and the native DSN is usable; web path unchanged; web bundle assert (no wrapper import in the web chunk)
- [ ] 4.2 Unit: DSN gate semantics for the native DSN (unset/empty/placeholder → inert)

## 5. Vendor & Rollout

- [ ] 5.1 Create the native Sentry project (or Better Stack equivalent) — third project per the one-project discussion; alert routing
- [ ] 5.2 Set `WODORE_SENTRY_NATIVE_DSN` in the android build env; validate on the stg preview variant, then RC
- [ ] 5.3 Release-health evaluation: decide whether the Play `versionCode` dimension is needed for rollout tracking
- [ ] 5.4 Rollout with the next release train; rollback = unset the native DSN (web side untouched)
