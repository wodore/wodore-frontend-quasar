# Design: Overlay Layer Groups

## Context

The overlay system (`WdOverlayControl`) currently renders all 11 layers as a flat mini strip and an expanded list. Layer metadata (name, icon, active state, config) lives in the overlay store (`useOverlayStore`). User settings persist via `useUserSettingsStore` (Pinia + localStorage, debounced writes). The app runs as a PWA and Capacitor Android app — `@capacitor/preferences` is the target storage abstraction for native.

## Goals / Non-Goals

### Goals
- Users can organise layers into groups (predefined + custom)
- One-tap group toggle from the mini strip
- Clear visual separation of active vs hidden groups in the expanded view
- Group edit mode with add/remove/rename/delete/hide
- Persistence that survives app restarts and merges gracefully with store updates
- Simple UX: groups locked by default, edit mode is opt-in

### Non-Goals
- Server-side sync (future PR — but the data model is designed for it)
- Custom user-uploaded layer sources (future)
- Nested groups (groups are flat)
- Group-level styling (opacity, filters — per-layer config stays as-is)

## Data Model

```typescript
interface LayerGroup {
  id: string;              // UUID (client-generated)
  slug: string;            // stable identifier for merge (e.g., 'hiking', 'snowsport')
  name: string;            // user-editable display name
  icon: string;            // iconify name or asset path
  layerSlugs: string[];    // ordered list of layer slugs (e.g., 'huts', 'hiking_trails')
  hidden: boolean;         // hidden groups: not in mini selector, still in expanded view
  locked: boolean;         // predefined groups are locked by default (edit mode to change)
  sortOrder: number;       // display order
}

interface OverlayGroupSettings {
  groups: LayerGroup[];
  activeGroupId: string | null;  // which group the mini selector is on
  editMode: boolean;             // global toggle (per session, not persisted)
}
```

### Storage

Settings stored in `useUserSettingsStore` under `map.overlayGroups`:
```typescript
// user-settings-store addition
overlayGroups: {
  groups: LayerGroup[];
  activeGroupId: string | null;
}
```

Uses the existing debounced localStorage write path. For Capacitor, migrate to `@capacitor/preferences` in a follow-up settings-management PR.

### Merge Strategy

When the overlay store's layer list changes (new layer, removed layer):
1. For each layer, find a group whose `layerSlugs` contains the layer's slug → stays in that group.
2. New layers with no group: check the layer's `defaultGroup` hint (from the overlay store metadata). If a group with a matching `slug` exists, auto-add. Otherwise, add to an "Ungrouped" virtual group.
3. New predefined groups (from a future update): compare by `slug`. If the user doesn't have it, prompt: "Add the new [name] group?" Yes → add with predefined layers. No → skip (don't ask again; store `dismissedGroupSlugs`).
4. Deleted groups: layers go back to "Ungrouped". The group's `slug` is added to `dismissedGroupSlugs` so it isn't re-merged.
5. Renamed groups: `slug` never changes (only `name` does) — merge continues.

## Predefined Groups

| Slug | Name | Layers | Icon |
|---|---|---|---|
| `hiking` | Hiking | huts, hiking_trails, nature_protection | hiking |
| `cycling` | Cycling | mtb, cycling | mtb |
| `snowsport` | Snowsport | ski_tours, snowshoeing, ski_slopes | skitouren |

Layers not in any group: transport (stops), livestock_guardian_dogs, slope_angle — these stay in the "All" / ungrouped view.

## UI Design

### Mini view (collapsed strip)

```
┌────┐
│ ⛰ │  ← group selector (FIXED first button) — icon of active group
├────┤
│ 🏠 │  ← layers of the active group (tapping toggles individually)
│ 🥾 │
│ 🌿 │
│ ...│
│ ⋮  │  ← more (expand) button
└────┘
```

- **Group selector**: first button, always visible. Icon = active group's icon. Tap → cycles to next visible group. Long-press → shows group picker (bottom sheet on mobile).
- **Group layers**: only layers from the active group are shown in the mini strip.
- **Selected from hidden groups**: if a layer from a non-active group is toggled on, it appears at the TOP of the mini strip (just below the group selector) with a "guest" indicator (small group-colored dot).

### Expanded view

```
┌─────────────────────────────┐
│ ⛰ Hiking          [edit]   │  ← header/toolbar (existing)
├─────────────────────────────┤
│ 🏠 Huts              ●     │  ← active group layers (full opacity)
│ 🥾 Hiking trails     ○     │
│ 🌿 Nature protection ○     │
├────────── ─────────────────┤  ← separator (hairline or gap + label)
│ 🚌 Stops             ○     │  ← "All layers" (faded, tonal bg)
│ 🐕 Livestock dogs    ○     │
│ ⛔ Slope angle        ○     │
│ 🚵 MTB               ●     │  ← selected from hidden group → promoted up
└─────────────────────────────┘
```

- **Active group section**: full-opacity labels, standard chips.
- **Separator**: hairline + "All layers" label.
- **Hidden/other layers**: faded labels (60% opacity), tonal chip background, smaller info/filter buttons.
- **Promotion**: a hidden-group layer that's active appears at the top of the "All layers" section (or just below the separator), with a small dot in its group's color.

### Edit mode

- Accessible from the expanded view's header (pencil icon → becomes "done" checkmark).
- In edit mode:
  - Group headers show drag handles (reorder)
  - Layers have +/- buttons to add/remove from the group
  - "Add group" button at the bottom
  - Long-press a group → context menu (rename, delete, hide, icon)
- Locked groups show a lock badge; unlock via context menu.

## Architecture

### New components

| Component | Path | Purpose |
|---|---|---|
| `WdOverlayGroupSelector` | `controls/WdOverlayGroupSelector.vue` | Mini strip first button — cycles groups |
| `WdOverlayGroupHeader` | `controls/WdOverlayGroupHeader.vue` | Expanded view group section header |
| `WdOverlayGroupEditSheet` | `controls/WdOverlayGroupEditSheet.vue` | Bottom sheet for group editing (rename, icon, delete) |

### Store changes

`useOverlayStore` gains a computed `layersByGroup` getter that:
1. Reads group assignments from `useUserSettingsStore().overlayGroups`
2. Splits layers into `activeGroupLayers` and `otherLayers`
3. Promotes active layers from other groups to the top of `otherLayers`

### Settings management (prerequisite or co-requisite)

The existing `useUserSettingsStore` handles persistence. This feature adds a new nested object. No schema migration needed (absent key = default groups). `@capacitor/preferences` migration is a separate concern.

## Migration / Compatibility

- **First boot**: default predefined groups are created. No user action needed.
- **Existing users**: no groups → defaults created on first access. Active layers stay active.
- **New layer added upstream**: if it has a `defaultGroup` hint matching a user's group slug, auto-added silently. Otherwise appears in "All layers".
- **New predefined group shipped**: user prompted once. Dismissed slugs are remembered.

## Testing

- **Unit**: group store logic (merge, promote, cycle, CRUD)
- **Interaction**: mini selector cycles groups, expanded view shows groups, edit mode CRUD
- **Visual regression**: expanded view with groups, group selector in mini strip
