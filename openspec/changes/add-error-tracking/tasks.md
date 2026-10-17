## 1. Dependency & Service

- [x] 1.1 Add `@sentry/vue` (`^11`) to `package.json` dependencies (`pnpm add @sentry/vue`; pnpm-lock updated)
- [x] 1.2 Create `src/services/sentry.ts`: DSN-gated `Sentry.init` (no init when `WODORE_SENTRY_DSN` unusable) with `release=WODORE_GIT_HASH`, `environment=WODORE_ENV`, `app_version` tag via `beforeSend`/`beforeSendTransaction`, v10-parity PII-off `dataCollection`, tolerant `WODORE_SENTRY_TRACES_SAMPLE_RATE` parsing (default 0, clamp [0,1]), `browserTracingIntegration({ router })` only when rate > 0
- [x] 1.3 Create `src/boot/sentry.ts` (thin wrapper passing `{ app, router }`) and register it FIRST in the boot list in `quasar.config.ts` with `{ server: false }`

## 2. Configuration & Docs

- [x] 2.1 Plumb the env vars: `quasar.config.ts` `build.env` (`WODORE_SENTRY_DSN`, `WODORE_SENTRY_TRACES_SAMPLE_RATE`), `public/env.js` `@@VAR@@` placeholders, `index.html` inline-EJS entries, `src/env.d.ts` ProcessEnv types
- [ ] 2.2 User adds the empty-default keys to the protected `.env` (`WODORE_SENTRY_DSN=`, `WODORE_SENTRY_TRACES_SAMPLE_RATE=0`) — required for `replace_vars` (agent sessions cannot write `.env`)
- [x] 2.3 Document the error-tracking setup in `AGENTS.md`: env vars, boot-first ordering, PII-off rule, vendor-neutrality, rollback = unset DSN, errors-only default
- [x] 2.4 Update the openspec change to complete and validate (`openspec status`)

## 3. Tests & Checks

- [x] 3.1 Test: without a usable DSN (unset / empty / `@@…@@` placeholder), `Sentry.init` is never called
- [x] 3.2 Test: with a DSN, init receives the expected `dsn`, `release` (WODORE_GIT_HASH), `environment` (WODORE_ENV), PII-off `dataCollection`, the `app_version` tag stamping on events/transactions, and no tracing options at the default rate
- [x] 3.3 Test: rate parsing — `0.05` enables `tracesSampleRate` + router tracing integration; `0`/unset/invalid/out-of-range values keep errors-only mode
- [x] 3.4 Run `pnpm lint`, `npx vue-tsc --noEmit`, `pnpm test:unit` — all green (268 tests; a `pnpm build:spa` run additionally validated the EJS/env plumbing end-to-end)

## 4. Staging Validation (spec scenarios)

- [ ] 4.1 Deploy staging with a DSN (Infisical); trigger a test error — verify the event arrives with correct release/environment/`app_version` tag
- [ ] 4.2 Verify a Vue component error carries component + route context, and that no telemetry leaves a no-DSN deployment (dev/preview)
- [ ] 4.3 Android: build an RC/preview variant with the DSN set; verify WebView errors arrive tagged with the build's commit hash

## 5. Vendor Decision & Rollout

- [ ] 5.1 Align with the backend's vendor trial (sentry.io vs Better Stack) — shared account hosts both backend and frontend projects; record the decision
- [ ] 5.2 Configure alert routing and inbound filters (bots/4xx noise) at the chosen vendor
- [ ] 5.3 Set `WODORE_SENTRY_DSN` in production; decide whether/when to enable `WODORE_SENTRY_TRACES_SAMPLE_RATE` (docker: runtime flip; Android: rebuild)
- [ ] 5.4 Decide sourcemap strategy per vendor (CI upload for docker builds; Capacitor map handling) — until then stacks are minified but component names identify the source
