## ADDED Requirements

### Requirement: Mobile image stripe rendering

The system SHALL display a horizontally scrollable image stripe on mobile viewports (`$q.screen.xs`) instead of the single-image Swiper. The stripe SHALL show multiple images side-by-side using Swiper with FreeMode, Scrollbar, and Mousewheel modules.

#### Scenario: Mobile viewport shows image stripe

- **WHEN** the viewport is mobile width (`$q.screen.xs` is true) and images are available
- **THEN** the component renders a horizontally scrollable stripe of images instead of a single full-width image

#### Scenario: Desktop viewport unchanged

- **WHEN** the viewport is desktop width (`$q.screen.xs` is false)
- **THEN** the component renders the existing single-image Swiper with fade effect and thumbnail overlay (no changes)

### Requirement: Stripe image size and aspect ratio

Each image in the stripe SHALL be displayed at 100px height, preserving its original aspect ratio. The system SHALL use `is_portrait` to select the correct orientation URLs (`urls.portrait` for portrait images, `urls.landscape` for landscape images). The stripe container SHALL have a fixed height of 100px. Images SHALL have rounded corners and a subtle border.

#### Scenario: Landscape image dimensions

- **WHEN** the stripe renders a landscape image (aspect ratio ~3:2)
- **THEN** the image is displayed at 100px height and approximately 150px width (preserving ratio)

#### Scenario: Portrait image dimensions

- **WHEN** the stripe renders a portrait image (aspect ratio ~2:3)
- **THEN** the image is displayed at 100px height and approximately 67px width (preserving ratio)

#### Scenario: Orientation URL selection

- **WHEN** an image has `is_portrait === true`
- **THEN** the system uses `urls.portrait.thumb` or `urls.portrait.preview`
- **WHEN** an image has `is_portrait === false` or is undefined
- **THEN** the system uses `urls.landscape.thumb` or `urls.landscape.preview`

#### Scenario: Empty / loading state

- **WHEN** an image has not yet loaded
- **THEN** a placeholder number (index + 1) is displayed

### Requirement: Tap to open full-screen dialog

Each thumbnail in the stripe SHALL be tappable. Tapping a thumbnail SHALL open `WdMediaDialog` at the corresponding image index using the existing `$q.dialog` pattern.

#### Scenario: Tap opens dialog at correct index

- **WHEN** the user taps on the 3rd thumbnail in the stripe
- **THEN** `WdMediaDialog` opens with `initialSlide` set to 2 (zero-indexed)

#### Scenario: Single image tappable

- **WHEN** only one image exists
- **THEN** the stripe shows one thumbnail and tapping it opens the dialog at index 0

### Requirement: Horizontal scrolling behavior

The stripe SHALL scroll horizontally with free-mode momentum (no snapping to slides), a subtle scrollbar, and mousewheel support along the scroll axis. The scrolling behavior SHALL match the `WdWeatherForecast` component pattern.

#### Scenario: Free-scroll with momentum

- **WHEN** the user swipes/draggs the stripe horizontally
- **THEN** the stripe scrolls freely with momentum, without snapping to individual slides

#### Scenario: Mousewheel scrolling

- **WHEN** the user scrolls with a mousewheel over the stripe
- **THEN** the stripe scrolls horizontally (force-to-axis behavior)

### Requirement: Attribution on mobile stripe

The current image attribution badge (author name + provider icon) SHALL remain visible on mobile, positioned above the stripe container.

#### Scenario: Attribution visible

- **WHEN** the stripe is shown and the current/first image has attribution data
- **THEN** the attribution badge is displayed in a position that doesn't overlap with the stripe thumbnails
