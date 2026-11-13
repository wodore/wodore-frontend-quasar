# Amenity Interactions — Delta Spec

## ADDED Requirements

### Requirement: Interactive amenity layers via registry claims

- **Requirement**: The accommodations overlay symbol layer (`wd-accommodations`) SHALL be claimed by the accommodation entry with interaction floor 5.
- **Requirement**: The ten amenity subtree symbol layers (`wd-restaurant`, `wd-health_and_emergency`, `wd-outdoor_services`, `wd-groceries`, `wd-shopping`, `wd-tourism`, `wd-services`, `wd-finance`, `wd-utilities`, `wd-automotive`) SHALL be claimed by an amenity entry at their backend tier floors: subtree tiers 5 / 9 / 13 exactly as the style symbol layers' `minzoom`.
- **Requirement**: The eleven cluster circle layers (`wd-<subtree>-clusters`, `wd-accommodations-clusters`) SHALL be claimed at the same tier floors, so hover cursor and the mobile focus-mode tap guard cover clusters.
- **Requirement**: Claims SHALL NOT include the `-selected` halo layers (invisible feature-state circles must not capture clicks) nor the `-cluster-count` badge layers (the claimed circle covers them).
- **Requirement**: Zoom gates SHALL be strict lower bounds (`zoom > minZoom`), mirroring the click pipeline and tap guard.

#### Scenario: Cursor affordance follows the claims

- **WHEN** the pointer hovers a restaurant symbol at zoom 6
- **THEN** the canvas cursor shows the pointer affordance
- **WHEN** the pointer hovers an automotive symbol at zoom 12 (below its floor 13)
- **THEN** no interactivity affordance is promised

#### Scenario: Tap guard covers clusters

- **WHEN** a mobile tap lands on a `wd-restaurant-clusters` circle above its floor
- **THEN** the tap is claimed (focus mode does not toggle) and the cluster click handling runs

### Requirement: Minimal amenity popup

- **Requirement**: Clicking an amenity symbol above its floor SHALL open a popup rendering name, type icon and elevation.
- **Requirement**: The popup SHALL paint instantly from tile properties and enrich from `/v1/geo/places/{slug}` (localized name, kind symbol, elevation) — a failed enrichment SHALL degrade silently to the tile-prop content (never a dead card).
- **Requirement**: Absent tile fields SHALL degrade gracefully: elevation hidden when absent, icon chain `category_identifier` → detail kind symbol → the marker's own color swatch (no wrong generic icon, never blank).
- **Requirement**: Amenities SHALL have popup capability only (no expand affordance, no detail surface).

#### Scenario: Popup below the label zoom

- **WHEN** a restaurant symbol is clicked at zoom 10 (tiles carry the slug but no name)
- **THEN** the popup opens instantly and fills its name row from the detail fetch when it resolves

### Requirement: Accommodations open the hut details view

- **Requirement**: Clicking a `wd-accommodations` symbol above floor 5 SHALL route to the existing hut details view (the `map-hut` content route) and set the feature-state selection highlight; a second map click on the same place SHALL toggle it closed.
- **Requirement**: Because accommodation overlay slugs are geoplace slugs, the accommodation entry's fetch SHALL wrap: a 404 from `/v1/huts/{slug}` falls back to `/v1/geo/places/{slug}` mapped onto the hut details shape (name, elevation, location, description, type ← kind).
- **Requirement**: Hut-only blocks (availability, capacities, year stripe) SHALL render nothing for geoplace accommodations (guarded on data presence).
- **Requirement**: The identity seed SHALL additionally read geoplace tile fields (`category_identifier` with parent `accommodation` → instant type avatar + color; `elevation` when present).

#### Scenario: Geoplace accommodation detail

- **WHEN** a bhotel symbol is clicked
- **THEN** the hut details panel opens, paints its title from the tile seed and the mapped geoplace detail, and shows no availability or capacity blocks

### Requirement: Cluster click flow via the near endpoint

