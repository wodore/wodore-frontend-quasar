# Tasks: Consume the backend map layer catalog

## Phase 0: Contract

- [x] Regenerate the typed API client (`/v1/map/catalog`; pin stays
      `unreleased`) — local `version?: string` DTO extension until
      backend #315 deploys, then a routine `gen:api` absorbs it
- [x] Create the openspec change (this directory)

## Phase 1: Catalog service

- [x] DTO types + catalog fetch (locale-aware, deduped in-session cache)
- [x] Style endpoint URL builder (spec/mode params, absolute against the
      API host) + style fetch
- [x] Client token resolver mirroring the backend walk (whole-node
      subtree values, inline scalar substitution, unknown passthrough)
- [x] GPU tier → `spec=` mapping; variant selection (exact → nearest →
      single)
- [x] Persistence: catalog snapshot + style documents keyed
      `slug|spec|mode` with layer `version`; slug-based pruning
- [x] Unit tests: resolver, variant picking, URL building

## Phase 2: Overlay integration (no factories — owner decision)

- [x] REMOVE the factory boot path (overlays.ts, overlay-transport.ts,
      overlay-hiking.ts, satellite-hybrid.ts, availability factory;
      overlay-huts.ts stripped to wireBookingsSource)
- [x] Overlay store boots EMPTY; `applyCatalogOverlays` is the single
      loader (persisted active/show state adopted on first application,
      RENAMED_SLUGS migrated once, `overlaysEpoch`)
- [x] Catalog layer → `OverlaySwitchItem` mapping (slot→onLayer with
      z-order anchor tables, opacity-curve → `opacity`, config/legend
      mapping, i18n label override for known slugs)
- [x] Sprite pack merge for same-id sprites across catalog overlays
- [x] Loading/error rows in the overlay control (cold boot)
- [x] Availability `wd-bookings` wiring via `bookingsGeojson`
- [x] Native view: epoch in the recompose watch key + catalog init

## Phase 3: Basemap integration

- [x] REMOVE the factory basemap literal + Martin style paths + bounded
      wait; cache-first init (cold boot awaits the fetch, error notice
      on failure)
- [x] Catalog layer → `BasemapSwitchItem` mapping (coverage_bbox +
      fallback_min_zoom → country fallback, `fallback` field, anchors
      merge with the z-order table, local thumbnails)
- [x] `refreshFromCatalog`: catalog refreshes rebuild the list keeping
      the active selection (force re-apply only on style-source change)
- [x] Persisted-name renames (`outdoor-osm` → `wd-outdoor-base-ofm`,
      `Satellite Hybrid` → `maptiler-hybrid`); default via catalog
      `is_default`
- [x] WdMapView `onMapError`: resolve fallback targets from the
      `fallback` field (legacy defaults when absent)

## Phase 4: Parameters & settings tab

- [x] Parameter preference get/set/reset in the map catalog store
      (localStorage, kind-aware value guards)
- [x] Settings tab UI: scalar controls per kind + `opacity-curve`
      zoom-stop editor
- [x] Live re-resolution (paint/layout/source application, no style
      reload) + `{{date}}` runtime value from the date-picker flow
- [x] i18n keys for the new UI strings (de/en/fr/it)

## Phase 5: Verification

- [x] Unit tests: mapping, boot cache, version sync (unchanged versions
      serve without refetch; changed versions refetch; version-less
      backends), invalid-style skip + notice, parameter application
- [x] `pnpm lint` + `npx vue-tsc --noEmit` + prettier clean
- [x] Dev-server smoke; staging live-verified (resolved + tokenized
      modes, `X-Map-Spec` nearest-tier fallback, `{{date}}` passthrough)
- [x] Draft PR (#278) with CI green
- [ ] After backend #315 deploys: regenerate the client (`gen:api` —
      `version` field + huts icon-size fix + `{API_URL}` substitution
      land server-side), verify the huts style validates and the
      availability URL arrives absolute
