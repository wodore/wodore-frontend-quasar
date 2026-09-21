## Why

The test tooling is half-installed but unused: Vitest and Playwright are wired to Allure reporters, two unit tests for map utils exist, yet `"test"` is an echo stub, there are no e2e specs, and CI (`main.yml`) only lints. There is no quality gate on PRs and no visibility into test results. The backend already posts Allure reports to PRs via `allure-framework/allure-action`; the frontend should follow the same pattern.

## What Changes

- Wire test and Allure scripts in `package.json` (`test:unit`, `test:e2e`, `allure:generate`, `allure:open`, `allure:clean`), replacing the echo stub
- Add a **basic Playwright e2e smoke suite** (`tests/e2e/`, mobile-chrome project) that runs **locally against the real dev server** (`yarn dev` on :9000, real backend). Covers: map page renders, data-policy page, 404 catch-all, hut detail deep link (`/m/hut/:slug`), in-app navigation. Public routes only — no login flows
- Add a **small set of high-value unit tests** for pure logic that breaks the map/app when wrong: `overlay-huts.ts`, `overlay-transport.ts` (map overlays), `customRouteMode.ts` (route mode styling), `imageService.ts` (image URLs), `user-settings-store` / `local-properties-store` (persistence logic)
- Add CI reporting: PR workflow runs lint + type-check + unit tests, generates the Allure report and posts it to the PR — mirroring `wodore-backend` `test.yml`. **E2E is NOT run in CI**
- Update `AGENTS.md` with test commands and the local-e2e precondition (dev server running)

## Capabilities

### New Capabilities

- `e2e-testing`: Basic local smoke suite against the real dev server
- `unit-testing`: Focused unit tests for map utils, services, and persisted stores
- `test-reporting`: Allure results from both runners; report generated and posted on every PR

### Modified Capabilities

(none)

## Impact

- **Files**: `package.json`, `vitest.config.ts` (unchanged), `playwright.config.ts` (minor), `tests/unit/**`, `tests/e2e/**` (new), `.github/workflows/main.yml` or new `test.yml`, `AGENTS.md`, `.gitignore` (`allure-results/`, `allure-report/`)
- **Risks**: E2e depends on local backend data (hut slug) — made configurable via env var with a safe default; skipped clearly if unavailable
- **Size**: Small-to-medium; no production code changes expected
