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

## Components

### WdPlaceSearch (CURRENT - Desktop Only)

**Location:** `src/components/search/WdPlaceSearch.vue`

Main search component following the `WdSelectDate` pattern.

**Desktop Behavior:**

- Read-only input field in toolbar (same styling as date picker)
- Search icon in prepend slot
- On click, opens dialog with search functionality
- Dialog uses `q-popup-proxy` with `persistent` prop

**Dialog Layout:**

- Dark theme (`bg-dark-500`, `bg-dark-700`)
- Top-right controls (desktop only):
  - **Not sticky**: Unlock icon (`IconEvaUnlockOutline`) - click to enable sticky mode
  - **Sticky mode**: Move/drag icon (`IconEvaMoveOutline`) + close icon (`wd-close`)
- Full-width search input in header section (outlined style)
- Results container with `q-scroll-area` (height: 400px, max: 600px)
  - Scroll bar: 6px width, accent color (#998019), 0.5 opacity
- Uses `WdSearchResultEntry` for each result (dense mode)

**Features:**

- **Sticky mode** (desktop only): Dialog stays open when selecting results
- **Preview mode**: Eye icon on each result - flies to location without closing dialog or navigating
- **Full selection**: Click result - flies to location, navigates to detail page, closes dialog (unless sticky)
- Minimum 2 characters to trigger search
- 300ms debounce delay before API call
- Search results persist when input cleared
- Keyboard navigation (arrow keys, enter, escape)
- Loading spinner during search
- Map navigation on selection
- Routing to hut detail pages
- Tooltips with delays: 2s for dialog controls, 3s for preview icon

**Mobile:** Not yet implemented - should use full-screen dialog like calendar.

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
- Preview button (right side section):
  - Eye icon (`IconEvaEyeOutline`)
  - Color: `primary-300`
  - Tooltip: "Vorschau auf Karte" (3s delay)
  - Extra right padding: `q-pr-md`

**Events:**

- `@select`: Full click - emits hut and event
- `@preview`: Eye icon click - emits hut only

**Styling:**

- Dark mode support
- Hover: ripple effect
- Selected state: `bg-dark-600` background
- Dark separator between items

## Legacy Components (To Be Deprecated)

### WdHutSearch

**Location:** `src/components/WdHutSearch.vue`

Legacy parent component. Should be removed once WdPlaceSearch mobile version is complete.

### WdHutSearchInput

**Location:** `src/components/WdHutSearchInput.vue`

Desktop search with inline dropdown. Should be removed once WdPlaceSearch is complete.

### WdHutSearchMobile

**Location:** `src/components/WdHutSearchMobile.vue`

Mobile search component. Should be removed once WdPlaceSearch mobile is implemented.

## Open Tasks / Future Improvements

### High Priority

1. **Fix Draggable Functionality**
   - Currently not working properly
   - Should use VueUse `useDraggable`
   - Drag handle: Move icon button (only visible in sticky mode)
   - Issue: May be conflict with `q-popup-proxy` positioning

2. **Mobile View**
   - Should work same as calendar (WdSelectDate)
   - Open as full-screen dialog in center
   - Probably larger than calendar
   - No preview mode on mobile
   - No sticky mode on mobile
   - Simple close button only

3. **Resizable Dialog**
   - Add small bar on bottom (2-5px height)
   - Same color as header (`bg-dark-700`)
   - Allow user to resize dialog height by dragging bottom bar
   - Consider min/max constraints

4. **Icon Background Styling**
   - Icons might need brighter/contrasting background
   - Not sure how to implement this aesthetically
   - Needs design review

### Medium Priority

5. **General Code Review**
   - Simplify component logic
   - Remove unnecessary complexity
   - Optimize performance
   - Review VueUse usage

6. **Search Filters**
   - Icons/chips above results to filter by type:
     - Accommodation (huts, lodges)
     - Transport (cable cars, lifts)
     - Peaks (summits)
     - Administrative (regions)
     - Other places
   - Show grayed out when inactive, highlighted when active

7. **Search History**
   - Show last 5 searches when input focused with no text
   - Use browser localStorage to persist history across sessions
   - Clear history option

### Low Priority

8. **Location-based Suggestions**
   - Show nearby huts based on current map view
   - "Near me" option using geolocation

9. **Keyboard Shortcuts**
   - Quick search activation (e.g., Ctrl+K or /)
   - Focus trap in dialog

10. **Accessibility**
    - ARIA labels
    - Screen reader support
    - Keyboard-only navigation

## Cleanup Tasks

- [ ] Remove old WdHutSearch components once mobile is implemented
- [ ] Move all search-related files to `src/components/search/`
- [ ] Update imports across codebase
- [ ] Remove unused dependencies
- [ ] Update CLAUDE.md with final patterns

## Notes

- Following WdSelectDate pattern for consistency
- Using VueUse composables (useDebounceFn, useDraggable)
- Prefer Quasar components without modifications
- Minimize custom styling
- Dark theme throughout
