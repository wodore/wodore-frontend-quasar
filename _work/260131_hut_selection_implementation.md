# Hut Selection and Map FlyTo Implementation

**Date:** 2026-02-01 22:23 | **Updated:** 2026-02-02 23:50
**Status:** ✅ Working - All edge cases handled correctly + Code refactored

---

## Executive Summary

Hut selection with intelligent map positioning has been fully implemented:

- ✅ Initial page load from URL works (fetches from API, sets map position)
- ✅ Hut selection (highlighting) works on initial load
- ✅ User click on marker works
- ✅ Desktop: Protects huts from all 4 edges (150px safe zone)
- ✅ Mobile: Protects huts from all 4 edges (100px safe zone)
- ✅ Handles drawer opening animations correctly
- ✅ Remembers mobile drawer height for accurate predictions

---

## How It Works

### 1. Initial Page Load (URL Navigation)

**Flow when user opens `/hut/blaemsch`:**

1. **Route watcher** detects slug and determines if initial load
2. **Fetch from API** (non-blocking) to get hut coordinates
3. **Set initial map position** via reactive props or `jumpTo()`
4. **Poll for hut feature** in vector tiles (500ms intervals, max 20 attempts)
5. **Select and highlight** hut when found

**Result:** Map centered on hut with zoom 12, hut highlighted with blue glow

### 2. User Click on Marker

**Flow when user clicks hut marker:**

1. **Click handler** captures click event
2. **Toggle if same hut** clicked (deselect)
3. **Smart fly to hut** - checks all 4 edges for danger zones
4. **Calculate minimal movement** - only moves as much as needed
5. **Update router** to reflect selected hut

---

## Current Implementation

### Danger Zone System

The implementation checks **all 4 edges** and moves huts to safe positions when they're too close to any edge:

**Desktop:**

- **Danger Zone:** 150px from any edge
- **Safe Position:** Moves hut to exactly 150px from edge
- **Right Panel:** Accounts for drawer width (460px on large screens, 380px on medium)

**Mobile:**

- **Danger Zone:** 100px from any edge
- **Safe Position:** Moves hut to exactly 100px from edge
- **Bottom Drawer:** Tracks actual drawer height dynamically

### Key Algorithm

```typescript
// 1. Check all 4 edges
let targetX = point.x;
let targetY = point.y;

if (point.y < padding.top + dangerMargin) targetY = padding.top + dangerMargin;
if (point.x > bounds.width - padding.right - dangerMargin)
  targetX = bounds.width - padding.right - dangerMargin;
if (point.y > bounds.height - padding.bottom - dangerMargin)
  targetY = bounds.height - padding.bottom - dangerMargin;
if (point.x < padding.left + dangerMargin) targetX = padding.left + dangerMargin;

// 2. Calculate offset and apply to map center
const offsetX = point.x - targetX;
const offsetY = point.y - targetY;
const targetCenter = map.unproject(
  new Point(currentCenterPoint.x + offsetX, currentCenterPoint.y + offsetY)
);

// 3. Fly to new position
map.flyTo({ center: targetCenter, zoom: targetZoom, duration: 667 });
```

### Drawer Width Prediction

**Desktop:**

- Uses `$q.screen.gt.md` to determine drawer width:
  - Large screens (>md): 460px
  - Medium screens: 380px
- When clicking a hut, assumes drawer will be open and uses expected width
- Prevents double adjustment when drawer animation completes

**Mobile:**

- Tracks last opened drawer height in `lastMobileDrawerHeight` ref
- Default initial height: 50% of window height (better safe than sorry)
- Updates when drawer opens (detects `bottom.value > 100px`)
- Subsequent selections use remembered height for accurate positioning

---

## Implementation Details

### Files Modified

**`src/components/map/WdMapView.vue`**

Key sections:

- Lines 66-97: Layout offset tracking with mobile drawer height memory
- Lines 197-234: `getMapPadding()` - handles desktop and mobile padding with drawer prediction
- Lines 246-261: `isPointVisibleWithPadding()` - checks all 4 edges with platform-specific margins
- Lines 270-387: `smartFlyToHut()` - intelligent flyTo with minimal movement
- Lines 467-544: Route watcher - handles initial load with API fetch

### Key Functions

#### `getMapPadding(assumeDrawerOpen: boolean = false)`

Returns padding for safe zones, accounting for drawers.

**Desktop:**

