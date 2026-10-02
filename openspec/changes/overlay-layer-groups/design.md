# Design: Overlay Layer Groups

## Context

The overlay system (`WdOverlayControl`) currently renders all 11 layers as a flat mini strip and an expanded list. Layer metadata (name, icon, active state, config) lives in the overlay store (`useOverlayStore`). **Layers are currently defined in the frontend; they will migrate to the backend** — the merge strategy must handle backend-driven layer lists arriving incrementally. User settings persist via `useUserSettingsStore` (Pinia + localStorage, debounced writes). The app runs as a PWA and Capacitor Android app — `@capacitor/preferences` is the target storage abstraction for native.

## Goals / Non-Goals

### Goals
- Users can organise layers into groups (predefined + custom)
- One-tap group toggle from the mini strip
- Clear visual separation of active vs hidden groups in the expanded view
- Group edit mode with add/remove/rename/delete/hide
- Persistence that survives app restarts and merges gracefully with store updates (frontend OR backend layer sources)
- Simple UX: groups locked by default, edit mode is opt-in
- Per-group active layer memory (each group remembers which layers are on)

### Non-Goals
- Server-side sync (future PR — but the data model is designed for it)
- Custom user-uploaded layer sources (future)
- Nested groups (groups are flat)
- Group-level styling (opacity, filters — per-layer config stays as-is for now)
- Layer editing (rename, hide globally, style settings — future PR, but data model accommodates)

## Data Model

```typescript
interface LayerGroup {
  id: string;              // UUID (client-generated)
  slug: string;            // stable identifier for merge (e.g., 'hiking', 'snowsport')
  name: string;            // user-editable display name
                             // predefined groups: i18n key (translated at render)
                             // custom groups: literal string (same across languages)
                             // if user edits a predefined name: literal string replaces i18n key
  icon: string;            // iconify name or asset path
  layerSlugs: string[];    // ordered list of layer slugs
  activeLayerSlugs: string[]; // layers currently toggled ON in this group
  hidden: boolean;         // hidden groups: not in mini selector, still in expanded view
  removed: boolean;        // removed groups: never shown, but slug retained for merge
  locked: boolean;         // predefined groups are locked by default (edit mode to change)
  sortOrder: number;       // display order
}

interface OverlayGroupSettings {
  groups: LayerGroup[];
  activeGroupId: string | null;  // which group the mini selector is on
  ungroupedActiveSlugs: string[]; // active layers NOT in any group
  dismissedGroupSlugs: string[];  // groups user declined or deleted (no re-prompt)
  editMode: boolean;             // per session, not persisted
}
```

### Key decisions

- **`removed` vs `hidden`**: `hidden` = temporarily out of the mini selector but accessible in expanded view. `removed` = permanently gone from the user's view; the slug stays in the settings so a backend re-import doesn't re-create it.
- **`activeLayerSlugs`**: each group remembers its own active state. Switching groups restores the remembered state (layers toggle to what they were when the group was last active).
- **`ungroupedActiveSlugs`**: layers not in any group (e.g., transport) track their active state separately.
- **Translatable names**: predefined groups use i18n keys (`overlays.groups.hiking.name`). Custom groups use literal strings. If a user renames a predefined group, the literal string replaces the i18n key for all languages.

### Future hooks (data model accommodates, not implemented)

- **Group-level layer settings**: `layerSettings?: Record<string, LayerSetting>` per group (overrides global)
- **Global layer settings**: `globalLayerSettings?: Record<string, LayerSetting>` (applies to all groups)
- **Layer editing**: `layerOverrides?: Record<string, { name?: string; hidden?: boolean; style?: object }>`

### Storage

Settings stored in `useUserSettingsStore` under `map.overlayGroups`:
```typescript
// user-settings-store addition
overlayGroups: OverlayGroupSettings
```

Uses the existing debounced localStorage write path. For Capacitor, migrate to `@capacitor/preferences` in a follow-up settings-management PR.

## Layer Source Migration (frontend → backend)

Layers are currently hardcoded in the frontend (`overlays.ts`). When they move to the backend:

