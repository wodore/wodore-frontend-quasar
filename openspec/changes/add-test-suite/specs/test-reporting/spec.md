## ADDED Requirements

### Requirement: Test and Allure scripts

The project SHALL provide package scripts for running unit tests (`test:unit`), e2e tests (`test:e2e`), and generating/opening/cleaning Allure reports (`allure:generate`, `allure:open`, `allure:clean`).

#### Scenario: Unit test run

- **WHEN** `yarn test:unit` is executed
- **THEN** Vitest runs all specs under `tests/unit/` and writes Allure results to `allure-results/unit` (cleaned per run)

#### Scenario: Report generation

- **WHEN** `yarn allure:generate` is executed after test runs
- **THEN** a single Allure report combining `allure-results/unit` and `allure-results/e2e` is generated locally

### Requirement: Allure report posted on every PR

The CI pipeline SHALL generate an Allure report from unit test results and post it to the pull request using `allure-framework/allure-action`, mirroring the `wodore-backend` workflow.

#### Scenario: PR receives Allure check

- **WHEN** a pull request is opened or updated
- **THEN** the workflow runs lint, type-check, and unit tests, generates the Allure report, and posts it as a check on the PR with `GITHUB_TOKEN` and `pull-requests: write, checks: write` permissions

#### Scenario: Failing tests still produce a report

- **WHEN** unit tests fail on a PR
- **THEN** the Allure report is still generated and posted (`if: always()`), while the quality check fails

### Requirement: E2E excluded from CI

The CI pipeline SHALL NOT execute any e2e/Playwright steps; e2e remains a local-only suite.

#### Scenario: CI runs no e2e

- **WHEN** the PR pipeline executes
- **THEN** no Playwright/e2e step runs; e2e results are never required for PR merge

### Requirement: Generated artifacts are not committed

Test results and generated reports SHALL be excluded from version control via `.gitignore`.

#### Scenario: Gitignore covers reports and results

- **WHEN** test runs or report generation happen locally or in CI
- **THEN** `allure-results/`, `allure-report/`, and Playwright output directories are ignored by git
