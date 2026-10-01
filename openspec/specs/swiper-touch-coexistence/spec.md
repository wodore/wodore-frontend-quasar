# swiper-touch-coexistence Specification

## Purpose

Defines how horizontal Swiper sliders inside the mobile bottom sheet coexist with the sheet's vertical touch scrolling: Swiper must not claim or block vertical touch gestures that drive the sheet's scroll-snap expansion, while horizontal swipes keep working and desktop behavior stays unchanged.
## Requirements

### Requirement: Swiper must not block vertical touch scroll propagation

Swiper instances inside the mobile bottom sheet SHALL allow vertical touch scroll events to propagate to the parent scroll container.

#### Scenario: Vertical touch scroll on mobile with Swiper in viewport

- **WHEN** a user touches and drags vertically on the mobile place detail page
- **AND** the touch starts over a Swiper slider (availability stripe or weather forecast)
- **THEN** the bottom sheet content scrolls vertically as expected

#### Scenario: Horizontal swipe still works in Swiper on mobile

- **WHEN** a user swipes horizontally on a Swiper slider in the mobile bottom sheet
- **THEN** the Swiper slides horizontally (free mode scrolling)

### Requirement: Touch configuration applied to both Swiper instances

Both `WdAccommodationAvailabilities.vue` and `WdWeatherForecast.vue` SHALL set `touchMoveStopPropagation: false` and `touchStartPreventDefault: false` on their Swiper instances.

#### Scenario: Availability stripe Swiper touch config

- **WHEN** the availability stripe Swiper initializes on mobile
- **THEN** `touchMoveStopPropagation` is `false` and `touchStartPreventDefault` is `false`

#### Scenario: Weather forecast Swiper touch config

- **WHEN** the weather forecast Swiper initializes on mobile
- **THEN** `touchMoveStopPropagation` is `false` and `touchStartPreventDefault` is `false`

### Requirement: Desktop behavior unchanged

The Swiper configuration changes SHALL NOT affect scrolling behavior on desktop (non-mobile) view.

#### Scenario: Desktop drawer scrolling

- **WHEN** the user views the place detail page on desktop
- **THEN** the content drawer scrolls normally via `q-scroll-area`
- **AND** the Swiper sliders respond to mouse wheel as before
