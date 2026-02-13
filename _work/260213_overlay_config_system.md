# Overlay Configuration System: Filters, Settings & Legends

**Date:** Fri, 13 Feb 2026 19:33:59 +0100
**Status:** Planning & Concept Phase - **UPDATED with decisions**
**Focus:** Huts overlay filter implementation (PRIORITY)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements Analysis](#requirements-analysis)
3. [Architecture Concepts](#architecture-concepts)
4. [Data Storage Strategy](#data-storage-strategy)
5. [Component Design](#component-design)
6. [Implementation Plan](#implementation-plan)
7. [Resolved Decisions](#resolved-decisions)
8. [Technical Considerations](#technical-considerations)

---

## Executive Summary

Design and implement a flexible overlay configuration system that supports:

- **Filters**: Dynamic filtering of overlay data (hut types, hiking difficulty, transport types, etc.)
- **Settings**: Layer-specific visual settings (occupancy display, symbols, colors, line widths) - **DEFERRED TO LATER PHASE**
- **Legends**: Information about symbols, lines, colors and what they represent

**Initial Scope**: **Huts overlay with hut type filtering (PRIORITY)**

**Trigger Mechanism**: Long-press (1500ms) on overlay icon (mobile) or settings icon next to overlay (desktop)

**Implementation Priority**:

1. **Phase 1-2**: Filter infrastructure and hut type filtering (FOCUS)
2. **Phase 3**: Legend/Info tab
3. **Phase 4+**: Settings (deferred to future)

---

## Requirements Analysis

### 1. Filters (PRIMARY FOCUS)

Filters modify which data points are visible on the map based on data properties.

#### Examples by Overlay Type

| Overlay                   | Filter Type    | Examples                                                         |
| ------------------------- | -------------- | ---------------------------------------------------------------- |
| **Huts** (Phase 1)        | **Hut Types**  | **Alpine hut, Mountain restaurant, Bivouac, Youth hostel, etc.** |
| Hiking (Future)           | Difficulty     | T1-T6 (SAC scale), Easy/Medium/Hard                              |
| Public Transport (Future) | Transport Type | Train, Bus, Tram, Cable car, Boat                                |
| Ski Slopes (Future)       | Difficulty     | Blue (easy), Red (medium), Black (hard)                          |
| Protected Nature (Future) | Zone Type      | Wildlife rest zones, Hunting ban areas, National parks           |

#### Filter Characteristics

- **Multiple selection**: Users can select multiple filter values simultaneously
- **Persistence**: Filter state saved in LocalStorage
- **Performance**: Uses MapLibre native filtering (expressions) for performance
- **Default state**: All filters enabled by default
- **Debouncing**: 100-200ms debounce on filter changes using `useDebounceFn`

### 2. Settings (DEFERRED TO PHASE 4+)

Settings control visual representation and display behavior.

**Note**: Settings implementation is deferred. Focus is on filters first, then legend, then settings.

#### Future Hut-Specific Settings (Phase 4+)

- **Occupancy display**:
  - Show/hide occupancy indicators
  - Number of days to display (1-4)
- **Symbol style by zoom**: Configurable icon transition point (currently fixed at zoom 11)

### 3. Legends (Phase 3)

Legends explain the visual language of each overlay.

#### Hut Legend Content (To Be Implemented)

- **Symbol Types**:
  - Simple vs. Detailed icons (zoom-dependent)
  - Icon meaning by hut type (with icon examples)
- **Occupancy Indicators**:
  - Color meaning:
    - Green (#33FF33): Empty
    - Yellow-green (#99CC33): Low occupancy
    - Orange (#FFA726): Medium occupancy
    - Dark orange (#EF6C00): High occupancy
    - Red (#D32F2F): Full
    - Gray (#D4D4D4): Unknown/No data
  - Multiple day indicators (day 0-3 layout)
- **Hut Type Icons**: Visual guide to all 14 hut types

---

## Architecture Concepts

### Selected Approach: Frontend-Only (Concept A) with Future Migration Path

**Decision**: Implement all filters, settings, and legends in the frontend

**Rationale**:

- Full flexibility and rapid iteration
- No backend dependencies for initial implementation
- Easier to implement and test
- All logic in one place

**Future Migration**: When Android/iOS apps are developed, migrate to Hybrid Approach (backend provides metadata, frontend implements UI)

---

## Data Storage Strategy

### User Preferences Storage

**Location**: Quasar LocalStorage

**Key**: `overlayPreferences`

**Structure**:

```typescript
interface OverlayPreferences {
  [overlayName: string]: {
    filters?: Record<string, unknown>;  // Filter values by filter ID
    settings?: Record<string, unknown>; // Setting values by setting ID (future)
  };
}

// Example:
{
  "huts": {
    "filters": {
      "hut-types": ["accommodation.bivouac", "accommodation.hut", "accommodation.alp"]
    }
  }
}
```

### Overlay Configuration Storage

**Location**: Frontend codebase

**Directory**: `src/stores/map/overlay-configs/` (NOT in utils/)

**Files**:

- `types.ts` - TypeScript interfaces
- `index.ts` - Exports all configs
- `huts.ts` - Hut overlay config (Phase 1-2)
- `transport.ts` - Transport config (future)
- `hiking.ts` - Hiking config (future)

### Hut Categories Data Source

**Endpoint**: `GET /v1/categories/list/accommodation?lang=de&is_active=true&media_mode=absolute`

**Response Structure**:

```json
[
  {
    "slug": "bivouac",
    "name": "Biwak",
    "description": "Biwak, oftmals Alpin gelegen mit schwierigem Zustieg",
    "order": 30,
    "level": 1,
    "parent": "accommodation",
    "identifier": "accommodation.bivouac",
    "children": false,
    "symbol_detailed": "http://localhost:8000/v1/categories/list/bivouac%20(detailed)",
    "symbol_simple": "http://localhost:8000/v1/categories/list/bivouac%20(simple)",
    "symbol_mono": "http://localhost:8000/v1/categories/list/bivouac%20(mono)"
  }
]
```

**Available Hut Types** (sorted by order):

1. unknown (0) - unbekannt
2. closed (2) - geschlossen
3. campgr (10) - Biwak Platz
4. shelter (20) - einfacher Unterstand
5. camping (25) - Campingplatz
6. bivouac (30) - Biwak
7. selfhut (40) - unbewartete Hütte
8. hut (50) - Hütte
9. alp (55) - Alp
10. bhotel (70) - einfaches Hotel
11. hostel (75) - Jugendherberge
12. special (80) - Spezial
13. hotel (90) - Hotel
14. resta (100) - Restaurant

**Icon Mapping**:

- Use existing sprites: `wd:detailed/accommodation.{slug}` and `wd:simple/accommodation.{slug}`
- Note: Backend symbol URLs currently have a bug, use sprite icons instead

**Implementation**:

- Fetch categories on overlay-config-store initialization
- Cache in Pinia store
- Use `identifier` field (e.g., "accommodation.bivouac") for filtering
- Display `name` in UI (e.g., "Biwak")

### State Management

**Pinia Store**: `overlay-config-store.ts`

```typescript
// src/stores/map/overlay-config-store.ts
import { defineStore } from 'pinia';
import { LocalStorage } from 'quasar';
import { ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { overlayConfigs } from '@stores/map/overlay-configs';
import { clientWodore } from '@clients/index';

export const useOverlayConfigStore = defineStore('overlayConfig', () => {
  const preferences = ref<OverlayPreferences>(LocalStorage.getItem('overlayPreferences') || {});

  const hutCategories = ref<HutCategory[]>([]);

  async function fetchHutCategories() {
    const { data } = await clientWodore.GET('/v1/categories/list/{category}', {
      params: {
        path: { category: 'accommodation' },
        query: { lang: 'de', is_active: true, media_mode: 'absolute' },
      },
    });
    if (data) {
      hutCategories.value = data;
    }
  }

  function getFilterValue(overlayName: string, filterId: string) {
    const config = overlayConfigs[overlayName];
    const filterDef = config?.filters?.find(f => f.id === filterId);

    return preferences.value[overlayName]?.filters?.[filterId] ?? filterDef?.defaultValue;
  }

  const debouncedApplyFilter = useDebounceFn(
    (overlayName: string, filterId: string, value: unknown) => {
      applyFilter(overlayName, filterId, value);
    },
    150
  );

  function setFilterValue(overlayName: string, filterId: string, value: unknown) {
    if (!preferences.value[overlayName]) {
      preferences.value[overlayName] = {};
    }
    if (!preferences.value[overlayName].filters) {
      preferences.value[overlayName].filters = {};
    }
    preferences.value[overlayName].filters![filterId] = value;
    LocalStorage.set('overlayPreferences', preferences.value);

    // Apply filter with debounce
    debouncedApplyFilter(overlayName, filterId, value);
  }

  function applyFilter(overlayName: string, filterId: string, value: unknown) {
    // Implementation in Phase 2
    // Apply MapLibre filter expressions to map layers
  }

  function reapplyAllFilters() {
    // Called after basemap switch to restore filters
    for (const overlayName in preferences.value) {
      const filters = preferences.value[overlayName].filters;
      if (filters) {
        for (const filterId in filters) {
          applyFilter(overlayName, filterId, filters[filterId]);
        }
      }
    }
  }

  return {
    preferences,
    hutCategories,
    fetchHutCategories,
    getFilterValue,
    setFilterValue,
    reapplyAllFilters,
  };
});
```

---

## Component Design

### Component Hierarchy

```
WdOverlayConfig.vue (Dialog/Drawer)
├── Tabs: [Filter, Info, Settings (placeholder)]
│   ├── WdOverlayConfigFilter.vue (Phase 2)
│   │   └── WdMultiSelectFilter.vue (generic, reusable)
│   ├── WdOverlayConfigLegend.vue (Phase 3)
│   └── WdOverlayConfigSettings.vue (Phase 4+, placeholder initially)
```

### Main Component: WdOverlayConfig.vue

**Purpose**: Container dialog/drawer that displays overlay configuration

**Props**:

- `overlayName: string` - Which overlay to configure
- `modelValue: boolean` - Dialog open/close state

**Features**:

- Responsive: Bottom sheet on mobile, side dialog on desktop
- Tabs for Filter, Info (Legend), Settings (placeholder)
- Close button
- Reset to defaults button

**Location**: `src/components/map/overlay-config/WdOverlayConfig.vue`

**Implementation**: See earlier example in document (Component Design section)

### Trigger Integration

**Modified Components**:

1. `WdOverlaySwitchItem.vue`:
   - Add `v-touch-hold:1500` for long-press
   - Add config icon on hover (desktop)
   - Emit `@configure` event
   - Accept `overlayName` prop

2. `WdOverlaySwitch.vue`:
   - Handle `@configure` event
   - Show `WdOverlayConfig` dialog
   - Track which overlay is being configured

---

## Implementation Plan

**Primary Focus**: Hut filter implementation with infrastructure for legend/info and settings

### Phase 1: Foundation & Type Definitions (Week 1)

#### Tasks

1. **Create overlay configuration system**
   - [ ] Define TypeScript interfaces for filter, setting, and legend definitions
   - [ ] Create `src/stores/map/overlay-configs/` directory
   - [ ] Create `src/stores/map/overlay-configs/types.ts`
   - [ ] Create `src/stores/map/overlay-configs/index.ts`
   - [ ] Create basic `src/stores/map/overlay-configs/huts.ts` (empty/minimal config to enable dialog)

2. **Create Pinia store**
   - [ ] Create `src/stores/map/overlay-config-store.ts`
   - [ ] Implement preference loading/saving from LocalStorage
   - [ ] Implement getter/setter methods for filters (and placeholders for settings)
   - [ ] Fetch hut categories from backend: `GET /v1/categories/list/accommodation?lang=de&is_active=true&media_mode=absolute`
   - [ ] Cache categories in store

3. **Create base components**
   - [ ] Create `src/components/map/overlay-config/` directory
   - [ ] Create `WdOverlayConfig.vue` (main dialog with tabs)
   - [ ] Create tab structure: Filter, Info (Legend), Settings (placeholder)
   - [ ] Add placeholder content for each tab (can show "Coming soon" or basic structure)

4. **Enable dialog trigger**
   - [ ] Update `WdOverlaySwitchItem.vue` to add long-press handler (1500ms) using `v-touch-hold:1500`
   - [ ] Add settings/config icon for desktop (shown on hover)
   - [ ] Add `overlayName` prop to `WdOverlaySwitchItem.vue`
   - [ ] Emit `@configure` event when long-press or icon clicked
   - [ ] Update `WdOverlaySwitch.vue` to handle `@configure` event
   - [ ] Show `WdOverlayConfig` dialog when triggered
   - [ ] Test dialog opens on long-press (mobile) and icon click (desktop)

### Phase 2: Hut Filter Implementation (PRIORITY - Week 1-2)

#### Tasks

1. **Complete hut overlay configuration**
   - [ ] Populate `src/stores/map/overlay-configs/huts.ts` (created in Phase 1)
   - [ ] Define hut type filter configuration using fetched categories
   - [ ] Map category identifiers to filter options with icons (`wd:detailed/accommodation.{slug}`)
   - [ ] Add legend structure (basic, will be populated in Phase 3)
   - [ ] Add settings structure (placeholder for Phase 4)

2. **Create filter components**
   - [ ] Create `WdOverlayConfigFilter.vue` (generic filter renderer)
   - [ ] Create `src/components/map/overlay-config/filters/` directory
   - [ ] Create `WdMultiSelectFilter.vue` (generic, reusable for huts and future overlays)
   - [ ] Implement multi-select UI with checkboxes and hut icons
   - [ ] Implement "Select All" / "Deselect All" buttons
   - [ ] Show filter count or active filter indicator

3. **Integrate with MapLibre**
   - [ ] Implement filter application in `overlay-config-store.ts`
   - [ ] Use `useDebounceFn` with 100-200ms debounce for filter updates
   - [ ] Apply MapLibre filter expression to all 7 hut layers:
     - `wd-huts`
     - `wd-huts-selected`
     - `wd-huts-occupation`
     - `wd-huts-occupation-day0` through `day3`
   - [ ] Use filter: `['in', ['get', 'type_standard_identifier'], ['literal', selectedIdentifiers]]`
   - [ ] Test filter with full dataset
   - [ ] Verify filter persistence in LocalStorage

4. **Implement actual filter functionality** (dialog trigger already done in Phase 1)
   - [ ] Verify dialog opens correctly with filter tab showing
   - [ ] Test filter UI with actual hut categories from backend

5. **Handle filter persistence across basemap switches**
   - [ ] Update `transformStyle` in `basemap-store.ts` to call `reapplyAllFilters()`
   - [ ] Ensure filters are restored after basemap change

### Phase 3: Hut Legend/Info (Week 2-3)

#### Tasks

1. **Define legend content**
   - [ ] Populate legend section in `huts.ts` configuration (structure created in Phase 2)
   - [ ] Define hut type symbols section with all 14 categories
   - [ ] Define occupancy colors section (Green=Empty, Yellow-Green=Low, Orange=Medium, Dark Orange=High, Red=Full, Gray=Unknown)
   - [ ] Add symbol zoom explanation (Simple icons < zoom 11, Detailed icons >= zoom 11)
   - [ ] Add descriptions for each section

2. **Create legend components**
   - [ ] Create `WdOverlayConfigLegend.vue` (generic legend renderer)
   - [ ] Support icon display with `q-icon`
   - [ ] Support color swatch display (circular colored divs)
   - [ ] Support section titles and descriptions
   - [ ] Make scrollable with `max-height: 60vh`

3. **Populate hut legend**
   - [ ] Display all 14 hut type icons with German names
   - [ ] Display occupancy color legend with meaning
   - [ ] Add explanation of zoom-dependent symbols
   - [ ] Test scrolling on mobile and desktop
   - [ ] Verify icons load correctly from `wd:detailed/accommodation.{slug}` sprites

### Phase 4: Hut Settings (FUTURE - Week 4+)

**Note**: Settings are lower priority. Focus is on filters first, then legend, then settings.

#### Tasks

1. **Define settings** (DEFERRED)
   - [ ] Populate settings section in `huts.ts` configuration
   - [ ] Define "Show Occupancy" toggle
   - [ ] Define "Number of Days" slider (1-4)
   - [ ] Icon transition zoom: deferred to later phase

2. **Create settings components** (DEFERRED)
   - [ ] Create `WdOverlayConfigSettings.vue` (generic settings renderer)
   - [ ] Support toggle controls with `q-toggle`
   - [ ] Support slider controls with `q-slider`
   - [ ] Support conditional rendering (dependsOn)
   - [ ] Use `useDebounceFn` for slider changes (100-200ms)

3. **Apply settings to map** (DEFERRED)
   - [ ] Implement occupancy visibility control
   - [ ] Implement dynamic day count (show/hide day0-day3 layers)
   - [ ] Update layer visibility based on settings
   - [ ] Test performance impact

### Phase 5: Polish & Testing (Week 3-4)

#### Tasks

1. **UI/UX refinement**
   - [ ] Test mobile bottom sheet experience
   - [ ] Test desktop side dialog experience
   - [ ] Add transitions and animations
   - [ ] Ensure accessibility (keyboard navigation, screen readers)

2. **State management**
   - [ ] Test LocalStorage persistence
   - [ ] Implement "Reset to Defaults" functionality
   - [ ] Test across browser sessions
   - [ ] Handle edge cases (corrupted LocalStorage, etc.)

3. **Performance optimization**
   - [ ] Profile filter application performance
   - [ ] Optimize re-renders
   - [ ] Verify debouncing works correctly
   - [ ] Test with full hut dataset (~5000 features)

4. **Documentation**
   - [ ] Document overlay configuration system
   - [ ] Add JSDoc comments to interfaces
   - [ ] Create developer guide for adding new overlays
   - [ ] Update AGENT_GUIDE.md

### Phase 6: Expand to Other Overlays (Future)

#### Tasks

1. **Transport overlay**
   - [ ] Create transport configuration
   - [ ] Add transport type filter
   - [ ] Add transport legend

2. **Hiking overlay**
   - [ ] Create hiking configuration
   - [ ] Add difficulty filter
   - [ ] Add trail legend

3. **Additional overlays**
   - [ ] Expand to other overlays as needed

---

## Resolved Decisions

All open questions have been resolved. Here are the final decisions:

### 1. Hut Types Source ✅ RESOLVED

**Decision**: Fetch from backend API

**Endpoint**: `GET /v1/categories/list/accommodation?lang=de&is_active=true&media_mode=absolute`

**Implementation**:

- Fetch on store initialization
- Cache in `hutCategories` ref
- Use `identifier` field for filtering (matches vector tile property `type_standard_identifier`)
- Display `name` in UI
- Use existing sprite icons (backend symbol URLs have a bug)

### 2. Filter Application Strategy ✅ RESOLVED

**Decision**: Use MapLibre filter expressions

**Implementation**: `map.setFilter(layerId, filterExpression)`

**Rationale**: Native, performant, GPU-accelerated. Sufficient for current needs.

### 3. Settings Application Timing ✅ RESOLVED

**Decision**: Apply changes immediately with small debounce (100-200ms)

**Implementation**: Use `useDebounceFn` from VueUse

**Rationale**: Real-time feedback with performance protection

### 4. Mobile Long-Press Duration ✅ RESOLVED

**Decision**: 1500ms (medium duration)

**Implementation**: `v-touch-hold:1500` directive

**Rationale**: Balance between quick access and avoiding accidental triggers

### 5. Icon Transition Zoom Setting ✅ RESOLVED

**Decision**: Not implemented in Phase 1-3 (deferred to Phase 4+)

**Rationale**: Keep initial scope focused on core filtering functionality

### 6. Filter Performance ✅ RESOLVED

**Decision**: Use MapLibre filter expressions, monitor performance

**Implementation**: Native MapLibre filtering should handle 5000+ huts efficiently

**Fallback**: Backend filtering via vector tile query parameters if needed (not expected)

**Testing**: Performance profiling in Phase 5

---

## Technical Considerations

### MapLibre Filter Expression for Hut Types

**Implementation Strategy**:

```typescript
// In overlay-config-store.ts
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';

function applyHutTypeFilter(selectedIdentifiers: string[]) {
  const mapRef = useMap();

  if (!mapRef.map) return;

  const hutLayers = [
    'wd-huts',
    'wd-huts-selected',
    'wd-huts-occupation',
    'wd-huts-occupation-day0',
    'wd-huts-occupation-day1',
    'wd-huts-occupation-day2',
    'wd-huts-occupation-day3',
  ];

  if (selectedIdentifiers.length === 0) {
    // Hide all huts (empty filter)
    const filter: ExpressionSpecification = ['==', ['get', 'type_standard_identifier'], ''];
    for (const layerId of hutLayers) {
      mapRef.map.setFilter(layerId, filter);
    }
  } else {
    // Show only selected types
    const filter: ExpressionSpecification = [
      'in',
      ['get', 'type_standard_identifier'],
      ['literal', selectedIdentifiers],
    ];

    for (const layerId of hutLayers) {
      if (mapRef.map.getLayer(layerId)) {
        mapRef.map.setFilter(layerId, filter);
      }
    }
  }
}
```

**Filter Property**: Use `type_standard_identifier` (matches category `identifier` field)

**Example Values**: `"accommodation.bivouac"`, `"accommodation.hut"`, `"accommodation.alp"`

### Preserving Filters Across Basemap Switches

**Implementation** (Phase 2):

```typescript
// In basemap-store.ts transformStyle function
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';

// After inserting custom layers into new basemap style
const configStore = useOverlayConfigStore();
configStore.reapplyAllFilters();
```

**Rationale**: Basemap switch rebuilds layers, so filters must be reapplied

### Generic Filter Component Architecture

**Strategy**: Build generic, reusable components

```vue
<!-- WdMultiSelectFilter.vue - Generic multi-select filter -->
<template>
  <div>
    <div class="row q-mb-md">
      <q-btn flat dense label="Select All" @click="selectAll" />
      <q-btn flat dense label="Deselect All" @click="deselectAll" />
    </div>

    <q-list>
      <q-item v-for="option in options" :key="option.value" tag="label" dense>
        <q-item-section avatar>
          <q-checkbox v-model="selected" :val="option.value" @update:model-value="handleUpdate" />
        </q-item-section>
        <q-item-section avatar v-if="option.icon">
          <q-icon :name="option.icon" size="sm" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ option.label }}</q-item-label>
          <q-item-label caption v-if="option.description">
            {{ option.description }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

interface Props {
  options: FilterOption[];
  modelValue: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: string[]];
}>();

const selected = ref<string[]>(props.modelValue);

watch(
  () => props.modelValue,
  newVal => {
    selected.value = newVal;
  }
);

function handleUpdate() {
  emit('update:modelValue', selected.value);
}

function selectAll() {
  selected.value = props.options.map(o => o.value);
  handleUpdate();
}

function deselectAll() {
  selected.value = [];
  handleUpdate();
}
</script>
```

---

## File Structure

```
src/
├── components/
│   └── map/
│       ├── WdOverlaySwitch.vue (updated)
│       ├── WdOverlaySwitchItem.vue (updated)
│       └── overlay-config/
│           ├── WdOverlayConfig.vue (new - main dialog)
│           ├── WdOverlayConfigFilter.vue (new - generic filter renderer)
│           ├── WdOverlayConfigSettings.vue (new - placeholder)
│           ├── WdOverlayConfigLegend.vue (new - generic legend renderer)
│           └── filters/
│               └── WdMultiSelectFilter.vue (new - generic multi-select)
│
├── stores/
│   └── map/
│       ├── overlay-store.ts (existing)
│       ├── overlay-config-store.ts (new - manages filters/settings state)
│       ├── overlay-configs/               (NEW LOCATION - not in utils/)
│       │   ├── types.ts (new - TypeScript interfaces)
│       │   ├── index.ts (new - exports all configs)
│       │   ├── huts.ts (new - hut overlay config)
│       │   ├── transport.ts (future)
│       │   └── hiking.ts (future)
│       └── utils/
│           ├── overlays.ts (existing)
│           └── overlay-huts.ts (existing)
```

---

## Next Steps

1. ✅ **Review and approve this document**
2. **Begin Phase 1**: Create type definitions and store infrastructure
3. **Implement Phase 2**: Hut type filtering (PRIORITY)
4. **Test filter functionality** with full dataset
5. **Implement Phase 3**: Legend/Info tab
6. **Defer Phase 4**: Settings to future release

---

## References

- Current overlay system: `src/stores/map/overlay-store.ts`
- Hut overlay definition: `src/stores/map/utils/overlay-huts.ts`
- Overlay switch UI: `src/components/map/WdOverlaySwitch.vue`
- Categories API: `GET /v1/categories/list/accommodation`
- MapLibre filter expressions: <https://maplibre.org/maplibre-style-spec/expressions/>
- Quasar Dialog: <https://quasar.dev/vue-components/dialog>
- Quasar LocalStorage: <https://quasar.dev/quasar-plugins/web-storage>
- VueUse useDebounceFn: <https://vueuse.org/shared/useDebounceFn/>

---

**End of Document**

**Status**: Ready for implementation. All decisions resolved. Focus on Phase 1-2 (filter implementation).
