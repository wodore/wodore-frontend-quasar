# Overlay Configuration System - Implementation Complete

**Date:** Thu, 13 Feb 2026  
**Status:** ✅ Phase 1 & 2 Complete - Fully Functional Hut Filter System

---

## Summary

The overlay configuration system has been successfully implemented with full hut type filtering functionality. Users can filter huts by type using an intuitive multi-select interface with real-time map updates, zoom-based icon switching, and persistent storage.

---

## Features Implemented

### 1. Dynamic Filter UI

- **Multi-select filter** with clickable items (no checkboxes)
- **Visual feedback**: Inactive items shown at 50% opacity with grayscale
- **Bold text for selected items**: Selected items appear with bold font weight
- **Icon size**: 32px avatars for each hut type
- **Zoom-adaptive icons**:
  - Zoom < 11: Simple icons
  - Zoom >= 11: Detailed icons
  - Smooth crossfade transition (0.3s)
- **Select All / Deselect All** toggle button
- **Status indicator**: "Kein Filter aktiv" when all selected, otherwise "X von Y ausgewählt"

### 2. Filter Indicators

- **Overlay button badge**: Small dot in top-right corner when filters active
- **Filter icon state**: Changes from `wd-filter-outline` (inactive) to `wd-filter` (filled) when active
- **Tab icon state**: Filter tab icon also switches based on active state
- **Config icon buttons**: Vertically stacked next to overlay button (Filter and Info)
  - Appear on hover with 300ms delay
  - Filter button positioned lower than Info button

### 3. Info/Legend Tab

- **Sub-tabs**: Hüttentypen and Verfügbarkeit (sticky headers)
- **Automatic population** from API category data
- **Hut Types section**:
  - Dual symbols: Shows both detailed (38px) and simple (28px) icons side-by-side
  - Full descriptions: Name and description for each hut type
- **Availability section**:
  - Shows availability categories with icons and color swatches
  - Populated from `/v1/categories/list/availability` API
- **Scrollable content**: Full-height layout with sticky sub-tabs

### 4. Tooltips

- **Info button** next to each filter option
- **500ms delay** before showing
- **Normal font size** (text-body2)
- **Shows description** only

### 5. Real-Time Map Filtering

- **MapLibre filter expressions** applied to 7 hut layers:
  1. wd-huts
  2. wd-huts-selected
  3. wd-huts-occupation
  4. wd-huts-occupation-day0-3
- **Debounced application** (150ms) for performance
- **Default behavior**: Empty selection = show all huts
- **Immediate visual feedback** on map

### 6. Persistent Storage

- **LocalStorage key**: `overlayPreferences`
- **Auto-save** on filter change
- **Survives page reload**
- **Reset button** to restore defaults

---

## Technical Architecture

### Type Definitions

**File:** `src/stores/map/overlay-configs/types.ts`

```typescript
export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  iconDetailed?: string;
  iconSimple?: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: FilterType; // 'multi-select'
  options?: FilterOption[];
  defaultValue?: unknown;
}

export interface LegendItem {
  icon?: string;
  label: string;
  description?: string;
  metadata?: {
    iconDetailed?: string | null;
    iconSimple?: string | null;
  };
}

export interface HutCategory {
  slug: string;
  name: string;
  description: string;
  identifier: string;
  symbol_detailed?: string | null;
  symbol_simple?: string | null;
  // ... other fields
}
```

### Hut Configuration

**File:** `src/stores/map/overlay-configs/huts.ts`

```typescript
export const hutsConfig: OverlayConfig = {
  filters: [
    {
      id: 'hutTypes',
      label: 'Hüttentypen',
      type: 'multi-select',
      options: [], // Populated dynamically from API
      defaultValue: [], // Empty = all selected
    },
  ],
  settings: [],
  legend: {
    sections: [], // Populated dynamically from API
  },
};
```

### Store Implementation

**File:** `src/stores/map/overlay-config-store.ts`

Key functions:

- `fetchHutCategories()` - Fetches from `/v1/categories/list/accommodation`
- `populateHutTypeFilterOptions()` - Maps categories to filter options
- `populateHutLegend()` - Creates legend items with both symbols
- `applyHutTypeFilter()` - Applies MapLibre filters to all hut layers
- `getFilterValue()` / `setFilterValue()` - LocalStorage integration

### Filter Components

**File:** `src/components/map/overlay-config/WdOverlayConfigFilter.vue`

