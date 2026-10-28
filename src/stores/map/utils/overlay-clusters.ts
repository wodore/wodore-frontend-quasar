/**
 * Overlay cluster conventions (MapLibre geojson-source clustering).
 *
 * Backend styles may cluster a geojson overlay's coinciding points on
 * its first visible zoom levels (transport-stops today: z5–z6, backend
 * seed `TRANSPORT_STYLE`). These conventions let renderer-agnostic
 * frontend code participate without hard-coding one overlay:
 *
 * — cluster render layers are the style layers with a
 *   `['has', 'point_count']` filter (only supercluster features match),
 * — the count badge is the symbol layer whose id ends in
 *   `-cluster-count` (backend naming convention; the user setting
 *   `ui.overlayClusterCounts` toggles ONLY the badge text — cluster
 *   bubbles always render),
 * — clustering is a SUBSET-profile feature (backend decision 2026-10):
 *   the no-WebGL fallback (Leaflet) clusters client-side via
 *   supercluster over the served cluster config; the full
 *   (WebGL/MapLibre + MapLibre Native) profile serves clean,
 *   unclustered documents.
 */

import type { LayerSpecification } from 'maplibre-gl';

/** Layer-id suffix marking the cluster count badge symbol layer. */
export const CLUSTER_COUNT_LAYER_SUFFIX = '-cluster-count';

/** Cluster render layer? (`['has', 'point_count']` filter) */
export function isClusterLayer(layer: LayerSpecification | { filter?: unknown }): boolean {
  const filter = 'filter' in layer ? (layer as { filter?: unknown }).filter : undefined;
  return (
    Array.isArray(filter) &&
    filter.length === 2 &&
    filter[0] === 'has' &&
    filter[1] === 'point_count'
  );
}

/** Count-badge layer? (the user setting toggles ONLY these) */
export function isClusterCountLayer(layerId: string): boolean {
  return layerId.endsWith(CLUSTER_COUNT_LAYER_SUFFIX);
}

/**
 * Visibility for count-badge layers: they render only when BOTH the
 * overlay switch is on AND the user setting shows counts — clusters
 * themselves always render with the overlay.
 */
export function clusterCountVisibility(
  overlayActive: boolean | undefined,
  showCounts: boolean
): 'visible' | 'none' {
  return overlayActive && showCounts ? 'visible' : 'none';
}
