## Requirements

### Requirement: Mobile image stripe rendering

The system SHALL display a horizontally scrollable image stripe on mobile viewports (`$q.screen.xs`) instead of the single-image Swiper. The stripe SHALL show multiple images side-by-side using Swiper with FreeMode, Scrollbar, and Mousewheel modules. The stripe SHALL span 100% width of the bottom sheet menu.

#### Scenario: Mobile viewport shows image stripe

- **WHEN** the viewport is mobile width (`$q.screen.xs` is true) and images are available
- **THEN** the component renders a horizontally scrollable stripe of images instead of a single full-width image

#### Scenario: Desktop viewport unchanged

- **WHEN** the viewport is desktop width (`$q.screen.xs` is false)
- **THEN** the component renders the existing single-image Swiper with fade effect and thumbnail overlay (no changes)

### Requirement: Stripe image size and aspect ratio

Each image in the stripe SHALL be displayed at 85px height, preserving its original aspect ratio. The system SHALL use `is_portrait` to select the correct orientation URLs (`urls.portrait` for portrait images, `urls.landscape` for landscape images). The stripe container SHALL have a fixed height of 85px. Images SHALL have rounded corners.

#### Scenario: Landscape image dimensions

- **WHEN** the stripe renders a landscape image (aspect ratio ~3:2)
- **THEN** the image is displayed at 85px height and approximately 128px width (preserving ratio)

#### Scenario: Portrait image dimensions

- **WHEN** the stripe renders a portrait image (aspect ratio ~2:3)
- **THEN** the image is displayed at 85px height and approximately 57px width (preserving ratio)

#### Scenario: Orientation URL selection

- **WHEN** an image has `is_portrait === true`
- **THEN** the system uses `urls.portrait.thumb` or `urls.portrait.preview`
- **WHEN** an image has `is_portrait === false` or is undefined
- **THEN** the system uses `urls.landscape.thumb` or `urls.landscape.preview`

#### Scenario: Empty / loading state

- **WHEN** an image has not yet loaded
- **THEN** a placeholder number (index + 1) is displayed

### Requirement: Tap to open full-screen dialog

Each image in the stripe SHALL be tappable. Tapping an image SHALL open `WdMediaDialog` at the corresponding image index using the existing `$q.dialog` pattern.

#### Scenario: Tap opens dialog at correct index

- **WHEN** the user taps on the 3rd image in the stripe
- **THEN** `WdMediaDialog` opens with `initialSlide` set to 2 (zero-indexed)

#### Scenario: Single image tappable

- **WHEN** only one image exists
- **THEN** the stripe shows one image and tapping it opens the dialog at index 0

### Requirement: Horizontal scrolling behavior

The stripe SHALL scroll horizontally with free-mode momentum (no snapping to slides), a subtle scrollbar, and mousewheel support along the scroll axis. The scrolling behavior SHALL match the `WdWeatherForecast` component pattern.

#### Scenario: Free-scroll with momentum

- **WHEN** the user swipes/drags the stripe horizontally
- **THEN** the stripe scrolls freely with momentum, without snapping to individual slides

#### Scenario: Mousewheel scrolling

- **WHEN** the user scrolls with a mousewheel over the stripe
- **THEN** the stripe scrolls horizontally (force-to-axis behavior)

### Requirement: Per-image attribution overlay

Each image in the stripe SHALL display an attribution overlay positioned at the bottom-right corner, showing the author name and provider icon. Author text SHALL be small (0.5rem) with ellipsis truncation. The overlay SHALL have a semi-transparent dark background with blur.

#### Scenario: Attribution visible per image

- **WHEN** an image in the stripe has author or provider data
- **THEN** a small badge appears at the bottom-right of that image with author name and/or provider icon

#### Scenario: No attribution

- **WHEN** an image has no author or provider data
- **THEN** no attribution overlay is shown for that image

### Requirement: No-image state matches stripe height

On mobile, the no-image banner (`WdNoImage`) SHALL have the same height (85px) as the image stripe.

#### Scenario: No-image height on mobile

- **WHEN** no images are available and the viewport is mobile width
- **THEN** the no-image container has a fixed height of 85px
