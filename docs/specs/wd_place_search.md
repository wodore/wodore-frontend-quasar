# Place Search

Feature to search huts and other places (peaks, cable cars, regions, etc.).

Backend endpoint docu: <http://localhost:8000/v1/docs#/hut/search_huts>

## Behavior

### General

- Minimum 2 characters to trigger search
- 300ms debounce delay before API call (using VueUse `useDebounceFn`)
- Search results stay visible during loading (no flickering)
- Results cleared when input has < 2 characters

### Result Persistence

- When result is selected, input text is cleared BUT results are kept
- When input is re-focused with empty text, previous results are shown
- This allows quick re-selection without re-searching

## Architecture

The search feature uses a three-component architecture:

1. **WdPlaceSearch** - Core component with search UI and logic (complete card)
2. **WdPlaceSearchMenu** - Desktop wrapper (q-popup-proxy with sticky/drag controls)
3. **WdPlaceSearchDialog** - Mobile wrapper (full-screen q-dialog)

This ensures no code duplication while allowing platform-specific behavior.

## Components

### WdPlaceSearch (Core Component)

**Location:** `src/components/search/WdPlaceSearch.vue`

Complete search component rendered as a card. Contains all search logic and UI.

**Props:**

- `mobile` (boolean) - Adjusts styling for mobile full-screen view

**Emits:**

- `close` - Emitted when user selects a result (parent decides whether to actually close)

**Exposes:**

- `focus()` - Method to focus the search input

**Card Layout:**

```
┌─────────────────────────────────────┐
│ Header (bg-dark-700, q-pa-md)       │
│ ┌─────────────────────────────────┐ │
│ │ Search Input (outlined, dense)  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Results (q-scroll-area, bg-dark-500)│
│ - 400px height (desktop)            │
│ - calc(100vh - 88px) (mobile)       │
│ - WdSearchResultEntry items         │
└─────────────────────────────────────┘
```

**Styling:**

