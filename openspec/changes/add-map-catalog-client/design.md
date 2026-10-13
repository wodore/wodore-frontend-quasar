# Design: Consume the backend map layer catalog

## Context

- Backend contract (wodore-backend PR #313): `GET /v1/map/catalog?lang=…[&role=…]`
  returns `{slots, layers}`; each layer carries identity (`slug`), i18n
  metadata, `parameters`, `variants: [{spec, style_url?, inline_style?}]`,
  `coverage_bbox`, `fallback_min_zoom`, `fallback`, `anchors`, `config`,
  `legend`, `attributions`. `GET /v1/map/styles/{slug}.json?spec=&mode=`
  serves the style — resolved (defaults baked, env substituted, URLs
  absolute) or tokenized (`{{param}}` tokens kept for the client).
- The catalog may not be on staging yet (separate infra handoff); the
  seed (backend `map_seed`) is still reaching parity with the frontend
  factories — it lacks e.g. the vector `hiking` overlay and serves
  `ch.swisstopo.swisstlm3d-wanderwege` where the app knows `hiking-swiss`.

## Decisions

### D1 — Factories become the fallback, not the source

The overlay store still boots from `overlays.ts` factories (instant
first paint, offline resilience, pre-cutover environments where Martin
still serves styles). When the catalog arrives, items are swapped
in-place (same pattern as `rebuildOverlays`: `Object.assign` keeps
reactive identity, active/show state preserved). Catalog layers replace
factory items with the same slug (after alias mapping); catalog-only
slugs append; factory slugs the catalog does not serve stay (documented
transition crutch — flips to strict catalog mode when the seed reaches
parity). Basemaps use the same merge but apply once at init (bounded
catalog wait, ~5 s) — a late catalog arrival only heals a broken
Martin-style basemap, it never interrupts a working session.

Rationale: the deploy ordering guarantee (styles seeded before Martin
routes drop) means "catalog unreachable ⇒ factories still work" on every
environment; hot-swapping basemaps mid-session for style-source changes
only would be visually jarring for zero benefit.

### D2 — One style endpoint, two modes

`inline_style` catalog variants are authored documents (tokens/env
placeholders unresolved) — the client ignores them and always fetches
from `/v1/map/styles/{slug}.json`, which runs the full resolution
pipeline and carries ETag caching. Basemaps fetch resolved styles (no
parameters in practice) as URL strings so MapLibre loads them directly;
external `style_url` variants (MapTiler, swisstopo, OpenFreeMap) are
used verbatim — the backend substitutes `{{env:…}}` keys server-side.
Overlays with `parameters` fetch `?mode=tokenized` and resolve
client-side with defaults ∪ user overrides ∪ runtime values (one code
path — resolving with defaults equals resolved mode). Overlays without
parameters fetch resolved.

### D3 — GPU tier maps to `?spec=`

`shouldUseRaster(gpuTier)` stays the single detector; its boolean maps
to `spec=low` (raster path) / `spec=high`. The server picks the nearest
available variant (exact → nearest → single) and reports it via
`X-Map-Spec`; the client does not need its own fallback logic for
served styles. When selecting between catalog _variant entries_
(external `style_url`s differ per spec), the client mirrors the
server's exact→nearest→single rule.

### D4 — Parameters compile into existing structures

`OverlaySwitchItem` gains `parameters` (schemas) and `tokenizedStyle`.
`opacity` compiles from the `opacity-curve` parameter's resolved default
so the existing `addOverlayLayer` paint injection and the native
composer keep working unchanged. Legend/config DTOs map onto the
existing `OverlayConfig` shapes (the backend seed already emits the
frontend filter layout). Category-driven legend sections whose
projections lack symbol URLs degrade to the existing category-API fetch
(bridge until the backend projection carries symbols, per its own spec).
Known-slug i18n labels take precedence over catalog names (mirrors
`BASEMAP_LABEL_KEYS`) so the four shipped languages keep working while
the backend translations catch up.

### D5 — Live re-resolution without style reload

Parameter changes re-run the token walk over the cached tokenized
style, then apply only the token-bearing paths: paint/layout via
`setPaintProperty`/`setLayoutProperty` per layer, geojson source URLs
via `setData`. `overlay.style` is updated in place so later re-adds
(basemap switches, native recompose) see resolved values. Runtime
parameters (`{{date}}`) resolve from the date-picker flow; the
availability layer wires its `wd-bookings` source to the existing
`bookingsGeojson` store object (auth/lang/days query params a raw
MapLibre URL fetch would not carry).

### D6 — Slot/anchor transition crutches

The catalog seeds two slots (`background`, `ways`); the app additionally
anchors `places` (huts under town labels) and `routes` (hiking lines
under all labels). Two small tables bridge the gap until the catalog
carries them: a slot override for `huts` → `places` and legacy anchors
for `wd-outdoor-base-mtk` (`places`/`routes` insertion points). Both
are keyed so catalog data supersedes them the moment it appears.

### D7 — Sprite pack merge

Catalog styles reference Martin sprite packs per layer (`wd` →
`/sprite/accommodation`, `wd` → `/sprite/availability`); MapLibre sprite
ids are unique and `icon-image` expressions bake the `wd:` prefix in.
At build time same-id sprites from the same Martin base merge their
comma-separated pack lists (the documented Martin sprite pack URL
grammar), restoring the combined `accommodation,availability` sprite the
factory world used.

## Risks / trade-offs

- Catalog unreachable at boot → factories (pre-cutover envs fine;
  post-cutover envs would show a broken Martin basemap until the
  bounded-wait catalog fetch succeeds — accepted per deploy ordering).
- Seed divergence (missing layers) → factory items remain visible until
  the seed completes; the merge is the single knob to flip later.
- English-only catalog labels for new slugs → i18n override table for
  known slugs keeps shipped languages intact.
