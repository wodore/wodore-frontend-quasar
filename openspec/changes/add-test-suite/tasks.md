## 1. Scripts & Housekeeping

- [x] 1.1 Replace the `test` echo stub in `package.json` with real scripts: `test:unit` (vitest run), `test:unit:watch`, `test:e2e` (playwright test), `allure:generate` (merge `allure-results/unit` + `allure-results/e2e`), `allure:open`, `allure:clean`
- [x] 1.2 Add `allure-results/`, `allure-report/`, `playwright-report/`, `test-results/` to `.gitignore`
- [x] 1.3 Add a fail-fast base-URL reachability check (fixture or util in `tests/e2e/`) that stops with a clear message when the dev server is not running

## 2. Unit Tests (high-value only)

- [x] 2.1 `tests/unit/overlay-huts.spec.ts` — hut overlay source/layer generation, clustering/filter expression invariants
- [x] 2.2 `tests/unit/overlay-transport.spec.ts` — transport overlay expressions and defaults
- [x] 2.3 `tests/unit/custom-route-mode.spec.ts` — route mode styling/selection logic for the map
- [x] 2.4 `tests/unit/image-service.spec.ts` — image URL building (sizes, params, fallbacks)
- [x] 2.5 `tests/unit/user-settings-store.spec.ts` — persisted settings defaults, get/set, localStorage round-trip
- [x] 2.6 `tests/unit/local-properties-store.spec.ts` — persisted property logic and defaults
- [x] 2.7 Apply the Allure label convention (`feature`, `severity`) as in the existing raster/overlays specs

## 3. E2E Smoke Suite (local, real dev server)

- [x] 3.1 Create `tests/e2e/` with a small helpers module (base URL check, hut slug from `E2E_HUT_SLUG`)
- [x] 3.2 Spec: app shell loads — `/` renders the map (canvas present, no fatal console errors)
- [x] 3.3 Spec: data-policy page renders its content
- [x] 3.4 Spec: unknown route shows the ErrorNotFound page
- [x] 3.5 Spec: hut detail deep link `/m/hut/:slug` loads hut content (skip with message when hut not in local DB)
- [x] 3.6 Spec: in-app navigation (e.g. map → feedback/support) works via the UI
- [x] 3.7 Run the suite locally against `yarn dev` and confirm Allure results in `allure-results/e2e`

## 4. CI Allure Reporting (unit only)

- [x] 4.1 Add a `tests` job to the PR workflow (new `test.yml` or extend `main.yml`) with `permissions: pull-requests: write, checks: write`
- [x] 4.2 Run `yarn lint`, `npx vue-tsc --noEmit`, `yarn test:unit` (with `--clean-alluredir` semantics for the results dir)
- [x] 4.3 `npx -y allure generate allure-results/unit --clean` (cache npm like the backend does)
- [x] 4.4 Post via `allure-framework/allure-action@v0.6.6` with `GITHUB_TOKEN`; verify no e2e step exists in CI
- [x] 4.5 Open a test PR and confirm the Allure check appears on it

## 5. Validation & Docs

- [x] 5.1 `yarn lint` and `npx vue-tsc --noEmit` pass on all new files
- [x] 5.2 Update `AGENTS.md`: test commands, local e2e precondition (dev server on :9000), results/report locations
- [x] 5.3 Validate with `openspec validate add-test-suite` (fix any spec issues)