- Card width: 440px (desktop), 100vw (mobile)
- Card height: auto (desktop), 100vh (mobile)
- Dark theme (`bg-dark-500`, `bg-dark-700`)
- Header padding-right: 84px (space for control buttons)
- Scroll bar: 6px width, accent color (#998019), 0.5 opacity

**Features:**

- Search input with clear button and loading spinner
- Keyboard navigation (arrow keys, enter, escape)
- Preview mode (desktop only - eye icon on results)
- Full selection - flies to location and navigates to detail page
- Empty state with search icon and helper text
- "No results" state

### WdPlaceSearchMenu (Desktop Wrapper)

**Location:** `src/components/search/WdPlaceSearchMenu.vue`

Desktop wrapper that shows readonly input trigger and opens WdPlaceSearch in a popup.

**Trigger:**

- Readonly input field (standout style, matches WdSelectDate)
- Search icon in prepend slot
- Placeholder: "Orte suchen..."

**Popup:**

- Uses `q-popup-proxy` for positioning near input
- Transitions: jump-down/jump-up
- Persistent based on sticky state

**Controls (positioned absolutely top-right):**

- **Not sticky**: Unlock icon (`IconEvaUnlockOutline`) - click to enable sticky mode
- **Sticky**: Move icon (`IconEvaMoveOutline`) + Close icon (`wd-close`)
- All with tooltips (2s delay)

**Behavior:**

- Auto-focuses search input when opened
- Resets sticky state and position when closed
- Closes on result selection (unless sticky mode enabled)

**Known Issue:**

- Draggable functionality not working (VueUse `useDraggable` conflicts with q-popup-proxy positioning)

### WdPlaceSearchDialog (Mobile Wrapper)

**Location:** `src/components/search/WdPlaceSearchDialog.vue`

Mobile wrapper that shows search icon button and opens WdPlaceSearch full-screen.

**Trigger:**

- Round flat button with search icon
- Small size, minimal styling

**Dialog:**

- Uses `q-dialog` with `maximized` prop
- Transitions: slide-up/slide-down
- Full screen (100vw x 100vh)

**Controls:**

- Close button only (top-right, absolutely positioned)
- No sticky mode on mobile
- No preview mode on mobile (handled by WdPlaceSearch via screen detection)

**Behavior:**

- Auto-focuses search input when opened
- Always closes on result selection (no sticky mode)

### WdSearchResultEntry

**Location:** `src/components/search/WdSearchResultEntry.vue`

Single search result item (shared by all search components).

**Layout:**

- Dense mode (`dense` prop on `q-item`)
- Hut type icon (left, avatar section)
- Hut name and details (main section):
  - Overline: Hut type name (`text-primary-400`)
  - Label: Hut name (`text-primary-100`, bold)
  - Caption: Elevation with mountain icon (`text-primary-300`)
- Preview button (right side section, desktop only):
  - Eye icon (`IconEvaEyeOutline`)
  - Color: `primary-300`
  - Tooltip: "Vorschau auf Karte" (3s delay)
  - Extra right padding: `q-pr-md`

**Events:**

- `@select` - Full click, emits hut and event
- `@preview` - Eye icon click, emits hut only

**Styling:**

- Dark mode support
- Hover: ripple effect
- Selected state: `bg-dark-600` background
- Dark separator between items

### MainLayout Integration

**Location:** `src/layouts/MainLayout.vue`

The toolbar conditionally renders the appropriate wrapper:

```vue
<WdPlaceSearchMenu v-if="!isMobile" />
<WdPlaceSearchDialog v-if="isMobile" />
```

## Legacy Components (Deprecated)

These components are marked with `.legacy` suffix and should be removed once testing is complete:

- `src/components/search/WdHutSearch.vue.legacy`
- `src/components/search/WdHutSearchInput.vue.legacy`
- `src/components/search/WdHutSearchMobile.vue.legacy`

## Open Tasks / Future Improvements

### High Priority

1. **Fix Draggable Functionality**

   - Currently not working in WdPlaceSearchMenu
   - VueUse `useDraggable` conflicts with `q-popup-proxy` positioning
   - Possible solutions:
     - Use `q-dialog` instead of `q-popup-proxy` with manual positioning
     - Apply transform manually
     - Use different drag library
     - Accept as limitation and remove drag feature

2. **Resizable Dialog**

   - Add small bar on bottom (2-5px height)
   - Same color as header (`bg-dark-700`)
   - Allow user to resize dialog height by dragging bottom bar
   - Consider min/max constraints

3. **Icon Background Styling**
   - Result icons might need brighter/contrasting background
   - Needs design review

### Medium Priority

4. **General Code Review**

   - Optimize performance
   - Review VueUse usage
   - Simplify logic where possible

5. **Search Filters**

   - Icons/chips above results to filter by type:
     - Accommodation (huts, lodges)
     - Transport (cable cars, lifts)
     - Peaks (summits)
     - Administrative (regions)
     - Other places
   - Show grayed out when inactive, highlighted when active

6. **Search History**
   - Show last 5 searches when input focused with no text
   - Use browser localStorage to persist history across sessions
   - Clear history option

### Low Priority

7. **Location-based Suggestions**

   - Show nearby huts based on current map view
   - "Near me" option using geolocation

8. **Keyboard Shortcuts**

   - Quick search activation (e.g., `/`)
   - Focus trap in dialog

9. **Accessibility**
   - ARIA labels
   - Screen reader support
   - Keyboard-only navigation

## Cleanup Tasks

- [x] Create WdPlaceSearch core component
- [x] Create WdPlaceSearchMenu desktop wrapper
- [x] Create WdPlaceSearchDialog mobile wrapper
- [x] Update MainLayout to use new components
- [x] Move legacy components to .legacy suffix
- [ ] Test both desktop and mobile thoroughly
- [ ] Remove legacy components after confirmation

## File Structure

```
src/components/search/
├── WdPlaceSearch.vue              # Core component (card with search UI)
├── WdPlaceSearchMenu.vue          # Desktop wrapper (popup)
├── WdPlaceSearchDialog.vue        # Mobile wrapper (full-screen)
├── WdSearchResultEntry.vue        # Result item component
├── WdHutSearch.vue.legacy         # Old parent (to be removed)
├── WdHutSearchInput.vue.legacy    # Old desktop (to be removed)
└── WdHutSearchMobile.vue.legacy   # Old mobile (to be removed)

src/layouts/
└── MainLayout.vue                 # Uses Menu/Dialog based on screen size

docs/specs/
├── wd_place_search.md             # Complete specification (this file)
└── wd_place_search_summary.md     # Implementation summary
```

## Notes

- Architecture eliminates code duplication between mobile and desktop
- WdPlaceSearch is a complete, self-contained card component
- Wrappers only handle opening/closing and platform-specific controls
- Following WdSelectDate pattern for consistency
- Using VueUse composables (useDebounceFn, useDraggable)
- Dark theme throughout
- All search-related code in `src/components/search/`
