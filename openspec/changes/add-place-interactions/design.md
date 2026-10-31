# Design: Place Interactions

Full architecture rationale, three review rounds (Opus architecture, Opus
Vue-expert, GLM JS/TS-expert) and owner decisions D1–D11 live in
`_work/place-interactions.md` — the normative source. This design condenses
it for implementation; where the two differ, the work doc wins.

## Core model

```
map click ─┐
search ────┼─► MapTarget ──resolve──► Presentation ──► Surface(s)
deep link ─┘   (what)                 (capabilities)   popup | detail
```

- **MapTarget** `{key, source, id, location?, props, featureRef?}` —
  `key` via `targetKey()` helper (never hand-built); `id` is the CANONICAL
  id driving the URL (geoplace slug / external id, D7 — hut `source_id` is
  entry-internal); `props` is an immutable markRaw'd wire bag; `featureRef`
  is an opaque markRaw'd engine handle (MapLibre `{source, sourceLayer,
numericId}` / Leaflet marker) passed back to the originating adapter for
  highlight.
- **Presentation** — typed at the entry edge via `definePresentation<P, D>`
  (generic in, erased `Presentation` out — sound because match consumes the
  ERASED target; a generic match predicate is contravariant). Declarative
  `MatchSpec {source, domain?, kindParent?, kind?, where?}`; `kindParent` is
  DERIVED (`kind.identifier.split('.')[0]`) — the wire has no parent member.
  `surfaces?: () => Promise<EntrySurfaces>` is ONE barrel import per entry
  (`surfaces.ts` re-exports popup/detail/detailTitle/detailActions — one
  chunk per entry, not four). `fetch(ctx: FetchCtx)` where `ctx.probe`
  carries the controller-resolved probe so entries never re-probe.
  `detailStart?: 'minimized' | 'expanded'` sets the panel start-size
  preset per entry (the per-type start-size promise). `mapLayers?:
ReadonlyArray<LayerClaim>` with `{layer, minZoom?, idProp}` — a claim
  BINDS the style layer to the entry (see Click pipeline).
- **Resolution has two paths** (GLM review C7): (1) **Claim-based** — a
  target built from a claimed style layer resolves to the CLAIMING entry
  directly (the claim knows what the features are; no taxonomy data
  needed in tile props — `wd-huts` tiles carry no kind/domain today and
  PR0 does not need to add them); (2) **MatchSpec** — for claim-less
  targets (search rows, probe payloads) via the declarative spec.
  `open()` accepts the resolved entry as an override when the adapter
  already knows it.
- **Selection store** (`src/stores/map/selection-store.ts`, setup store) —
  popup + candidates ephemeral (`shallowRef` targets, never routed, D2);
  detail derived from the route (single source of truth); ONE route watcher
  is the choke point clearing ephemeral state on content-slug change/leave;
  `open(target, {via})` picks the surface (both exist → map: popup,
  search/link: detail) and detects already-routed targets
  (`NavigationDuplicated` → via map: toggle-close, D12; via
  search/link: re-anchor/re-highlight/reseed).
- **Interim routed-entry binding (PR1a only, GLM review T1)**: until the
  PR1b probe chain exists, the routed target's entry binds via route
  meta (`contentType: 'place'` → accommodation entry — the registry
  equivalent of today's `componentMap`); a cold `/hut/:slug` resolves
  with ZERO probe requests.

## Async rules (normative)

- Sequence **token** = correctness; `AbortController` = optimization.
  Re-check `signal.aborted` between chained GETs (probe → hut).
- Controller owns popup-target abort + highlight clear only; detail
  supersession stays in the route-driven `usePlaceDetail` slug watch.
- Deduped requests are never aborted by an individual consumer (shared
  controller cross-talk); dedup Map keyed `${entry.id}:${id}:${lang}`,
  module scope (not reactive state), fixing today's slug-only key.
- **Expand = handoff** of the in-flight promise (`consumePrefetchedHut`
  pattern), then `router.push`, popup cleared after nav commits — never
  abort.
- Seed cache: LRU (~50) + clear on `overlaysEpoch` bump.
- Cold deep link: controller probes `GET /v1/geo/places/{slug}` (sparse
  fields: domain, kind, sources — the meta endpoint lacks domain/kind),
  matches, seeds from the probe, then `‖(surfaces barrel, entry.fetch)`.
  Accommodation `fetch` chains `probe.sources[wodore].source_id →