- **Requirement**: A click on a `count > 1` cluster feature SHALL be intercepted before the individual-target pipeline (cluster features carry no canonical id).
- **Requirement**: Clusters with `count < 6` SHALL open a member-list popup; clusters with `count >= 6` SHALL zoom in (`easeTo`, +1.5 zoom, centered on the cluster).
- **Requirement**: The member list SHALL be fetched from `GET /v1/geoplaces/near` in cluster mode: anchor lngLat, `z` = the served tile zoom (integer floor capped at the source's declared maxzoom), `category_tree`, `limit` = count, and the overlay tile URL's cluster params (`importance_threshold`, `cluster_max_zoom`, `cluster_radius_m`, `cluster_ref_zoom`) forwarded verbatim when present.
- **Requirement**: The member fetch SHALL show a small loading state and offer a retry on failure; the response's `count` (total before limit) SHALL be trusted over the feature count on mismatch.
- **Requirement**: The list SHALL contain STRICT members only — no proximity supplement.
- **Requirement**: Clicking a member SHALL open that place exactly like an individual symbol click of the same overlay (accommodation members → the hut details view; subtree members → the amenity popup), anchored approximately at the cluster position.
- **Requirement**: Re-clicking the same cluster SHALL toggle the popup closed.

#### Scenario: Small cluster members

- **WHEN** a count-3 restaurant cluster is clicked
- **THEN** a popup lists the three members (color-marked, clickable) fetched from the near endpoint with the tile-grid snap

#### Scenario: Large cluster zoom

- **WHEN** a count-12 cluster is clicked
- **THEN** the map eases in by 1.5 zoom levels centered on the cluster and no popup opens

### Requirement: What's-here proximity probe on the deliberate gesture

- **Requirement**: The what's-here proximity probe (`GET /v1/geoplaces/near`, proximity mode: `radius` 25–50 m, `order=distance`, `limit` 3–5, no zoom, no category) SHALL fire ONLY on the deliberate detail gesture — mouse right-click and touch long-press, both surfacing as ONE map `contextmenu` event — and NEVER on a plain click/tap.
- **Requirement**: A plain click/tap that hits no interactive layer (exact point and ±10px box) SHALL NOT probe: active-layer icons remain the only click-openable places; the tap falls straight through to the popup-dismiss and focus-mode behavior as it was before the probe existed.
- **Requirement**: With probe results, they SHALL open through the place framework: one result opens its entry surface directly (accommodation kinds → the hut details view; others → the amenity popup), several results arm the candidate list.
- **Requirement**: The release click following a touch long-press SHALL be swallowed (exactly one per gesture — it must not close what the probe opened nor re-run the click pipeline); clicks after a mouse right-click SHALL NOT be swallowed (no trailing click exists).
- **Requirement**: A gesture on map chrome (controls, popups, markers, sticky panels) SHALL NOT probe.
- **Requirement**: With no results (or a failed probe), the gesture SHALL be a silent no-op — no focus-mode toggle, no error surface; the probe SHALL be single-flight with latest-wins supersession.

#### Scenario: Plain tap near an inactive-layer place

- **WHEN** a tap on empty map lands within 50 m of a place whose layer is not active
- **THEN** nothing opens (no probe) and the tap owns popup-dismiss / focus mode exactly as before the probe existed

#### Scenario: Long-press near an inactive-layer place

- **WHEN** a long-press (touch) or right-click (mouse) lands within 50 m of a place
- **THEN** that place's popup or detail opens through the place framework

#### Scenario: Long-press release click

- **WHEN** the finger lifts after the long-press opened a place
- **THEN** the trailing click is swallowed and the opened surface stays

#### Scenario: Probe finds nothing

- **WHEN** the deliberate gesture finds no places within the radius
- **THEN** nothing happens (no focus toggle, no error)

#### Scenario: Active-layer icon on plain click

- **WHEN** an icon of an active overlay is clicked normally
- **THEN** its popup/detail opens as before — the gesture gate only affects the empty-map probe

### Requirement: Tab-focus overlay-catalog revalidation

- **Requirement**: On tab focus (`visibilitychange` → visible), the overlay catalog SHALL revalidate via one conditional GET (`refreshCatalog({background: true, revalidate: true, deferApply: true})`), so a backend overlay added mid-session appears in the menu immediately and on the map at idle (live-refresh diff + idle epoch bump) without a reload.
- **Requirement**: Unchanged revalidations (ETag 304) SHALL NOT re-add map layers (no flicker).

#### Scenario: New overlay appears without reload

- **WHEN** the backend publishes a new overlay while a session is open and the tab regains focus
- **THEN** the overlay chip appears in the menu immediately and, once active, its layers are added at the next idle moment