1. The overlay store fetches the layer list from the API
2. The merge strategy (below) assigns new layers to existing groups via slug matching
3. Layers removed from the backend are marked inactive in the UI (slug stays in `layerSlugs` in case it returns)
4. The `LayerGroup` data model doesn't change — it references layers by slug regardless of source

### Merge Strategy

When the overlay store's layer list changes (new layer, removed layer):
1. For each layer, find a group whose `layerSlugs` contains the layer's slug → stays in that group.
2. New layers: check the layer's `defaultGroup` hint (from the layer metadata, frontend or backend). If a group with a matching `slug` exists and is not `removed`, auto-add silently.
3. New predefined groups (from an app update or backend): compare by `slug`. If the user doesn't have it and it's not in `dismissedGroupSlugs` or `removed`, prompt: "Add the new [name] group?" Yes → add. No → add slug to `dismissedGroupSlugs`.
4. Deleted (`removed: true`) groups: layers go back to "Ungrouped". The slug stays with `removed: true` — never re-created from a backend import.
5. Renamed groups: `slug` never changes (only `name` does) — merge continues.

## Predefined Groups

| Slug | Name key | Layers | Icon |
|---|---|---|---|
| `hiking` | overlays.groups.hiking | huts, hiking_trails, nature_protection, **transport** | hiking |
| `cycling` | overlays.groups.cycling | mtb, cycling, **huts**, **transport** | mtb |
| `snowsport` | overlays.groups.snowsport | ski_tours, snowshoeing, ski_slopes, slope_angle, **huts**, **transport** | skitouren |

**Huts and transport appear in ALL default groups** — they're universally relevant for any mountain activity.

Layers not in any default group: livestock_guardian_dogs (niche, activity-agnostic).

## UI Design

### Mini view (collapsed strip)

```
┌────┐
│ 🏠 │  ← layers of the active group
│ 🥾 │
│ 🌿 │
│ ...│
│ ⛰ │  ← group selector (FIXED AT THE BOTTOM, above the more button)
│ ⋮  │  ← more (expand) button
└────┘
```

- **Group selector**: fixed at the BOTTOM of the strip, directly above the more button. Icon = active group's icon. Tap → cycles to the next visible group.
- **Group layers**: only layers from the active group are shown above the selector.
- **Group active state**: switching groups restores the new group's `activeLayerSlugs` and saves the previous group's state.

### Expanded view

```
┌─────────────────────────────┐
│ ⛰ Hiking          [edit]   │  ← header/toolbar (existing)
├─────────────────────────────┤
│ 🏠 Huts              ●     │  ← active group layers (full opacity)
│ 🥾 Hiking trails     ○     │
│ 🚌 Stops             ●     │  ← transport: in all groups
├────────── ─────────────────┤  ← separator (hairline + "All layers" label)
│ 🐕 Livestock dogs    ○     │  ← ungrouped (faded, tonal bg)
│ 🚵 MTB               ●     │  ← active from another group → promoted + dot
└─────────────────────────────┘
```

- **Active group section**: full-opacity labels, standard chips.
- **Separator**: hairline + "All layers" label.
- **Ungrouped/other-group layers**: faded labels (60% opacity), tonal chip background, smaller info/filter buttons.
- **Promotion**: a layer from another group that's active appears at the top of the "All layers" section with a small dot in its group's color.

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
| `WdOverlayGroupSelector` | `controls/WdOverlayGroupSelector.vue` | Mini strip bottom button — cycles groups, restores group active state |
| `WdOverlayGroupHeader` | `controls/WdOverlayGroupHeader.vue` | Expanded view group section header |
| `WdOverlayGroupEditSheet` | `controls/WdOverlayGroupEditSheet.vue` | Bottom sheet for group editing (rename, icon, delete) |

### Store changes

`useOverlayStore` gains:
- `layersByGroup` computed: splits layers by active group + promotes
- `cycleGroup()`: switches to next visible group, saves/restores active states
- `toggleGroupLayer()`: toggles a layer within the current group's `activeLayerSlugs`

## Testing

- **Unit**: group store logic (merge, promote, cycle, CRUD, active state memory)
- **Interaction**: mini selector cycles groups, expanded view shows groups, edit mode CRUD
- **Visual regression**: expanded view with groups, group selector in mini strip