- Generic filter renderer
- Routes to appropriate filter type component
- Future-ready for slider, toggle, range filters

**File:** `src/components/map/overlay-config/WdMultiSelectFilter.vue`

- Main multi-select implementation
- Zoom-based icon switching with `useMap()` hook
- Crossfade transitions between icon states
- Click-to-toggle interaction (no checkboxes)

### Dialog Component

**File:** `src/components/map/overlay-config/WdOverlayConfig.vue`

```vue
<q-card class="flex-column">
  <div class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="text-h6">{{ overlayLabel }}</div>
      <q-btn icon="wd-close" v-close-popup />
    </div>
    <q-tabs>
      <q-tab :icon="hasActiveFilters ? 'wd-filter' : 'wd-filter-outline'" />
      <q-tab icon="wd-info-outline" />
      <q-tab icon="wd-edit" />
    </q-tabs>
  </div>
  
  <div class="col q-px-md">
    <q-tab-panels class="fit-height">
      <!-- Filter, Legend, Settings -->
    </q-tab-panels>
  </div>
  
  <div class="q-pa-md">
    <q-btn label="Zurücksetzen" @click="resetDefaults" />
  </div>
</q-card>
```

### Overlay Switch Integration

**File:** `src/components/map/WdOverlaySwitch.vue`

- Config icons appear on hover (300ms delay)
- Three icons: Filter, Info, Settings
- Icons positioned to right of overlay button
- Badge on overlay button when filters active
- `hasActiveFilters()` function checks filter state

**File:** `src/components/map/WdOverlaySwitchItem.vue`

- Long-press support (1500ms)
- Badge prop for filter indicator
- Badge positioned at top-right (-2px, -2px)

---

## API Integration

### Endpoint

```
GET /v1/categories/list/accommodation?lang=de&is_active=true&media_mode=absolute
```

### Response Structure

```json
[
  {
    "slug": "hut",
    "name": "Hütte",
    "description": "Bewartete Berghütte mit Übernachtungsmöglichkeit",
    "identifier": "accommodation.hut",
    "order": 50,
    "symbol_detailed": "https://api.example.com/.../hut_detailed.svg",
    "symbol_simple": "https://api.example.com/.../hut_simple.svg"
  }
]
```

### Categories Fetched (14 total)

1. unknown (0)
2. closed (2)
3. campgr (10)
4. shelter (20)
5. camping (25)
6. bivouac (30)
7. selfhut (40)
8. hut (50)
9. alp (55)
10. bhotel (70)
11. hostel (75)
12. special (80)
13. hotel (90)
14. resta (100)

---

## User Interface

### Filter Tab

```
┌──────────────────────────────────┐
│ Hütten                       [×] │
├──────────────────────────────────┤
│ [🔍] [ℹ️] [⚙️]                    │
│  ^active filter icon             │
├──────────────────────────────────┤
│ Hüttentypen    [Alle abwählen]   │
│                                  │
│ 12 von 14 ausgewählt             │
│                                  │
│ [🏔️] Hütte                    ℹ️ │
│ [⛺] Biwak                     ℹ️ │
│ [🏕️] Camping (grayed)         ℹ️ │
│ [🏠] Selbstversorger          ℹ️ │
│ ...                              │
│                                  │
├──────────────────────────────────┤
│                  [Zurücksetzen] →│
└──────────────────────────────────┘
```

### Info Tab (with Sub-tabs)

```
┌──────────────────────────────────┐
│ Hütten                       [×] │
├──────────────────────────────────┤
│ [🔍] [ℹ️] [⚙️]                    │
├──────────────────────────────────┤
│ Hüttentypen | Verfügbarkeit      │ ← Sticky sub-tabs
│━━━━━━━━━━━                       │
│                                  │
│ Verschiedene Unterkunftsarten    │
│                                  │
│ [📷 38px] [📷 28px] Hütte        │
│  detailed   simple               │
│ Bewartete Berghütte mit...       │
│                                  │
│ [📷 38px] [📷 28px] Biwak        │
│ Unbewartete Notunterkunft...     │
│                                  │
│ ...                              │
└──────────────────────────────────┘

Switch to Verfügbarkeit tab:

┌──────────────────────────────────┐
│ Hütten                       [×] │
├──────────────────────────────────┤
│ [🔍] [ℹ️] [⚙️]                    │
├──────────────────────────────────┤
│ Hüttentypen | Verfügbarkeit      │ ← Sticky sub-tabs
│               ━━━━━━━━━━━━━━     │
│                                  │
│ Belegungsstatus                  │
│                                  │
│ [📷 38px] [●] Verfügbar          │
│  icon    color                   │
│ Freie Plätze verfügbar           │
│                                  │
│ [📷 38px] [●] Ausgebucht         │
│ Keine freien Plätze              │
│                                  │
│ ...                              │
└──────────────────────────────────┘
```

