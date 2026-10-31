# Place Interactions Architecture (popup / detail / hybrid)

**Date:** 2026-10-31 (rev 3)
**Status:** REVISED — Opus architecture review, owner decisions, Opus Vue-expert review and GLM JS/TS-expert review applied; pending owner sign-off
**Next step:** OpenSpec change `add-place-interactions`

## Goal

Generalize the hut-only detail flow into a type-agnostic interaction system:
map features, search results and deep links can open **small anchored popups**,
**full detail panes**, or **popup → detail hybrids**, with per-type components,
per-type start sizes, click disambiguation when multiple features are stacked,
and no backend coupling beyond a narrow contract.

First implementation scope (owner, 2026-10-31):

| Entry                          | Surfaces                                 | Data source                           |
| ------------------------------ | ---------------------------------------- | ------------------------------------- |
| **accommodation** (huts)       | custom **detail** (today's UX)           | `/v1/huts/{slug}` (unchanged, D4)     |
| **transport** (external layer) | **popup only**                           | tile properties (entry-owned shape)   |
| **geoplace-default**           | **popup** + minimal deep-link **detail** | light geoplace detail (probe payload) |

## Owner decisions (2026-10-31)

| #   | Topic              | Decision                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | URLs               | No redirects. Hut routes die, canonical URL becomes `/place/:slug`. (Old `/hut/:slug` links 404 — accepted. SEO proxies: PR0, see §4.)                                                                                                                                                                                                                               |
| D2  | Back from detail   | Returns to map; transient popup is dropped. No history entry for popups.                                                                                                                                                                                                                                                                                             |
| D3  | Mobile popup       | Anchored popup on mobile too (NOT a bottom-sheet snap).                                                                                                                                                                                                                                                                                                              |
| D4  | Backend            | Accommodation keeps `/v1/huts/{slug}` + `HutSchemaDetails`. Huts→geoplace backend migration is a separate, later PR — the registry makes that swap entry-local.                                                                                                                                                                                                      |
| D5  | Interactive layers | Derived frontend-side from registry entries (rationale vs. the unused catalog `interaction` field: §2.6).                                                                                                                                                                                                                                                            |
| D6  | Extensibility      | Routes, areas, user content (`/route/:id`, `/my/place/:slug`, …) later WITHOUT core changes — see §2.4.                                                                                                                                                                                                                                                              |
| D7  | Id spaces          | Geoplace slug ≠ hut `source_id` (owner-confirmed; `HutSchemaDetails` carries no geoplace ref either). Canonical URL id = **geoplace slug**; the accommodation entry derives the hut slug from `sources[wodore].source_id`. `wd-huts` tiles gain a geoplace-slug property (PR0) so map clicks can build the URL.                                                      |
| D8  | Generic detail     | geoplace-default minimal detail (renders the probe payload) accepted as the deep-link/search fallback UX.                                                                                                                                                                                                                                                            |
| D9  | Fallback popup     | IN scope. Anchoring shell is engine-specific (MapLibre/Leaflet adapters); the rendered popup CONTENT component is shared. The transport popup component already exists (WIP) and is integrated as-is.                                                                                                                                                                |
| D10 | URL taxonomy       | Path segments = ENTITY MODELS only (`place`, `route`, `area`). Geoplace domains (admin/natural/amenity) NEVER appear in URLs — reclassification must not break links. External sources: no URL in first scope; `/place/:source/:id` pattern reserved (needs `encodeURIComponent` + param regex when it lands).                                                       |
| D11 | Search sources     | `sources` returns to the autocomplete sparse selection (owner accepts the per-row keystroke cost). Search select opens detail straight from props — 1 request, no probe. May be dropped again after the huts→geoplace migration removes the source_id chain — but sources stay potentially useful then too (attribution, external sources); revisit, don't pre-drop. |
| D12 | Toggle-close       | Clicking the already-open target's feature via the MAP toggles the detail CLOSED (today's tap-pin-to-close UX is preserved). Via search/link, the already-routed target re-anchors/re-highlights/reseeds instead. |

## 1. Current state (what constrains us)

- **Click**: `INTERACTIVE_LAYERS` hardcodes `wd-huts` (`src/stores/map/utils/interactive-layers.ts`); `onHutLayerClick` lives inside `WdMapView.vue` (1810 lines, per-layer `map.on('click', …)` binding) and is duplicated in `WdFallbackMapView.vue` (2081 lines, DOM-marker listeners — a different architecture).
- **Open**: always `router.push('map-hut')` — full detail, fixed behavior.
- **Route**: `/hut/:slug` with `meta.contentType: 'place'`; `MainLayout` fills the panel's header/footer slots via a `componentMap` keyed by content type (exactly one type today). Store state is purely route-derived.
- **Data**: `usePlace(slug)` hardwires `/v1/huts/{slug}`; MVT seeding hardcodes property names (`seedPlaceFromMap`); boot prefetch (`hut-prefetch`) fires the hut GET at boot for cold `/hut/:slug` loads (raw `fetch` — bypasses the `Api-Version` pin header). `pendingRequests` dedup is keyed by slug only while requests carry `lang` (latent wrong-locale cross-talk).
- **Panel**: `WdContentPanel` (desktop) + `WdBottomSheet` (mobile) compose THREE zones — header title slot, body (the `content` named router-view), pinned footer actions slot — and the panel's height choreography measures `headerEl`/`footerEl`/`contentEl` as separate boxes. `smartFlyToHut` pads for the **drawer/panel**, not for popups. `openContentPanelMaximized()` gates on `route.name === 'map-hut'`.
- **Search**: generic (`/v1/geo/places/search`, `WdSearchResultEntry` keyed by `domain`/`kind`) — but `SEARCH_FIELDS` deliberately drops `sources` (per-PO: keystroke perf), so search rows today carry NO hut `source_id`.
- **Backend is ahead**: `GeoPlaceDetailSchema` (domain discriminator + `kind` ref + sparse fieldsets), `/v1/geo/places/{slug}`, `/v1/geo/places/overlays`, generic search all exist. `PlaceMetaSchema` carries no domain/kind — not usable as a type probe. `CategoryKindRefSchema` has `identifier`/`slug`/`classifier` — **no `parent` member** (kind parents are a frontend-derived concept, §2.6).

