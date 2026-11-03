# Proposal: Amenity Interactions

## Why

The backend now serves eleven amenity overlays (accommodations + ten
subtrees: restaurant, health_and_emergency, outdoor_services, groceries,
shopping, tourism, services, finance, utilities, automotive) as
catalog-driven MapLibre styles on the geoplaces tile source. They render,
but nothing is interactive: no cursor, no tap handling, no popups, no
details. Huts keep their exclusive click pipeline; a new backend overlay
still needs a page reload to appear (boot/locale are the only catalog
refreshes — the #380 tab-focus revalidation landed separately).

## What Changes

- **Interactive amenity layers** via the #383 place-interaction
  framework's layer claims (no parallel system): the accommodation entry
  claims `wd-accommodations` (floor 5); a new **amenity entry** claims the
  ten `wd-<subtree>` symbol layers at their backend tier floors
  (5 / 9 / 13); a new **amenity-cluster entry** claims the eleven
  `*-clusters` circle layers at the same floors. Claims derive the hover
  cursor, the mobile focus-mode tap guard and the click-pipeline gates.
- **Amenity popups** (minimal, owner decision): name, type icon,
  elevation. Instant paint from tile properties (`slug`, `name`,
  `color(s)`, `category_identifier`, `elevation` — the latter two land
  with the backend tile-fields PR, degrading gracefully until then);
  enrichment from `/v1/geo/places/{slug}` (localized name below the
  style's label zoom, kind symbol, elevation).
- **Accommodations open the hut details view** (owner decision): their
  slugs are geoplace slugs and 404 on `/v1/huts/{slug}` — the
  accommodation entry's fetch wraps: 404 → fetch the unified geoplace
  detail and map it onto the hut details shape (title, elevation,
  weather, location, description render; hut-only blocks stay hidden for
  lack of data). Second click toggles closed (existing D12 behavior).
- **Cluster clicks**: `count < 6` opens a member-list popup; `>= 6`
  zooms in (+1.5). Members are NOT in the tiles (the
  members-in-properties contract was abandoned — +100–370% tile size):
  the popup fetches them from the backend's spatial near endpoint
  (`GET /v1/geoplaces/near`) with the exact tile-grid snap (`z` = served
  tile zoom, `category_tree`, `limit=count`, forwarded cluster params
  from the overlay's tile URL). Strict members only — no proximity
  supplement (owner decision: graduated high-importance POIs are their
  own clickable markers). Member clicks open the place exactly like an
  individual symbol click.
- **What's here**: a tap that hits no interactive layer probes the near
  endpoint in proximity mode (`radius` 50 m, `order=distance`, no
  zoom/category). Results open through the place framework (one → its
  detail flow; several → the candidate list popup); an empty or failed
  probe falls through to focus mode exactly as before.
- **Tab-focus catalog refresh**: a visibilitychange revalidation of the
  overlay catalog (`refreshCatalog({background, revalidate, deferApply})`)
  so new backend overlays appear without a reload (menu instantly, map
  re-adds at idle). Landed with #380 — this change documents and verifies
  it; no new code.

## Capabilities

### New Capabilities

- `amenity-interactions`: interactive amenity overlays — layer claims and
  zoom gates, the minimal popup, the accommodations→hut-details wrap,
  the cluster member flow via the near endpoint, and the what's-here
  proximity fallback.

### Modified Capabilities

(none — `place-interactions` / `place-registry` requirements are
consumed as-is; the amenity entries are ordinary registry entries.)

## Impact

- **Code**: `src/selection/map-layer-ids.ts` (amenity layer ids/tiers),
  new `src/selection/entries/amenity/` + `src/selection/entries/amenity-cluster/`,
  new `src/selection/cluster-behavior.ts` + `src/selection/near-places.ts`,
  new `src/services/cluster-members.ts` (near endpoint client),
  new `WdAmenityPopup.vue` + `WdClusterPopup.vue`,
  `src/selection/entries/accommodation/index.ts` (claim + geoplace wrap),
  `src/selection/entries/accommodation/seed.ts` (category_identifier
  seed), `src/selection/entries/index.ts` (registry order),
  `src/components/map/WdMapView.vue` (cluster interception, what's-here
  probe), i18n ×4.
- **Backend (parallel PRs, NOT in this repo)**: the near endpoint
  contract + the count-sync invariant (endpoint `count` == feature
  `count` under the grid snap) are owned by the backend's openspec
  change — cross-referenced in `design.md` §Backend contract. Tile
  `elevation`/`category_identifier` fields are a separate backend task;
  the frontend degrades gracefully without them.
- **Dependencies**: none new.