### Overlay Button with Badge and Vertical Config Icons

```
┌─────────┐
│  🏔️  ● │ ← Badge (top-right)
└─────────┘
   ↓ hover (300ms delay)
┌─────────┐  ℹ️
│  🏔️    │  🔍 ← Config icons (vertically stacked, right)
└─────────┘
```

**Config Icon Layout:**

- Filter icon positioned lower than Info icon
- Tight vertical spacing (negative margins)
- Appears on hover with fade-in transition
- Click to open respective tab in dialog

---

## CSS & Styling

### Zoom-Based Icon Transition

```scss
.icon-container {
  position: relative;
  overflow: hidden;
}

.icon-img {
  display: block;
  width: 100%;
  height: 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-leave-active {
  position: absolute; // For crossfade
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
```

### Inactive Item Styling

```scss
.option-inactive {
  opacity: 0.5;

  img {
    filter: grayscale(100%);
  }
}
```

### Full-Height Layout

```scss
.flex-column {
  display: flex;
  flex-direction: column;
}

.fit-height {
  height: 100%;
}

.q-tab-panel {
  height: 100%;
  padding: 0;
}
```

---

## User Interaction Flow

### 1. Opening Filter Dialog

**Desktop:**

- Hover over hut overlay button
- Click Filter icon (🔍) after 300ms delay
- OR long-press (1500ms) on overlay button

**Mobile:**

- Long-press (1500ms) on overlay button

### 2. Filtering Huts

1. Click on any hut type to toggle selection
2. Icon fades to 50% opacity and grayscale when deselected
3. Map updates immediately (150ms debounce)
4. Status text updates: "X von Y ausgewählt"
5. Filter icon changes to filled state
6. Badge appears on overlay button

### 3. Viewing Info

1. Click Info tab to see all hut types with both symbols
2. Scroll through full list of 14 categories
3. Each item shows detailed (38px) and simple (28px) icons

### 4. Tooltip Interaction

1. Hover over info icon (ℹ️) next to any filter option
2. Wait 500ms
3. Tooltip appears with full description

### 5. Resetting Filters

1. Click "Zurücksetzen" button at bottom
2. Success notification appears
3. All hut types re-selected
4. Map shows all huts
5. Filter icon returns to outline state
6. Badge disappears

---

## Performance Optimizations

1. **Debounced Filter Application** - 150ms delay prevents excessive MapLibre updates
2. **Computed Properties** - Reactive filter state without watchers
3. **LocalStorage Caching** - Instant preference restoration
4. **MapLibre Native Filtering** - No layer re-rendering
5. **Zoom Event Handler** - Only updates icon state, not full re-render
6. **Transition Optimization** - Crossfade uses absolute positioning

---

## Known Issues & Future Improvements

### 1. Overlay Button Alignment

**Status:** To be fixed in future

- Config icons cause slight left shift of overlay buttons
- Impact: Minimal - functional but not perfectly centered
- Needs better CSS alignment strategy

### 2. Vertical Spacing Between Config Icons

**Status:** To be fixed in future

- Current vertical spacing between Filter and Info buttons still too large
- Need tighter stacking with proper touch targets maintained
- May require custom button styling or different layout approach

### 3. Mobile Tooltip Interaction

**Status:** To be implemented in future

- Desktop: Tooltips appear on hover (500ms delay)
- Mobile: Should show tooltip on clicking the info button
- Currently no mobile-specific tooltip trigger implemented
- Requires touch event handling and different UX pattern

---

## Files Created

```
src/stores/map/overlay-configs/
├── types.ts                         # All TypeScript interfaces
├── huts.ts                          # Hut overlay config
└── index.ts                         # Central export

src/stores/map/
└── overlay-config-store.ts          # Pinia store with filter logic

src/components/map/overlay-config/
├── WdOverlayConfig.vue              # Main dialog component
├── WdOverlayConfigFilter.vue        # Generic filter renderer
└── WdMultiSelectFilter.vue          # Multi-select filter with zoom icons
```

