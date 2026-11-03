/**
 * Server-side cluster click behavior (amenity overlays, 2026-11).
 *
 * The geoplaces tile function aggregates features into server-side
 * clusters below `cluster_max_zoom` (+ transition): cluster features
 * carry `count > 1` and NO slug/name. Clicks on them are intercepted by
 * the map adapter BEFORE the target pipeline (cluster features cannot
 * produce individual targets) and resolved here:
 *
 * - `count >= 6`: zoom in (`easeTo`, +1.5 z) to break the cluster apart.
 * - `count < 6`: open a member-list popup. Members are NOT in the tiles
 *   (the members-in-properties contract was abandoned — it inflated tile
 *   sizes +100–370%); the popup fetches them from the spatial near
 *   endpoint (services/cluster-members.ts), ordered by importance /
 *   distance around the cluster anchor (the server anchors clusters at
 *   their highest-importance member, so nearest-first ≈ the members).
 *
 * Pure functions only — unit-testable without a map.
 */
import { CLUSTER_LAYER_SUFFIX } from './map-layer-ids';
import type { MapTarget, PropsBag } from './types';
import { targetKey } from './types';

/** Member threshold above which a cluster zooms instead of listing (the
 *  fixed backend convention; long lists are useless in a 232px popup). */
export const CLUSTER_LIST_MAX = 6;

/** How far a cluster click zooms in (one notch breaks most clusters). */
export const CLUSTER_ZOOM_STEP = 1.5;

/**
 * Served TILE zoom for a map zoom: integer floor, capped at the
 * source's declared maxzoom (MapLibre's overzoom rule — a z9-max source
 * still serves z9 tiles at map z12). The near endpoint's grid snap
 * needs the zoom the clicked tile was BUILT for, not the fractional
 * camera zoom.
 */
export function servedTileZoom(zoom: number, sourceMaxZoom?: number): number {
  const z = Math.max(0, Math.floor(zoom));
  if (sourceMaxZoom === undefined || !Number.isFinite(sourceMaxZoom)) return z;
  return Math.min(z, Math.max(0, Math.floor(sourceMaxZoom)));
}

/** Cluster-shaping tile-URL params the near endpoint accepts in cluster
 *  mode (forwarded verbatim so the grid snap sees the SAME cluster
 *  configuration the tiles were built with). */
export const FORWARDABLE_CLUSTER_PARAMS = [
  'importance_threshold',
  'cluster_max_zoom',
  'cluster_radius_m',
  'cluster_ref_zoom',
] as const;

export type ForwardableClusterParam = (typeof FORWARDABLE_CLUSTER_PARAMS)[number];

/**
 * Parse the forwardable cluster params off an overlay's tile URL (the
 * style source `tiles` entry): `?…&cluster_max_zoom=7&…`. Returns the
 * subset present; absent params stay absent (the backend applies its
 * own defaults). Defensive — a missing/garbage URL yields `{}`.
 */
export function clusterParamsFromTilesUrl(
  tilesUrl: string | null | undefined
): Partial<Record<ForwardableClusterParam, string>> {
  if (!tilesUrl) return {};
  let params: URLSearchParams;
  try {
    params = new URL(tilesUrl).searchParams;
  } catch {
    return {};
  }
  const out: Partial<Record<ForwardableClusterParam, string>> = {};
  for (const key of FORWARDABLE_CLUSTER_PARAMS) {
    const value = params.get(key);
    if (value !== null && value !== '') out[key] = value;
  }
  return out;
}

