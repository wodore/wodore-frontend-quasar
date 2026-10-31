# Proposal: Place Interactions

## Why

Every map feature click, search selection and deep link funnels through the
hut-only flow (`/hut/:slug` → `WdPlaceContent`): one content type, one fixed
behavior, hut-specific fetch and seeding. Upcoming content types (transport,
water points, villages, peaks — most already served by the backend's generic
geoplace model) need small popups, full detail panes, or popup→detail
hybrids, with per-type components and disambiguation when stacked features
are clicked. Full architecture doc: `_work/place-interactions.md`.

## What Changes

- **Selection framework**: a `MapTarget` (source/id/location/props/
  featureRef) normalized across map clicks, search and deep links; a static
  **Presentation registry** (declarative match, first-wins; lazy surface
  loaders; optional fetch/seed); a **selection store** owning the
  popup (ephemeral) / detail (routed) state machine with disambiguation
  candidates.
- **URL model** **BREAKING**: `/hut/:slug` dies without redirect (old links
  404, accepted); canonical URL becomes `/place/:slug` (geoplace slug, D7).
  Path segments follow entity models only — domains never in URLs (D10).
- **Surfaces**: generic popup (`WdMapPopup`, anchored on map + mobile, both
  engines via per-engine anchoring adapters + shared content component, D9)
  and the existing detail panel composition (three-zone slots fed from the
  registry instead of `MainLayout.componentMap`).
- **Data layer**: `usePlace` generalizes to `usePlaceDetail(target)`
  (per-entry fetchers/seeds; cold deep links resolve via a light geoplace
  probe); accommodation keeps `/v1/huts/{slug}` (D4) chaining
  `sources[wodore].source_id`.
- **Map clicks**: one global MapLibre click handler + registry-derived
  interactive layers (D5) replacing hardcoded `wd-huts`; Leaflet fallback as
  a separate adapter with the same contract.
- **Search**: `sources` returns to the autocomplete selection (D11) so
  search select opens detail straight from props; select routes through the
  registry.
- **First-scope entries**: accommodation (custom detail), transport
  (popup-only, existing WIP component), geoplace-default (popup + minimal
  probe-payload detail, D8).

## Capabilities

### New Capabilities

- `place-registry`: target model, declarative presentation matching, ordered
  first-wins resolution, geoplace-default fallback, registration/module
  boundaries.
- `place-interactions`: the selection controller state machine — open/expand/
  close, via-modes (map/search/link), candidates/disambiguation, async rules
  (probe chain, token latest-wins, expand-as-handoff), click pipelines for
  both engines.
- `place-popup`: the anchored popup surface — projection/anchoring, move+rAF
  tracking, viewport clamping, engine swap handling, shared content.
- `place-urls`: URL taxonomy (entity-model segments), route records, crawler
  gates, deep-link resolution, boot prefetch adaptation.

### Modified Capabilities

(none — no existing OpenSpec capability covers place detail/opening)

## Impact

- **Code**: `src/stores/map/map-content-store.ts` (→ selection-store),
  `src/composables/usePlace.ts` (→ usePlaceDetail), `src/components/map/
WdMapView.vue` + `WdFallbackMapView.vue` (click paths),
  `src/layouts/MainLayout.vue` (componentMap → useActiveDetailEntry),
  `src/router/routes.ts`, `src/components/search/WdPlaceSearch.vue`,
  `src/services/hut-prefetch.ts`, `src/stores/map/utils/interactive-layers.ts`
  (derived list), new `src/selection/` module tree, new `WdMapPopup.vue`,
  `WdDetailBodyHost.vue`.
- **Backend/nginx (PR0, blocking for the URL cutover only)**: `/place/:slug`
  SEO proxy support; `wd-huts` MVT tiles gain a geoplace-slug property (D7).
- **Dependencies**: none new.
- **PR slicing**: PR1a framework (zero URL change) → PR1b URL cutover (after
  PR0) → PR2 popup surface → PR3 transport entry. The lane branch implements
  PR1a first.
