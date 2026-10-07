# Tasks: Overlay Layer Groups

## Prerequisites

- [ ] Verify the existing `useUserSettingsStore` supports nested objects without migration
- [ ] Define the `LayerGroup` + `OverlayGroupSettings` TypeScript interfaces in `src/stores/map/utils/interfaces.ts`
- [ ] Add i18n keys for predefined group names (`overlays.groups.hiking.name`, etc.) in all 4 locales

## Phase 1: Data layer

- [ ] Add `overlayGroups` to the user settings store (groups + activeGroupId + ungroupedActiveSlugs + dismissedGroupSlugs)
- [ ] Create default predefined groups (Hiking, Cycling, Snowsport) — huts + transport in ALL, slope_angle in Snowsport
- [ ] Add `removed` flag semantics: removed groups skipped in all UI, slug blocks re-merge
- [ ] Add merge logic: new layers auto-assigned via `defaultGroup` hint or slug match (respects `removed` and `dismissedGroupSlugs`)
- [ ] Add per-group active state memory (`activeLayerSlugs`)
- [ ] Unit tests: group CRUD, merge with new layers, removed vs hidden, active state save/restore on group switch, dismissed groups not re-prompted

## Phase 2: Store integration

- [ ] Add `layersByGroup` computed to `useOverlayStore` (splits by active group + promotes active other-group layers)
- [ ] Add `cycleGroup()` action: saves outgoing group's activeLayerSlugs, restores incoming group's
- [ ] Add `toggleGroupLayer()` action: toggles within the current group's activeLayerSlugs
- [ ] Handle ungrouped layers via `ungroupedActiveSlugs`
- [ ] Unit tests: `layersByGroup` ordering, promotion, cycleGroup state persistence

## Phase 3: Mini view

- [ ] Create `WdOverlayGroupSelector` component (fixed at the BOTTOM, above the more button)
- [ ] Render only active-group layers in the mini strip above the selector
- [ ] Implement group cycling: tap selector → next visible group
- [ ] Save/restore per-group active state on cycle
- [ ] Visual regression test: mini strip with group selector (bottom position)

## Phase 4: Expanded view

- [ ] Group section headers in the expanded list
- [ ] "All layers" separator with faded styling for non-active-group layers
- [ ] Promotion indicator (group-color dot) on active other-group layers
- [ ] Hidden groups' layers still visible in "All layers"
- [ ] Visual regression test: expanded view with groups

## Phase 5: Edit mode

- [ ] Edit mode toggle in the expanded view header
- [ ] Add/remove layers from groups (+/- buttons in edit mode)
- [ ] Rename group (inline or dialog; predefined → literal string replaces i18n key)
- [ ] Create new group (bottom-sheet form with icon picker)
- [ ] Delete group (sets `removed: true`, layers → "All layers")
- [ ] Hide/unhide group (sets `hidden: true`)
- [ ] Group icon picker (predefined set)
- [ ] Reorder groups (drag or up/down buttons)

## Phase 6: New group prompt

- [ ] Detect new predefined groups on app update or backend layer sync
- [ ] Prompt user: "Add the [name] group?" with add/dismiss options
- [ ] Store dismissed slugs in `dismissedGroupSlugs`
- [ ] Skip prompt for `removed` groups (never re-prompt)

## Phase 7: Polish & verification

- [ ] Design review with the impeccable skill
- [ ] Interaction tests: group cycle, expanded grouping, edit CRUD, active state memory
- [ ] Visual regression: all new states (mini with selector bottom, expanded grouped, edit mode)
- [ ] Full `pnpm test:ci` + `pnpm test:visual` pass
