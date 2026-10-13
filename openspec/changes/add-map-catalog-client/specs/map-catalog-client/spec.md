# Spec Delta: map-catalog-client

## ADDED Requirements

### Requirement: Catalog-driven overlay and basemap definitions

The app SHALL load overlay and basemap definitions from
`GET /v1/map/catalog` (in the active UI language) and SHALL fall back to
the bundled factory definitions when the catalog is unreachable. Catalog
layers replace factory entries with the same slug (after alias
normalization), append catalog-only layers, and factory entries for
slugs the catalog does not serve SHALL remain until the seed reaches
parity.

#### Scenario: Catalog unreachable

- **WHEN** the catalog request fails or times out
- **THEN** overlays and basemaps render from the bundled factories with
  today's behavior and no error surfaces to the user

#### Scenario: Catalog layer replaces a factory layer

- **WHEN** the catalog serves a layer whose slug (after alias mapping)
  matches a factory entry
- **THEN** the overlay/basemap item's style, parameters, legend and
  config come from the catalog while the user's persisted active/show
  state and selection survive the swap

#### Scenario: New catalog layer

- **WHEN** the catalog serves a slug the factories do not know (e.g.
  `huts-availability`)
- **THEN** the layer appears in the overlay list and joins the layer
  group merge (predefined groups keep working via slugs)

### Requirement: Style fetching with device-tier variants

The app SHALL fetch each layer's style from
`GET /v1/map/styles/{slug}.json`, passing `spec=` derived from the GPU
tier (weak-GPU raster path → `low`, otherwise `high`) and
`mode=tokenized` when the layer declares parameters (resolved mode
otherwise). Variant selection between catalog variant entries SHALL
follow the backend rule: exact spec, else nearest tier, else the single
existing variant.

#### Scenario: Weak GPU

- **WHEN** `shouldUseRaster` reports true for the device
- **THEN** style URLs request `spec=low` and the served variant's
  reported spec is trusted (server-side nearest fallback)

#### Scenario: Parameterized layer

- **WHEN** a catalog layer declares `parameters`
- **THEN** its style is fetched tokenized and resolved client-side with
  authored defaults overlaid with the user's persisted overrides and
  runtime values

### Requirement: Client token resolution

The app SHALL resolve `{{param}}` tokens in tokenized styles and legend
items with one tree walk: standalone JSON string nodes substitute the
parameter's value (scalar or subtree), tokens embedded in longer strings
substitute scalars, and unknown tokens pass through unchanged. The
resolution order SHALL be registry/layer default, then user override,
then runtime value (most specific wins).

#### Scenario: Opacity curve override

- **WHEN** the user edits a layer's `opacity-curve` parameter
- **THEN** the new expression subtree replaces the token in the layer's
  paint without a style reload and persists to localStorage preferences

#### Scenario: Runtime date token

- **WHEN** the availability layer's `{{date}}` token resolves
- **THEN** the selected date from the date picker drives the source
  update (the existing availability fetch flow stays the data path)

### Requirement: Catalog-driven legends and configuration

The app SHALL render legend sections, links and attributions from the
catalog payload. Static legend item colors carrying parameter tokens
SHALL resolve through the same token walk. Category-driven sections
SHALL use the catalog's pre-resolved projections, degrading to the
existing category-API fetch while projections carry no symbol URLs.

#### Scenario: Static legend with token color

- **WHEN** a legend item's color references a parameter token
- **THEN** the rendered swatch shows the resolved color (defaults or the
  user's override)

### Requirement: Coverage-driven basemap fallback

The app SHALL compile country-basemap behavior from catalog fields:
`coverage_bbox` drives the bounding-box watcher and `fallback_min_zoom`
the zoom floor (replacing the hardcoded `countryOnly`/`bbox`/
`countryMinZoom` values), and a basemap's `fallback` field names the
auto-switch target on tile-host failures (legacy defaults apply to
factory entries without the field).

#### Scenario: Country basemap from the catalog

- **WHEN** a catalog basemap declares `coverage_bbox` and
  `fallback_min_zoom`
- **THEN** the world fallback composition and the moveend visibility
  watcher behave exactly as with the hardcoded values they replace
