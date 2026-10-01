# Tasks: Overlay Layer Groups

## Prerequisites

- [ ] Verify the existing `useUserSettingsStore` supports nested objects without migration
- [ ] Define the `LayerGroup` TypeScript interface in `src/stores/map/utils/interfaces.ts`

## Phase 1: Data layer

- [ ] Add `overlayGroups` to the user settings store (groups + activeGroupId)
- [ ] Create default predefined groups (Hiking, Cycling, Snowsport) as constants
- [ ] Add merge logic: new layers auto-assigned via `defaultGroup` hint or slug match
- [ ] Add `dismissedGroupSlugs` to settings
- [ ] Unit tests: group CRUD, merge with new layers, dismissed groups not re-merged

## Phase 2: Store integration

- [ ] Add `layersByGroup` computed to `useOverlayStore` (splits by active group + promotes)
- [ ] Wire group toggle: cycling the selector toggles all layers in the group on/off
- [ ] Unit tests: `layersByGroup` ordering, promotion of active hidden-group layers

## Phase 3: Mini view

- [ ] Create `WdOverlayGroupSelector` component (first fixed button)
- [ ] Render only active-group layers in the mini strip
- [ ] Show promoted layers from hidden groups below the selector
- [ ] Visual regression test: mini strip with group selector

## Phase 4: Expanded view

- [ ] Group section headers in the expanded list
- [ ] "All layers" separator with faded styling for non-active-group layers
- [ ] Promotion indicator (group-color dot) on active hidden-group layers
- [ ] Visual regression test: expanded view with groups

## Phase 5: Edit mode

- [ ] Edit mode toggle in the expanded view header
- [ ] Add/remove layers from groups (+/- buttons in edit mode)
- [ ] Rename group (inline or dialog)
- [ ] Create new group (bottom-sheet form)
- [ ] Delete group (layers → "All layers", slug → dismissed)
- [ ] Hide/unhide group
- [ ] Group icon picker (predefined set)
- [ ] Reorder groups (drag or up/down buttons)

## Phase 6: New group prompt

- [ ] Detect new predefined groups on app update
- [ ] Prompt user: "Add the [name] group?" with add/dismiss options
- [ ] Store dismissed slugs

## Phase 7: Polish & verification

- [ ] Design review with the impeccable skill
- [ ] Interaction tests: group cycle, expanded grouping, edit CRUD
- [ ] Visual regression: all new states
- [ ] Full `yarn test:ci` + `yarn test:visual` pass