## Files Modified

```
src/components/map/
├── WdOverlaySwitch.vue              # Config icons, badge, hasActiveFilters()
└── WdOverlaySwitchItem.vue          # Badge support, long-press handler
```

---

## Type Fixes Applied

1. **HutCategory interface**: Updated to match OpenAPI schema
   - `parent?: string | null`
   - `symbol_detailed?: string | null`
   - `symbol_simple?: string | null`

2. **AvailabilityCategory interface**: Added for availability data
   - `color?: string | null`
   - `color_text?: string | null`
   - `symbol_detailed?: string | null`
   - `symbol_simple?: string | null`

3. **API endpoints**:
   - Fixed from `/v1/categories/list/{category}` to `/v1/categories/list/{parent_slug}`
   - Added `/v1/categories/list/availability` for availability categories

4. **FilterOption**: Added `iconDetailed` and `iconSimple` fields

5. **LegendItem**: Added `metadata` field for storing both symbols, and `color` field for color swatches

6. **GeoJSON types**: Added type casts for bbox/coordinates tuple mismatches

---

## Testing Instructions

### Test Filter Functionality

1. **Open filter dialog:**

   ```
   Navigate to http://localhost:9001
   Hover over hut overlay button
   Click Filter icon (after 300ms delay)
   ```

2. **Test filtering:**
   - Click on "Biwak" to deselect
   - Icon should fade to 50% opacity and grayscale
   - Map should hide bivouac huts immediately
   - Status should show "13 von 14 ausgewählt"
   - Filter icon should change to filled state
   - Badge should appear on overlay button

3. **Test zoom icon switching:**
   - Zoom map below level 11 - icons should show simple versions
   - Zoom map above level 11 - icons should smoothly fade to detailed versions

4. **Test "Alle abwählen":**
   - Click button - all items should deselect
   - All huts should disappear from map
   - Status shows "0 von 14 ausgewählt"

5. **Test Info tab:**
   - Click Info tab
   - Should see all 14 hut types
   - Each with two icons (detailed 38px, simple 28px)
   - Full descriptions visible

6. **Test tooltips:**
   - Hover over info icon next to any hut type
   - Wait 500ms
   - Tooltip appears with description in normal font

7. **Test persistence:**
   - Deselect 2-3 hut types
   - Refresh page (F5)
   - Filter state should be preserved
   - Map should still show filtered huts
   - Badge still visible

8. **Test reset:**
   - Click "Zurücksetzen"
   - Success notification appears
   - All types re-selected
   - All huts reappear
   - Badge disappears

### Verify Console Logs

Expected on page load:

```
[OverlayConfigStore] Fetched 14 hut categories
[OverlayConfigStore] First category: {...}
[OverlayConfigStore] Populated 14 options for hutTypes filter
[OverlayConfigStore] First filter option: {...}
[OverlayConfigStore] Populated legend with 14 items
```

Expected when filtering:

```
[OverlayConfigStore] Filter 'hutTypes' set to: [...] for overlay 'huts'
[OverlayConfigStore] Applying filter 'hutTypes' for overlay 'huts': [...]
[OverlayConfigStore] Applied filter to layer 'wd-huts' with 12 types
[WdOverlayConfig] Active filter detected: hutTypes 12 of 14
```

---

## Future Phases

### Phase 3: Enhanced Legend & Occupancy Info

**Objectives:**

- Add occupancy color scale to legend
- Explain zoom-dependent behavior
- Document filter interactions

**Tasks:**

1. **Occupancy Color Legend**
   - Add section explaining color meanings:
     - Green: Available / Low occupancy
     - Yellow: Moderate occupancy
     - Orange: High occupancy / Few spots left
     - Red: Fully booked
   - Show color swatches with descriptions
   - Link to booking system info

2. **Zoom Behavior Documentation**
   - Explain symbol switching at zoom level 11
   - Show examples of simple vs detailed icons
   - Clarify when occupancy overlays appear

3. **Filter Info in Legend**
   - Show active filter count
   - Quick link to clear filters
   - Explain filter persistence

### Phase 4: Transport Stops Filter

**Objectives:**

- Implement filtering for public transport stops overlay
- Support multiple transport types

**Tasks:**

1. **Transport Categories API**
   - Endpoint: `/v1/categories/list/public_transport`
   - Fetch transport types (bus, train, cable car, etc.)