```typescript
{
  top: parseInt(top.value) || 50,
  bottom: parseInt(bottom.value) || 31,
  left: parseInt(left.value) || 0,
  right: $q.screen.gt.md ? 460 : 380  // When assumeDrawerOpen=true
}
```

**Mobile:**

```typescript
{
  top: parseInt(top.value) || 50,
  bottom: lastMobileDrawerHeight || window.innerHeight * 0.5,  // When assumeDrawerOpen=true
  left: 0,
  right: 0
}
```

#### `isPointVisibleWithPadding(map, lngLat, assumeDrawerOpen)`

Checks if hut is in safe zone (not in any danger zone).

**Returns:** `true` if safe, `false` if too close to any edge

**Danger Margins:**

- Desktop: 150px
- Mobile: 100px

#### `smartFlyToHut(map, lngLat, isInitialLoad)`

Intelligently positions hut away from edges.

**Logic:**

1. Get padding (with drawer prediction for user clicks)
2. Check if hut is visible in safe zone
3. If not visible or needs zoom:
   - Calculate target position (check all 4 edges)
   - Calculate map center offset
   - Fly to new position (667ms duration)

**Parameters:**

- `isInitialLoad`: If true, centers using padding; if false, minimal movement

---

## Code Quality Improvements (2026-02-02)

### Refactoring Summary

The code has been refactored for better maintainability, readability, and type safety:

#### 1. Constants Extracted

All magic numbers and repeated values moved to a constants section at the top of the file:

```typescript
// Margins and safe zones
const MOBILE_DANGER_MARGIN = 100;
const DESKTOP_DANGER_MARGIN = 150;
const MOBILE_DRAWER_MARGIN = 100;
const MOBILE_DRAWER_TRACK_THRESHOLD = 100;

// Zoom levels
const MIN_HUT_CLICK_ZOOM = 8;
const MIN_FLY_ZOOM = 9;
const INITIAL_ZOOM = 12;

// Animation
const FLY_DURATION = 667; // 1.5x speed (1000ms / 1.5)

// Desktop drawer widths (matches WdMapContent.vue:103)
const DESKTOP_DRAWER_WIDTH_LARGE = 460;
const DESKTOP_DRAWER_WIDTH_MEDIUM = 380;

// Mobile drawer
const MOBILE_DRAWER_DEFAULT_RATIO = 0.5; // 50% of screen height

// Map layer IDs
const HUT_LAYER_ID = 'wd-huts';
const HUT_SOURCE_ID = 'wd-huts';
const HUT_SOURCE_LAYER = 'huts';

// Debug flag
const DEBUG_MAP_POSITIONING = false;
```

#### 2. Helper Functions Created

Five utility functions eliminate code duplication:

```typescript
// Platform detection
function isMobileView(): boolean {
  return !$q.screen.gt.sm;
}

// Get expected desktop drawer width based on screen size
function getExpectedDesktopDrawerWidth(): number {
  return $q.screen.gt.md ? DESKTOP_DRAWER_WIDTH_LARGE : DESKTOP_DRAWER_WIDTH_MEDIUM;
}

// Get expected mobile drawer height
function getExpectedMobileDrawerHeight(): number {
  const defaultHeight = process.env.CLIENT ? window.innerHeight * MOBILE_DRAWER_DEFAULT_RATIO : 400;
  return lastMobileDrawerHeight.value || defaultHeight;
}

// Conditional debug logging
function debugLog(message: string, ...args: unknown[]) {
  if (DEBUG_MAP_POSITIONING) {
    console.debug(message, ...args);
  }
}

// Get danger margin for current platform
function getDangerMargin(): number {
  return isMobileView() ? MOBILE_DANGER_MARGIN : DESKTOP_DANGER_MARGIN;
}
```

#### 3. Functions Refactored

**`getMapPadding()`:**

- Now returns MapLibre's `PaddingOptions` type (proper type safety)
- Uses helper functions to eliminate duplication
- Cleaner separation of mobile/desktop logic

**`isPointVisibleWithPadding()`:**

- Uses `getDangerMargin()` helper
- Handles undefined padding properties with nullish coalescing

**`smartFlyToHut()`:**

- Extracted desktop-specific logic into `flyToDesktopMinimal()`
- Simplified conditional logic
- All magic numbers replaced with constants

**`flyToDesktopMinimal()` (new):**

- Extracted from `smartFlyToHut()` for better separation of concerns
- Handles desktop minimal movement positioning
- Properly handles optional padding properties