/** Cluster count off a feature's property bag (0 when absent/garbage). */
export function clusterCountOf(
  props: PropsBag | Record<string, unknown> | null | undefined
): number {
  const raw = props?.count;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** A server-side cluster feature? (`count > 1` — count==1 features are
 *  individuals, possibly without identity at clustered zooms.) */
export function isClusterProps(
  props: PropsBag | Record<string, unknown> | null | undefined
): boolean {
  return clusterCountOf(props) > 1;
}

/** What a click on a cluster feature does. */
export type ClusterClickAction = 'members' | 'zoom';

/** Small clusters list their members; big ones zoom in to break apart. */
export function clusterClickAction(count: number): ClusterClickAction {
  return count > 0 && count < CLUSTER_LIST_MAX ? 'members' : 'zoom';
}

/**
 * Subtree slug of a cluster/symbol layer id (`wd-restaurant-clusters` →
 * `restaurant`, `wd-accommodations` → `accommodations`), null for other
 * layer ids.
 */
export function subtreeOfLayerId(layerId: string | null | undefined): string | null {
  if (!layerId || !layerId.startsWith('wd-')) return null;
  return layerId.slice('wd-'.length).replace(/-clusters$/, '') || null;
}

/**
 * Category-tree query value for the near endpoint: the overlay subtrees
 * ARE category trees (`category_tree=restaurant`), except the
 * accommodations overlay which serves the `accommodation` tree.
 */
export function categoryTreeOfSubtree(subtree: string): string {
  return subtree === 'accommodations' ? 'accommodation' : subtree;
}

/** Minimal rendered-feature shape the adapter intercepts (structural —
 *  satisfies MapLibre's MapGeoJSONFeature without importing GL here). */
export interface ClusterFeatureLike {
  layer?: { id: string } | null;
  source?: string | null;
  sourceLayer?: string | null;
  id?: number | string | null;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Adapter-resolved context for a cluster click: the served tile zoom
 *  and the overlay's forwardable cluster params (both read from the
 *  style source — see WdMapView). */
export interface ClusterClickContext {
  tileZoom: number;
  nearParams: Partial<Record<ForwardableClusterParam, string>>;
}

/**
 * Build the synthetic popup target for a small cluster: source
 * `cluster`, geometry-anchored, carrying the count/subtree/colors plus
 * the near-query context (served TILE zoom + forwarded cluster params —
 * members come from the endpoint, not the tiles). The id is
 * layer@lng,lat — stable per cluster feature within a tile set, so
 * re-clicking the same cluster toggles the popup closed.
 */
export function clusterTargetFromFeature(
  feature: ClusterFeatureLike,
  ctx: ClusterClickContext
): MapTarget | null {
  const layerId = feature.layer?.id;
  const subtree = subtreeOfLayerId(layerId);
  const count = clusterCountOf(feature.properties);
  if (!layerId || !subtree || !isClusterLayerId(layerId) || !isClusterProps(feature.properties))
    return null;
  let location: MapTarget['location'];
  if (feature.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
    const [lon, lat] = feature.geometry.coordinates as number[];
    if (Number.isFinite(lon) && Number.isFinite(lat)) location = { lat, lon };
  }
  if (!location) return null;
  const id = `${layerId}@${location.lon.toFixed(5)},${location.lat.toFixed(5)}`;
  const props = feature.properties ?? {};
  return {
    key: targetKey({ source: 'cluster', id }),
    source: 'cluster',
    id,
    location,
    props: {
      count,
      subtree,
      tileZoom: ctx.tileZoom,
      nearParams: ctx.nearParams,
      color: props.color,
      parent_color: props.parent_color,
      parent_slug: props.parent_slug,
    },
    featureRef: {
      engine: 'maplibre',
      handle: {
        source: feature.source ?? undefined,
        sourceLayer: feature.sourceLayer ?? undefined,
        id: feature.id ?? undefined,
      },
    },
  };
}

/** Whether a layer id is an amenity-family cluster layer (suffix check —
 *  the `-cluster-count` badge layers do NOT match: text sits inside the
 *  circle, the circle's claim covers them). */
export function isClusterLayerId(layerId: string | null | undefined): boolean {
  return (
    typeof layerId === 'string' &&
    layerId.startsWith('wd-') &&
    layerId.endsWith(CLUSTER_LAYER_SUFFIX)
  );
}
