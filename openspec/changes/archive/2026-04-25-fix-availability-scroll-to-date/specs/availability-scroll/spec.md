## ADDED Requirements

### Requirement: Scroll to selected date on initialization

WdAccommodationAvailabilities SHALL scroll to the selected date (or today if no date is selected) when the Swiper instance becomes ready.

#### Scenario: Initial scroll to today

- **WHEN** the component mounts with no `selectedDate` set
- **THEN** the availability stripe scrolls to show today's date immediately when Swiper initializes

#### Scenario: Initial scroll to selected date

- **WHEN** the component mounts with `selectedDate` set to "25.06.26"
- **THEN** the availability stripe scrolls to show June 25, 2026 immediately when Swiper initializes

### Requirement: Scroll to selected date on change

WdAccommodationAvailabilities SHALL scroll to the new date when `selectedDate` changes after mount.

#### Scenario: Date change triggers scroll

- **WHEN** `selectedDate` changes from "25.04.26" to "15.07.26"
- **THEN** the availability stripe animates to show July 15, 2026

### Requirement: Scroll to date on month chip click

WdAccommodationAvailabilities SHALL scroll to the first day of a month when its month chip is clicked.

#### Scenario: Month chip click

- **WHEN** the user clicks the "JUN" chip
- **THEN** the availability stripe scrolls to the first day of June

### Requirement: No race condition between initialization and Swiper readiness

The initial scroll SHALL be triggered from the Swiper `onSwiper` callback (which fires when the instance is ready), not from a watch with `immediate: true` or a `nextTick` in `watchEffect`.
