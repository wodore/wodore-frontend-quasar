# MapLibre Overlays and Basemaps Analysis

**Date:** 2026-01-31
**Status:** Fixed - Ready for Testing

---

## Executive Summary

The maplibre implementation uses a store-based pattern with vue-maplibre-gl wrapper components. The `transformStyle` solution has been implemented to preserve overlay layers during basemap switching. All critical bugs have been identified and fixed:

1. ✅ TypeScript type recursion errors
2. ✅ Layer object mutation causing inconsistent visibility
3. ✅ Deep cloning implemented throughout

**Ready for manual testing** to verify functionality.

---

## Issues Fixed

### 1. TypeScript Type Recursion Error ✅ FIXED

**Problem:** Deep type instantiation errors when accessing `overlayStore.overlays.find()` within `transformStyle` callback.

**Solution:** Created lookup maps outside the reactive loops to avoid type recursion.

**Files Modified:**

- `src/stores/map/basemap-store.ts:121-130` - Created `layerVisibilityMap` lookup
- `src/stores/map/basemap-store.ts:241-250` - Created `layerOnLayerMap` lookup

**Code:**

```typescript
// Build lookup maps to avoid type recursion
const layerVisibilityMap: Record<string, 'visible' | 'none'> = {};
for (const o of overlayStore.overlays) {
  const visibility = o.active ? 'visible' : 'none';
  for (const l of o.style.layers) {
    layerVisibilityMap[l.id] = visibility;
  }
}
```

---

## How Overlay System Works

### Layer Addition Flow

1. **On Map Load** (`WdOverlaySwitch.vue:233`):

   ```
   mapRef.map.on('load', addOverlays)
   ```

2. **addOverlays Function** (`WdOverlaySwitch.vue:149-232`):
   - Groups overlays: background layers and ways layers
   - Reverses order: `frontOverlays.concat(backOverlays).reverse()`
   - For each overlay:
     - Adds sources (vector tiles, geojson)
     - Adds sprites
     - Adds all layers with initial visibility set
3. **Layer Visibility** (`WdOverlaySwitch.vue:207-221`):

   ```typescript
   const layerWithVisibility = { ...layer };
   if (!layerWithVisibility.layout) {
     layerWithVisibility.layout = {};
   }
   layerWithVisibility.layout.visibility = overlay.active ? 'visible' : 'none';
   ```

4. **Layer Insertion** (`WdOverlaySwitch.vue:98-145`):
   - Uses `basemap.layers[onLayer].before` to find insertion point
   - If no `beforeId`, layers append at end (raster basemaps)

### Basemap Switching Flow

1. **User Clicks Basemap** → `WdBasemapSwitch.vue:60`
2. **setBasemap Called** → `basemap-store.ts:47`
3. **transformStyle Preserves Layers** → `basemap-store.ts:51-281`:
   - Preserves custom sources (wd- prefix)
   - Preserves custom layers (wd- prefix)
   - Sets visibility from overlay store state
   - Groups layers by onLayer property
   - Inserts at basemap-specific positions
   - Preserves sprites

### Overlay Definitions

**Example: Huts Overlay** (`overlay-huts.ts:220-235`):

```typescript
export const hutsStyle: StyleSpecification = {
  version: 8,
  sources: {
    'wd-huts': { type: 'vector', url: '...' },
    'wd-bookings': { type: 'geojson', data: ... }
  },
  sprite: [
    { id: 'wd', url: '...' }
  ],
  layers: [
    // 7 LAYERS TOTAL:
    hutsOccpationDetailLayer(0),  // wd-huts-occupation-day0
    hutsOccpationDetailLayer(1),  // wd-huts-occupation-day1
    hutsOccpationDetailLayer(2),  // wd-huts-occupation-day2
    hutsOccpationDetailLayer(3),  // wd-huts-occupation-day3
    { id: 'wd-huts-occupation', ... },
    { id: 'wd-huts-selected', ... },
    { id: 'wd-huts', ... }
  ]
};
```

**Overlay Registration** (`overlays.ts:28-35`):

```typescript
export const huts: OverlaySwitchItem = {
  name: 'huts',
  label: 'Huts',
  show: true,
  active: true, // ← Initially active!
  onLayer: 'ways', // ← Insert before 'ways' reference layer
  icon: 'huts',
  style: hutsStyle,
};
```

