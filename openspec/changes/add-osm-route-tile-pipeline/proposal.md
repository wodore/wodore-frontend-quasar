## Why

The map overlays for signed routes (hiking today, cycling soon) depend on external tile providers whose generalization and coverage we cannot control: the Maptoolkit vector source carries walking networks no earlier than z7 (z9–11 in remote regions like NZ), the Waymarked Trails raster overlay fixes styling we cannot adapt, and both carry per-provider license terms. Generating our own route vector tiles from OSM gives us full control over zoom policy, schema, colors, and freshness at trivially small data sizes (measured: all hiking-relevant ways of Switzerland, z6–14 = 122 MB, ~2–3 min on a laptop).

## What Changes

- Add a **route tileset generator** built on Planetiler (custom Java profile) producing one MBTiles archive per activity from OSM route relations and way tags:
  - `wd_hiking` — walking/foot/hiking route networks (iwn/nwn/rwn/lwn) with SAC scale, via ferrata, names/refs
  - `wd_cycling` — bicycle route networks (ncn/rcn/lcn + mtb) with network, names/refs
- Define an activity-agnostic **route tile schema** (same layer shape for every sport) so styles and frontend code are written once.
- Serve the archives through the existing **Martin** tile server as file-backed `mbtiles:` sources, atomically swapped on rebuild.
- Add a **scheduled rebuild** (nightly per region via Geofabrik extracts) with a documented small-box recipe (2 CPU / 2 GB + swap measured sufficient for CH-sized regions; CI runner for larger).
- Frontend: point the hiking overlay's vector source at the Wodore tile server (env-driven URL, MTK stays as documented fallback); a future cycling vector overlay consumes the same schema.
- License/attribution switches to pure **ODbL** (© OpenStreetMap contributors) for the generated tiles.

Non-goals (this change): replacing the basemap, terrain/contours, raster overlays (Waymarked Trails stays), minute-level freshness (PostGIS/osm2pgsql replication is documented as the future path but not built).

## Capabilities

### New Capabilities

- `route-tile-pipeline`: generate, rebuild, and serve Wodore-owned OSM route vector tiles (schema, generator, scheduling, serving, sizing/licensing constraints).
- `route-overlay-source`: consume the generated route tilesets in map overlays (source selection, fallback behavior, activity-specific styling contract on top of the shared schema).

### Modified Capabilities

- None at spec level — the existing hiking overlay's requirements (Swiss color code, dash difficulty grammar, labels/shields) stay unchanged; only the data source behind them becomes configurable.

## Impact

- **Backend / infra** (`wodore-backend`): tile_server gains the generator profile, build scripts, Martin source entries, and a scheduled job; ~100 MB–few GB archive storage per region.
- **Frontend** (this repo): `overlay-hiking.ts` source URL becomes environment-configurable with the Maptoolkit source as fallback; no layer grammar changes.
- **Dependencies**: none at runtime for the app (tiles are served); build-time only (Planetiler jar, Java 21, osmium optional).
- **License**: generated tiles are ODbL share-alike with attribution — removes the Maptoolkit Community License constraints from the route layer.