#### 4. Type Safety Improvements

- Used MapLibre's official `PaddingOptions` type instead of inline object type
- Added nullish coalescing operators (`??`) for optional padding properties
- Fixed TypeScript/ESLint errors (changed `any[]` to `unknown[]` in debugLog)
- All code passes strict TypeScript compilation

#### 5. Benefits

✅ **Maintainability:** All configuration values in one place, easy to adjust
✅ **Readability:** Helper functions make code intent clearer
✅ **Performance:** No degradation, debug logging is toggleable
✅ **Type Safety:** Better TypeScript types using MapLibre's official types
✅ **DRY Principle:** Eliminated code duplication across functions
✅ **Consistency:** All similar operations use the same helper functions

---

## Configuration

### Adjustable Parameters

All parameters are now defined as constants at the top of `WdMapView.vue` (lines 42-64):

**Danger Margins:**

```typescript
const MOBILE_DANGER_MARGIN = 100; // Distance from edge to trigger movement on mobile
const DESKTOP_DANGER_MARGIN = 150; // Distance from edge to trigger movement on desktop
```

**Drawer Settings:**

```typescript
const MOBILE_DRAWER_MARGIN = 100; // Extra margin above mobile drawer
const MOBILE_DRAWER_DEFAULT_RATIO = 0.5; // Initial mobile drawer estimate (50% of screen)
const MOBILE_DRAWER_TRACK_THRESHOLD = 100; // Min height to track mobile drawer
const DESKTOP_DRAWER_WIDTH_LARGE = 460; // Drawer width on large screens
const DESKTOP_DRAWER_WIDTH_MEDIUM = 380; // Drawer width on medium screens
```

**Animation:**

```typescript
const FLY_DURATION = 667; // Animation speed in ms (lower = faster)
```

**Zoom Levels:**

```typescript
const MIN_HUT_CLICK_ZOOM = 8; // Minimum zoom to enable hut clicks
const MIN_FLY_ZOOM = 9; // Minimum zoom before auto-zooming to hut
const INITIAL_ZOOM = 12; // Target zoom when flying to hut
```

**Debug:**

```typescript
const DEBUG_MAP_POSITIONING = false; // Set to true to enable debug logging
```

---

## Future Improvements

### High Priority

1. **Centralized Layout Store**
   - Move drawer dimensions into Pinia store
   - Share across components (WdMapView, WdMapContent, etc.)
   - Eliminate need for layout offset injection and tracking
   - Single source of truth for all drawer states

2. **Desktop Drawer Height Tracking**
   - Currently assumes fixed drawer width
   - Could track if user resizes or if content changes height
   - Similar to mobile implementation

### Medium Priority

3. **Smooth Drawer Open/Close Integration**
   - Coordinate flyTo animation with drawer animation
   - Potentially adjust hut position during drawer slide

4. **User Preference Storage**
   - Remember user's preferred danger zone margins
   - Store in localStorage or user settings

5. **Multi-Hut Selection**
   - When multiple huts overlap, intelligent positioning for all
   - FitBounds with safe zone padding

### Low Priority

6. **Animation Curves**
   - Custom easing functions for more natural movement
   - Different speeds for different distances

7. **Touch Gestures**
   - Swipe gestures to adjust hut position manually
   - Pinch to adjust danger zone size

---

## Known Limitations

1. **Mobile Drawer Height First Load**
   - First hut selection uses 50% window height estimate
   - Might not be perfect if user previously dragged drawer to extreme height
   - Resolved after first selection (height is remembered)

2. **Extreme Zoom Levels**
   - At very high zoom (>18), pixel calculations might be less accurate
   - At very low zoom (<7), hut positioning less critical

3. **Rapid Drawer Dragging**
   - If user drags drawer while flyTo is in progress, position might be slightly off
   - Resolved on next selection

---

## Related Files

- `src/components/map/WdMapView.vue` - Main map component with flyTo logic
- `src/components/map/WdMapContent.vue` - Drawer component with height management
- `src/stores/map/utils/overlay-huts.ts` - Hut overlay definitions
- `src/router/routes.ts` - Route definitions
- `src/components/huts/WdHutView.vue` - Hut detail panel
- `src/layouts/MainLayout.vue` - Layout with drawer control

---

**Status:** ✅ Fully Working - All platforms and edge cases handled

**Last Updated:** 2026-02-02 23:50
