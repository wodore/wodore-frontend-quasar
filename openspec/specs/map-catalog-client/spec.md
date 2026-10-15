# map-catalog-client Specification

## Purpose

TBD - created by archiving change add-map-catalog-client. Update Purpose after archive.

## Requirements

### Requirement: Martin-compatible basemap catalog

The app SHALL fetch the basemap selector data from the
Martin-compatible index `GET /v1/map/catalog` (flat `styles` map:
`path`, `name`, `icon`, `role`, `is_default`, `fallback`, coverage),
with `?lang=` for localized labels and `?spec=` for device-tier
resolution of the style `path`s. Basemap entries SHALL use the served
`path` as the complete style URL — no client-side style composition
(the backend serves `world-topo` and `world-satellite-hybrid` rasters
and all other basemaps). The rich overlay catalog SHALL come from
`GET /v1/map/config` (unchanged shape: slots, layers, parameters,
variants, legends).

#### Scenario: Basemap list from the Martin index

- **WHEN** the basemap store initializes or refreshes
- **THEN** entries compile from the index ordered by `order`, the
  style is the served `path` plus the `STYLE_VERSION` cache buster,
  and the default is the `is_default` entry (falling back to the
  compiled default `wd-outdoor-base-mtk-hill`)

### Requirement: Cache-key rotation (STYLE_VERSION)

The app SHALL append a `v=` query parameter (STYLE_VERSION, bumped
with each deploy that changes served map content) to every map
response request — the Martin catalog, the rich config, and style
documents. The API ignores the parameter; it rotates the 6-hour
view-cache and browser cache keys so re-seeds and style changes
propagate without waiting for TTLs.

#### Scenario: Re-seed visible immediately

- **WHEN** the backend re-seeds layers (new `version`) and the
  frontend STYLE_VERSION is bumped or first used
- **THEN** all map requests hit fresh cache keys and the origin serves
  the updated documents (e.g. the fixed `huts` style validates and the
  row renders without waiting for the previous TTL)

### Requirement: Catalog as the single layer source

The app SHALL load overlay and basemap definitions exclusively from
`GET /v1/map/catalog` (in the active UI language) — there SHALL be no
bundled factory definitions. Layers the catalog does not serve are
absent. A cold first run shows an explicit loading state until the
catalog answers; a failure is an error state with a user-visible
notice.

#### Scenario: Catalog unreachable on a cold first run

- **WHEN** no catalog has been persisted and the fetch fails
- **THEN** the overlay/basemap controls show an error notice and no
  layers render, without factories or silent fallbacks

#### Scenario: New catalog layer

- **WHEN** the catalog serves a slug the app has not seen (e.g.
  `huts-availability`)
- **THEN** the layer appears in the overlay list and joins the layer
  group merge (predefined groups keep working via slugs)

### Requirement: Boot cache and version sync

The app SHALL persist the last catalog snapshot and the fetched style
documents (keyed by slug, spec and mode with their layer `version`) via
the storage service, and SHALL boot by rendering that cache
synchronously. In the background a fresh catalog is fetched; a layer's
style is refetched only when its `version` changed (or its cache entry
is missing or invalid). Cache entries of removed layers are pruned.

#### Scenario: Offline boot

- **WHEN** the app boots with a persisted catalog and no network
- **THEN** overlays and basemaps render from the cache with the user's
  persisted active/show state and selection

#### Scenario: Version bump

- **WHEN** the fresh catalog carries a new `version` for a layer
- **THEN** only that layer's style is refetched; unchanged layers serve
  from the cache without network requests

#### Scenario: Version-less backend (pre-#315)

- **WHEN** catalog layers carry no `version` field
- **THEN** cached entries without a version stay valid; the first
  version-bearing catalog invalidates each entry exactly once

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
- **AND** the occupation layers' visibility binds to the picked date:
  hidden until a date is selected, visible afterwards (baked into the
  style spec for basemap switches, applied live via
  `setLayoutProperty`)

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
the zoom floor, and a basemap's `fallback` field names the auto-switch
target on tile-host failures (legacy defaults apply to entries without
the field).

#### Scenario: Country basemap from the catalog

- **WHEN** a catalog basemap declares `coverage_bbox` and
  `fallback_min_zoom`
- **THEN** the world fallback composition and the moveend visibility
  watcher behave exactly as with the hardcoded values they replace

### Requirement: Invalid remote styles skip loudly

The app SHALL skip the layer of a served or persisted style that fails MapLibre structural validation (the resolved output, for tokenized documents), surfacing a console warning plus a user-visible notice, rather than blanking the map or falling back silently.

#### Scenario: Invalid authored expression

- **WHEN** the served style nests a zoom expression where MapLibre
  requires a top-level step/interpolate input
- **THEN** that layer is skipped with a visible notice and every other
  layer renders normally
