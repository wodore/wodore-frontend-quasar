# Design: Consume the backend map layer catalog

## Context

- Backend contract (wodore-backend #313 + #315): `GET /v1/map/catalog?lang=…[&role=…]`
  returns `{slots, layers}`; each layer carries identity (`slug`), i18n
  metadata, `parameters`, `variants: [{spec, style_url?, inline_style?}]`,
  `coverage_bbox`, `fallback_min_zoom`, `fallback`, `anchors`, `config`,
  `legend`, `attributions`, and a content `version` (ISO timestamp =
  `layer.modified`, #315). `GET /v1/map/styles/{slug}.json?spec=&mode=`
  serves the style — resolved (defaults baked, env substituted, URLs
  absolute) or tokenized (`{{param}}` tokens kept for the client) — fast
  (render cache) and ETag-cached.

## Decisions

### D1 — Catalog is the single source; persistence replaces factories (owner decision)

There are NO bundled factory overlay/basemap definitions anymore — the
backend owns the catalog, and missing seed layers are simply absent.
What changes instead of the factories:

- **Boot cache**: the last catalog snapshot and the fetched style
  documents persist in localStorage (storage service; styles keyed
  `slug|spec|mode` with their layer `version`). Boot renders the
  persisted catalog synchronously — offline and instant.
- **Cold first run** (no cache): an explicit loading state in the
  overlay/basemap controls until the catalog answers; a failure is an
  error state + user-visible notice. Never factories, never a blank
  silent fallback.
- **Metadata-first, progressive styles**: overlay rows apply as
  PLACEHOLDER items the moment the catalog is known (labels, icons,
  settings render from metadata with an empty style — addOverlay is a
  no-op on it), and each resolved style bundle replaces its placeholder
  through a progressive re-apply (catalog order). One slow, hung or
  dead style fetch therefore never blocks the menu; style fetches abort
  after 30 s and the layer skips loudly (D8) — the interaction suite's
  chrome assertions are independent of style-endpoint health.
- **Version sync**: after the cached render, a fresh catalog is fetched
  in the background. Per layer, the style is refetched ONLY when its
  `version` changed (or the entry is missing/invalid); otherwise the
  persisted document serves. Absent `version` (pre-#315 backends)
  degrades to "null-version entries stay valid" — the first
  version-bearing catalog invalidates each cache once. Removed layers'
  cache entries are pruned by slug.

The deploy ordering guarantee (styles seeded before Martin's style
routes drop) plus the boot cache make every environment work: offline
or unreachable → last known catalog; fresh → version-synced.

### D2 — One style endpoint, two modes

`inline_style` catalog variants are authored documents (tokens/env
placeholders unresolved) — the client ignores them and always fetches
from `/v1/map/styles/{slug}.json`, which runs the full resolution
pipeline, is render-cached server-side (#315) and ETag-cached in the
browser. Basemaps fetch resolved styles as URL strings so MapLibre
loads them directly; external `style_url` variants (MapTiler, swisstopo,
OpenFreeMap) are used verbatim — the backend substitutes `{{env:…}}`
keys server-side. Overlays with `parameters` fetch `?mode=tokenized`
and resolve client-side with defaults ∪ user overrides ∪ runtime values
(one code path — resolving with defaults equals resolved mode);
tokenized documents persist in the boot cache and re-resolve on every
load. Overlays without parameters fetch resolved mode.

### D3 — GPU tier maps to `?spec=`

`shouldUseRaster(gpuTier)` stays the single detector; its boolean maps
to `spec=low` (raster path) / `spec=high`. The server picks the nearest
available variant (exact → nearest → single) and reports it via
`X-Map-Spec`; the client mirrors the same rule when selecting between
catalog variant entries (external `style_url`s).

### D4 — Slug continuity for persisted user state

The backend owns the slugs. Persisted state written in the factory era
keeps resolving through one-time rename tables: overlay slugs
(`hiking-swiss` → `ch.swisstopo.swisstlm3d-wanderwege`,
layer-groups `RENAMED_SLUGS`) and basemap selections
(`outdoor-osm` → `wd-outdoor-base-ofm`, `Satellite Hybrid` →
`maptiler-hybrid`). Known-slug i18n labels take precedence over catalog
names (four shipped languages vs. untranslated seed strings).
Overlay groups reference slugs; layers the catalog does not serve are
absent from the group lists — correct by D1.

### D5 — Live re-resolution without style reload

Parameter changes re-run the token walk over the tokenized style, then
apply only the token-bearing paths: paint/layout via
`setPaintProperty`/`setLayoutProperty` per layer, geojson source URLs
via `setData`. `overlay.style` is updated in place so later re-adds
(basemap switches, native recompose) see resolved values. Runtime
parameters (`{{date}}`) resolve from the date-picker flow; the
availability layer wires its `wd-bookings` source to the existing
`bookingsGeojson` store object (auth/lang/days query params a raw
MapLibre URL fetch would not carry).

### D6 — Slot/anchor z-order anchors

The catalog seeds two slots (`background`, `ways`); the app additionally
anchors `places` (huts under town labels) and `routes` (hiking lines
under all labels). Two small tables bridge the gap until the catalog
carries them: a slot override for `huts` → `places` and anchors for
`wd-outdoor-base-mtk` (`places`/`routes` insertion points). Both are
keyed so catalog data supersedes them the moment it appears.

### D7 — Sprite pack merge

Catalog styles reference Martin sprite packs per layer (`wd` →
`/sprite/accommodation`, `wd` → `/sprite/availability`); MapLibre sprite
ids are unique and `icon-image` expressions bake the `wd:` prefix in.
At build time same-id sprites from the same Martin base merge their
comma-separated pack lists (the documented Martin sprite pack URL
grammar).

### D8 — Invalid remote styles skip loudly

Served/persisted documents are remote data: a style that fails
MapLibre structural validation (resolved output, for tokenized docs)
SKIPS that layer — console warning plus a user-visible notice — instead
of blanking the map or silently falling back. (The seeded huts
`icon-size` bug was the motivating case; fixed backend-side in #315.)

## Risks / trade-offs

- First run on a new device needs the network before the map shows
  layers — accepted: explicit loading state, no silent degradation.
- localStorage caps (~5 MB) bound the style cache; overlay styles are
  a few KB each, basemap styles are URL-loaded (not cached by us) — the
  cache stays ~100 KB. Pruning drops removed layers.
- English-only catalog labels for new slugs → i18n override table for
  known slugs keeps shipped languages intact.
