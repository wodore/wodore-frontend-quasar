# Place Interactions — Delta Spec

## ADDED Requirements

### Requirement: Selection controller state machine

- **Requirement**: A selection store SHALL own interaction state with modes `closed`, `popup` (ephemeral store state, never routed) and `detail` (derived from the route — single source of truth, not duplicated).
- **Requirement**: ONE route watcher SHALL be the choke point clearing ephemeral state (popup, candidates, highlight) when navigation changes the content slug or leaves the content family; back/leave SHALL NOT resurrect the popup.
- **Requirement**: `open(target, {via})` SHALL pick the surface: when the entry declares both popup and detail, `via: 'map'` opens the popup and `via: 'search' | 'link'` opens the detail; a single declared surface opens regardless of via.
- **Requirement**: `open()` SHALL detect an already-routed target (same slug → duplicated navigation, no watcher fires): via `map` it SHALL toggle-close the detail (preserving today's tap-pin-to-close UX, D12); via `search`/`link` it SHALL re-anchor, re-highlight and reseed.

#### Scenario: Open from map click

- **WHEN** a map click resolves to one target whose entry declares both surfaces
- **THEN** the popup opens and no route change occurs

#### Scenario: Re-click of the open target toggles it closed (map)

- **WHEN** the user clicks the feature whose slug is already in `/place/:slug` (opened from the map or still open after navigation)
- **THEN** the detail closes (toggle), matching the pre-framework tap-pin-to-close behavior

#### Scenario: Search re-select of the open target re-anchors

- **WHEN** a search selection targets the slug already in `/place/:slug`
- **THEN** the detail stays open and re-anchors/re-highlights/reseeds instead of closing

#### Scenario: Back from detail

- **WHEN** the user navigates back from `/place/:slug` to the map
- **THEN** detail state clears and the popup is not resurrected

### Requirement: Disambiguation candidates

- **Requirement**: When a click yields multiple distinct targets, the controller SHALL keep them as `candidates` (ephemeral, ordered topmost layer first), open the first, and expose a minimal switcher (current target + `1/n` cycling chip) reusing the search result row component family.
- **Requirement**: Stacked features of the SAME layer (same `target.key`) SHALL dedupe to one target — they never produce candidates.
- **Requirement**: The switcher chip SHALL render the same avatar chain as the search rows (`kind.symbol.color` → `WdCategoryIcon` → domain tier icon from taxonomy).

#### Scenario: Stacked features

- **WHEN** a click hits features of two interactive layers at the same point
- **THEN** the topmost layer's target opens and the switcher shows `1/2`, cycling swaps the open target

#### Scenario: Same-layer stack dedupes

- **WHEN** a click hits multiple overlapping features of one layer (e.g. clustered symbols)
- **THEN** exactly one target results and no switcher appears

### Requirement: Detail surface composition (three-zone rule)

- **Requirement**: The panel shells (`WdContentPanel` desktop, `WdBottomSheet` mobile) SHALL keep their three-zone composition — header title slot, body, pinned footer actions slot — as three SEPARATELY measured boxes (minimize floor, debounced shrink, pinned-actions-without-scroll).
- **Requirement**: A `useActiveDetailEntry()` composable SHALL resolve the entry and feed the three EXISTING slots from the entry's surface loaders (generic geoplace defaults when title/actions are omitted); the `content` named view SHALL be a thin body host. The zones SHALL NOT be flattened into a monolithic host.
- **Requirement**: Hosts SHALL wrap raw loaders with `defineAsyncComponent` + `markRaw`, memoized into `shallowRef`s keyed by `target.key`; async components SHALL NOT be resolved inside a `computed`; `Suspense` SHALL NOT be used for the detail surface.

#### Scenario: Entry swap preserves panel choreography

- **WHEN** the open detail re-targets to a place of a different entry (e.g. accommodation → geoplace-default detail)
- **THEN** the panel keeps its three measured zones: the minimized floor stays ≤ the expanded floor and the pinned actions remain visible without scrolling

#### Scenario: Re-target does not remount the zones

- **WHEN** another target opens while the panel is open
- **THEN** the title/actions zones do not flicker from component re-creation (keyed memoized resolution)

### Requirement: Async data rules

- **Requirement**: Supersession correctness SHALL come from a sequence token (checked after every await); `AbortController` SHALL be used only as a bandwidth optimization, with `signal.aborted` re-checked between chained requests.
- **Requirement**: The controller SHALL own only popup-target abort and highlight clearing; detail fetch supersession SHALL stay in the route-driven `usePlaceDetail` slug/locale watch.
- **Requirement**: Simultaneous identical fetches SHALL dedupe on a module-scope Map keyed by entry id, target id and locale; a deduped request SHALL NOT be aborted by an individual consumer abandoning it.
- **Requirement**: Seed data (target props held until fetch resolves) SHALL be cached with an LRU bound (~50) and cleared when the overlay catalog epoch bumps.
- **Requirement**: Locale refetch SHALL happen only while a surface is open — no background refetch when closed.

#### Scenario: Rapid clicks

- **WHEN** target A's fetch is in flight and target B is clicked
- **THEN** A's request is aborted best-effort, A's highlight clears even if A's fetch already resolved, and only B's data renders

#### Scenario: Abort re-checked between chained GETs

- **WHEN** the accommodation chain resolves the probe and the abort fires before the hut GET is issued
- **THEN** the second GET is skipped (the entry re-checks `signal.aborted` after every await)

#### Scenario: No background refetch while closed

- **WHEN** the UI language changes while no surface is open
- **THEN** no detail fetch fires for previously viewed targets

#### Scenario: Deduped request survives one consumer leaving

- **WHEN** two consumers await the same deduped request and the first one navigates away
- **THEN** the second consumer still receives the resolved payload (no AbortError)

### Requirement: Expand (popup → detail) handoff

- **Requirement**: Expanding a popup SHALL hand the in-flight popup fetch promise (if any) to the detail context (the established prefetch-handoff pattern), then push the detail route, and clear popup state only after navigation commits — expand SHALL NOT abort the in-flight fetch.
- **Requirement**: The popup header SHALL render an expand affordance automatically when the entry declares both surfaces.

#### Scenario: Expand mid-fetch

- **WHEN** the user expands a popup whose fetch is in flight
- **THEN** the detail pane adopts the same promise (no second request, no abort) and the popup disappears after the route commits

### Requirement: Cold deep-link resolution

- **Requirement**: A bare `/place/:slug` navigation with no props SHALL resolve via a controller-owned probe (`GET /v1/geo/places/{slug}` with a minimal sparse-fieldset selection of domain, kind and sources); the probe SHALL run once and be passed into `entry.fetch` via the fetch context; the probe payload SHALL seed the detail skeleton.
- **Requirement**: The accommodation entry SHALL chain `probe.sources[wodore].source_id` to `/v1/huts/{source_id}` (D4), re-checking the abort signal between requests; all other kinds SHALL render the geoplace-default minimal detail from the probe payload with no second request.
- **Requirement**: The surfaces barrel import SHALL run in parallel with the entry fetch once the entry is known.
- **Requirement**: The boot deep-link prefetch SHALL probe at boot (reusing the API client's header set incl. the `Api-Version` pin) and fire the follow-up GET in parallel with app startup, matching `/place/` paths.

#### Scenario: Cold accommodation link

- **WHEN** a user opens `/place/<geoplace-slug>` directly
- **THEN** exactly one probe request resolves the entry, the skeleton paints from the probe payload, and the hut details fetch runs in parallel with the barrel import

### Requirement: Click pipeline

- **Requirement**: MapLibre SHALL use one global click handler registered once; it SHALL hit-test at click time via `queryRenderedFeatures` against the derived interactive layer list (a reactive getter recomputed on catalog epoch bumps), preserving the style-not-loaded guard.
- **Requirement**: Feature→target mapping (which tile property is the canonical id, geometry-vs-props location, localized name family) SHALL live in the layer claims and one shared `propsFromFeature` helper — not per-handler hardcoded property names.
- **Requirement**: A target built from a claimed layer SHALL resolve to the claiming entry directly (claim-based resolution); map-click resolution SHALL NOT depend on kind/domain tile properties.
- **Requirement**: The mobile focus-mode tap guard SHALL consume the same derived interactive list.
- **Requirement**: The Leaflet fallback SHALL implement the same open contract via a separate adapter (DOM-marker click → target with marker as `featureRef`), without a shared hit-test and without disambiguation.

#### Scenario: Dynamic layers do not stale the handler

- **WHEN** the overlay catalog re-applies and re-adds layers after the map loaded
- **THEN** the single global handler still resolves clicks on the re-added layers without re-registration

#### Scenario: Tap guard and click handler share the list

- **WHEN** a mobile tap hits no feature of any derived interactive layer above its zoom gate
- **THEN** the focus-mode tap guard toggles focus mode (same list, same gates as the click handler)
