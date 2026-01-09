# Hut Search

Feature to search huts and other places.

Backend endpoint docu: http://localhost:8000/v1/docs#/hut/search_huts

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

### WdHutSearch

Parent component used in toolbar. Handles:

- Screen size detection (mobile vs desktop)
- API calls with debouncing
- Map navigation on selection
- Routing to hut detail pages

### WdHutSearchInput

Desktop search input field.

**Styling:**

- Use `q-input` with `dense`, `dark`, `standout` props
- Same style as calendar input (`WdSelectDate`)
- Search icon in prepend slot (dark mode only)
- Loading spinner or clear button in append slot

**Results dropdown:**

- Positioned below input with small gap
- White background (readable!)
- Uses `WdSearchResultEntry` components for each result
- Max height with scroll

**Keyboard navigation:**

- Arrow keys: move selection up/down
- Enter: select highlighted result
- Escape: close dropdown

### WdHutSearchMobile

Mobile search component.

**Behavior:**

- Shows only search icon button when collapsed
- Opens full-width toolbar overlay when clicked
- Uses Quasar `q-dialog` with `position="top"` and `seamless`
- Slides in from right (use `transition-show="slide-left"`)
- Same toolbar height as main menu toolbar
- Click outside (backdrop) to close

**Layout:**

- `q-toolbar` with white background
- Search icon (left) + input (flex: 1) + close button (right)
- Uses `WdHutSearchInput` component in light mode

### WdSearchResultEntry

Single search result item.

**Layout:**

- Hut type icon (40px circle, left)
- Hut name (bold)
- Elevation and location (small text, if available)
- Optional thumbnail image (48x48, right)

**Styling:**

- Use Quasar spacing classes
- Hover: light gray background
- Selected state for keyboard navigation

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

Show last 5 searches when input focused with no text.

### Location-based Suggestions

Show nearby huts based on current map view.
