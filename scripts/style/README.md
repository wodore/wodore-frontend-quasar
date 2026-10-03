# Wodore Outdoor styles

Two sibling basemaps, kept visually as close as possible:

- **`outdoor-mtk`** (default, visible) — terrain fork of Maptoolkit's
  hiking style, built by `build-mtk-style.mjs` from the vendored
  `mtk-src.json`. Rock drawing, glacier-aware server contours, bathymetry,
  AO hillshade, dashed alpine paths — but NO route lines/shields/labels:
  the app's hiking overlay owns routes.
  Maptoolkit Community License (<= EUR 1M revenue, < 10 FTE):
  attribution + logo required; NO pre-fetching, bulk downloads, proxying,
  offline generation, repackaging or print creation — those use cases
  must run on the OpenFreeMap style below.
- **`outdoor-osm`** (hidden fallback) — keyless OpenFreeMap basemap built by
  `build-outdoor-style.mjs`. Auto-selected when Maptoolkit tiles fail
  (see WdMapView `isMtkTileFailure`), and the right base for any future
  offline/print feature (OpenFreeMap has no usage restrictions).

Both register in `src/stores/map/basemap-store.ts`. Design target: mapy.com "turisticka"
meets Stadia Outdoors — warm cream base, soft greens, dialed-down roads,
burnt-orange trail hierarchy, Mapterhorn hillshade + client-side contour
lines, peaks with elevation. Huts render as plain buildings (no POI
text/icons) — the app's hut overlay owns hut markers.

## Stack (all free, no API keys)

| Piece        | Source                                                        |
| ------------ | ------------------------------------------------------------- |
| Vector tiles | OpenFreeMap planet (`tiles.openfreemap.org/planet`, OpenMapTiles schema) |
| Base style   | OFM Liberty fork (vendored: `liberty-src.json`, BSD)          |
| Hillshade    | Mapterhorn raster DEM (`tiles.mapterhorn.com`, terrarium)     |
| Contours     | `maplibre-contour` — computed client-side in a web worker from the same DEM |
| Sprites      | OpenFreeMap sprite CDN                                        |
| Glyphs       | `demotiles.maplibre.org/font/...` (hosts Noto Sans **and** the Open Sans stack the app overlays use — OFM's font server 404s on Open Sans) |

Useful tile attributes (verified in OFM planet tiles): `transportation.class`
(`path`, `track`, …), `subclass` (`footway`, `cycleway`, `steps`,
`pedestrian`, `bridleway`), `bicycle` (`designated`), `surface`
(`paved`/`unpaved`), `mtb_scale` (`0`–`6`, for future MTB overlays), and the
`mountain_peak` layer (`ele`, `rank`, localized names).

## Files

- `build-outdoor-style.mjs` — deterministic build: Liberty → outdoor. All
  design decisions live here as declarative transforms.
- `liberty-src.json` — vendored upstream Liberty (provenance; re-fetch from
  <https://tiles.openfreemap.org/styles/liberty> to update).
- `preview/index.html` — standalone preview harness (see below).
- `../../public/styles/outdoor/style.json` — generated artifact, committed.

## Editing workflows (important: Maputnik limitations)

- **`outdoor-mtk` CANNOT be previewed in Maputnik** — any version. The
  style uses multi-sprite arrays and MapLibre 5/6 layer types
  (`switch-to-layer`, bathymetry color-relief) that Maputnik's engine
  does not support ("sprite string expected, array found"). Use the
  preview harness instead (full fidelity, incl. live contours):
  `http://localhost:8330/scripts/style/preview/index.html?style=/public/styles/outdoor-mtk/style.json&lon=9.1&lat=46.7&z=13`
  and edit via `build-mtk-style.mjs`.
- **`outdoor-osm` works in Maputnik v1.7 CLI** (single sprite, standard
  types). The CLI requires a style `id` to auto-load the file (both
  build scripts now set one):
  `maputnik-linux --watch --file public/styles/outdoor/style.json --port 8001`

## Workflow

```bash
node scripts/style/build-outdoor-style.mjs          # rebuild style.json

# Static preview harness — REAL dem-contour:// protocol + hillshade
# (Maputnik cannot render custom protocols!)
cd <repo root> && python3 -m http.server 8330
# → http://localhost:8330/scripts/style/preview/index.html?lon=9.109&lat=46.697&z=13

# Maputnik for hand-tuning (CLI binaries ended with v1.7.0):
# download https://github.com/maplibre/maputnik/releases/download/v1.7.0/maputnik-linux.zip
maputnik-linux --watch --file public/styles/outdoor/style.json -p 8000
```

**Any change made in Maputnik edits the generated `style.json` directly —
port it back into `build-outdoor-style.mjs` afterwards**, or the next
rebuild will silently revert it.

Reference captures of the design target (mapy.com z11/z13/z15) must NOT be
committed (licensing) — keep them under `/tmp` or another gitignored path.

## Contour protocol sync

The style references `dem-contour://{z}/{x}/{y}?...` with thresholds encoded
in the URL. Three places must stay in sync:

1. `build-outdoor-style.mjs` — the `style.sources.contours` URL (thresholds)
2. `src/services/outdoorContours.ts` — `DemSource` config (`id: 'dem'`,
   Mapterhorn URL, `encoding: 'terrarium'`, `maxzoom: 15`)
3. `scripts/style/preview/index.html` — same config for the harness

Thresholds (meters, `zoom*minor*major`): `11*200*1000 ~ 12*100*500 ~
13*100*500 ~ 14*50*200 ~ 15*20*100`.

## Future options (documented decisions)

- **Colored route trails** (mapy's red/yellow waymarked routes) need OSM
  route *relations* — not in OFM planet tiles. Could be served by the
  existing Martin tile server (`WODORE_TILE_SERVER_URL`) as an overlay.
- **Glyphs self-hosting**: if `demotiles.maplibre.org` becomes a
  bottleneck, bake Noto Sans + Open Sans Semibold with
  [font-maker](https://github.com/maplibre/font-maker) into `public/fonts/`.
- **MTB emphasis**: `mtb_scale` exists in the tiles; reserved for the
  dedicated cycling/MTB overlays (not the basemap).

<!-- ci probe -->
