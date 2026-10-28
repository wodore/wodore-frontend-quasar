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
 *   `ui.overlayClusterCounts` toggles ONLY these layers — clusters
 *   themselves always render),
 * — renderers without supercluster (MapLibre Native compose, Leaflet
 *   fallback) strip the clustering bits and render raw points.
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

/** Geojson source keys that drive MapLibre's in-browser clustering. */
const CLUSTER_SOURCE_KEYS = new Set([
  'cluster',
  'clusterMaxZoom',
  'clusterMinPoints',
  'clusterRadius',
  'clusterProperties',
]);

/**
 * Copy of a source spec WITHOUT the clustering keys — for renderers
 * that must not cluster (MapLibre Native style compose).
 */
export function withoutClusterConfig<S extends object>(source: S): S {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !CLUSTER_SOURCE_KEYS.has(key))
  ) as S;
}
