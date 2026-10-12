## 1. Generator (backend)

- [ ] 1.1 Create the Planetiler Java profile (`wodore-backend/tile_server/route-tiles/`): collect `type=route` relations (hiking: foot/walking/hiking; cycling: bicycle), stamp highest network + difficulty onto member ways, emit `wd_hiking` / `wd_cycling` source-layers with the shared schema (network, sac_scale, via_ferrata_scale, name, ref, type) at the zoom policy z5–z14 (reference: planetiler `example-bikeroutes`)
- [ ] 1.2 Add planetiler schema test fixtures (`verify schema.yml` example cases: way on multiple relations, untagged way, via ferrata) and run them in backend CI
- [ ] 1.3 Add the build script wrapping the measured recipe: Java 21, `-Xmx1100m --threads=1 --process-threads=1 --write-threads=1 --nodemap-type=sortedtable`, `--area=<region>` (Geofabrik auto-download), temp-file + atomic rename output
- [ ] 1.4 Build switzerland + alps extracts, verify parity against the mtk source at Zermatt/Dolomites (coverage, tier colors via tile decoding) and record sizes (CH upper-bound reference: 122 MB z6–14)

## 2. Serving (backend)

- [ ] 2.1 Register the archives as Martin `mbtiles:` sources in `martin.yaml` (mount path, ODbL attribution at tilejson level) and document the sync step in `tile_server/README.md`
- [ ] 2.2 Add the nightly rebuild schedule (per configured region) with failure alerting; document the ≥4 GB runner requirement for Europe/planet-scale regions
- [ ] 2.3 Define the region growth plan (priority regions first; `osmium merge` of disjoint extracts or `tile-join` of per-region archives into one planet-wide source)

## 3. Frontend (this repo)

- [ ] 3.1 Make the hiking overlay source env-driven: `WODORE_ROUTE_TILES_URL` (own Martin) with automatic fallback to the Maptoolkit source (absent setting, failed load) — `overlay-hiking.ts` + env typing
- [ ] 3.2 Add a cycling route overlay (`wd_cycling`: ncn/rcn/lcn zoom gating, own colors) on the existing `routes` anchor and shared source contract, in All layers (mirroring the hiking arrangement)
- [ ] 3.3 Unit tests: source selection/fallback logic, schema-attribute layer filters against the shared contract, cycling overlay anchor
- [ ] 3.4 Verify in PR preview (PREVIEW:web): hiking grammar identical from own tiles vs provider; cycling renders at the `routes` z-order; NZ remote-region early visibility from own tiles

## 4. Rollout

- [ ] 4.1 Deploy own tiles to staging (`WODORE_ROUTE_TILES_URL` set), compare rendering against production provider source, gather feedback
- [ ] 4.2 Flip production default to own tiles (provider source stays as fallback), update legend attribution wording if needed (© OpenStreetMap contributors)
- [ ] 4.3 Archive this openspec change after verification
