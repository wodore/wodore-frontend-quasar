/**
 * Style-layer id constants — the single home of the map-catalog naming
 * contract the selection framework depends on (work doc §2.6, D5).
 *
 * The catalog is backend-driven, so a backend rename cannot be caught at
 * compile time — the dev-only drift guard in the click pipeline warns
 * when a claimed id matches no layer of the applied style. If that
 * warning fires: the backend renamed a layer, update it HERE (one place).
 */

/** Hut symbol layer (MVT source `wd-huts`). */
export const WD_HUTS_LAYER = 'wd-huts';
/** Hut vector-tile source id. */
export const WD_HUTS_SOURCE = 'wd-huts';

/** Date-gated hut occupation/availability circle layers (composed into
 *  the huts overlay, visibility owned by the picked date — see
 *  `overlay-huts.ts` OCCUPATION_LAYER_IDS; clicking one IS clicking the
 *  hut, so they carry the same claim as the symbol layer). */
export const WD_HUTS_OCCUPATION_LAYERS = [
  'wd-huts-occupation',
  'wd-huts-occupation-day0',
  'wd-huts-occupation-day1',
  'wd-huts-occupation-day2',
  'wd-huts-occupation-day3',
] as const;

/** All wd-huts-family layer ids that produce accommodation targets. */
export const WD_HUTS_CLICK_LAYERS: readonly string[] = [
  WD_HUTS_LAYER,
  ...WD_HUTS_OCCUPATION_LAYERS,
];

/** Transport stop layers (probed from the staging catalog style: circle
 *  + two symbol layers, source `transitland_stops`). */
export const TRANSPORT_STOP_LAYERS = [
  'transport-stops',
  'transport-stops-icons',
  'transport-stops-icons-detail',
] as const;

// ── Amenity overlay family (backend amenity-overlays, 2026-11) ──────────
// Catalog-driven geoplace overlays: one subtree per overlay, each style
// ships four layers — `wd-<subtree>` symbols (count==1),
// `wd-<subtree>-clusters` circles (count>1), a `-cluster-count` badge
// and a feature-state `-selected` halo. The symbol layer's style
// `minzoom` is the subtree's importance tier floor; claims mirror it so
// the zoom gate never hides a rendered symbol (dead-tap guard).

/** Accommodation geoplaces overlay (hotels, bhotel, bivouac amenities —
 *  NOT huts; their slugs resolve via /v1/geo/places, not /v1/huts). */
export const WD_ACCOMMODATIONS_LAYER = 'wd-accommodations';
export const WD_ACCOMMODATIONS_CLUSTER_LAYER = 'wd-accommodations-clusters';

/** Cluster render-layer id suffix (backend naming convention — the
 *  cluster COUNT badge uses `-cluster-count`, see overlay-clusters.ts). */
export const CLUSTER_LAYER_SUFFIX = '-clusters';

/** The ten amenity subtrees with their interaction zoom floors (= the
 *  style symbol-layer minzooms, importance-tiered by the backend):
 *  high-importance subtrees from z5, mid from z9, low from z13. */
export const AMENITY_SUBTREES: ReadonlyArray<{ subtree: string; minZoom: number }> = [
  { subtree: 'restaurant', minZoom: 5 },
  { subtree: 'health_and_emergency', minZoom: 5 },
  { subtree: 'outdoor_services', minZoom: 5 },
  { subtree: 'groceries', minZoom: 9 },
  { subtree: 'shopping', minZoom: 9 },
  { subtree: 'tourism', minZoom: 9 },
  { subtree: 'services', minZoom: 9 },
  { subtree: 'finance', minZoom: 9 },
  { subtree: 'utilities', minZoom: 13 },
  { subtree: 'automotive', minZoom: 13 },
];

/** Amenity symbol layer claims (`wd-<subtree>`, count==1 features). */
export const AMENITY_LAYERS: ReadonlyArray<{ layer: string; minZoom: number }> =
  AMENITY_SUBTREES.map(({ subtree, minZoom }) => ({
    layer: `wd-${subtree}`,
    minZoom,
  }));

/** Amenity cluster layer claims (`wd-<subtree>-clusters`, count>1
 *  features — cluster clicks, not individual targets). */
export const AMENITY_CLUSTER_LAYERS: ReadonlyArray<{ layer: string; minZoom: number }> =
  AMENITY_SUBTREES.map(({ subtree, minZoom }) => ({
    layer: `wd-${subtree}${CLUSTER_LAYER_SUFFIX}`,
    minZoom,
  }));

// Re-exported for entry claims: entries are store-free (eslint boundary
// on **/stores/*), so the zoom gate travels through this module — the
// single definition lives in map-constants.ts.
export { MIN_HUT_CLICK_ZOOM } from '@stores/map/utils/map-constants';
