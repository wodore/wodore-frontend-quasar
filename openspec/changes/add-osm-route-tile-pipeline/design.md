## Context

Map overlays for signed routes currently depend on external providers: the hiking **vector** layer reads the Maptoolkit (mtk) basemap source (walking networks no earlier than z7; z9–11 in remote regions such as NZ — measured on live tiles), the **Hiking** raster layer renders fixed Waymarked Trails tiles, and both carry per-provider license terms (Maptoolkit Community License: attribution + logo, no proxying/pre-fetching). The `routes` z-order anchor, dash/dot difficulty grammar, and Swiss color code shipped with PR #268; only the data source is provider-bound.

A self-generated route tileset removes those limits. Feasibility was measured live on a developer machine (20 cores / Java 21): Planetiler with a custom schema built **Switzerland z6–14 in 1m48s / 122 MB** (all hiking-relevant ways — an upper bound for a routes-only schema). On a simulated 2 CPU / 2 GB box the same build passes in 3m34s at 1.96 GB peak RSS with `-Xmx1100m --threads=1 --nodemap-type=sortedtable` (900 MB heap OOMs; 1450 MB peaks at 2.3 GB). Martin — already deployed in `wodore-backend` — serves MBTiles files directly.

## Goals / Non-Goals

**Goals:**

- Own route vector tiles for **hiking and cycling** (one activity-agnostic schema, per-activity layers) generated from OSM
- Control zoom policy (network importance vs. zoom) planet-wide — fix remote-region late visibility at the root
- Serve via the existing Martin; nightly per-region rebuilds; pure ODbL terms
- Keep the frontend contract identical (same layer grammar, `routes` anchor, labels/shields)

**Non-Goals:**

- Replacing the basemap, terrain, or contours
- Minute-level freshness (PostGIS/osm2pgsql-replication documented as a future path, not built)
- Removing the Waymarked Trails raster overlay or the swisstopo CH layer (they remain selectable sources)
- Mobile/offline packaging of route tiles

## Decisions

### D1: Generator — Planetiler (Java profile), not tilemaker or osm2pgsql

Planetiler is single-pass PBF→MBTiles with no database; measured on our schema (see Context). Tilemaker (Lua) handles relations but has a smaller ecosystem for relation→way tagging; the osm2pgsql→PostGIS route trades a nightly batch file for a permanently-operated database — that is the diff-update path (D5), not the baseline. The YAML "configurable schema" cannot merge route relations onto ways ("only a subset of the Java API is exposed"), so the generator is a small **Java profile** in `planetiler-examples` style using `relationInfos` (planetiler ships `example-bikeroutes` as a working reference for exactly this pattern).

*Alternative rejected:* OpenMapTiles/PR #1169 (hiking networks in the standard schema) — unmerged since 2021.

### D2: Schema — way-based, one shared layer shape per activity

Each activity emits one MBTiles with a single source-layer (e.g. `wd_hiking`, `wd_cycling`) of **way features** carrying: `network` (iwn/nwn/rwn/lwn — stamped from route relations; ncn/rcn/lcn for cycling), `sac_scale` (+ `via_ferrata_scale`), `name`, `ref`, `type` (highway). Way-based matches the current mtk-fed styling contract 1:1 (filters reference way attributes), so the shipped layer grammar keeps working. Route-based (one feature per relation) was considered — cleaner labels — but changes every filter and loses per-way sac grading.

Zooms z5–z14 (overzoom beyond, like mtk); **our own generalization**: international/national from z5–6, regional z7, local z9, planet-wide — mtk's data floor was z7 (Alps) to z11+ (remote).

### D3: Serving — Martin file source with atomic swap

Drop `wd_<activity>.mbtiles` into the Martin mount, register as an `mbtiles:` source in `martin.yaml`. Rebuilds write a temp file and `rename()` over the live one — Martin reloads without downtime. No Postgres involvement at serve time (contrast: huts, which Martin tiles from Postgres on request).

### D4: Coverage & size strategy — per-region Geofabrik extracts, merged or joined

Start with priority regions (alps, ch, at, it, fr, si …), grow to planet. Merging: `osmium merge` **disjoint** extracts before one generator run (parent+child extracts duplicate data), or per-region runs + `tile-join` (tippecanoe) into one archive. Measured CH upper bound: 122 MB z6–14 / ~42 MB z6–12; estimates: Europe 1.5–4 GB, planet 4–8 GB z6–14. Small-box recipe (2 CPU/2 GB + swap) documented in tasks for CH-sized regions; Europe/planet rebuilds belong on a ≥4 GB CI runner.

### D5: Updates — nightly full rebuild (no differential)

Planetiler is stateless by design; a nightly rebuild *is* the update (CH ≈ 2–3 min; planet basemap benchmark: 3h35m on 8 CPU/16 GB). Geofabrik extracts refresh daily. If near-real-time is ever needed: `osmium apply-changes` on the extract (cheap freshness, full re-tile) or osm2pgsql-replication → PostGIS → Martin-on-request (the backend's existing huts stack) — documented, deliberately not built.

### D6: Frontend — source URL becomes env-driven with provider fallback

`overlay-hiking.ts` (and a future cycling overlay) read `WODORE_ROUTE_TILES_URL` (our Martin) and fall back to the mtk source when unset/unreachable. Layer grammar, legend, and `routes` anchor unchanged — PR #268's UX is the contract.

## Risks / Trade-offs

- **Generator ownership**: a ~150-line Java profile becomes build infra to maintain (schema bugs = wrong tiles). Mitigated by `verify schema.yml`-style example fixtures in CI (planetiler supports schema test cases).
- **2 GB boxes are borderline** (measured 1.96 GB peak, zero headroom; 900 MB heap OOMs). Recipe pins exact flags; CI runner recommended for ≥Europe.
- **Planet build needs ~100+ GB disk** for the 80 GB PBF + workspace — developer machines with <50 GB free cannot; regional-first strategy sidesteps this.
- **Duplicate-ish overlays during transition**: mtk vector + own tiles render the same routes if both enabled. The env flag makes own-tiles opt-in per deployment until parity is verified.
- **OSm data quality**: untagged sac_scale renders easy/yellow (existing behavior); via ferrata outside route relations appears only if way-tagged.
- **License**: generated tiles are ODbL share-alike; attribution "© OpenStreetMap contributors". Serving is unproblematic; any future offline/redistribution must respect share-alike.
