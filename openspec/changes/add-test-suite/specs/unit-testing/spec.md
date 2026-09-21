## ADDED Requirements

### Requirement: Unit tests for map overlay utils

The map overlay utilities `overlay-huts` and `overlay-transport` SHALL be covered by unit tests verifying generated MapLibre source/layer expressions and their invariants.

#### Scenario: Hut overlay expressions

- **WHEN** the hut overlay helpers are called with typical configuration
- **THEN** the resulting filter/expression structures match the documented invariants (layer ids, source shape, zoom-dependent values)

#### Scenario: Transport overlay defaults

- **WHEN** the transport overlay helpers are called without custom options
- **THEN** documented default values are applied

### Requirement: Unit tests for route mode service

The `customRouteMode` service SHALL be covered by unit tests verifying mode selection and styling output.

#### Scenario: Custom route mode styling

- **WHEN** `customRouteMode` logic is exercised for available modes
- **THEN** the selected mode produces the expected styling/route parameters

### Requirement: Unit tests for image service

The `imageService` SHALL be covered by unit tests verifying URL construction and fallback behavior.

#### Scenario: Image URL building

- **WHEN** image URLs are built for varying sizes and parameters
- **THEN** the resulting URLs are well-formed and include the requested options

#### Scenario: Fallback behavior

- **WHEN** image data is missing or incomplete
- **THEN** the service falls back to documented placeholder behavior

### Requirement: Unit tests for persisted settings stores

The `user-settings-store` and `local-properties-store` SHALL be covered by unit tests verifying persistence round-trips and defaults.

#### Scenario: Settings defaults and persistence

- **WHEN** `user-settings-store` state changes
- **THEN** changes persist across store re-instantiation (localStorage round-trip) and defaults apply for absent keys

#### Scenario: Local properties persistence

- **WHEN** `local-properties-store` properties are set
- **THEN** they persist and unknown properties fall back to defaults

### Requirement: Allure labels on unit tests

All unit specs SHALL attach Allure `feature` and `severity` labels consistent with the existing conventions.

#### Scenario: Feature and severity labels

- **WHEN** unit tests run
- **THEN** each spec attaches Allure `feature` and `severity` labels consistent with the existing raster/overlays specs

### Requirement: Unit tests run in CI on every PR

The unit suite SHALL run in CI on every pull request and block the quality check on failure.

#### Scenario: PR opened or updated

- **WHEN** a pull request is opened, synchronized, or marked ready for review
- **THEN** the unit suite runs in CI and a failing test blocks the required quality check
