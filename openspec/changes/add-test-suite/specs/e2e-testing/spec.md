## ADDED Requirements

### Requirement: Local e2e smoke suite against the real dev server

The repository SHALL provide a Playwright smoke suite under `tests/e2e/` that runs against a developer-started dev server on the configured base URL (default `http://localhost:9000`) and SHALL NOT be executed by CI pipelines.

#### Scenario: Dev server not running

- **WHEN** the e2e suite is started and nothing listens on the base URL
- **THEN** the run fails immediately with a message instructing the developer to start `yarn dev`

#### Scenario: Dev server running

- **WHEN** the e2e suite is started and the dev server responds on the base URL
- **THEN** the suite executes against the real dev server and real backend

### Requirement: App shell and map load

The e2e suite SHALL verify that the application shell and the map view load successfully on the root route.

#### Scenario: Map page renders

- **WHEN** the root route `/` is opened
- **THEN** the main layout renders and the map canvas becomes visible without fatal console errors

### Requirement: Public static pages

The e2e suite SHALL verify that public static pages render and that unknown routes are handled.

#### Scenario: Data policy page

- **WHEN** `/data-policy` is opened
- **THEN** the data policy content is rendered

#### Scenario: Unknown route

- **WHEN** a non-existent route is opened
- **THEN** the ErrorNotFound page is displayed

### Requirement: Hut detail deep link

The e2e suite SHALL verify that hut detail pages are reachable via deep link with a configurable slug.

#### Scenario: Known hut slug

- **WHEN** `/m/hut/{slug}` is opened with a slug available in the local backend (`E2E_HUT_SLUG` env var or default)
- **THEN** hut detail content is rendered

#### Scenario: Hut not in local database

- **WHEN** the hut endpoint for the configured slug returns not-found
- **THEN** the spec is skipped with a visible message instead of failing

### Requirement: In-app navigation

The e2e suite SHALL verify that in-app navigation from the map page reaches its target views.

#### Scenario: Navigate from map

- **WHEN** an in-app navigation entry (e.g. feedback or support) is triggered from the map page
- **THEN** the target view is displayed

### Requirement: Allure results from e2e runs

Local e2e runs SHALL write Allure results with feature labels for report generation.

#### Scenario: Local e2e run produces results

- **WHEN** the e2e suite runs locally
- **THEN** Allure results are written to `allure-results/e2e` with feature labels for each spec