## 2. Architecture

```
map click ─┐
search ────┼─► MapTarget ──resolve──► Presentation ──► Surface(s)
deep link ─┘   (what)                 (capabilities)   popup | detail
```

### 2.1 `MapTarget` — normalized "what was clicked"

Produced by every entry point; nothing downstream knows the origin.

```ts
interface MapTarget {
  key: string; // targetKey(t) helper — NEVER hand-built strings at call
  // sites (external ids may contain the separator, e.g. 'ch.sbb:123')
  source: string; // owning family: 'geoplace' | 'transport' | … (flat for now)
  id: string; // CANONICAL id — drives the URL: geoplace slug / external
  // id (D7). The hut source_id is entry-internal (from props or probe).
  location?: LatLng; // popup anchor + flyTo
  props: PropsBag; // raw payload: MVT props | search row | probe. markRaw —
  // immutable wire data; entries must NOT mutate it
  /** Opaque engine-specific highlight handle, attached by the adapter that
   *  created the target: MapLibre {source, sourceLayer, id: numericFeatureId}
   *  (numeric id ≠ slug!) or the Leaflet marker ref. markRaw — a proxied
   *  live engine object (Leaflet markers hold DOM + map refs) is a perf
   *  hazard or worse. Passed back to that adapter to set/clear highlight. */
  featureRef?: unknown;
}
```

