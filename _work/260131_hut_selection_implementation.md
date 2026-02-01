# Hut Selection and Map FlyTo Implementation

**Date:** 2026-02-01 22:23
**Status:** Partially Working - Initial load works, border flyTo has issues

---

## Executive Summary

Hut selection has been implemented with the following features:

- ✅ Initial page load from URL works (fetches from API, sets map position)
- ✅ Hut selection (highlighting) works on initial load
- ✅ User click on marker works
- ❌ **ISSUE**: FlyTo on desktop moves hut vertically when it should only move horizontally

---

## How It's Supposed to Work

### 1. Initial Page Load (URL Navigation)

**Flow when user opens `/hut/blaemsch`:**

1. **Route watcher** detects slug (`WdMapView.vue:467-544`)
   - Runs with `immediate: true` on component mount
   - Determines `isInitialLoad = !oldSlug && !selectedHutFeature.value`

2. **Fetch from API** (non-blocking):

   ```typescript
   clientWodore.GET('/v1/huts/{slug}', { params: { path: { slug: newSlug } } }).then(({ data }) => {
     const lngLat: LngLatLike = [data.location.lon, data.location.lat];

     if (mapRef.map) {
       // Map loaded: jump to position
       mapRef.map.jumpTo({ center: lngLat, zoom: 12 });
     } else {
       // Map not loaded: set reactive props
       mapCenter.value = lngLat;
       mapZoom.value = 12;
     }

     // Start polling for hut feature to select it
   });
   ```

3. **Poll for hut feature** (every 500ms, max 20 attempts):
   - Uses `map.querySourceFeatures('wd-huts', ...)`
   - When found: `setFeatureState({ selected: true })`
   - Sets `selectedHutFeature.value`

4. **Map loads at correct position** (either via reactive props or `jumpTo()`)

**Result:** Map centered on hut with zoom 12, hut highlighted with blue glow ✅

### 2. User Click on Marker

**Flow when user clicks hut marker:**

1. **Click handler** (`WdMapView.vue:130-165`)

   ```typescript
   function onHutLayerClick(e: MapLayerEventType['click']) {
     if (e.target.getZoom() > minHutClickZoom) {
       const feature = e.features?.[0];
       const slug = feature.properties.slug;

       // Toggle if clicking same hut
       if (selectedHutFeature.value?.id == feature.id) {
         // Deselect
         router.push({ name: 'map' });
         return;
       }

       // Select new hut
       map.setFeatureState({ id: feature.id }, { selected: true });

       // Smart fly to hut
       const coordinates = feature.geometry.coordinates;
       smartFlyToHut(e.target, coordinates, false);

       // Update router
       router.push({ name: 'map-hut', params: { slug } });
     }
   }
   ```

2. **Smart FlyTo** (`WdMapView.vue:270-315`)
   - Calculates safe position with `calculateSafePosition()`
   - Checks if hut is visible with padding
   - Only moves if needed

3. **Calculate Safe Position** (`WdMapView.vue:217-266`)
   - **Mobile**: If hut within 150px of bottom 400px padding → move up
   - **Desktop**: If hut within 150px of right 800px padding → move left

---

## Current Issues

### ❌ Issue: Desktop FlyTo Moves Hut Vertically

**Symptom:**
When clicking a hut marker in the right "danger zone" (within 150px of 800px padding), the map repositions such that the hut appears to move up or down to the center, not just horizontally.

**Expected Behavior:**

- Desktop: Hut should ONLY move horizontally (left/right) to avoid right menu
- Mobile: Hut should ONLY move vertically (up/down) to avoid bottom menu

**Current Code (Looks Correct):**

```typescript
// Desktop: menu is on right
const rightThreshold = bounds.width - padding.right;
if (point.x > rightThreshold - margin) {
  // Hut is near right edge, move it LEFT (keep Y the same!)
  adjustedPoint = new Point(rightThreshold - margin, point.y);
  console.debug(
    `Desktop: hut at x=${point.x}, moved to x=${adjustedPoint.x}, y unchanged=${point.y}`
  );
}
```

**Debug Logs Added:**

