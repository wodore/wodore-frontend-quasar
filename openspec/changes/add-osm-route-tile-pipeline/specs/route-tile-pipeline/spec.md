# route-tile-pipeline Specification

## Purpose

Generate, rebuild, and serve Wodore-owned OSM route vector tiles (hiking, cycling) as an alternative to external provider tiles — controlling schema, zoom policy, and licensing (ODbL).

## ADDED Requirements

### Requirement: Shared per-activity tile schema

The pipeline SHALL emit one MBTiles archive per activity (`wd_hiking`, `wd_cycling`) containing a single source-layer of way features with the shared attribute set: `network` (stamped from OSM route relations), difficulty (`sac_scale`, `via_ferrata_scale` for hiking), `name`, `ref`, and `type` (highway classification).

#### Scenario: Way on multiple routes

- **WHEN** a way is member of route relations of different networks
- **THEN** the emitted feature carries the most important network (iwn > nwn > rwn > lwn) and the highest-seen difficulty

#### Scenario: Way without route membership

- **WHEN** a way carries no route-relation membership and no difficulty tags
- **THEN** the way is not emitted

### Requirement: Self-controlled zoom policy

The generator SHALL control feature generalization by network importance, planet-wide: international/national networks from z5–z6, regional from z7, local from z9, with tiles available through z14 and overzoom beyond.

#### Scenario: Remote-region national route

- **WHEN** the viewport shows a national route in a region where provider tiles carry no networks before z9+
- **THEN** the route renders at its schema zoom (z6) from the Wodore tileset

### Requirement: Nightly regional rebuild

The pipeline SHALL rebuild each configured region nightly from the current Geofabrik extract and swap the resulting archive atomically (temp file + rename) so Martin serves without downtime.

#### Scenario: Rebuild while serving

- **WHEN** a nightly rebuild replaces `wd_hiking.mbtiles` for a region
- **THEN** tile requests continue to be served throughout and resolve to the new archive after the swap

### Requirement: Small-host build recipe

The pipeline's build tooling SHALL document and use the measured small-box recipe: Java 21, `-Xmx1100m`, `--threads=1 --process-threads=1 --write-threads=1`, `--nodemap-type=sortedtable` for CH-sized extracts on 2 CPU / 2 GB (+ swap) hosts; larger regions SHALL run on a host with ≥4 GB RAM and ≥100 GB free disk for planet-scale input.

#### Scenario: Switzerland on a 2 GB host

- **WHEN** the hiking tileset for switzerland is built with the documented recipe
- **THEN** the build completes without OOM with peak RSS ≤ 2 GB

### Requirement: ODbL attribution

Generated tiles SHALL carry the attribution "© OpenStreetMap contributors" at the source level (tilejson) and the Martin source configuration.

#### Scenario: Tilejson request

- **WHEN** a client fetches the tilejson for a Wodore route source
- **THEN** the response includes the OpenStreetMap attribution
