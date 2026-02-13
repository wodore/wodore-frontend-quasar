# Overlay Configuration System - Phase 1 Complete

**Date:** Thu, 13 Feb 2026  
**Status:** ✅ Phase 1 Complete - Ready for Phase 2

---

## Summary

Phase 1 of the overlay configuration system has been successfully implemented. Users can now trigger a configuration drawer for overlays (currently huts) via long-press or by clicking dedicated config icons.

---

## What Was Implemented

### 1. Type Definitions

- **File:** `src/stores/map/overlay-configs/types.ts`
- Comprehensive TypeScript interfaces for filters, settings, legends
- `FilterDefinition`, `SettingDefinition`, `LegendDefinition`
- `OverlayConfig`, `OverlayPreferences`
- `HutCategory` interface for backend API data

### 2. Overlay Configuration Files

- **File:** `src/stores/map/overlay-configs/huts.ts`
  - Minimal configuration created (to be populated in Phase 2)
  - Includes placeholder legend with "Coming soon" message
- **File:** `src/stores/map/overlay-configs/index.ts`
  - Central export for all overlay configs

### 3. Pinia Store

- **File:** `src/stores/map/overlay-config-store.ts`
- Features:
  - Automatic fetching of hut categories from backend API on initialization
  - LocalStorage integration for user preferences (key: `overlayPreferences`)
  - Debounced filter application (150ms) using `useDebounceFn`
  - MapLibre filter expression implementation for hut types
  - Methods to reapply filters after basemap switches
  - Filter and setting getter/setter methods

### 4. Dialog Component

- **File:** `src/components/map/overlay-config/WdOverlayConfig.vue`
- **Type:** Left drawer (persistent), not dialog overlay
- **Width:** 400px
- **Behavior:** Overlay mode with mobile-optimized scrolling
- **Tabs:** Filter, Info (Legend), Settings
- **Features:**
  - Accepts `initialTab` prop to open specific tab
  - Only shows tabs if content exists
  - Reset to defaults button
  - German labels
  - Uses `wd-` prefix icons (`wd-close`, `wd-info-outline`, `wd-edit-outline`)

### 5. Trigger Integration

- **Modified:** `src/components/map/WdOverlaySwitchItem.vue`
  - Added long-press handler (1500ms) using `v-touch-hold:1500.mouse`
  - Emits `@configure` event
  - Added `overlayName` prop

- **Modified:** `src/components/map/WdOverlaySwitch.vue`
  - Added three config icons **outside** each overlay button (to the right):
    - **Filter icon** (`wd-edit-outline`) - Opens filter tab
    - **Info icon** (`wd-info-outline`) - Opens legend/info tab
    - **Settings icon** (`wd-edit`) - Opens settings tab
  - Icons only shown if overlay has that type of content
  - Clicking icon opens drawer with specific tab pre-selected
  - Long-press on overlay button also opens drawer
  - Manages drawer state and passes `initialTab` prop

---

## UI Structure

### Overlay Switcher Layout

```
┌─────────────────────────────────────┐
│ [Hut Icon] [🖊️] [ℹ️] [⚙️]           │
│            └─────┬─────┘             │
│         Config Icons                 │
│  (Filter, Info, Settings)            │
└─────────────────────────────────────┘
```

### Left Drawer Content

```
┌──────────────────────────────────┐
│ Hütten                       [×] │
├──────────────────────────────────┤
│ [Filter] [Info] [Einstellungen]  │
├──────────────────────────────────┤
│                                  │
│  Tab Content Here                │
│  (Currently "Coming soon")       │
│                                  │
├──────────────────────────────────┤
│                  [Zurücksetzen] →│
└──────────────────────────────────┘
```

---

## Key Implementation Decisions

### Icons

- **Custom icons:** `wd-` prefix (defined in `src/extras/icons/dist/icons.ts`)
- **Examples:** `wd-close`, `wd-info-outline`, `wd-edit-outline`, `wd-edit`
- **No Material Icons:** Using custom icon system for consistency

### Dialog Type

- **Left drawer** (persistent), not overlay dialog
- **Reason:** Same UX pattern as main menu
- **Mobile:** Full overlay with scroll area
- **Desktop:** 400px width drawer

### Config Icons Position