```typescript
console.debug(
  `[calculateSafePosition] Desktop: hut at x=${point.x}, moved to x=${adjustedPoint.x}, y unchanged=${point.y}`
);
const result = map.unproject(adjustedPoint);
console.debug(`[calculateSafePosition] Projected to lng/lat:`, result);
```

**Possible Causes:**

1. **Map Projection Issue**: When calling `map.unproject(adjustedPoint)`, the Mercator projection might cause slight latitude changes even though Y pixel is preserved. This is inherent to how map projections work.

2. **flyTo() Animation**: The `flyTo()` animation with `center: safePosition` moves the map center, not the hut. If the new center has a different latitude, the entire map view shifts vertically.

3. **Viewport Padding**: MapLibre GL's `flyTo()` might apply its own padding/centering logic that conflicts with our calculations.

**Next Steps to Debug:**

1. Check console logs when clicking a hut in the danger zone
2. Verify that `y unchanged=${point.y}` shows the same Y value
3. Compare `lngLat` vs `safePosition` to see if latitude changed
4. Consider using `panBy()` instead of `flyTo()` for pure pixel-based movement

---

## Implementation Details

### Files Modified

1. **`src/components/map/WdMapView.vue`**
   - Lines 53-55: Added reactive `mapCenter` and `mapZoom` refs
   - Lines 107-118: `onMapLoad` - no longer needed for initial positioning
   - Lines 183-208: `isPointVisibleWithPadding()` - checks if point visible with padding
   - Lines 217-266: `calculateSafePosition()` - calculates safe position (HAS ISSUE)
   - Lines 270-315: `smartFlyToHut()` - smart fly to logic
   - Lines 318-428: `selectHutBySlug()` - removed initial load logic (now in route watcher)
   - Lines 467-544: Route watcher - handles initial load with API fetch and polling

### Padding Configuration

**Desktop:**

```typescript
{
  top: 100,     // Keep 100px from top
  bottom: 100,  // Keep 100px from bottom
  left: 100,    // Keep 100px from left
  right: 800    // Keep 800px from right (hut details panel)
}
```

**Mobile:**

```typescript
{
  top: 100,     // Keep 100px from top
  bottom: 400,  // Keep 400px from bottom (menu area)
  left: 50,     // Keep 50px from left
  right: 50     // Keep 50px from right
}
```

**Comfort Margin:** 150px (additional buffer zone)

### Key Functions

#### `isPointVisibleWithPadding(map, lngLat)`

Checks if a geographic coordinate is visible within the padded viewport.

**Returns:** `true` if visible, `false` if outside padding zone

**Usage:** Determine if flyTo is needed

#### `calculateSafePosition(map, lngLat, isInitialLoad)`

Calculates a safe position for the hut to avoid menu overlap.

**Parameters:**

- `map`: MapLibre GL map instance
- `lngLat`: Target longitude/latitude
- `isInitialLoad`: If true, center in safe area; if false, adjust only if near edge

**Returns:** Safe LngLat position

**Desktop Logic:**

```typescript
if (point.x > rightThreshold - margin) {
  adjustedPoint = new Point(rightThreshold - margin, point.y);
  return map.unproject(adjustedPoint);
}
```

**Mobile Logic:**

```typescript
if (point.y > bottomThreshold - margin) {
  adjustedPoint = new Point(point.x, bottomThreshold - margin);
  return map.unproject(adjustedPoint);
}
```

#### `smartFlyToHut(map, lngLat, isInitialLoad)`

Smart fly to hut location with visibility and zoom checks.

**Logic:**

1. Calculate safe position
2. Check if position changed
3. Check if zoom < 9 (min zoom)
4. If needs move OR zoom too low: call `flyTo()`

**Parameters:**

