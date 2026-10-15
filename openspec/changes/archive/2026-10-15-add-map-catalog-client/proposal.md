# Proposal: Consume the backend map layer catalog

## Why

Overlay and basemap definitions are hardcoded in the frontend as factory
functions (`src/stores/map/utils/overlays.ts`, `basemap-store.ts`). The
backend now defines them (wodore-backend PR #313, merged 2026-10-13):
`GET /v1/map/catalog` serves layer metadata (identity, i18n labels,
legends, parameter schemas, device-tier variants, coverage) and
`GET /v1/map/styles/{slug}.json` serves the styles — resolved by default,
tokenized for client-side customization. Keeping two divergent copies of
the layer set means every layer change ships a frontend release; the
catalog makes layers data.

## What Changes

- **Catalog loader** (`src/services/map-catalog.ts`): fetch the catalog
  (locale-aware, in-session cached) via the typed API client; fetch
  styles per layer from the style endpoint — `?mode=tokenized` when the
  layer declares parameters (client resolves tokens), resolved otherwise;
  `?spec=` mapped from the GPU tier (`shouldUseRaster` → `low`, else
  `high` — the server falls back nearest-tier). Client-side token
  resolver mirrors the backend walk: whole-node tokens may be subtrees,
  inline tokens substitute scalars, unknown tokens pass through. The
  catalog snapshot and style documents persist to localStorage (boot
  cache) keyed by slug × spec × mode with their layer `version`
  (backend #315) — styles refetch only when the version changes.
- **No factory fallbacks (owner decision)**: overlay/basemap factory
  definitions are REMOVED — the backend owns the catalog, missing seed
  layers are absent. Boot renders the persisted cache synchronously
  (offline/instant); a cold first run shows an explicit loading state,
  failures an error notice. Map re-application happens through an
  `overlaysEpoch` counter the overlay control watches. Persisted user
  state keeps resolving through one-time slug renames (`hiking-swiss` →
  `ch.swisstopo.swisstlm3d-wanderwege`, `outdoor-osm` →
  `wd-outdoor-base-ofm`, `Satellite Hybrid` → `maptiler-hybrid`).
- **Basemap store**: builds the basemap list from the catalog after GPU
  detection (cache-first; cold boot awaits the fetch with an error
  notice on failure). Country fallback compiles from `coverage_bbox` +
  `fallback_min_zoom`; the mtk→ofm and MapTiler auto-switches resolve
  their target from the basemap's `fallback` field (legacy defaults when
  absent). Catalog refreshes rebuild the list keeping the selection.
- **Parameters / settings tab**: catalog `parameters` render as controls
  in the overlay config settings tab — sliders/pickers/toggles for
  scalars, a zoom-stop editor for `opacity-curve`. Values persist to the
  existing localStorage preferences pattern and re-resolve the layer's
  paint live (`setPaintProperty`/`setLayoutProperty`, source `setData`
  for URL tokens) without a style reload.
- **Availability layer**: split from huts per the catalog
  (`huts-availability`); its `{{date}}` runtime token resolves from the
  date picker flow — the existing `bookingsGeojson` store stays the data
  path (auth/lang/days query params MapLibre would not send).
- **Legends**: catalog legend sections render directly — static items
  (token colors resolve through the same walk), external links,
  attributions. Category-driven sections whose projections carry no
  symbol URLs keep fetching the category API (bridge until the backend
  projection includes symbols).
- **Generated API client**: regenerated from the backend's unreleased
  OpenAPI schema (adds `/v1/map/catalog`; pin stays `unreleased`;
  `version` typed locally until #315 deploys).

## Non-goals

- Server-side preference sync and user global/per-layer override levels
  beyond localStorage (later lanes).
- Custom user layers or authoring UI.
- Changes to the backend contract — consumed as specified.

## Capabilities

### New Capabilities

- `map-catalog-client`: load overlays/basemaps exclusively from the
  backend catalog with a persisted boot cache, version sync,
  style/variant/parameter resolution, and catalog-driven legends.

### Modified Capabilities

- None — `overlay-groups`, country fallback and transformStyle behavior
  are preserved (driven by catalog data instead of hardcoded values).
