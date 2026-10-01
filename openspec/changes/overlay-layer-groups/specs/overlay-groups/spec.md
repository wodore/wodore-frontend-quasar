# Overlay Groups — Delta Spec

## ADDED Requirements

### Group data model
- **Requirement**: Layer groups SHALL be stored as `LayerGroup` objects with `id` (UUID), `slug` (stable merge key), `name`, `icon`, `layerSlugs` (ordered), `hidden`, `locked`, and `sortOrder`.
- **Requirement**: Group settings SHALL persist in `useUserSettingsStore` under `map.overlayGroups` with `groups` and `activeGroupId`.
- **Requirement**: Absent settings SHALL initialize with the three predefined groups: Hiking (`hiking`), Cycling (`cycling`), Snowsport (`snowsport`).

### Mini view group selector
- **Requirement**: The first button in the mini strip SHALL be a fixed group selector showing the active group's icon.
- **Requirement**: Tapping the group selector SHALL cycle to the next visible (non-hidden) group.
- **Requirement**: The mini strip SHALL show only layers from the active group below the selector.
- **Requirement**: An active layer from a non-active group SHALL appear just below the group selector with a group-color dot indicator.

### Expanded view grouping
- **Requirement**: The expanded view SHALL show the active group's layers first (full opacity), then a separator labelled "All layers", then all other layers (faded, tonal background).
- **Requirement**: An active layer in the "All layers" section SHALL be promoted to the top of that section with a group-color dot.
- **Requirement**: Hidden groups' layers SHALL still appear in the "All layers" section.

### Group editing
- **Requirement**: Groups SHALL be locked by default. An edit mode toggle in the expanded view's header SHALL unlock CRUD operations.
- **Requirement**: In edit mode, users SHALL be able to: add/remove layers from a group, rename a group, reorder groups, create a new group, delete a group (layers go to "All layers"), hide a group (not in mini selector, still in expanded view).
- **Requirement**: Deleting a group SHALL add its slug to a `dismissedGroupSlugs` list preventing auto-merge on future updates.

### Merge strategy
- **Requirement**: New layers matching a group's `layerSlugs` SHALL remain in that group after store updates.
- **Requirement**: New layers with a `defaultGroup` hint matching an existing group's `slug` SHALL be auto-added to that group.
- **Requirement**: New predefined groups (from app updates) SHALL prompt the user once; dismissed groups are not re-prompted.
- **Requirement**: Renaming a group SHALL NOT change its `slug`; merge continues.

### Group icons
- **Requirement**: Each group SHALL have an icon from a predefined set (Iconify/`wd` custom icons).
- **Requirement**: Image upload for group icons SHALL NOT be implemented in this phase.