/v1/huts/{…}` (D4). Everything else renders geoplace-default from the
  probe payload (D8). Boot prefetch adapts: probe at boot reusing the
  client's `Api-Version` header set, then the hut GET.

## Panel composition (three-zone rule)

`WdContentPanel`/`WdBottomSheet` keep their three measured zones (header
title slot / body / pinned footer actions slot — minimize floor, debounced
shrink, pinned-actions-without-scroll requirement). A
`useActiveDetailEntry()` composable resolves the entry and feeds the three
EXISTING slots (generic geoplace defaults for missing title/actions); the
`content` named view becomes a thin `WdDetailBodyHost`. Never flatten the
zones. Legacy slug-prop surface components (WdPlaceContent family) are
adapted by the HOST during migration — new surface components receive the
whole target as a single prop (C2). Component discipline: hosts wrap raw loaders with
`defineAsyncComponent` + `markRaw` memoized into keyed `shallowRef`s; never
async components inside `computed`; no `Suspense`; warm barrels on
pointerdown/mouseenter over interactive layers.

## Click pipeline

- **MapLibre**: ONE global click handler; at click time
  `queryRenderedFeatures` against the derived interactive list (reactive,
  recomputed on catalog epoch bumps — per-layer bindings go stale when
  `applyCatalogOverlays` re-adds layers). Features → targets via
  `LayerClaim.idProp` + shared `propsFromFeature` (geometry location,
  `name_${locale}` family — no per-handler property hardcoding), each
  target resolving to its CLAIMING entry (claim-based resolution — no
  kind/domain tile-property dependency). Stacked features of the SAME
  layer dedupe to one target (by `key`). 1 target →
  open; n targets → minimal `1/n` cycling switcher chip (`WdResultChip`,
  compact `WdSearchResultEntry` variant), topmost layer first.
- **Leaflet fallback**: separate adapter, same contract — DOM-marker click →
  target (marker as `featureRef`) → `controller.open(via: 'map')`. No shared
  hit-test; no disambiguation (markers don't stack).

## Popup surface

`WdMapPopup` mounts once in `MainLayout` (sibling of the map, survives
engine swaps, shares floating-surface z-index/safe-area context). A ~20-line
projector module singleton (`registerProjector(p) → unregister`): MapLibre
`map.project`, Leaflet `latLngToContainerPoint`; canvas-relative px →
viewport px via `getCanvas().getBoundingClientRect()` (popup teleports to
body). rAF discipline: dirty-flag on continuous `move` (glues through
flyTo), one loop, starts `movestart`, stops on `moveend`, pauses when
closed; imperative `el.style.transform` writes (position is a render
artifact, not state); pure `clampToViewport(anchorPx, cardSize, chrome)`
(topbar pill 62px, bottom controls, safe areas). Engine swap / projector
unregister closes the popup; the adapter that set a highlight clears it
(MapLibre style swaps wipe feature-state). FlyTo uses a popup-aware padding
variant (pin + popup bbox on screen) — not a drawer-padding reuse.

## URLs

Static route records per entity model (`/place/:slug` now; `/route/:id`,
`/area/:id`, `/my/*` later — zero core changes). Each: `meta {content:
true, source}`, named views `default`/`menu`/`content` with crawler stubs
(`menuView` AND `contentView` — vue-router resolves lazy views during
navigation), `props: {content: true}`, query/hash preserved. No runtime
`addRoute`. Domains never in URLs (D10). External sources: no URL in first
scope; `/place/:source/:id` pattern reserved.

## Module layout & boundaries

```
src/selection/{types,registry,taxonomy,map-layer-ids,projector}.ts
src/selection/entries/{geoplace-default,accommodation,transport}/…
src/stores/map/selection-store.ts
src/components/map/WdMapPopup.vue, src/components/content/WdDetailBodyHost.vue
src/composables/useActiveDetailEntry.ts, usePlaceDetail.ts
```

- Entries are store-free data modules (eslint `no-restricted-paths` — the
  store→registry→entry cycle crashes at module-init); entry `index.ts`
  export-only.
- `createRegistry(entries)` for tests/Histoire; dev-only drift warning when
  claimed layer ids match no style layers.
- Registry order documents precedence; first match wins; unknown
  domain/kind → geoplace-default (fail open, never blank) + dev warning for
  unresolved non-default sources.

## Testing strategy

Declarative MatchSpec table tests; selection-store state machine with a
real in-memory `createRouter` (open/expand/close/candidates/via-modes/
token-latest-wins/handoff/same-slug reopen); probe chain + chained
accommodation fetch via the hoisted `globalThis.fetch` stub pattern (no
MSW); `clampToViewport` pure math; derived interactive layers + epoch
recompute; locale re-render of props-only popups; Histoire stories for the
three first-scope entries; E2E/visual for popup anchoring, clamping,
flyTo glue, detail parity, cold `/place/:slug`.

## Migration

PR0 (backend/nginx, blocking for cutover only) → PR1a framework at
`/hut/:slug` (behavior-identical, zero URL change) → PR1b URL cutover →
PR2 popup surface (both engines) → PR3 transport entry. This lane
implements PR1a; PR1b waits for PR0.