- **Location:** Outside overlay button, to the right
- **Layout:** Horizontal row with small spacing
- **Conditional:** Only shown if overlay has filters/legend/settings
- **Interaction:** Click opens drawer to specific tab

### Long-Press Duration

- **Duration:** 1500ms (medium)
- **Device:** Works on both touch and mouse
- **Fallback:** Config icons provide direct access

### Tab Visibility Logic

- Only show Filter tab if `filters.length > 0`
- Only show Info tab if `legend !== undefined`
- Only show Settings tab if `settings.length > 0`
- Default tab: Filter (if exists) → Legend → Settings
- Can override with `initialTab` prop

---

## Backend Integration

### API Endpoint

```
GET /v1/categories/list/accommodation?lang=de&is_active=true&media_mode=absolute
```

### Response

14 hut categories fetched successfully:

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

### Console Output

```
[OverlayConfigStore] Fetched 14 hut categories
```

---

## Testing Instructions

### Start Dev Server

```bash
yarn dev
# Opens on http://localhost:9000
```

### Test on Desktop

1. Open browser to http://localhost:9000
2. Look for **huts overlay** in switcher (left side)
3. You should see **three small icons** to the right of the hut icon:
   - Filter icon (pencil outline)
   - Info icon (info circle outline)
   - Settings icon (edit/gear)
4. Click **Info icon** → left drawer opens showing "Coming soon" message
5. Click **X** to close drawer
6. Click **Filter icon** → drawer opens to Filter tab (also shows "Coming soon")
7. Long-press (hold) on hut icon for 1.5 seconds → drawer opens

### Test on Mobile

1. Open browser DevTools
2. Switch to mobile/responsive mode
3. Open http://localhost:9000
4. Long-press on hut icon → drawer opens as full overlay
5. Swipe or click outside to close

### Verify Backend Integration

1. Open browser DevTools Console
2. Look for: `[OverlayConfigStore] Fetched 14 hut categories`
3. Confirms API is working

### Test Dialog Features

1. Click between tabs (only "Info" is visible, others say "Coming soon")
2. Click "Zurücksetzen" button → shows success notification
3. Close drawer and reopen → state is preserved (via LocalStorage)

---

## Code Quality

### Linting

```bash
yarn lint
# ✅ No errors or warnings
```

### Type Safety

- All TypeScript interfaces properly defined
- No `any` types used
- Proper type inference throughout

---

## What's Next: Phase 2

Phase 2 will implement **actual filter functionality**:

1. **Populate hut configuration** (`huts.ts`) with filter definitions from fetched categories
2. **Create filter components:**
   - `WdOverlayConfigFilter.vue` (generic filter renderer)
   - `WdMultiSelectFilter.vue` (reusable multi-select with checkboxes)
3. **Implement filtering:**
   - Map hut categories to filter options with icons
   - Apply MapLibre filter expressions to all 7 hut layers
   - Handle "Select All" / "Deselect All"
   - Show active filter count
4. **Handle filter persistence:**
   - Reapply filters after basemap switches
   - Verify LocalStorage persistence works

### Phase 2 Deliverables

- Working hut type filter with checkboxes and icons
- MapLibre filtering applied to map layers
- Filter state persists across sessions
- Filter count indicator

---

## Files Created

```
src/stores/map/overlay-configs/
├── types.ts                    # Type definitions
├── huts.ts                     # Hut overlay config (minimal)
└── index.ts                    # Central export

src/stores/map/
└── overlay-config-store.ts     # Pinia store

src/components/map/overlay-config/
└── WdOverlayConfig.vue         # Left drawer component
```

## Files Modified

```
src/components/map/
├── WdOverlaySwitchItem.vue     # Long-press handler
└── WdOverlaySwitch.vue         # Config icons, drawer integration
```

---

## References

- Original planning document: Created in session (not saved to disk initially)
- Hut categories API: `GET /v1/categories/list/accommodation`
- Custom icons: `src/extras/icons/dist/icons.ts`
- MapLibre filter expressions: https://maplibre.org/maplibre-style-spec/expressions/
- VueUse useDebounceFn: https://vueuse.org/shared/useDebounceFn/
- Quasar Drawer: https://quasar.dev/vue-components/drawer

---

**End of Phase 1 Summary**

**Status:** ✅ Complete and tested. Ready for Phase 2 (filter implementation).