**Reactivity rules (normative — the store's bug farm if ignored):**
Pinia deep-reactivity must never wrap `props` or `featureRef`. Hold targets in
`shallowRef`, `markRaw` the whole target at construction, no clones anywhere
(immutable read-only wire data; the only reactivity a popup needs is the
locale ref). Memoize `resolvePresentation` by `target.key` (string identity),
pass the whole target as ONE prop (spreading mints new identities per render).

The existing MVT seeding (`seedPlaceFromMap`) is the special case
"remember `target.props` until the fetch resolves".

### 2.2 `Presentation` — declarative capabilities per target kind

Typed at the entry edge, erased at the registry (`definePresentation<P, D>`
identity helper: generic in, plain `Presentation` out — narrow fetch/seed
return types erase soundly; a generic match predicate would hit
contravariance, so `match` consumes the ERASED target):

```ts
interface MatchSpec {
  source: string; // 'geoplace' | 'transport' | …
  domain?: string | readonly string[]; // vocabulary from taxonomy.ts
  kindParent?: string; // DERIVED — taxonomy.kindParentOf(kind) =
  // kind.identifier.split('.')[0]; the wire
  // has NO parent member
  kind?: string | readonly string[]; // full identifier or slug
  where?: (t: MapTarget) => boolean; // escape hatch, erased target
}

interface Presentation {
  // erased, registry-facing — no generics leak
  id: string;
  match: MatchSpec; // declarative DATA: unit-testable as tables,
  // printable for diagnostics ("no entry matched
  // {source, domain}"), vocabulary stays in
  // taxonomy.ts instead of N opaque predicates
  surfaces?: () => Promise<EntrySurfaces>; // ONE barrel import — see §3
  fetch?(ctx: FetchCtx): Promise<unknown>; // ctx.probe — see §2.3
  seed?(props: PropsBag): unknown; // wide bag in, narrow type out
  detailStart?: 'minimized' | 'expanded';
  mapLayers?: ReadonlyArray<LayerClaim>; // { layer, minZoom?, idProp } — §2.5
}
```

**Surface choice when both exist**: the open intent decides — `via: 'map'`
→ popup, `via: 'search' | 'link'` → detail. No fallback chains. First match
wins; the registry array order documents precedence.

Unknown `domain`/`kind` resolves to `geoplace-default` → generic popup driven
purely by payload fields. New backend kinds work automatically; custom UI is a
deliberate choice, never a prerequisite. **Fail open, never blank.** (Dev-only
guard: warn when a non-default `source` matches no entry — a silently
never-matching entry fails open to the default and is hard to spot in review.)

**Zone loaders and panel composition (the three-zone rule).** `EntrySurfaces`
carries `popup?`, `detail?`, `detailTitle?`, `detailActions?`. The panel
shells keep their three-zone slot composition — `WdContentPanel`/`WdBottomSheet`
render header title slot / body / pinned footer actions slot, and the height
choreography measures the three boxes separately (minimize floor, debounced
shrink, pinned-actions-without-scroll requirement from
`docs/specs/wd_design_place_details.md`). Therefore: **a `useActiveDetailEntry()`
composable in MainLayout resolves the entry and feeds the panel's EXISTING
three slots** (title/body/actions, generic geoplace defaults when omitted) —
replacing the `componentMap` lookup, keeping all slot/measurement wiring. The
`content` named view becomes a thin generic body host. A monolithic
`WdDetailHost` rendering its own header/footer internally would collapse the
three measured boxes and break the panel choreography — do NOT flatten.
Component resolution discipline: hosts wrap raw loaders with
`defineAsyncComponent` + `markRaw`, memoized into `shallowRef`s keyed by
`target.key`; **never resolve async components inside a `computed`** (fresh
wrapper per re-eval → remount + re-import). No `Suspense` (fights seed-paint
choreography and the out-in fade transition).

### 2.3 Selection controller — one store owns interaction state

`map-content-store` evolves into **`selection-store`** (`src/stores/map/`):

```
                     ┌────────────────────── routed: /place/:slug ──────┐
closed ──► popup(target) ──expand──► detail(target)                     │
  ▲          │ ephemeral store state     ▲   ▲                          │
  │◄─close───┘                           │   └─ route-leave/back → map (D2)
  │                                      │      (popup NOT resurrected)
  └◄──────────────────────────────────────┘
  candidates?: MapTarget[]   (disambiguation, ephemeral like popup)
```

- **Popup + candidates = ephemeral store state**, never routed (D2). Held as
  `shallowRef`s (§2.1).
- **Detail = the route, the single source of truth for detail state.** `mode`
  is derived (route ⇒ detail), not duplicated — no dual source of truth.
- **Single choke point for ephemeral cleanup: one watcher on
  `router.currentRoute`** (the pattern `map-content-store` uses today): any
  navigation that changes the content slug or leaves the content family
  clears popup + candidates + highlight. Atomicity is by construction and
  unit-testable; the A→B-slug-change-while-detail-open case is covered free.
- **Expand = HAND OFF, never abort** (§7.3 fixed): look up the in-flight
  promise for `target.key`, pass it to the detail context (the
  `consumePrefetchedHut` pattern), `router.push`, adopt `detailPending` in the
  route watcher, clear popup after navigation commits (push is async —
  clearing synchronously flashes empty content). Abort is for supersede
  (A→B) and close only.
- **Latest-wins, correctly split**:
  - _Popup target replacement_ (rapid A→B clicks) — controller-owned: abort
    A's popup fetch (best-effort), clear A's highlight, B wins.
  - _Detail supersession_ — stays in the route-driven `usePlaceDetail` slug
    watch where it already works. Moving it into the controller invites
    double-abort/stale-overwrite bugs.
  - _Correctness mechanism = sequence token_ (check `token === seq` after
    every await), _abort = optimization_ (abort has two windows: resolved
    before abort fires; shared/deduped controllers). Copy the codebase's
    existing captured-controller + `signal.aborted` re-check pattern.
  - _Deduped requests are never aborted by a consumer_ (two awaiters share the
    first caller's controller; one leaving would AbortError the other) —
    consumers abandon via token; abort applies only to controller-owned
    (single-owner) requests.
- **`open(target, { via })`** picks the surface, resolves the entry
  (synchronous for map/search targets — props carry domain/kind), applies
  `seed(props)`, kicks fetch. Must detect **"target already routed"** (same
  slug → `NavigationDuplicated`, no watcher fires — a bug class today's
  `openPlace` already has) and still re-anchor, re-highlight, reseed.
- **Existing consumer migration (PR1a, mechanical)**: the store exposes
  `detailOpen`/`detailId` computed from route + state so `MainLayout`'s
  `contentDrawerOpen`, `:slug`, `close()`, the re-target scroll-reset watch
  (`contentSlug ?? contentId`) migrate 1:1. `openContentPanelMaximized()`'s
  `route.name === 'map-hut'` gate and `WdContentPanel`'s module-scope
  `sessionMinimized` both track the route rename.

**Cold deep-link resolver** — the only async resolution path, owned by the
CONTROLLER (one probe, ever; the probe is passed INTO `entry.fetch` via
`FetchCtx.probe` so the accommodation entry never re-fetches it):

```
/place/:slug (bare URL, no props available)
  ─► probe: GET /v1/geo/places/{slug}          [sparse fields: domain (required),
  │    │ place/probe payload = seed (skeleton)   kind, sources — small]
  │    ▼
  │  registry match (probe props)
  ├─► accommodation: entry.fetch({probe}) chains probe.sources[wodore]
  │    .source_id → /v1/huts/{source_id} — re-checks signal.aborted between
  │    the two GETs (D4). ONE probe total; probe doubles as seed.
  └─► everything else: geoplace-default minimal detail renders FROM the
                       probe payload (no second request)
  ‖(surfaces barrel import, entry.fetch) once the entry is known — no
   serialized waterfall.
```

- The probe is the geoplace detail endpoint with a minimal `fields[places]`
  selection — not the meta endpoint (carries no domain/kind/sources).
- 2 sequential requests on a cold accommodation link; seeded paths stay at 1
  (map click via tile props; search rows carry `sources` again — D11).
- **Boot prefetch adapts** (PR1b): probe at boot, then the hut GET in
  parallel with app startup — reusing the client's header set (`Api-Version`
  pin — today's raw `fetch` in `hut-prefetch.ts` bypasses it); prefetch regex
  gains the `/place/` path.

### 2.4 URLs & extensibility (D6, D10)

Public content gets **typed top-level segments**, all sharing the same body
host + registry, differing only in `meta.source`:

| Route                              | Target source              | Exists in                                               |
| ---------------------------------- | -------------------------- | ------------------------------------------------------- |
| `/place/:slug`                     | `geoplace`                 | first scope (replaces `/hut/:slug`, no redirect — D1)   |
| `/route/:id`                       | `routes`                   | later — new entry + new route record, zero core changes |
| `/area/:id`                        | `areas`                    | later — same                                            |
| `/my/place/:slug`, `/my/route/:id` | `user:place`, `user:route` | later — same host behind an auth-gated prefix           |

Static route records only — explicitly REJECT runtime `router.addRoute` per
entry (no code-split win — the host is shared; complicates the crawler stub
and langPrefix; undebuggable route shape). Each record: `meta: { content:
true, source: … }`, named views (`default` MapPage, `menu` crawler-stubbed
`menuView`, `content` crawler-stubbed `contentView` — **the content view
needs the same `isCrawlerUA()` stub as the menu**; vue-router resolves lazy
views during navigation, so without the stub crawlers pull the host chain),
`props: { content: true }`. Query/hash preservation per the established
`query: current.query, hash: current.hash` pattern.

`source` ids stay **flat strings** until `/my/*` lands (YAGNI). Extending =
one route record + one registry entry.

**URL taxonomy (D10): segments follow ENTITY MODELS, never taxonomy.**
`/place` serves ALL geoplace domains (admin, natural, amenity, …) — a village
(domain=admin) or peak (domain=natural) is `/place/:slug` like any
accommodation. The domain is data, not identity: reclassifying a place must
never change its URL. Separate segments exist only for different entity
models. External sources (transport) are popup-only in the first scope and
have NO URL; if external deep links ever become real, the reserved pattern is
a source-qualified place URL (`/place/:source/:id`, with
`encodeURIComponent` + param regex — external ids are the one id space we
don't control) — decided when needed, not now.

### 2.5 Click pipeline & disambiguation — honestly split per engine

**MapLibre (primary):** ONE global click handler, registered once at map load.
At click time it queries the _derived_ interactive layer list (§2.9) via
`queryRenderedFeatures`:

```
click ─► queryRenderedFeatures(derived interactive layers, topmost first)
      ─► features → MapTargets (dedup by key; LayerClaim.idProp says WHICH
      │   tile property is the canonical id — the mapping contract lives in
      │   the claim, not hardcoded per handler)
      ─► resolve each (sync — props carry domain/kind)
      ├─ 1 target ─► open(via: 'map')
      └─ n targets ► switcher chip row, topmost first
                     ("importance = layer order" falls out of render order)
```

**Claim-based resolution (GLM OpenSpec review C7)**: a target built from
a claimed style layer resolves to the CLAIMING entry directly — the claim
binds layer → entry. Map-click resolution therefore has NO dependency on
kind/domain tile properties (today's `wd-huts` tiles carry none, and PR0
does not need to add them); MatchSpec resolution applies to claim-less
targets (search rows, probe payloads). Stacked features of the same layer
dedupe by `key` (never candidates).

A single global handler is what makes dynamic layers safe: `applyCatalogOverlays`
re-adds layers on every epoch bump (boot/revalidate/locale) — per-layer
`map.on('click', …)` bindings would need re-registration each time; a global
handler + click-time query never goes stale. The derived interactive list is
a **reactive getter** (recomputed on epoch bump) so the click handler and the
mobile focus-mode tap guard (`tapTargetsInteractiveLayer`) read the same
current value. Keeps the style-not-loaded guard.

**Feature → target mapping contract:** each `LayerClaim` carries
`{ layer, minZoom?, idProp }` plus a shared `propsFromFeature` helper doing
geometry-vs-props location and the `name_${locale}` family ONCE — otherwise
`seedPlaceFromMap`'s hardcoded property names reincarnate in every handler.

**Leaflet fallback:** a DIFFERENT architecture (raster basemap + client-side
clustered DOM markers, per-marker listeners, no `queryRenderedFeatures`, no
feature-state). It does NOT share the hit-test path — it is a **separate
adapter implementing the same contract**: build a `MapTarget` (marker as
`featureRef`), call `controller.open(target, { via: 'map' })`. Markers never
stack like vector features, so disambiguation is naturally absent. **Popup on
the fallback is IN scope (D9)** — the anchoring adapters below are shared.

**Switcher** reuses the search row family (`WdResultChip`, compact variant of
`WdSearchResultEntry` — same avatar chain `kind.symbol.color` →
`WdCategoryIcon` → domain tier icon from `taxonomy.ts`). First scope ships a
MINIMAL switcher (current target + `1/n` cycling chip); rich UI later.

### 2.6 Registration & module layout

Static, ordered registry — first matching entry wins; entries are store-free
data modules:

```
src/selection/
  types.ts          # MapTarget, Presentation, MatchSpec, FetchCtx, targetKey()
  registry.ts       # resolve(target) + createRegistry(entries) for tests
  taxonomy.ts       # THE ONLY backend-taxonomy module: domains, kind parents
                    # (DERIVED — kindParentOf(kind) = identifier.split('.')[0];
                    # the wire has no parent), tier icons/labels
  map-layer-ids.ts  # style-layer id constants — single home for the catalog
                    # naming contract
  projector.ts      # ~20-line module singleton — §2.9
  entries/
    geoplace-default/ { popup.vue, detail.vue (minimal), surfaces.ts, index.ts }
    accommodation/    { detail.vue (≈ WdPlaceContent family), surfaces.ts, index.ts }
    transport/        { popup.vue (existing WIP), surfaces.ts, index.ts }
    index.ts          # ordered array — order documents precedence
src/stores/map/selection-store.ts     # controller (§2.3)
src/components/map/WdMapPopup.vue     # anchored popup shell (desktop + mobile)
src/components/content/WdDetailBodyHost.vue  # thin generic body named-view
src/composables/useActiveDetailEntry.ts      # three-zone slot feeder (§2.2)
```

- **Import-boundary rule (eslint `no-restricted-paths`)**: entries may import
  `types.ts`, `taxonomy.ts`, `map-layer-ids.ts`, `@clients/index` (types) and
  dynamic component thunks — NEVER stores. The cycle
  `selection-store → registry → entries → selection-store` crashes at
  module-init under dev/HMR (Pinia setup stores call `useRouter()` at init).
  Entry `index.ts` files are export-only, no side effects.
- **Dev-only claim↔style drift guard**: after `applyCatalogOverlays`, diff
  claimed layer ids against `map.getStyle().layers`, `console.warn` on claims
  matching nothing — catches backend renames in dev, where they happen.
- `kindParent` matching goes through `taxonomy.kindParentOf()` — never a wire
  field.
- **D5 rationale**: what a click OPENS is a presentation concern changing with
  frontend UX releases, not with the backend style catalog. Residual coupling
  (style-layer ids) is confined to `map-layer-ids.ts`.
- Adding "villages detail" later = one folder + one array line. No edits to
  `WdMapView`, `MainLayout`, `routes.ts`.

### 2.7 Data layer

`usePlace` generalizes to **`usePlaceDetail(target)`**, instantiated ONCE in
the body host (detail is route-driven, the host is a singleton — scope-bound
cleanup as today):

- Framework keeps (entry-agnostic): abort+token supersession (§2.3 rules),
  dedup of simultaneous requests (module-scope Map — NOT reactive state;
  promises in Pinia cause churn for zero benefit; keyed
  `${entry.id}:${id}:${lang}` — fixing today's slug-only key; shared deduped
  promises never aborted by consumers), locale refetch via the existing
  `watch([slug, currentLocale])` shape (only while a surface is open — a
  closed panel must not fire background requests), prefetch handoff,
  seed-then-overwrite.
- **Seed cache**: today's `seededPlaces` never evicts — LRU-trim (~50) AND
  clear on `overlaysEpoch` bump (props from pre-swap tiles are semantically
  stale once layers re-add). Fix the test-isolation smell (module maps leak
  across vitest cases) by exposing a reset.
- Per entry: `fetch(ctx)` + `seed(props)`. Accommodation `fetch` = the
  cold-link chain (ctx.probe → `sources[wodore].source_id` → `/v1/huts/{…}`),
  re-checking `signal.aborted` between GETs; seeded paths carry the hut slug
  in props and skip the probe. Transport and geoplace-default popups are
  **props-only** (no fetch, no network on open).
- The hardcoded MVT property names move into `propsFromFeature` (§2.5).
- **Props-only popups read locale reactively** (`name_${locale}` picked at
  render time — works precisely because the bag is not the reactive part).

### 2.8 Backend decoupling — the whole contract

1. Interaction layer depends only on `(source, id, location, props-bag)`.
2. Domain/kind-parent knowledge lives ONLY in `src/selection/taxonomy.ts`
   (kind parents DERIVED from `identifier`, not a wire field).
3. Unknown taxonomy → generic presentation from payload fields. No blank
   screens for new backend kinds.
4. Per-entry fetchers — endpoint swaps (huts→geoplace later) are entry-local.
5. External sources register their own presentation with their own prop
   shapes — no backend knowledge leaks into the framework.
6. Named residual couplings: style-layer ids (`map-layer-ids.ts`), the
   accommodation slug chain (geoplace slug → hut `source_id`), and
   `LayerClaim.idProp` tile-property names.

### 2.9 Map integration

- **Derived interactive layers**: `LayerClaim`s (accommodation claims
  `wd-huts` + date-gated `wd-huts-occupation*`, `minZoom:
MIN_HUT_CLICK_ZOOM` — same behavior as today) compile into a reactive
  interactive list at `applyCatalogOverlays` time, recomputed on every epoch
  bump; the global click handler queries at click time.
- Generic `onMapClick(targets)` in `WdMapView` replaces `onHutLayerClick`:
  feature-state selection via `featureRef` (numeric feature id, not slug),
  seeding, routing move into the controller/entries. The fallback implements
  the same contract over its DOM markers.
- **Projector: a ~20-line module singleton** (`selection/projector.ts`), not
  an event bus, not Pinia: `registerProjector(p)` returns an unregister fn;
  a `shallowRef` handle makes the popup re-anchor reactively on engine swap.
  MapLibre registers `ll => map.project(ll)`; Leaflet `ll =>
map.latLngToContainerPoint(ll)`. The popup is a SIBLING of the map (mounted
  once in `MainLayout` — survives engine identity switches, shares the
  floating-surface z-index/safe-area context), so provide/inject does not
  reach it; `useMap()` is MapLibre-only (Leaflet has no registry).
  **Coordinate subtlety:** `project()` returns canvas-relative px; the popup
  teleports to body (escape map-container overflow/stacking), so add the
  canvas bounding rect (`getCanvas().getBoundingClientRect()` — existing
  pattern).
- **rAF re-anchor discipline** (Capacitor battery trap if leaked): set a
  dirty flag on continuous `move` (NOT `moveend`-only — flyTo emits
  continuous `move`, which glues the popup through the 600ms animation);
  ONE rAF loop drains the flag, starts on `movestart`, stops + final snap on
  `moveend`, pauses when closed/tab-hidden (`useRafFn`); write
  `el.style.transform` imperatively inside the loop — the popup position is a
  render artifact, not reactive state. Extract `clampToViewport(anchorPx,
cardSize, chrome)` (topbar pill 62px, bottom controls, safe areas) as a
  pure function for unit tests.
- **Engine swap / style change closes the popup and clears highlight** — a
  Leaflet marker handle is meaningless to MapLibre and vice versa; MapLibre
  style swaps wipe feature-state. Cleanup belongs to the adapter that set it
  (the projector unregister path).
- **FlyTo geometry is new**: `smartFlyToHut`/`getMapPadding` pad for the
  drawer/panel. A popup needs the pin AND the popup bounding box on-screen —
  a popup-aware padding variant, not a reuse. `WdMapPopup` = its own
  de-risking SPIKE before PR2.

### 2.10 Search integration

`WdPlaceSearch.onPlaceSelect` builds a `MapTarget` and calls
`open(target, { via: 'search' })`. **Id semantics** (D7): `MapTarget.id` =
geoplace `slug` (canonical, drives the URL); the wodore `source_id` (hut
slug) rides in `props` for the accommodation fetch.

**D11 — `sources` returns to the autocomplete selection.** Today's
`SEARCH_FIELDS` drops `sources` (per-PO keystroke perf; select falls back
to fly-only). Owner decision: include `sources` in the search request
again — the per-row cost is accepted; search select then opens the detail
pane (1 request, straight from props) instead of today's fly-only. The
accommodation entry reads `source_id` from search props and skips the
probe; non-wodore rows work regardless (geoplace-default needs only the
canonical slug). The probe chain remains the cold-link/degradation path.
**Migration note (D4-later):** once huts migrate to geoplaces, the
`source_id` chain disappears (the accommodation entry fetches the geoplace
endpoint by canonical slug) and `sources` COULD be dropped from search
again for payload — but it may stay useful regardless (source attribution,
future external/secondary sources), so revisit then, don't pre-drop.
Registry supplies per-entry `searchEntry` overrides later.

## 3. Performance

- **ONE barrel chunk per entry** (`surfaces.ts` re-exports popup/detail/
  title/actions) — NOT four independent loaders (4 chunks × N entries =
  parallel-request storms before first paint, inflated workbox manifest).
  Still fully lazy; the "2 KB water-point popup" claim holds. The shared
  popup content component + geoplace defaults live in one common host chunk.
- **SW precache decision (explicit)**: precache entry chunks (PWA posture —
  popups/details work offline, first use costs nothing). Size-check the
  WIP transport popup's dependency footprint when integrated.
- **Chunk warming on the hot path**: call the barrel loader early on
  `mouseenter`/pointerdown over interactive layers (module cache dedupes) —
  Vite's modulepreload covers the route graph, not the registry graph.
- Popups open from tile props alone — zero network on the open path.
- Seed mechanism keeps instant-paint details; the cold-link probe doubles as
  seed. Cold deep link = probe → ‖(barrel import, entry.fetch).
- Registry resolution = synchronous declarative-match chain over ~3–10
  entries, memoized by `target.key`.
- rAF loop only while moving; imperative transform writes; no reactive
  per-frame patching.

## 4. Migration (PR slicing)

| PR                                    | Content                                                                                                                                                                                                                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PR0 (backend/nginx)**               | `/place/:slug` SEO support: `.md` + meta subrequests + canonical/hreflang; `wd-huts` MVT tiles gain a geoplace-slug property (D7)                                                                                                                                                                                                                                                        | **Blocking** — without it the canonical URL has no indexable content and map clicks cannot build the canonical URL.                                                                                                                                    |
| **PR1a — framework, zero URL change** | `selection-store`, `registry` (+`createRegistry`), `types`, `taxonomy`, `map-layer-ids`, `projector` scaffold, `usePlaceDetail`, accommodation entry, `useActiveDetailEntry` + body host (legacy slug-props adapted by the host), eslint import boundaries, INTERIM route-meta→entry binding for cold `/hut/:slug` (probe chain replaces it in PR1b) — all still mounted at `/hut/:slug` | Behavior-identical; generalizes internals without breaking anything. Deviation (GLM review C5): the geoplace-default ENTRY (stubbed surface loaders) already lands here so registry resolution + fail-open are testable; its components come with PR2. |
| **PR1b — URL cutover**                | `/place/:slug` + cold-link resolver (probe chain) + boot-prefetch adaptation (client headers, `/place/` regex) + search last hop (per §2.10 decision) + content-view crawler stub + `/hut/:slug` dies (D1)                                                                                                                                                                               | Ships only after PR0 is live.                                                                                                                                                                                                                          |
| **PR2 — popup surface**               | `WdMapPopup` SPIKE first (anchoring, clamping, move+rAF, flyTo bbox, teleport coords — §2.9), then popup surface (BOTH engines, D9) + global click pipeline + `LayerClaim`-derived interactive layers + `geoplace-default` entry + minimal `1/n` switcher                                                                                                                                | Engine swap closes popup + clears highlight; drift-warning dev guard lands here.                                                                                                                                                                       |
| **PR3 — transport entry**             | Integrate the existing transport popup (WIP) via `surfaces.ts` barrel; proves the external-source path end to end                                                                                                                                                                                                                                                                        | Depends on transport layer serving (catalog row w/ external tiles); footprint size-check for precache.                                                                                                                                                 |
| **Later**                             | Rich switcher UI, routes/areas/`my/*` entries, huts→geoplace backend swap (entry-local), per-entry `searchEntry` overrides, popup↔detail morph (cross-fade only for now)                                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                      |

## 5. Risks & coordination

| Risk                                                                                                                          | Mitigation                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/hut/:slug` URLs are indexed; they will 404 (D1)                                                                             | Accepted by owner; PR0 ships `/place` SEO first; monitor Search Console after PR1b.                                                                         |
| `/place/:slug` cold links for accommodation = 2 sequential requests                                                           | Accepted cost; boot prefetch hides most of it; disappears with the huts→geoplace swap (D4-later).                                                           |
| Map clicks need the geoplace slug in `wd-huts` tile props (D7)                                                                | PR0 backend item. Transitional fallback if backend lags: cold-link probe tries `/v1/huts/{slug}` on geoplace 404 (mixed id-space, removed once tiles ship). |
| Search payload grows: `sources` back in the per-keystroke selection (D11) — the cost a past PO dropped                        | Owner-accepted; backend may later ship the cheap `hut_slug` scalar instead (entry-local swap). Monitor search latency after rollout.                        |
| **Silent match failure**: a never-matching entry (e.g. typo'd kindParent) fails open to geoplace-default — wrong UX, no crash | Declarative MatchSpec + dev warning on unresolved non-default sources; table tests over (spec, target) pairs.                                               |
| Reactivity bug farm: deep-proxied props/featureRef in Pinia (Leaflet markers hold DOM + map refs)                             | Normative shallowRef/markRaw rules (§2.1); store state machine unit-tested without mounting.                                                                |
| Async misuse: expand-abort (doubles latency), shared-dedup abort cross-talk, resolved-before-abort windows                    | Token-for-correctness, abort-as-optimization, expand-as-handoff, dedup-never-aborted (§2.3) — normative in the spec.                                        |
| Generic geoplace popup needs a clickable amenity overlay in the map catalog (e.g. water points)                               | Backend coordination: catalog row + Martin tiles with category filters (`/v1/geo/places/overlays` exists). Entry testable via Histoire meanwhile.           |
| Transport external layer must be servable through the map catalog (external style/tile URLs)                                  | Catalog already supports external style URLs; entry matches by source id.                                                                                   |
| `WdMapView` refactor risk (1810 lines)                                                                                        | PR1a touches routing/store only; click-path extraction is PR2; fallback adapter covered by visual-matrix checks.                                            |
| Popup occlusion on small screens (D3 anchored)                                                                                | Spike includes clampToViewport + safe-area pass; visual verification on mobile viewports.                                                                   |
| Crawler pulls the detail host chain on `/place/:slug`                                                                         | Content-view crawler stub (same as `menuView`) — vue-router resolves lazy views during navigation.                                                          |

## 6. Testing

- Unit: registry resolution (declarative MatchSpec table tests, first-wins,
  unknown-domain fallback, unresolved-source warning), selection-store state
  machine (open/expand/close/candidates, via-modes, token latest-wins, expand
  handoff, same-slug reopen, route-watcher choke point) with a real in-memory
  `createRouter`, derived interactive layers (+ epoch recompute, drift
  warning), cold-link probe chain + chained accommodation fetch (hoisted
  `globalThis.fetch` stub — the established `use-place.spec.ts` pattern, no
  MSW; assert call order probe→hut and `signal` propagation),
  `usePlaceDetail` framework (abort, dedup incl. never-abort-shared,
  `${entry}:${id}:${lang}` key, seed, locale refetch only-while-open),
  `clampToViewport` pure math, locale-switch re-render of an open
  props-only popup.
- Histoire stories: `geoplace-default` popup + minimal detail, transport
  popup, result chip.
- E2E/visual: popup anchor + clamping on mobile viewport, accommodation
  detail parity with today, cold `/place/:slug` load, fallback detail parity,
  popup glued through flyTo.

## 7. Failure modes designed against

1. **Cold deep link** — bare slug, no type: controller-owned probe chain
   (§2.3) before any fetch/component choice; barrel import parallel to fetch.
2. **Rapid clicks A→B** — token + best-effort abort (popup path); A's
   `featureRef` highlight cleared even if A's fetch resolved.
3. **Expand mid-fetch** — HAND OFF the in-flight promise to the detail
   context (never abort — aborting throws away a response the detail pane
   immediately needs); route watcher adopts `detailPending`.
4. **Re-open the currently-routed target (D12)** — `NavigationDuplicated`
   means no watcher fires; `open()` detects already-routed: map re-click
   toggles the detail closed (today's UX), search re-select re-anchors/
   re-highlights/reseeds.
5. **Locale switch while popup open** — reactive locale read (§2.7), popup
   re-renders, no stale-language text; no background refetch while closed.
6. **Back from detail** — route-watcher choke point clears detail + ephemeral
   state; popup never resurrected (D2).
7. **Style not loaded / mid-basemap-switch** — global handler keeps the
   `queryRenderedFeatures` try/catch guard (today's behavior).
8. **Engine swap / style change with popup open** — projector unregister
   closes the popup; the adapter that set a highlight clears it (handles are
   engine-specific; MapLibre style swaps wipe feature-state).
9. **Crawler hits `/place/:slug`** — PR0 serves content via nginx
   subrequests; `menuView` AND `contentView` crawler stubs keep crawlers off
   the MapLibre vendor chunk and the host chain.
10. **Silent registry miss** — declarative MatchSpec + dev-only unresolved-
    source warning (fails open to geoplace-default, but loudly in dev).

## 8. Review log

- **2026-10-31 — Claude Opus (advisor) architecture review, applied:**
  cold deep-link resolver; PR0 SEO promotion; Leaflet fallback split;
  `MapTarget.featureRef`; boolean match + array order; popup spike; atomic
  expand handoff; YAGNI source hierarchy; catalog `interaction` rationale +
  `map-layer-ids.ts`; search id semantics; PR1 split 1a/1b.
- **2026-10-31 — Owner review, applied:** detailTitle/detailActions rationale;
  id-space NO → D7 (geoplace-slug canonical, tile prop in PR0); D8 generic
  minimal detail; D9 fallback popup in scope + existing transport WIP; D10
  URL taxonomy (entity models only).
- **2026-10-31 — Claude Opus (Vue-expert) review, applied:**
  1. **Three-zone rule (top finding, verified in `MainLayout.vue`/`WdContentPanel.vue`)**:
     registry resolution feeds the panel's EXISTING header/body/footer slots
     via `useActiveDetailEntry()`; the named view becomes a thin body host;
     never flatten the three measured boxes (§2.2).
  2. Raw loaders in the registry; hosts wrap `defineAsyncComponent` +
     `markRaw` into keyed `shallowRef`s; never async components in
     `computed`; no `Suspense`; chunk warming on hover/pointerdown (§2.2, §3).
  3. Popup mounts once in MainLayout; projector via callback registration;
     canvas-rect offset for teleported coordinates; rAF gated + cancelled
     (§2.9).
  4. Normative reactivity: shallowRef/markRaw targets, key-memoized
     resolution, whole-target props (§2.1).
  5. Latest-wins scoped: controller = popup abort + highlight only; detail
     supersession stays in the composable; dedup key bug found
     (slug-only → `${id}:${lang}`) (§2.7).
  6. SSR/crawler safety for the body host; no q-menu/q-dialog popups;
     cross-fade only, keep route.path keying + `onContentChanged` (§2.2/§2.9).
- **2026-10-31 — GLM 5.3 (JS/TS-expert) review, applied:**
  1. `definePresentation<P,D>` type erasure; `Partial<unknown>` cut;
     declarative `MatchSpec` (+ `where` escape hatch); **`kind.parent` does
     not exist on the wire** — `kindParentOf()` derived from `identifier`
     (§2.2, §2.6).
  2. `FetchCtx.probe` — controller owns the single probe, passes it into
     `entry.fetch`; no double-probe, skeleton seed guaranteed (§2.3).
  3. Async semantics: token-for-correctness/abort-as-optimization;
     deduped-never-aborted; **expand = handoff, not abort (fixes §7.3)**;
     chained-fetch aborted-recheck between GETs; locale refetch only while
     open; seed-cache LRU + epoch clear (§2.3, §2.7).
  4. Router: content-view crawler stub; route-watcher as single ephemeral
     cleanup choke point; same-slug reopen case; static records only (§2.4).
  5. `targetKey()` helper (colon collisions); one `surfaces.ts` barrel chunk
     per entry; SW precache decision; imperative transform in the rAF loop;
     `clampToViewport` pure fn (§2.1, §3, §2.9).
  6. Projector as module singleton with unregister; engine swap closes popup
     - clears highlight (§2.9).
  7. `LayerClaim.idProp` + `propsFromFeature` — the feature→target mapping
     contract specified (§2.5).
  8. **§2.10 contradiction found (verified)**: search drops `sources` —
     PR1b backend dependency or probe-on-select (open question §9).
  9. `hut-prefetch` raw `fetch` bypasses the `Api-Version` header — boot
     probe must reuse the client's header set (§2.3).
  10. Import-boundary rule (entries store-free, eslint-enforced) +
      `createRegistry()` + dev drift warning (§2.6).
- **2026-10-31 — Owner review round 2, applied:** §9.1 resolved → **D11**:
  `sources` included in the search autocomplete again (per-row cost
  accepted); §2.3, §2.10, PR0 and the risk table updated. No open
  questions remain.
- **2026-10-31 — Owner review round 3, applied:** C1 resolved → **D12**:
  map re-click of the open target toggles the detail closed (today's UX
  preserved); search re-select re-anchors. Spec scenarios, design, tasks
  and §7.4 updated. No open questions remain.
- Owner sign-off: **pending go for OpenSpec** — no open questions.
