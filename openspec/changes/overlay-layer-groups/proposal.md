# Proposal: Overlay Layer Groups

## Why

The overlay mini strip shows 11 flat layer buttons — too many to scan quickly and no seasonal context (hiking vs winter sport layers are interleaved). Users need to toggle a small set of related layers at once (e.g., "show me winter sport overlays") rather than tapping each individually.

## What Changes

- **Layer groups**: layers can be organised into named groups (e.g., Hiking, Cycling, Snowsport). Predefined groups ship by default; users can edit, create, delete, and hide them.
- **Mini view group selector**: the first (fixed) button in the mini strip cycles through groups. Pressing it toggles all layers of the active group on/off in one tap.
- **Expanded view grouping**: layers are shown grouped with headers. Layers from the active group appear at the top; "hidden" (inactive group) layers appear below a visual separator, styled differently (faded/tonal).
- **Active promotion**: selecting a hidden-group layer moves it up, just below the active group's layers.
- **Group edit mode**: groups are locked by default. An edit mode (accessed from the expanded view's header/toolbar) unlocks add/remove/rename/reorder/delete/hide.
- **Persistence**: group assignments stored in user settings (local via `@capacitor/preferences` initially, server sync later).
- **Merge strategy**: each group has a slug. New incoming layers with a matching slug are auto-added to the group. Deleted groups stop merging. New predefined groups prompt the user.
- **Group icons**: each group has an icon (predefined set; image upload later).
