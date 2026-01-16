# Place Search Specification

Feature to search huts and other places (peaks, cable cars, regions, etc.).

Backend endpoint: <http://localhost:8000/v1/docs#/hut/search_huts>

## Overview

Three-component architecture for place search:

- **WdPlaceSearch** - Core search card (UI + logic)
- **WdPlaceSearchMenu** - Desktop popup wrapper
- **WdPlaceSearchDialog** - Mobile full-screen wrapper

Benefits: No code duplication, platform-specific behavior, follows WdSelectDate pattern.

## Behavior

- Minimum 2 characters to trigger search
- 300ms debounce (VueUse `useDebounceFn`)
- Results persist after selection (allows quick re-selection)
- Keyboard navigation (arrows, enter, escape)

## Components

### WdPlaceSearch (Core)

`src/components/search/WdPlaceSearch.vue`

Self-contained q-card component (440px × auto desktop, 100vw × 100vh mobile).

**Interface:**

- Props: `mobile` (boolean)
- Emits: `close` (on result selection)
- Exposes: `focus()` method

**Features:**

- Search input with clear/loading states
- Results area (q-scroll-area, 400px desktop / calc(100vh - 88px) mobile)
- Preview mode (desktop only - eye icon)
- Empty/no-results states
- Dark theme (bg-dark-500/700)

### WdPlaceSearchMenu (Desktop)

`src/components/search/WdPlaceSearchMenu.vue`

Desktop popup wrapper with sticky/drag functionality.

**Trigger:** Readonly input (matches WdSelectDate style)

**Popup:** q-menu with jump-down/up transitions, persistent when sticky

**Controls:**

- Unlock icon (non-sticky) → pin to enable sticky mode
- Move icon (sticky) → drag handle (click to unpin if not dragging)
- Close button

**Sticky Mode:**

- Content becomes `position: fixed` with draggable via VueUse `useDraggable`
- Captures position when entering sticky mode (prevents jump to 0,0)
- Resets position on close or when leaving sticky
- Border constraints: configurable via `BORDER_MARGIN` constant
- Drag detection: 200ms timeout to distinguish clicks from drags

**Behavior:**

- Auto-focus on open
- Closes on selection (unless sticky)
- Position resets when menu closes

### WdPlaceSearchDialog (Mobile)

`src/components/search/WdPlaceSearchDialog.vue`

Full-screen dialog for mobile devices.

**Trigger:** Round search icon button

**Dialog:** q-dialog maximized, slide-up/down transitions

**Controls:** Close button only (no sticky/drag on mobile)

**Behavior:** Auto-focus, always closes on selection

### WdSearchResultEntry

`src/components/search/WdSearchResultEntry.vue`

Single result item (q-item, dense mode).

**Layout:** Icon (left) → Name/details (center) → Preview button (right, desktop only)

**Events:** `@select` (full click), `@preview` (eye icon)

**Styling:** Dark theme, ripple effect, hover states

## Integration

MainLayout conditionally renders based on screen size:

**Desktop:** Search input appears before calendar selection

```vue
<WdPlaceSearchMenu v-if="!isMobile" />
<WdSelectDate />
```

**Mobile:** Search icon appears after calendar selection

```vue
<WdSelectDate />
<WdPlaceSearchDialog v-if="isMobile" />
```

## Future Enhancements

**High Priority:**

- Resizable dialog (drag bottom bar to adjust height)
- Icon background contrast improvements

**Medium Priority:**

- Search filters (chips to filter by type: huts, peaks, lifts, etc.)
- Search history (localStorage, last 5 searches)

**Low Priority:**

- Location-based suggestions (nearby huts based on map view)
- Keyboard shortcuts (quick activation)
- Enhanced accessibility (ARIA, screen readers)

## File Structure

```
src/components/search/
├── WdPlaceSearch.vue           # Core search card
├── WdPlaceSearchMenu.vue       # Desktop popup
├── WdPlaceSearchDialog.vue     # Mobile full-screen
├── WdSearchResultEntry.vue     # Result item
└── *.legacy                    # Deprecated (to be removed)
```

## Technical Notes

- VueUse composables: `useDebounceFn`, `useDraggable`
- Sticky mode: Switches content to `position: fixed` with drag constraints
- Position capture: Uses `getBoundingClientRect()` before mode switch to prevent jumps
- Drag detection: 200ms timeout distinguishes clicks from drags
- Dark theme throughout (bg-dark-500/700, text-primary variants)
