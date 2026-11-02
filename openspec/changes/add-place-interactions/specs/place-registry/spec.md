# Place Registry — Delta Spec

## ADDED Requirements

### Requirement: MapTarget model

- **Requirement**: Every interaction origin (map click, search selection, deep link) SHALL produce a `MapTarget` with `key` (built via a `targetKey()` helper, never hand-built strings at call sites), `source` (flat family id, e.g. `geoplace`, `transport`), `id` (the CANONICAL id that drives the URL), optional `location`, `props` (immutable raw wire payload), and optional `featureRef` (engine-tagged highlight handle).

#### Scenario: Map click creates a target

- **WHEN** a feature of an interactive layer is clicked
- **THEN** the adapter builds one `MapTarget` whose `id` is the canonical id named by the layer's `LayerClaim.idProp`, whose `featureRef` carries the engine highlight handle, and whose `props` is the raw tile-property bag

### Requirement: Target reactivity discipline

- **Requirement**: `props` and `featureRef` SHALL be excluded from deep reactivity (`markRaw`); targets SHALL be held in `shallowRef`s; consumers SHALL NOT clone or mutate `props`.

#### Scenario: Live engine objects stay unproxied

- **WHEN** a target holding a `featureRef` (MapLibre feature state key or Leaflet marker) is stored in the selection store
- **THEN** the engine object is not wrapped in a reactive proxy and highlight set/clear through it still works

### Requirement: Surface component prop contract

- **Requirement**: NEW surface components SHALL receive the whole target as a single prop (no spreading). During migration, legacy slug-prop components (the WdPlaceContent family) MAY be adapted by the host until they are migrated or replaced.

#### Scenario: Legacy components keep working under the host adapter

- **WHEN** the accommodation entry's legacy detail components (slug props) render through the body host
- **THEN** the host adapts target → slug props and the components behave identically to before the migration

### Requirement: Declarative presentation registry

- **Requirement**: Presentations SHALL be declared as static, ordered entries (first matching entry wins; array order documents precedence) with a declarative `MatchSpec` (`source`, optional `domain`, optional `kindParent`, optional `kind`, optional `where` escape hatch consuming the erased target).
- **Requirement**: Entry definitions SHALL be typed at the entry edge via a `definePresentation<D>` helper that erases to the registry-facing `Presentation` type; `match` SHALL consume the erased `MapTarget`.
- **Requirement**: `kindParent` matching SHALL derive the parent from `kind.identifier` (prefix before `.`) via the taxonomy module — the wire carries no `parent` member.
- **Requirement**: Domain/kind vocabulary SHALL live only in the taxonomy module (`src/selection/taxonomy.ts`).

#### Scenario: First matching entry wins

- **WHEN** two entries both match a target
- **THEN** the entry earlier in the registry array is selected

#### Scenario: Unknown taxonomy fails open

- **WHEN** a target's domain/kind matches no entry except `geoplace-default`
- **THEN** the geoplace-default presentation renders from payload fields and no blank screen or error state occurs

#### Scenario: Unresolved source warns in development

- **WHEN** a non-default `source` matches no entry in development mode
- **THEN** a developer warning identifies the unresolved source

### Requirement: Claim-based resolution for map clicks

- **Requirement**: A target built from a claimed style layer SHALL resolve to the claiming entry directly (the claim binds layer → entry); MatchSpec resolution applies to claim-less targets (search rows, probe payloads). Map-click resolution SHALL NOT depend on kind/domain tile properties.

#### Scenario: Hut map click resolves without taxonomy tile props

- **WHEN** a `wd-huts` feature is clicked and its tile properties carry no `kind`/`domain` members
- **THEN** the accommodation entry resolves via the layer claim and the correct detail opens

### Requirement: Registry factory

- **Requirement**: The registry SHALL expose a `createRegistry(entries)` factory for tests and Histoire alongside the default instance; resolution SHALL be memoized by `target.key`.

#### Scenario: Scoped registry for tests

- **WHEN** a test builds a registry from mock entries via `createRegistry`
- **THEN** resolution behaves first-wins against exactly those entries without module mocking

### Requirement: Per-entry detail start size

- **Requirement**: A presentation MAY declare `detailStart: 'minimized' | 'expanded'`; the panel SHALL apply it as the start-size preset when the entry's detail opens (the user's sticky minimize/maximize choice still applies afterwards).

#### Scenario: Accommodation opens minimized

- **WHEN** the accommodation detail opens and the entry declares `detailStart: 'minimized'`
- **THEN** the panel starts minimized (or the user's sticky choice, once made)

### Requirement: Registry module boundaries

- **Requirement**: Entry modules SHALL be store-free (no imports of Pinia stores); they MAY import selection types, taxonomy, map-layer-ids, generated client types, and dynamic component loaders. The boundary SHALL be enforced by eslint `no-restricted-paths`.

#### Scenario: Store import rejection

- **WHEN** an entry file imports a Pinia store
- **THEN** eslint reports a restricted-path violation

### Requirement: Claim↔style drift guard

- **Requirement**: A dev-only check SHALL warn when claimed style-layer ids match no layers of the applied map style.

#### Scenario: Backend layer rename caught in dev

- **WHEN** the backend catalog renames a style layer a claim names, and the style is applied in a development session
- **THEN** a console warning names the unmatched claim so the rename is fixed in `map-layer-ids.ts`

### Requirement: One barrel chunk per entry

- **Requirement**: Surface components SHALL be loaded through ONE barrel loader per entry (`surfaces.ts` re-exporting popup/detail/detailTitle/detailActions) producing one lazy chunk per entry.

#### Scenario: Entry loads as one chunk

- **WHEN** an entry's surfaces are first used
- **THEN** exactly one barrel chunk is fetched covering all of the entry's surface components
