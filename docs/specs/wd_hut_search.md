# Hut Search

Feature to search huts and other places.

Backend endpoint docu: <http://localhost:8000/v1/docs#/hut/search_huts>

## Behavior

### General

- Minimum 2 characters to trigger search
- 300ms debounce delay before API call
- Search results stay visible during loading (no flickering)
- Results cleared when input has < 2 characters

### Result Persistence

- When result is selected, input text is cleared BUT results are kept
- When input is re-focused with empty text, previous results are shown
- This allows quick re-selection without re-searching

## Components

### WdPlaceSearch (NEW DESIGN - Desktop)

**Location:** `src/components/search/WdPlaceSearch.vue`

Main search component following the `WdSelectDate` pattern.

**Desktop Behavior:**

- Read-only input field in toolbar (same styling as date picker)
- Search icon in prepend slot
- On click, opens dialog with search functionality
- Dialog uses `q-popup-proxy` with same positioning as calendar

**Dialog Layout:**

- Dark theme (`bg-dark-500`, `bg-dark-700`)
- Close button (top right, orange)
- Search icon (top left, orange)
- Full-width search input in header section
- Results container below (min-height: 300px)
- Uses `WdSearchResultEntry` for each result

**Features:**

- Minimum 2 characters to trigger search
- 300ms debounce delay before API call
- Search results persist when input cleared
- Keyboard navigation (arrow keys, enter, escape)
- Loading spinner during search
- Map navigation on selection
- Routing to hut detail pages

**Mobile:** Currently only desktop version implemented. Mobile version TBD.

### WdHutSearch (OLD - Still Available)

**Location:** `src/components/WdHutSearch.vue`

Legacy search component. Handles:

- Screen size detection (mobile vs desktop)
- API calls with debouncing
- Map navigation on selection
- Routing to hut detail pages

### WdHutSearchInput (OLD)

**Location:** `src/components/WdHutSearchInput.vue`

Desktop search input field with inline dropdown.

**Styling:**

- Use `q-input` with `dense`, `dark`, `standout` props
- Search icon in prepend slot (dark mode only)
- Loading spinner or clear button in append slot

**Results dropdown:**

- Positioned below input with small gap
- White background (readable!)
- Uses `WdSearchResultEntry` components for each result
- Max height with scroll

### WdHutSearchMobile (OLD)

**Location:** `src/components/WdHutSearchMobile.vue`

Mobile search component with overlay.

### WdSearchResultEntry

**Location:** `src/components/search/WdSearchResultEntry.vue`

Single search result item (shared by all search components).

**Layout:**

- Hut type icon (left)
- Hut name (bold)
- Elevation and location (small text, if available)

**Styling:**

- Dark mode support (`text-accent-300`, `text-primary-100`)
- Hover: light background change
- Selected state for keyboard navigation (`bg-dark-600`)

## Future Improvements

### Search Filters

Icons/chips above results to filter by type:

- Accommodation (huts, lodges)
- Transport (cable cars, lifts)
- Peaks (summits)
- Administrative (regions)
- Other places

Show grayed out when inactive, highlighted when active.

### Search History

Show last 5 searches when input focused with no text. This could use browser localStorage to persist history across sessions.

### Location-based Suggestions

Show nearby huts based on current map view.
