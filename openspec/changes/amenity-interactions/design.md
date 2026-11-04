# Design: Amenity Interactions

Owner decisions (2026-11, user review):

| #   | Topic             | Decision                                                                                                                                                                               |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Framework         | Everything flows through the #383 selection framework (entries, claims, popups, `openFromMap`). No parallel click pipeline.                                                            |
| A2  | Accommodations    | Open the EXISTING hut details view. Their slugs are geoplace slugs (404 on `/v1/huts/{slug}`) — wrap the entry fetch: 404 → `/v1/geo/places/{slug}` mapped onto the hut details shape. |
| A3  | Amenity popup     | Minimal: name, type icon, elevation. Tile props paint instantly; `/v1/geo/places/{slug}` enriches (localized name below label zoom, kind symbol, elevation). No expand/detail surface. |
| A4  | Cluster threshold | `count < 6` → member list; `>= 6` → zoom in (+1.5 z). 6 is the fixed backend convention.                                                                                               |
| A5  | Members source    | NOT the tiles (members-in-properties abandoned: +100–370% tile size). Spatial near endpoint with exact tile-grid snap.                                                                 |
| A6  | Cluster members   | STRICT members only — no "also nearby" section (graduated high-importance POIs are their own clickable markers next to the bubble).                                                    |
| A7  | What's here       | Unclaimed tap → proximity probe (50 m, distance-ordered, ≤5). Results open via the framework; empty/failed → focus mode exactly as before.                                             |

## Backend contract (owned by the backend's openspec change)

`GET /v1/geoplaces/near` — two modes:

- **Cluster mode** (member lists): `lat`, `lon` (cluster anchor), `z`
  (the served TILE zoom — integer, source-maxzoom-capped), `category_tree`,
  `limit` (= cluster count), plus the overlay tile URL's cluster params
  forwarded verbatim (`importance_threshold`, `cluster_max_zoom`,
  `cluster_radius_m`, `cluster_ref_zoom` when present). The backend snaps
  to the exact tile grid — the response IS the cluster's members.
  Default order: importance-desc (matches the popup listing).
- **Proximity mode** (what's here): `lat`, `lon`, `radius` (25–50 m),
  `limit` (3–5), `order=distance`; NO `z`, NO cluster params, NO
  category.

Response envelope both modes: `{ data: [...], count }` — `count` is the
total BEFORE `limit`; the sync invariant (endpoint `count` == tile
feature `count` under the grid snap) is owned and verified by the
backend's openspec change. On mismatch the frontend TRUSTS the endpoint
count (the endpoint owns the tile-grid truth) but still lists `data`.

Row fields (the `fields` projection both popup modes request):
`slug, name, importance, category_identifier, color, parent_color,
elevation`.

The endpoint is not yet in the generated API client: URL construction and
row mapping live in ONE service module (`src/services/cluster-members.ts`)
so the typed-client swap is local when the schema lands.

## Interaction flow

```
click ─► queryRenderedFeatures (claimed layers, point ±10px)
  ├─ cluster feature (count>1 on *-clusters) ─► count<6: cluster popup
  │                                            └ count>=6: easeTo(z+1.5)
  ├─ symbol features ─► targetsFromFeatures ─► openFromMap (framework)
  └─ nothing claimed ─► what's-here probe ─► results: openFromMap
                                             └ empty: focus mode (as before)
```

- **Cluster interception** runs BEFORE the target pipeline: cluster
  features carry no slug and can never produce individual targets. The
  synthetic `cluster`-source target (id `layer@lng,lat` — stable per
  feature, so re-clicking toggles the popup closed) carries
  count/subtree/colors plus the near-query context (served tile zoom +
  forwarded cluster params), both read from the overlay's style source
  at click time (maxzoom overzoom rule; the tiles URL's query string).
- **Served tile zoom**: `min(floor(camera zoom), source.maxzoom)` — an
  overzoomed source still serves z-maxzoom tiles at higher camera zooms,
  and the grid snap needs the zoom the clicked tile was BUILT for.
- **The `-selected` layers are NOT claimed** (invisible feature-state
  halos must not capture clicks; the ±10px tolerance covers near-misses).
  The `-cluster-count` badges are not claimed either (text sits inside
  the claimed circle).

## Accommodations wrap (A2)

The `wd-accommodations` overlay serves geoplace accommodations (bhotel,
bivouac amenities — huts have their own `wd-huts` overlay and remain on
`/v1/huts/{slug}`). One entry serves both claim families:

- claim `wd-accommodations` on the accommodation entry (floor 5, its
  style minzoom) — clicks route to `map-hut` (the hut details view),
  feature-state highlight via the generic `featureRef` handle;
- fetch wrap: `/v1/huts/{slug}` 404 → `/v1/geo/places/{slug}` mapped
  onto `HutSchemaDetails` (name, elevation, location, description,
  `type_open` ← kind). The hut view guards every hut-only block
  (availability, capacities, year stripe) on data presence — they render
  nothing for geoplace accommodations;
- seed wrap: the hut identity seed additionally reads the geoplace tile
  fields (`category_identifier` 'accommodation.\*' → `type_open.slug`,
  `color` → instant avatar; `elevation` when the tile-fields PR lands).

## What's here (A7)

- Fires only when BOTH the exact-point and ±10px-box queries find no
  claimed feature (the existing empty-click branch).
- Single flight, latest wins (abort); no error surface (background
  lookup — offline behaves like an empty probe).
- Focus-mode coordination: a pending focus toggle from the tap's
  pointerup is CANCELLED for the probe and re-armed (same timer slot,
  same 250 ms delay) on empty/failed results — double-tap/pan/wheel
  cancels keep working, and a newer pointerdown suppresses the re-arm.
- Results: `nearPlaceTarget(row, tapAnchor)` + `entryForNearPlace(row)`
  (identifier parent `accommodation` → accommodation entry, else amenity
  entry) → `openFromMap` — one row opens directly, several arm the
  popup shell's candidate switcher (built for stacked clicks; no new
  list UI).

## Out of scope

- The no-WebGL Leaflet fallback (amenity overlays on the subset profile
  are a separate lane).
- Deep links/URLs for amenity popups (popups are ephemeral by design,
  D2).
- The transport popup's backend category-slug 400 (separate fix).
