## ADDED Requirements

### Requirement: Swiper-based horizontal availability display

WdAccommodationAvailabilities SHALL display availability days in a horizontal Swiper with FreeMode and Scrollbar modules, using `slidesPerView: 'auto'` and a draggable scrollbar.

#### Scenario: Swiper initialization

- **WHEN** the component mounts
- **THEN** a Swiper instance is created with FreeMode enabled, sticky mode, momentum scrolling, and a draggable scrollbar

#### Scenario: Smooth scrolling

- **WHEN** the user scrolls horizontally through availability days
- **THEN** the Swiper provides free-mode scrolling with momentum and no snap-to-slide behavior

### Requirement: Availability icon rendering

WdAccommodationAvailabilities SHALL fetch availability category icons from `/v1/categories/map/availability` and pass the icon mapping to each WdAccommodationDay component. Each day SHALL display the SVG icon matching its `occupancy_status` at 28px.

#### Scenario: Icons loaded from API

- **WHEN** the component mounts
- **THEN** availability icons are fetched from `/v1/categories/map/availability?lang=de&is_active=true&media_mode=absolute`
- **AND** each day cell renders the SVG icon corresponding to its `occupancy_status`

#### Scenario: Unknown occupancy status

- **WHEN** a day has `occupancy_status` of "unknown"
- **THEN** the unknown SVG icon is displayed and the free count shows "?"

### Requirement: Per-day hut type coloring

Each WdAccommodationDay SHALL display a 2-3px top stripe colored with the day's `type_color` from the API, and a subtle background tint (5-10% opacity of `type_color`).

#### Scenario: Hut type stripe

- **WHEN** a day has `type_color` set to "#FF5500"
- **THEN** the top stripe is 2-3px solid "#FF5500"
- **AND** the background has a tint of "#FF5500" at 5-10% opacity

#### Scenario: Missing type color

- **WHEN** a day has no `type_color`
- **THEN** no top stripe or background tint is applied

### Requirement: Free and total bed display

Each WdAccommodationDay SHALL display free beds (bold, colored by occupancy status) and total beds (lighter gray, smaller font) on separate lines.

#### Scenario: Available beds

- **WHEN** a day has `free: 20` and `total: 88`
- **THEN** "20" is displayed in bold with occupancy-status color
- **AND** "88" is displayed in lighter gray at a smaller font size

#### Scenario: Full occupancy

- **WHEN** a day has `free: 0` and `total: 50`
- **THEN** "0" is displayed in bold with full-occupancy color
- **AND** "50" is displayed in lighter gray

### Requirement: Month navigation bar

WdAccommodationAvailabilities SHALL display a month selector bar with month abbreviation chips. Clicking a month SHALL scroll the Swiper to the first day of that month.

#### Scenario: Month chip click

- **WHEN** the user clicks the "JUN" chip
- **THEN** the Swiper scrolls to the first day of June

#### Scenario: Active month detection

- **WHEN** the user scrolls through the Swiper
- **THEN** the month chip corresponding to the currently visible days is highlighted

### Requirement: Date range initialization

WdAccommodationAvailabilities SHALL initialize a date range from 4 days before today to 365 days after today.

#### Scenario: Initial date range

- **WHEN** the component mounts
- **THEN** the date range spans from (today - 4 days) to (today + 365 days)

### Requirement: Lazy data loading

WdAccommodationAvailabilities SHALL fetch per-day availability data lazily as the user scrolls, using the `/v1/huts/{slug}/availability/{date}` endpoint.

#### Scenario: Initial data load

- **WHEN** the component mounts
- **THEN** availability data for ±14 days around today is fetched

#### Scenario: Scroll-triggered load

- **WHEN** the user scrolls to an unloaded date range
- **THEN** availability data for the visible range is fetched in batch (30-day chunks)

#### Scenario: Loading state

- **WHEN** data for a day has not yet been loaded
- **THEN** the day cell displays skeleton placeholders

### Requirement: Scroll to selected date

WdAccommodationAvailabilities SHALL scroll to a selected date on mount (defaulting to today).

#### Scenario: Scroll to today on mount

- **WHEN** the component mounts with no selected date
- **THEN** the Swiper scrolls to today's position

### Requirement: Day cell click navigation

Each WdAccommodationDay SHALL be wrapped in an anchor tag using the `link` from per-day API data, allowing users to navigate to the booking page.

#### Scenario: Click on available day

- **WHEN** the user clicks a day cell with `reservation_status: "possible"` and a valid `link`
- **THEN** the browser navigates to the link URL

### Requirement: Day cell tooltip

Each WdAccommodationDay SHALL display a tooltip with the full date, free/total beds, and hut type name.

#### Scenario: Hover tooltip

- **WHEN** the user hovers over a day cell
- **THEN** a tooltip shows the full date, "20/88 beds free", and the hut type name

### Requirement: WdDayLabel integration in day cells

Each WdAccommodationDay SHALL use the shared WdDayLabel component to render the day name and date, passing `isActive` based on selection state.

#### Scenario: Day label in availability cell

- **WHEN** a WdAccommodationDay renders
- **THEN** it contains a WdDayLabel with the day's `date` and `isSelected` as `isActive`
