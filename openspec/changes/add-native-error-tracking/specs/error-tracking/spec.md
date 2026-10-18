## ADDED Requirements

### Requirement: Native crashes are captured on Capacitor builds

The native Sentry SDK SHALL capture, when active on a Capacitor build,
unhandled native exceptions (Capacitor plugin Java/Kotlin code,
MainActivity, the Android runtime) and crashes occurring before the
WebView finishes loading the JavaScript bundle, as error events in the
native Sentry project, attributed with the build's release and
environment. The web/PWA integration SHALL remain byte-identical
(plain `@sentry/vue`, `WODORE_SENTRY_DSN`, published sourcemaps).

#### Scenario: Plugin crash

- **WHEN** a Capacitor plugin raises an unhandled native exception
- **THEN** an error event with the native stack trace arrives in the native project, tagged with the APK's commit-hash release

#### Scenario: Startup crash

- **WHEN** the app crashes after native launch but before the WebView reports ready
- **THEN** the crash is captured by the native layer (no JavaScript involvement required)

#### Scenario: Web path untouched

- **WHEN** the same commit is built for web/PWA
- **THEN** the bundle contains no native SDK code and reporting behavior is identical to pre-change

### Requirement: ANR detection and offline persistence on native

The native SDK SHALL report application-not-responding (ANR)
occurrences, and events captured while offline SHALL be persisted to
disk and delivered after the application restarts.

#### Scenario: App not responding

- **WHEN** the main thread is blocked long enough to trigger the Android ANR watchdog
- **THEN** an ANR event is captured with a main-thread stack trace

#### Scenario: Offline event

- **WHEN** an error occurs while the device has no connectivity and the app is later killed
- **THEN** the event survives on disk and is delivered on the next app start

### Requirement: Native release health

The native project SHALL track release health (crash-free sessions and
users) per deployed release, supporting Play Store rollout evaluation.
Release identity SHALL be the commit hash (matching the web scheme);
the Play `versionCode` dimension MAY be added if rollout evaluation
requires it.

#### Scenario: Staged rollout health

- **WHEN** a release train rolls out via Play Store
- **THEN** crash-free session/user rates are attributable per release in the native project

### Requirement: Native activation is DSN-gated with project separation

The native SDK SHALL initialize only when a usable
`WODORE_SENTRY_NATIVE_DSN` is baked at APK build time; without it the
native SDK SHALL NOT initialize. The native DSN SHALL target a
separate Sentry project from the web `WODORE_SENTRY_DSN` (mixed native
events and the Play release cadence justify separation). Rollback of
the native side SHALL NOT affect the web side.

#### Scenario: No native DSN

- **WHEN** an APK is built without `WODORE_SENTRY_NATIVE_DSN`
- **THEN** the native SDK stays inert and WebView JS reporting follows the web DSN unchanged

#### Scenario: Native rollback

- **WHEN** `WODORE_SENTRY_NATIVE_DSN` is unset for subsequent builds
- **THEN** those APKs report WebView JS events only, and web telemetry is unaffected

### Requirement: Native symbolication and privacy parity

Native stacks SHALL be symbolicated via ProGuard/R8 mapping uploads,
and the APK's WebView JavaScript sourcemaps SHALL be uploaded at build
time (the published-maps scraping strategy does not reach the APK's
device-internal origin). The native init SHALL apply the same privacy
posture as the web integration (PII-off data collection, no user
identification).

#### Scenario: Minified native stack

- **WHEN** a native crash arrives from a release build
- **THEN** the ProGuard mapping uploaded for that build resolves the obfuscated frames

#### Scenario: Privacy parity

- **WHEN** any native-layer event is captured
- **THEN** it carries no user identity, IP, cookies, or request bodies, matching the web integration's posture