### 2. Layer Object Mutation Bug ✅ FIXED

**Problem:** The `setOverlayVisibility` function was directly mutating the original layer definition objects from `overlay-huts.ts` and other overlay files. This caused the original layer definitions to be permanently modified in memory, leading to inconsistent visibility states on initial load.

**Root Cause:**

```typescript
// OLD CODE - MUTATES ORIGINAL
for (const layer of overlay.style.layers) {
  if (layer.layout) {
    layer.layout.visibility = overlay.active ? 'visible' : 'none'; // ⚠️ MUTATION!
  }
}
```

When a user toggled an overlay off, this code would set `layer.layout.visibility = 'none'` on the **original shared layer object** from the overlay definition. These mutations persisted across the application lifecycle, causing only some layers to be visible on subsequent loads.

**Solution:** Remove all mutations and set visibility directly on the map instance.

**Files Modified:**

- `src/components/map/WdOverlaySwitch.vue:61-73` - Fixed `setOverlayVisibility` function

**Code:**

```typescript
// NEW CODE - NO MUTATIONS
function setOverlayVisibility(overlay: OverlaySwitchItem): boolean {
  if (mapRef.map === undefined) {
    return false;
  }
  for (const layer of overlay.style.layers) {
    const currentLayer = mapRef.map.getLayer(layer.id);
    if (currentLayer) {
      const visibility = overlay.active ? 'visible' : 'none';
      mapRef.map.setLayoutProperty(layer.id, 'visibility', visibility);
    }
  }
  return true;
}
```

### 3. Deep Cloning in addOverlays ✅ VERIFIED

**Status:** Already correctly implemented in `WdOverlaySwitch.vue:198-207`.

The `addOverlays` function properly deep clones layer objects before adding them:

```typescript
const layerWithVisibility = {
  ...layer,
  layout: {
    ...(layer.layout || {}),
    visibility: visibility,
  },
};
```

This prevents mutations during the initial layer addition process.

### 4. Deep Cloning in transformStyle ✅ VERIFIED

**Status:** Already correctly implemented in `basemap-store.ts:134-157`.

The `transformStyle` function properly deep clones layers when preserving them across basemap switches:

```typescript
const customLayersWithVisibility = customLayers.map(layer => {
  const visibility = layerVisibilityMap[layer.id];
  return {
    ...layer,
    layout: {
      ...(layer.layout || {}),
      visibility: visibility as 'visible' | 'none',
    },
  };
});
```

---

## Potential Issues Identified (Historical - Now Fixed)

### Issue 1: Layer Object Mutation in transformStyle ✅ FIXED

**Problem:** `transformStyle` directly mutates layer objects:

```typescript
layer.layout.visibility = visibility;
```

These layer objects are **shared references** from overlay definitions. Mutations could persist across basemap switches.

**Recommendation:** Clone layer objects before mutation:

```typescript
const clonedLayer = {
  ...layer,
  layout: { ...layer.layout, visibility },
};
```

### Issue 2: Initial Load - Only One Availability Layer Visible

**Hypothesis:** The issue might be in how layers are spread/cloned in `addOverlays`.

**Current code** (`WdOverlaySwitch.vue:214`):

```typescript
const layerWithVisibility = { ...layer };
```

This is a **shallow copy**. If `layer.layout` already exists, it's still a reference!

**Fix:**

```typescript
const layerWithVisibility = {
  ...layer,
  layout: { ...(layer.layout || {}), visibility: overlay.active ? 'visible' : 'none' },
};
```

### Issue 3: Overlays Disappear on Basemap Switch

**For Vector Basemaps:** Should work if `beforeId` layers exist.

**For Raster Basemaps:** `beforeId` is `undefined`, so layers append at end. This is expected behavior.

**Possible Issue:** If `currentBasemap` is not set correctly during switch, the `transformStyle` might return early or use wrong insertion points.

---

## Recommended Fixes

### Fix 1: Deep Clone Layers in addOverlays

**File:** `src/components/map/WdOverlaySwitch.vue:214-221`

**Before:**

```typescript
const layerWithVisibility = { ...layer };
if (!layerWithVisibility.layout) {
  layerWithVisibility.layout = {};
}
layerWithVisibility.layout.visibility = overlay.active ? 'visible' : 'none';
```

