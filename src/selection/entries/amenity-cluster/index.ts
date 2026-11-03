/**
 * Amenity-cluster entry — the `*-clusters` circle layers of the
 * amenity/accommodations overlays. Cluster features carry `count > 1`
 * and no slug: they never produce individual targets (the click
 * pipeline skips them — empty canonical id). The map adapter
 * intercepts cluster clicks BEFORE the pipeline (cluster-behavior.ts):
 * small clusters open this entry's member-list popup (members fetched
 * from the spatial near endpoint), big ones zoom in.
 *
 * The claims exist for the tap guard + hover cursor — the SAME tier
 * floors as the symbol layers (cluster circles share the style
 * minzoom). The synthetic `cluster`-source targets are built by the
 * adapter (clusterTargetFromFeature).
 */
import { definePresentation } from '@selection/types';
import { AMENITY_CLUSTER_LAYERS, WD_ACCOMMODATIONS_CLUSTER_LAYER } from '@selection/map-layer-ids';

export const amenityClusterEntry = definePresentation<Record<string, unknown>>({
  id: 'amenity-cluster',
  match: { source: 'cluster' },
  capabilities: ['popup'],
  surfaces: () => import('./surfaces'),
  mapLayers: [
    ...AMENITY_CLUSTER_LAYERS.map(({ layer, minZoom }) => ({ layer, minZoom })),
    { layer: WD_ACCOMMODATIONS_CLUSTER_LAYER, minZoom: 5 },
  ],
});
