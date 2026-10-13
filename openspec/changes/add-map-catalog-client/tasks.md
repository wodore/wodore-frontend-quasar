# Tasks: Consume the backend map layer catalog

## Phase 0: Contract

- [x] Regenerate the typed API client from the backend's unreleased
      OpenAPI schema (`/v1/map/catalog`; pin stays `unreleased`)
- [x] Create the openspec change (this directory)

## Phase 1: Catalog service

- [x] DTO types + catalog fetch (locale-aware, deduped in-session cache)
- [x] Style endpoint URL builder (spec/mode params, absolute against the
      API host) + style fetch
- [x] Client token resolver mirroring the backend walk (whole-node
      subtree values, inline scalar substitution, unknown passthrough)
- [x] GPU tier → `spec=` mapping; variant selection (exact → nearest →
      single)
- [x] Unit tests: resolver, variant picking, URL building

## Phase 2: Overlay integration

- [x] Catalog layer → `OverlaySwitchItem` mapping (slot→onLayer with
      transition aliases, opacity-curve → `opacity`, config/legend
      mapping, i18n label override for known slugs)
- [x] Sprite pack merge for same-id sprites across catalog overlays
- [x] Overlay store: catalog load + in-place swap preserving state,
      `overlaysEpoch`, group re-merge, locale-change rebuild reusing
      cached styles
- [x] `createHutsAvailability` factory (offline parity for the split)
- [x] Overlay control: epoch watcher (remove stale layers/sources,
      re-add), availability `wd-bookings` wiring via `bookingsGeojson`
- [x] Native view: epoch in the recompose watch key + catalog init

## Phase 3: Basemap integration

- [x] Catalog layer → `BasemapSwitchItem` mapping (coverage_bbox +
      fallback_min_zoom → country fallback, `fallback` field, anchors
      merge with legacy table, preview/image fallback)
- [x] Basemap store: bounded catalog wait, spec-param style URLs,
      persisted-name rename table (`outdoor-osm` → `wd-outdoor-base-ofm`,
      `Satellite Hybrid` → `maptiler-hybrid`)
- [x] WdMapView `onMapError`: resolve fallback targets from the
      `fallback` field (legacy defaults when absent); fixed the stale
      `outdoor-mtk` slug check

## Phase 4: Parameters & settings tab

- [x] Parameter preference get/set/reset in the map catalog store
      (localStorage, kind-aware value guards)
- [x] Settings tab UI: scalar controls per kind + `opacity-curve`
      zoom-stop editor
- [x] Live re-resolution (paint/layout/source application, no style
      reload) + `{{date}}` runtime value from the date-picker flow
- [x] i18n keys for the new UI strings (de/en/fr/it)

## Phase 5: Verification

- [x] Unit tests: mapping, merge, parameter application, curve helpers
- [x] `pnpm lint` + `npx vue-tsc --noEmit` clean
- [ ] Manual smoke against a catalog-serving backend (staged for the
      infra handoff's deploy — factory fallback verified locally)
- [ ] Draft PR