**After:**

```typescript
const layerWithVisibility = {
  ...layer,
  layout: {
    ...(layer.layout || {}),
    visibility: overlay.active ? 'visible' : 'none',
  },
};
```

### Fix 2: Deep Clone Layers in transformStyle

**File:** `src/stores/map/basemap-store.ts:131-148`

**Before:**

```typescript
customLayers.forEach((layer) => {
  const visibility = layerVisibilityMap[layer.id];

  if (visibility !== undefined) {
    if (!layer.layout) {
      layer.layout = {};
    }
    layer.layout.visibility = visibility;
    ...
  }
});
```

**After:**

```typescript
const customLayersWithVisibility = customLayers.map(layer => {
  const visibility = layerVisibilityMap[layer.id];

  if (visibility !== undefined) {
    return {
      ...layer,
      layout: {
        ...(layer.layout || {}),
        visibility,
      },
    };
  } else {
    console.warn(
      `[transformStyle] Layer '${layer.id}' not found in any overlay, defaulting to visible`
    );
    return {
      ...layer,
      layout: {
        ...(layer.layout || {}),
        visibility: 'visible',
      },
    };
  }
});

// Use customLayersWithVisibility instead of customLayers below
```

### Fix 3: Update Layer Grouping to Use Cloned Layers

**File:** `src/stores/map/basemap-store.ts:251-269`

Update to use `customLayersWithVisibility` instead of `customLayers`.

---

## Testing Instructions

### Manual Testing (Since Playwright unavailable)

1. **Open in browser:** <http://localhost:9000/>
2. **Open DevTools Console**
3. **Check initial load:**
   - Look for: `[addOverlays] Adding overlays for the first time`
   - Should see 7 hut layers being added:

     ```
     [addOverlays] Add layer wd-huts-occupation-day0 with visibility: visible
     [addOverlays] Add layer wd-huts-occupation-day1 with visibility: visible
     [addOverlays] Add layer wd-huts-occupation-day2 with visibility: visible
     [addOverlays] Add layer wd-huts-occupation-day3 with visibility: visible
     [addOverlays] Add layer wd-huts-occupation with visibility: visible
     [addOverlays] Add layer wd-huts-selected with visibility: visible
     [addOverlays] Add layer wd-huts with visibility: visible
     ```

   - **Verify on map:** Multiple availability indicators should be visible

4. **Test basemap switch:**
   - Click different basemap
   - Look for: `[transformStyle] Transforming style for basemap: ...`
   - Should see: `[transformStyle] Preserved 7 custom layers`
   - Should see: Layer insertion messages
   - **Verify on map:** All hut layers should remain visible

5. **Test overlay toggle:**
   - Click huts overlay to disable
   - All 7 hut layers should disappear
   - Click again to enable
   - All 7 hut layers should reappear

### Expected Console Output

**Initial Load:**

```
[addOverlays] Adding overlays for the first time
[addOverlays] Add vector source 'wd-huts'
[addOverlays] Add geojson source 'wd-bookings'
[addOverlays] Add sprite 'wd' from '...'
[addOverlays] Add layer wd-huts-occupation-day0 with visibility: visible
...
[addOverlays] Overlay initialization complete
```

**Basemap Switch:**

```
[transformStyle] Transforming style for basemap: ch-swisstopo-full
[transformStyle] Preserved 2 custom sources
[transformStyle] Layer 'wd-huts' visibility set to 'visible'
...
[transformStyle] Preserved 7 custom layers
[transformStyle] Layer groups: background=0, ways=7, other=0
[transformStyle] Inserting 7 'ways' layers before 'Tunnel' (index 15)
[transformStyle] Style transformation complete: 42 layers total, ...
```

---

## Summary of Changes Made

### Files Modified

1. **`src/stores/map/basemap-store.ts`**
   - Lines 121-130: Created `layerVisibilityMap` lookup to fix TypeScript recursion
   - Lines 134-157: Implemented deep cloning in `customLayersWithVisibility`
   - Lines 241-250: Created `layerOnLayerMap` lookup to fix TypeScript recursion
   - Line 253: Added comment clarifying use of cloned layers in grouping

2. **`src/components/map/WdOverlaySwitch.vue`**
   - Lines 61-73: **CRITICAL FIX** - Removed layer object mutation in `setOverlayVisibility`
   - Lines 198-207: Deep clone layers before adding to map (proper implementation)
   - Line 200: Improved console logging for clarity

