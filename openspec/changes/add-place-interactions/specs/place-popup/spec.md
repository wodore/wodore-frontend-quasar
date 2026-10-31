# Place Popup — Delta Spec

## ADDED Requirements

### Requirement: Anchored popup surface

- **Requirement**: A popup SHALL be a Vue-rendered card (no engine DOM popup, no `q-menu`/`q-tooltip`/`q-dialog`) mounted once outside both map engines (in the main layout), teleporting to `body` to escape map-container overflow and stacking.
- **Requirement**: The popup content component SHALL be shared between engines and between desktop/mobile; only the anchoring adapter (projection) is engine-specific (D9).
- **Requirement**: Anchored popups SHALL be used on mobile as well (D3) — not a bottom-sheet snap.
- **Requirement**: Popups that need no data beyond the target props SHALL open without any network request; prop-rendered text SHALL read the locale reactively so a mid-session language switch re-renders an open popup.

#### Scenario: Props-only open

- **WHEN** the user taps a water-point feature
- **THEN** the popup renders entirely from tile properties with zero fetches, localized to the current UI language at render time

#### Scenario: Mid-session language switch re-renders an open popup

- **WHEN** the UI language changes while a props-only popup is open
- **THEN** the popup re-renders in the new language (the localized name is picked at render time, not frozen at open time)

### Requirement: Projection and re-anchoring

- **Requirement**: Each engine SHALL register a projector (MapLibre `map.project`, Leaflet `latLngToContainerPoint`) into a small module singleton; registration returns an unregister function.
- **Requirement**: Canvas-relative projected coordinates SHALL be converted to viewport coordinates (canvas bounding rect) because the popup teleports to body.
- **Requirement**: While the map moves, the popup SHALL re-anchor via one rAF loop driven by a dirty flag set on continuous `move` events (not only `moveend`), so it stays glued through flyTo animations; the loop SHALL start on movement start, stop on movement end, and pause when the popup is closed or the tab hidden.
- **Requirement**: Position updates SHALL write the card transform imperatively (not through reactive style binding).
- **Requirement**: Viewport clamping SHALL keep the popup inside the visible area accounting for the topbar pill, bottom map controls and safe-area insets, implemented as a pure testable function.

#### Scenario: Glued through flyTo

- **WHEN** the map flies to the clicked feature (600 ms animation)
- **THEN** the popup tracks its anchor every frame and lands centered on the feature without drift

### Requirement: Engine swap and cleanup

- **Requirement**: A projector unregister (engine swap or fallback switch) SHALL close the popup; the adapter that set a selection highlight SHALL clear it (feature handles are engine-specific; MapLibre style swaps wipe feature-state).
- **Requirement**: Highlight set/clear SHALL use the opaque `featureRef` of the originating adapter, never the slug.

#### Scenario: Basemap/engine switch with popup open

- **WHEN** the map engine or style changes while a popup is open
- **THEN** the popup closes, the highlight is cleared by its adapter, and no stale feature-state remains

### Requirement: FlyTo geometry

- **Requirement**: Opening a popup via map click SHALL use a popup-aware flyTo padding that keeps both the pin and the popup's bounding box on screen — not the drawer/panel padding reuse.

#### Scenario: Popup never occludes its pin

- **WHEN** a popup opens near a viewport edge
- **THEN** the flyTo padding shifts the view so the pin and the full popup card are visible within clamped bounds
