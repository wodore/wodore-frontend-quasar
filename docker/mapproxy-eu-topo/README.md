# MapProxy "Europe Topo" — border-merged tile service

Merges national topographic maps into ONE tile layer with **pixel-perfect
country-border cuts**, replacing the client-side bbox compositing (which
always shows seams or white no-data strips at borders):

```
OpenTopoMap (worldwide fallback, bottom)
        ▲ clipped by the Switzerland polygon (transparent outside)
swisstopo pixelkarte (CH, top)
        = one merged tile — cut follows the actual border
```

This is the same technique skitourenguru.ch relies on conceptually, but
with a real polygon cut instead of trusting upstream coverage.

## Quickstart

```bash
cd docker/mapproxy-eu-topo
docker compose up -d
```

| What | URL |
|---|---|
| Demo viewer | <http://localhost:8090/mapproxy/demo/> |
| Tiles (XYZ order!) | `http://localhost:8090/mapproxy/tiles/europe_topo/webmercator/{z}/{x}/{y}.png` |
| TMS capabilities | `http://localhost:8090/mapproxy/tms/1.0.0/` |

The `/tiles` endpoint serves plain **XYZ order** (top-left origin) — use it
directly as a MapLibre raster source, no `scheme: 'tms'` needed.

First access to a tile fetches from upstream (OpenTopoMap + swisstopo) and
caches it in `cache_data/` — afterwards only the cache is hit.

## Verified behavior

- Tile deep inside CH (Bern/Fribourg): 100% swisstopo style
- Tile at the CH/AT border (Rhine valley): swisstopo on the Swiss side,
  OpenTopoMap on the Austrian side, cut follows the border river, no
  white/blank areas, no straight bbox seams
- Tiles over Austria/France/elsewhere: pure OpenTopoMap
- Repeated requests served from cache only

## Wodore integration

Point a basemap at the proxy (plain XYZ raster source). Combined with the
OpenFreeMap vector base for zoomed-out views:

```ts
const europeTopoProxy = getRasterStyle({
  name: 'eu-topo-proxy',
  tiles: ['http://192.168.1.50:8090/mapproxy/tiles/europe_topo/webmercator/{z}/{x}/{y}.png'],
  attribution: '&copy; swisstopo &copy; OpenTopoMap (CC-BY-SA) &copy; OpenStreetMap contributors',
  suffix: '',
  maxZoom: 17,
});

const europeTopoStyle = getCompositeRasterStyle({
  name: 'europe-topo',
  styles: [
    positronBase ?? esriLightGrayStyle,        // clean zoomed-out base
    withLayerMinZoom(europeTopoProxy, 8),      // merged topo from z8
  ],
});
```

In production, host the proxy on your VPS (it's the same compose file) and
put nginx/Cloudflare caching in front — merged tiles are deterministic.

## Caching & seeding

`cache_data/` (gitignored) holds the default file cache. Tiles are cached
on demand; to pre-warm low zooms overnight:

```bash
docker compose exec mapproxy mapproxy-seed \
  -f /mapproxy/config/mapproxy.yaml /mapproxy/config/seed.yaml
```

After changing the boundary polygon or source URLs, clear the cache:
`rm -rf cache_data/*` (stale tiles keep the old cut).

## Extending

- **More countries**: add a tile source + `coverage` with the country
  polygon (`at-boundary.geojson` etc.) and append it to
  `europe_topo_cache.sources` (right = on top). Candidates: basemap.at
  (CC BY 4.0 — note its white no-data edge, the polygon clip removes it),
  IGN ortho (étalab, keyless `data.geopf.fr`).
- **Precise borders**: `ch-boundary.geojson` is Natural Earth 10m
  (~1 km, public domain). For survey-grade, replace with swisstopo
  swissBOUNDARIES3D Landesgebiet (OGD) and re-seed.
- **Higher zooms**: OpenTopoMap serves to z17; swisstopo to ~z20.

## MapProxy 7.0.0 gotchas (all hit & verified here)

- **Layer merge is 8.0+**: a `layers[].sources` list with multiple caches
  silently kills service registration in 7.0.0 — merge at the **cache**
  level instead (`caches.x.sources: [a, b]`, left = bottom)
- **`num_levels` on a based grid hangs startup** — don't override it
- **mbtiles caches failed to initialize** in the official images — default
  file cache works fine
- The `-nginx` image serves on container port **80** with path prefix
  `/mapproxy/`; the `-dev` image is only for poking around
- Bind-mounted `cache_data/` must be writable by uid 1000 (the container's
  `mapproxy` user) — if Docker created it as root:
  `docker run --rm -v "$PWD/cache_data:/d" alpine chown -R 1000:1000 /d`

## Licenses

Only sources whose terms permit caching are used: swisstopo OGD (free,
commercial use allowed, attribution `© swisstopo`), OpenTopoMap
(CC-BY-SA + OSM attribution, self-hosting encouraged at scale).
Do NOT put MapTiler behind this proxy — their terms prohibit it.