### All Fixes Applied ✅

All recommended fixes have been applied. The code no longer mutates original layer definitions.

---

## Architecture Notes

### Layer Ordering (Bottom to Top)

1. Basemap base layers
2. Background overlays (`onLayer: 'background'`)
3. Basemap reference layers (buildings, labels, etc.)
4. Ways overlays (`onLayer: 'ways'`)
5. Top basemap layers

### Basemap Configuration

Each basemap specifies insertion points:

```typescript
{
  name: 'Satellite Hybrid',
  layers: {
    ways: { before: 'Tunnel' },        // Insert ways overlays before 'Tunnel' layer
    background: { before: 'State labels' }  // Insert background overlays before 'State labels'
  }
}
```

For **raster basemaps**, `before` is `undefined`, so overlays append at end.

---

## Next Steps

1. ✅ TypeScript errors fixed
2. ✅ Code analysis complete
3. ✅ All fixes applied (mutation bugs, deep cloning)
4. ⏳ **Manual testing required**
5. ⏳ Verify all hut layers visible on initial load
6. ⏳ Verify layers persist on basemap switch
7. ⏳ Verify overlay toggle works correctly
8. ⏳ Update this document with test results

---

## Testing Instructions (Manual)

### Start Development Server

```bash
yarn dev
# or specifically for PWA mode:
yarn dev:pwa
```

Open browser to: http://localhost:9000/

### Test 1: Initial Load - All Hut Layers Visible

**Expected Console Output:**

```
[addOverlays] Adding overlays for the first time
[addOverlays] Add vector source 'wd-huts'
[addOverlays] Add geojson source 'wd-bookings'
[addOverlays] Add sprite 'wd' from '...'
[addOverlays] Adding layer 'wd-huts-occupation-day0' with visibility: visible
[addOverlays] Adding layer 'wd-huts-occupation-day1' with visibility: visible
[addOverlays] Adding layer 'wd-huts-occupation-day2' with visibility: visible
[addOverlays] Adding layer 'wd-huts-occupation-day3' with visibility: visible
[addOverlays] Adding layer 'wd-huts-occupation' with visibility: visible
[addOverlays] Adding layer 'wd-huts-selected' with visibility: visible
[addOverlays] Adding layer 'wd-huts' with visibility: visible
[addOverlays] Overlay initialization complete
```

**Visual Verification:**

- All 7 hut layers should be visible on the map
- Availability indicators should show for multiple days
- Hut icons should be visible

### Test 2: Overlay Toggle

**Steps:**

1. Click the huts overlay switch to disable
2. All 7 hut layers should disappear
3. Check console for: `[setOverlayVisibility] Setting layer 'wd-huts-...' visibility to 'none'`
4. Click again to enable
5. All 7 layers should reappear
6. Check console for: `[setOverlayVisibility] Setting layer 'wd-huts-...' visibility to 'visible'`

### Test 3: Basemap Switch

**Steps:**

1. Ensure huts overlay is enabled
2. Click a different basemap (e.g., "Schweiz Topo Raster" or "Satellite")
3. Check console for:
   ```
   [transformStyle] Transforming style for basemap: ...
   [transformStyle] Preserved 2 custom sources
   [transformStyle] Preserved 7 custom layers
   [transformStyle] Layer groups: background=0, ways=7, other=0
   [transformStyle] Inserting 7 'ways' layers before '...'
   ```
4. All hut layers should remain visible after switch
5. Switch back to original basemap - layers should still be visible

### Test 4: Basemap Switch with Overlay Disabled

**Steps:**

1. Disable huts overlay
2. Switch basemap
3. Hut layers should remain hidden
4. Enable huts overlay
5. All 7 layers should appear

---

## Questions for User

1. **Raster basemaps behavior:** When switching to raster basemaps (no `beforeId`), should overlays:
   - Stay visible at end of layer stack? ✅ (Current behavior)
   - Be hidden?
   - Use a default insertion point?

2. **After testing:** Please report:
   - ✅ or ❌ for each test above
   - Any console errors or warnings
   - Any visual issues with layer rendering
   - Performance issues (if any)

---

**Status:** All fixes applied. Ready for manual testing.
