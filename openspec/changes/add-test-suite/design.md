## Context

- Vitest 5 (+ `allure-vitest`) and Playwright (+ `allure-playwright`) are installed and configured: `vitest.config.ts` writes `allure-results/unit` with v8 coverage on map utils/services; `playwright.config.ts` targets `http://localhost:9000` (mobile-chrome project, workers=1) and writes `allure-results/e2e`
- Two unit tests already exist (`tests/unit/raster.spec.ts`, `overlays.spec.ts`) and demonstrate the Allure label convention (`allure.label('feature', ...)`, `allure.severity(...)`)
- `wodore-backend` posts Allure reports to PRs: `--alluredir` → `npx -y allure generate` → `allure-framework/allure-action@v0.6.6` with `pull-requests: write, checks: write` permissions
- Relevant app routes: `/` (map), `/m/hut/:slug` (hut detail deep link), `/data-policy`, `/:catchAll(.*)*` (404)
- High-value untested pure logic: `src/stores/map/utils/overlay-huts.ts`, `overlay-transport.ts`, `src/services/customRouteMode.ts`, `src/services/imageService.ts`, persisted stores `user-settings-store`, `local-properties-store`

## Goals / Non-Goals

**Goals:**

- A basic e2e smoke suite that verifies the app boots and core public pages work
- Unit tests for logic where a regression visibly breaks the map or data display
- Allure report generated and posted as a PR check for every PR (unit tests only)
- Identical reporter/workflow conventions as `wodore-backend` for a unified cross-repo view

**Non-Goals:**

- Running e2e in CI (explicitly deferred)
- Authenticated e2e flows (OIDC/Zitadel login, booking, account settings)
- Component tests (Vue Test Utils) — Storybook/Histoire already covers visual behavior
- API mocking (MSW) or a Playwright `webServer` block — later "correct setup" phase
- High coverage numbers; only high-value targets are tested

## Decisions

### 1. E2E runs locally against the real dev server

**Choice**: Playwright specs target `yarn dev` on `:9000` with the real local backend; developer starts the dev server manually before running specs.
**Alternative**: Auto-started `webServer` in `playwright.config.ts`, or mocked API routes.

The real dev server exercises the real API and tile providers, which is what we want for smoke tests today. Auto-start and mocking belong to the deferred "correct setup" phase. The precondition is documented in `AGENTS.md` and asserted in a spec-time check (fail fast with a clear message when nothing listens on the base URL).

### 2. No e2e in CI

**Choice**: CI runs lint + `vue-tsc` + unit tests only; e2e stays local.
**Alternative**: Full e2e in CI against a built app.

E2E depends on backend data and external tile/map services — flaky in CI and not deterministic per PR. Deferring until the proper setup (mocked or seeded environment) exists.

### 3. Vitest for unit tests

**Choice**: Keep Vitest (already wired, node environment, path aliases, Allure reporter).
**Alternative**: Jest.

Vitest is Vite-native (this is a Vite app), 3–8× faster on Vite projects, and the official Quasar testing harness. No reason to change.

### 4. Allure publishing via `allure-framework/allure-action`

**Choice**: Reuse the backend's pattern exactly: `allure generate` → `allure-framework/allure-action@v0.6.6` with `GITHUB_TOKEN`, permissions `pull-requests: write, checks: write`.
**Alternative**: Artifact-only upload, or gh-pages deployment for trend history.

Matches backend tooling and gives a PR check without extra infrastructure. Trend history via gh-pages can be added later without changing this design.

### 5. Keep split results directories

**Choice**: `allure-results/unit` (Vitest) and `allure-results/e2e` (Playwright) stay separate; local `allure:generate` merges both.
**Alternative**: Single flat `allure-results/` like the backend.

CI only consumes the unit results today, but local runs get one merged report. Both dirs are gitignored.

### 6. E2E hut slug is configurable

**Choice**: Hut-detail spec reads `E2E_HUT_SLUG` (env) with a stable default slug known to exist in the dev database; the spec is skipped with a visible message if the hut API returns 404.
**Alternative**: Hardcoded slug.

Keeps the suite green across dev databases without weakening the deep-link check.
