## ADDED Requirements

### Requirement: Error tracking activation is DSN-gated
The frontend SHALL initialize the error-tracking SDK only when a
non-empty, usable `WODORE_SENTRY_DSN` runtime env value is present;
without it, the SDK SHALL NOT be initialized and no telemetry SHALL
leave the browser. Development, test, CI, and PR-preview builds set no
DSN and SHALL behave exactly as before this change existed.

#### Scenario: No DSN configured

- **WHEN** the app boots without `WODORE_SENTRY_DSN` (dev, test, CI, preview)
- **THEN** `Sentry.init` is never called and no network request to any error-tracking endpoint is made

#### Scenario: Unrewritten placeholder or empty value

- **WHEN** the runtime env carries `WODORE_SENTRY_DSN` as an empty string or an unrewritten `@@WODORE_SENTRY_DSN@@` placeholder
- **THEN** the value is treated as absent and the SDK is not initialized (misconfiguration degrades to telemetry-free, never to a broken app)

#### Scenario: DSN configured

- **WHEN** `WODORE_SENTRY_DSN` is set to a valid Sentry-protocol DSN (sentry.io or a compatible receiver such as Better Stack)
- **THEN** the SDK initializes once at boot and routes error events to that DSN

### Requirement: Unhandled errors are captured with Vue context
The SDK SHALL be initialized with the Quasar Vue app instance so that
unhandled component render/lifecycle errors are captured via the Vue
error handler, and global `window.onerror` / `unhandledrejection`
errors SHALL be captured from boot time onward, each with component and
route context where available.

#### Scenario: Vue component error

- **WHEN** a component render or lifecycle hook throws during production use
- **THEN** an error event with the failing component name and current route context is captured

#### Scenario: Unhandled promise rejection

- **WHEN** a promise rejection is not handled by application code
- **THEN** an error event is captured with the rejection reason

#### Scenario: Errors in later boot files

- **WHEN** a boot file that runs after the error-tracking boot throws during initialization
- **THEN** the error is captured (the error-tracking boot runs first in the boot list)

### Requirement: Release and environment attribution
Every captured event SHALL carry `release` set to the build's
`WODORE_GIT_HASH` and `environment` set to the deployment's
`WODORE_ENV`, identically in staging and production (one release scheme
across environments), and SHALL additionally carry the package semver as
an `app_version` tag for human-readable filtering. No new build steps
SHALL be required.

#### Scenario: Error attributed to a deploy

- **WHEN** an error is captured on staging or production
- **THEN** the event is tagged with the commit hash baked into the build and the environment name (e.g. `staging`, `production`)

#### Scenario: Cross-environment correlation

- **WHEN** the same commit is deployed to both staging and production and errors occur in both
- **THEN** the events share the same `release` value (differing only in `environment`) and both carry the same `app_version` tag

### Requirement: Configuration flows through the runtime env plumbing
The DSN and tracing rate SHALL be read via the runtime env accessor
(`getEnv`), giving docker deployments per-environment values at
container start (`/env.js`, no rebuild) and dev/Capacitor builds
build-time-baked values through the same code path. The tracing-rate
value SHALL be parsed tolerantly: unset, empty, placeholder, or invalid
values result in the default, and values outside `[0, 1]` clamp to that
range.

#### Scenario: Docker runtime configuration

- **WHEN** the container starts with `WODORE_SENTRY_DSN` in its environment and `replace_vars` rewrites `/env.js`
- **THEN** the app initializes error tracking with that DSN on the next page load, without a rebuild

#### Scenario: Capacitor build-time configuration

- **WHEN** a Capacitor build is produced with `WODORE_SENTRY_DSN` in the build environment
- **THEN** the value is baked inline into the HTML shell and the Android app initializes error tracking with that DSN

#### Scenario: Malformed sample rate

- **WHEN** `WODORE_SENTRY_TRACES_SAMPLE_RATE` is set to a non-numeric string
- **THEN** the rate falls back to the default (`0`) and no crash or tracing occurs

### Requirement: Performance tracing is opt-in and off by default
Performance tracing SHALL be governed by `WODORE_SENTRY_TRACES_SAMPLE_RATE`
(default `0` = errors-only mode: no tracing integration is attached and
no transactions are created). A rate greater than 0 SHALL attach the
Vue Router tracing integration so pageload and navigation transactions
are sampled at that rate.

#### Scenario: Tracing disabled (default)

- **WHEN** the app initializes without `WODORE_SENTRY_TRACES_SAMPLE_RATE` (or with `0`)
- **THEN** error events are captured but no tracing integration is attached and no transactions are created

#### Scenario: Tracing enabled later

- **WHEN** a deployment sets `WODORE_SENTRY_TRACES_SAMPLE_RATE=0.05`
- **THEN** pageload and navigation transactions are sampled at 5% with route context from the Vue Router

### Requirement: No personally identifiable information is sent
The SDK SHALL be configured so that user identities, cookies, HTTP
bodies, and IP-bearing headers/params are not attached to events (the
SDK v11 `dataCollection` option: `userInfo`/`cookies`/`httpBodies` off,
header and URL-param deny-lists for IP-bearing and OIDC authorization
params), and the application SHALL NOT identify users to the
error-tracking vendor (no user IDs, emails, or account data on events).

#### Scenario: Error during an authenticated session

- **WHEN** an error is captured while a user is signed in
- **THEN** the event contains no user identifier, IP address, or session data

#### Scenario: OIDC redirect URL captured

- **WHEN** an error or breadcrumb is captured on a URL still carrying OIDC authorization params (`code`, `state`, `iss`)
- **THEN** those params are filtered from the collected URL

### Requirement: Rollback by configuration only
Disabling error tracking SHALL require only removing (or emptying)
`WODORE_SENTRY_DSN` and redeploying — no code change. Switching between
Sentry-protocol-compatible vendors SHALL require only changing the DSN.

#### Scenario: Disable on web

- **WHEN** `WODORE_SENTRY_DSN` is removed from the deployment environment and the container restarts
- **THEN** subsequent page loads initialize no SDK and no telemetry leaves the browser
