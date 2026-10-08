# Wodore Outdoor styles

Two sibling basemaps, kept visually as close as possible:

- **`wd-outdoor-base-mtk`** (default, visible) — terrain fork of
  Maptoolkit's hiking style. Rock drawing, glacier-aware server
  contours, bathymetry, AO hillshade, dashed alpine paths — but NO
  route lines/shields/labels: the app's hiking overlay owns routes.
  Maptoolkit Community License (<= EUR 1M revenue, < 10 FTE):
  attribution + logo required; NO pre-fetching, bulk downloads,
  proxying, offline generation, repackaging or print creation — those
  use cases must run on the OpenFreeMap style below.
- **`wd-outdoor-base-ofm`** (hidden fallback) — keyless OpenFreeMap
  basemap. Auto-selected when Maptoolkit tiles fail (see WdMapView
  `isMtkTileFailure`), and the right base for any future offline/print
  feature (OpenFreeMap has no usage restrictions).

Both are served by the backend **Martin** tile server and register in
`src/stores/map/basemap-store.ts` (`martinStylePath()`).

## Where styles live now

| Piece                         | Location                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Served style JSONs            | `wodore-backend/tile_server/styles/wd-outdoor-base-{mtk,ofm}.json`                                       |
| Upstream sources (NOT served) | `wodore-backend/tile_server/styles/src/{mtk-outdoor,ofm-liberty}-src.json`                               |
| Fonts / sprite SVGs           | `wodore-backend/tile_server/{fonts,sprites}/` (Martin generates PBFs / sprite PNGs on the fly)           |
| Frontend loader               | `src/stores/map/basemap-store.ts` (`martinStylePath`, `STYLE_VERSION` cache buster)                      |
| Style contract tests          | `tests/unit/wd-outdoor-base-{mtk,ofm}.spec.ts` (fetch from Martin; skip when unreachable)                |
| Build pipeline (archived)     | `scripts/archive/style/` — the one-time Liberty/mtk → Wodore transforms. Styles are now edited directly. |

## Editing styles

1. Edit `wodore-backend/tile_server/styles/wd-outdoor-base-*.json`
   directly (prettier-formatted JSON — CI enforces it).
2. Sync + restart: `app martin_sync` (backend) and restart the Martin
   container; or copy into `martin_sync/styles/` for a quick local try.
3. Bump `STYLE_VERSION` in `src/stores/map/basemap-store.ts` so
   browsers re-fetch (manual ISO-date bust, no deploy coupling).

## Preview + captures

```bash
# Backend Martin running, then from the frontend repo root:
python3 -m http.server 8330
# → http://localhost:8330/scripts/style/preview/index.html?style=http%3A%2F%2Flocalhost%3A8075%2Fstyle%2Fwd-outdoor-base-mtk&lon=9.109&lat=46.697&z=13

# Screenshot matrix (ours vs swisstopo reference) — needs dev server
# (port 9000) + Martin running:
node scripts/style/capture-scenarios.mjs --only ours --out /tmp/shots
```

The harness (`preview/index.html`) runs the REAL `dem-contour://`
protocol — Maputnik cannot render custom protocols, and `outdoor-mtk`
cannot be previewed in Maputnik at all (multi-sprite arrays, custom
layer types). `outdoor-ofm` works in Maputnik v1.7 CLI when pointed at
the Martin style URL.

## Contour protocol sync

The OFM style references `dem-contour://{z}/{x}/{y}?...` with
thresholds encoded in the URL. Three places must stay in sync:

1. `wodore-backend/tile_server/styles/wd-outdoor-base-ofm.json` — the
   `contours` source URL (thresholds)
2. `src/services/outdoorContours.ts` — `DemSource` config (`id: 'dem'`,
   Mapterhorn URL, `encoding: 'terrarium'`, `maxzoom: 15`)
3. `scripts/style/preview/index.html` — same config for the harness

Thresholds (meters, `zoom*minor*major`): `11*200*1000 ~ 12*100*500 ~
13*100*500 ~ 14*50*200 ~ 15*20*100`.

Reference captures of design targets (mapy.com, swisstopo) must NOT be
committed (licensing) — keep them under `/tmp` or another gitignored
path.
