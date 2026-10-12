# route-overlay-source Specification

## Purpose

Consume Wodore-generated route tilesets in the map overlays behind the existing user-facing contract (layer grammar, legend, z-order), with the external provider source as fallback.

## ADDED Requirements

### Requirement: Configurable route tile source

The hiking vector overlay (and future cycling overlay) SHALL resolve its vector source from the `WODORE_ROUTE_TILES_URL` environment setting (Wodore Martin tilejson) and SHALL fall back to the Maptoolkit source when the setting is absent or the source fails to load.

#### Scenario: Own tiles configured

- **WHEN** the deployment sets `WODORE_ROUTE_TILES_URL`
- **THEN** the hiking overlay renders from the Wodore route tileset with identical layer grammar

#### Scenario: Setting absent

- **WHEN** `WODORE_ROUTE_TILES_URL` is not set
- **THEN** the overlay uses the Maptoolkit source exactly as before (current behavior)

#### Scenario: Own tiles unreachable

- **WHEN** the configured Wodore tile source fails to load tiles
- **THEN** the overlay continues to render from the fallback source without user-facing errors beyond existing tile-error handling

### Requirement: Layer grammar unchanged by source

Overlay layer definitions (Swiss color tiers, dash/dot difficulty grammar, network zoom gating, names and route-number badges) SHALL be expressed against the shared schema attributes and SHALL NOT change behavior when the source switches between Wodore tiles and the provider fallback.

#### Scenario: Same rendering from either source

- **WHEN** the same viewport+zoom is rendered once from Wodore tiles and once from the provider source
- **THEN** the tier colors, dash patterns, badge and label rules apply identically, and only data coverage may differ

### Requirement: Cycling overlay on the shared schema

A cycling route overlay SHALL be addable using the same source contract (`network` values ncn/rcn/lcn) and the `routes` z-order anchor, without new source plumbing.

#### Scenario: Cycling overlay enabled

- **WHEN** a cycling overlay consuming `wd_cycling` is active
- **THEN** its route lines render on the `routes` anchor (below labels, below huts) using network-based zoom gating