2. **Transport Config**
   - File: `src/stores/map/overlay-configs/transport.ts`
   - Multi-select filter for transport types
   - Legend with transport symbols

3. **Apply to Layers**
   - Filter transport stop layers by type
   - Same pattern as huts implementation

### Phase 5: Hiking Difficulty Filter

**Objectives:**

- Filter hiking routes by difficulty level
- Support SAC scale and other difficulty systems

**Tasks:**

1. **Difficulty Categories**
   - T1-T6 (SAC hiking scale)
   - Color-coded difficulty levels
   - Map to route properties

2. **Multi-Select Implementation**
   - Filter definition for hiking overlay
   - Apply to hiking route layers
   - Legend with difficulty scale

3. **Visual Indicators**
   - Color swatches for each difficulty
   - Icons for route types
   - Terrain descriptions

### Phase 6: Advanced Settings

**Objectives:**

- User-configurable display settings for overlays
- Occupancy display customization
- Symbol and label preferences

**Tasks:**

1. **Occupancy Settings**
   - Number of days slider (1-14 days)
   - Default: 7 days
   - Affects occupancy color calculations
   - Real-time preview

2. **Symbol Settings**
   - Toggle between simple/detailed icons (override zoom)
   - Icon size preferences (small/medium/large)
   - Label visibility toggles

3. **Layer Opacity**
   - Slider for overlay opacity (0-100%)
   - Per-overlay settings
   - Preview on map

4. **Label Settings**
   - Toggle hut names on/off
   - Font size options
   - Collision behavior (hide overlapping)

### Phase 7: Filter Combinations & Advanced Queries

**Objectives:**

- Support multiple active filters
- Complex filter logic (AND/OR)
- Saved filter presets

**Tasks:**

1. **Multiple Overlays**
   - Allow filtering across multiple active overlays
   - Combined view of huts + transport
   - Cross-overlay queries

2. **Filter Logic**
   - AND: Show only items matching all criteria
   - OR: Show items matching any criteria
   - Toggle between modes

3. **Saved Presets**
   - Save current filter combination
   - Name and manage presets
   - Quick-apply saved filters
   - Example presets:
     - "Mountain huts only (no hotels)"
     - "Easy routes with public transport access"
     - "Fully booked accommodations"

4. **Advanced Queries**
   - Capacity range filter (e.g., 20-50 beds)
   - Altitude range filter
   - Distance from point filter
   - Amenity filters (shower, WiFi, etc.)

### Phase 8: Performance & UX Enhancements

**Objectives:**

- Optimize filter performance for large datasets
- Improve mobile experience
- Add accessibility features

**Tasks:**

1. **Performance Optimization**
   - Virtualized lists for 100+ filter options
   - Lazy loading of legend content
   - Memoization of filter computations
   - Web Worker for complex filtering

2. **Mobile Improvements**
   - Bottom sheet instead of left drawer
   - Swipe gestures for tabs
   - Larger touch targets
   - Simplified UI for small screens

3. **Accessibility**
   - ARIA labels for all interactive elements
   - Keyboard navigation support
   - Screen reader announcements
   - High contrast mode support
   - Focus management in dialog

4. **UX Polish**
   - Loading states for API fetches
   - Error handling and retry
   - Empty state messaging
   - Animated filter counts
   - Smooth map zoom to filtered items

### Phase 9: Export & Sharing

**Objectives:**

- Share filtered views with others
- Export filter configurations
- URL-based filter state

**Tasks:**

1. **URL Parameters**
   - Encode filter state in URL query params
   - Deep linking to specific filter views
   - Share links via clipboard

2. **Export Options**
   - Export filtered items as GeoJSON
   - Export filter config as JSON
   - Print-friendly filtered map

3. **Social Sharing**
   - Generate share preview images
   - Social media integration
   - QR codes for mobile sharing

---

## References

- MapLibre Filter Expressions: https://maplibre.org/maplibre-style-spec/expressions/
- VueUse useDebounceFn: https://vueuse.org/shared/useDebounceFn/
- Quasar Components: https://quasar.dev/vue-components/
- Vue Transitions: https://vuejs.org/guide/built-ins/transition.html

---

**End of Implementation Summary**

**Status:** ✅ Phases 1 & 2 complete. Fully functional hut type filtering with zoom-adaptive icons, persistent storage, visual indicators, and comprehensive legend.
