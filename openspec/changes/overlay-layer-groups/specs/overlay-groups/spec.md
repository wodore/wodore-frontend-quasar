# Overlay Groups — Delta Spec

## ADDED Requirements

### Group data model

- **Requirement**: Layer groups SHALL be stored as `LayerGroup` objects with `id` (UUID), `slug` (stable merge key), `name`, `icon`, `layerSlugs` (ordered), `activeLayerSlugs` (per-group active state), `hidden`, `removed`, `locked`, and `sortOrder`.
- **Requirement**: Group settings SHALL persist in `useUserSettingsStore` under `map.overlayGroups` with `groups`, `activeGroupId`, `ungroupedActiveSlugs`, and `dismissedGroupSlugs`.
- **Requirement**: Predefined group names SHALL use i18n keys for translation. Custom group names SHALL be literal strings (same across all languages). Renaming a predefined group SHALL replace the i18n key with a literal string.
- **Requirement**: The `removed` flag SHALL permanently hide a group from the user while retaining its slug for merge decisions (backend imports never re-create removed groups).
- **Requirement**: The `hidden` flag SHALL remove a group from the mini selector only; the group remains accessible in the expanded view.
- **Requirement**: Each group SHALL remember its own `activeLayerSlugs`. Switching groups SHALL save the current group's active state and restore the new group's.

### Predefined groups

- **Requirement**: Default groups SHALL be: Hiking (`hiking`), Cycling (`cycling`), Snowsport (`snowsport`).
- **Requirement**: The `huts` layer and `transport` layer SHALL be included in ALL default groups.
- **Requirement**: The `slope_angle` layer SHALL be included in the Snowsport group.
- **Requirement**: Layers not in any group (e.g., livestock_guardian_dogs) SHALL appear in an "All layers" section.

### Mini view group selector

- **Requirement**: The group selector SHALL be fixed at the BOTTOM of the mini strip, directly above the more (expand) button.
- **Requirement**: Tapping the group selector SHALL cycle to the next visible (non-hidden, non-removed) group.
- **Requirement**: The mini strip SHALL show only layers from the active group above the selector.
- **Requirement**: Cycling groups SHALL save the outgoing group's active layer state and restore the incoming group's.

### Expanded view grouping

- **Requirement**: The expanded view SHALL show the active group's layers first (full opacity), then a separator labelled "All layers", then all other layers (faded, tonal background).
- **Requirement**: An active layer from another group SHALL be promoted to the top of the "All layers" section with a group-color dot.
- **Requirement**: Hidden groups' layers SHALL still appear in the "All layers" section.

### Group editing

- **Requirement**: Groups SHALL be locked by default. An edit mode toggle in the expanded view's header SHALL unlock CRUD operations.
- **Requirement**: In edit mode, users SHALL be able to: add/remove layers from a group, rename a group, reorder groups, create a new group, delete a group (sets `removed: true`), hide a group (sets `hidden: true`).
- **Requirement**: Deleting a group SHALL set `removed: true` (layers go to "All layers", slug retained for merge).
- **Requirement**: Hiding a group SHALL set `hidden: true` (group excluded from mini selector only).

### Merge strategy

- **Requirement**: New layers matching a group's `layerSlugs` SHALL remain in that group after store updates.
- **Requirement**: New layers with a `defaultGroup` hint matching an existing group's `slug` SHALL be auto-added to that group (unless the group is `removed`).
- **Requirement**: New predefined groups (from app updates or backend) SHALL prompt the user once; declined groups are added to `dismissedGroupSlugs`.
- **Requirement**: Groups with `removed: true` SHALL never be re-created or re-prompted from backend imports.
- **Requirement**: Renaming a group SHALL NOT change its `slug`; merge continues.

### Layer source migration

- **Requirement**: The merge strategy SHALL work identically whether layers come from the frontend (hardcoded) or the backend (API-fetched).
- **Requirement**: Layers removed from the source (backend/frontend) SHALL be marked inactive in the UI; their slug SHALL remain in `layerSlugs` in case they return.

### Group icons

- **Requirement**: Each group SHALL have an icon from a predefined set (Iconify/`wd` custom icons).
- **Requirement**: Image upload for group icons SHALL NOT be implemented in this phase.
