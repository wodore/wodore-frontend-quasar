## ADDED Requirements

### Requirement: Inline add-image slide in mobile stripe

The mobile stripe gallery SHALL append an "add image" slide at the end of the Swiper when the view is mobile (xs breakpoint) and at least 3 images exist.

#### Scenario: Mobile stripe shows add-image slide at end with >= 3 images

- **WHEN** the gallery is viewed on a mobile device (screen width < 600px) AND 3 or more images exist
- **THEN** the mobile stripe SHALL render an add-image slide after the last image, styled with a dashed border and centered add-photo icon (no text)

#### Scenario: No add-image slide with fewer than 3 images

- **WHEN** the gallery is viewed on mobile AND fewer than 3 images exist
- **THEN** no inline add-image slide SHALL appear in the stripe

#### Scenario: Add-image slide is not shown on desktop

- **WHEN** the gallery is viewed on desktop (screen width >= 600px)
- **THEN** no inline add-image slide SHALL appear in the gallery; the existing desktop contribute button remains unchanged

#### Scenario: Add-image slide click navigates to contribute page

- **WHEN** the user taps the inline add-image slide
- **THEN** the system SHALL navigate to the contribute page with the same parameters as the current overlay button

### Requirement: Floating overlay button hidden on mobile

The floating contribute button overlay in WdHutImageGallery SHALL be hidden on mobile (xs breakpoint) when images exist, since the inline add-image slide replaces its function.

#### Scenario: Floating button hidden on mobile with images

- **WHEN** images exist AND the screen is mobile (xs breakpoint)
- **THEN** the floating contribute button overlay SHALL NOT be visible

#### Scenario: Floating button visible on desktop with images

- **WHEN** images exist AND the screen is NOT mobile (>= sm breakpoint)
- **THEN** the floating contribute button overlay SHALL remain visible as before