- `duration`: 1000ms
- `essential`: true (can't be filtered out)

---

## Testing Instructions

### Test 1: Initial Load

1. Open URL: `http://localhost:9000/hut/blaemsch`
2. **Expected:** Map jumps to hut location, zoom 12, hut highlighted
3. **Console logs:**
   ```
   [route watch] Initial load, fetching hut location before map loads
   [route watch] Set map center/zoom to [lng, lat], 12
   [calculateSafePosition] (initial) Center in safe area
   [route watch] Hut selected after initial load
   ```

### Test 2: Desktop - Click Safe Area Hut

1. Click a hut marker in the safe area (not near edges)
2. **Expected:** No movement, hut highlights
3. **Console logs:**
   ```
   [onHutLayerClick] Hut layer clicked
   [smartFlyToHut] No movement needed (already visible)
   ```

### Test 3: Desktop - Click Danger Zone Hut ❌ HAS ISSUE

1. Click a hut marker in right danger zone (within 150px of 800px padding)
2. **Expected:** Hut moves LEFT only, stays at same vertical position
3. **Actual:** Hut moves to center vertically (WRONG!)
4. **Console logs:**
   ```
   [calculateSafePosition] Desktop: hut at x=1200, moved to x=350, y unchanged=450
   [calculateSafePosition] Projected to lng/lat: { lng: 8.5, lat: 46.8 }
   [smartFlyToHut] Flying to safe position
   ```

**Check:** Does `y unchanged` match the original Y? Does the latitude change?

### Test 4: Mobile - Click Danger Zone Hut

1. Switch to mobile view (browser devtools or actual mobile)
2. Click a hut marker in bottom danger zone
3. **Expected:** Hut moves UP only
4. **Console logs:**
   ```
   [calculateSafePosition] Mobile: hut at y=800, moved to y=350
   [smartFlyToHut] Flying to safe position
   ```

---

## Potential Solutions for Desktop Issue

### Solution 1: Use `panBy()` Instead of `flyTo()`

Instead of flying to a new geographic center, pan by a specific pixel amount:

```typescript
// Calculate pixel difference
const pixelDiff = adjustedPoint.x - point.x;

// Pan horizontally only
map.panBy([pixelDiff, 0], { duration: 1000 });
```

**Pros:** Pure horizontal movement, no projection issues
**Cons:** Need to handle zoom levels differently

### Solution 2: Preserve Latitude Explicitly

When calculating safe position, explicitly preserve the original latitude:

```typescript
const safePosition = map.unproject(adjustedPoint);
safePosition.lat = lngLat.lat; // Force latitude to stay the same
```

**Pros:** Simple fix
**Cons:** Might not work due to projection constraints

### Solution 3: Use `easeTo()` with Bearing

Instead of changing center, change the bearing/rotation:

**Not applicable** - this rotates the map, not what we want.

### Solution 4: Calculate Geographic Offset

Calculate the longitude offset needed while keeping latitude exactly the same:

```typescript
const currentLng = lngLat.lng;
const lat = lngLat.lat;

// Project both points
const originalPoint = map.project(lngLat);
const safePoint = new Point(rightThreshold - margin, originalPoint.y);
const safeLngLat = map.unproject(safePoint);

// Keep latitude exactly the same
const finalPosition = {
  lng: safeLngLat.lng,
  lat: lat, // Use original latitude
};
```

**Pros:** Explicitly preserves latitude
**Cons:** Might cause distortion at extreme latitudes

---

## Recommended Next Steps

1. **Add more detailed logging** to confirm Y is actually unchanged
2. **Check actual vs expected latitude** in console logs
3. **Try Solution 4** (explicitly preserve latitude)
4. **If that fails, try Solution 1** (use `panBy()` for pixel-based movement)
5. **Consider using MapLibre GL's padding option** in `flyTo()`:
   ```typescript
   map.flyTo({
     center: lngLat,
     padding: { left: 100, right: 800, top: 100, bottom: 100 },
     duration: 1000,
   });
   ```

---

## Related Files

- `src/components/map/WdMapView.vue` - Main map component
- `src/stores/map/utils/overlay-huts.ts` - Hut overlay definitions
- `src/router/routes.ts` - Route definitions
- `src/components/huts/WdHutView.vue` - Hut detail panel
- `src/layouts/MainLayout.vue` - Layout with drawer control

---

**Status:** Initial load working ✅ | Desktop flyTo vertical movement issue ❌

**Last Updated:** 2026-02-01 22:23
