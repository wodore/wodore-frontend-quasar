/**
 * Spatial near lookups — the amenity-interaction fetches built on the
 * backend's `GET /v1/geoplaces/near` endpoint (two modes):
 *
 * 1. CLUSTER MEMBERS: server-side clusters carry only `count` + colors
 *    in the tiles; the endpoint snaps to the EXACT tile grid when given
 *    the cluster feature's lngLat + `z` (the served TILE zoom — integer,
 *    capped at the source's maxzoom like MapLibre's overzoom) +
 *    `category_tree` + `limit = count`, returning exactly the cluster's
 *    members.
 * 2. WHAT'S HERE: a tap that hits no interactive layer probes the
 *    immediate surroundings (`radius` 25–50 m, no z, no category) —
 *    results open through the place framework, an empty answer falls
 *    through to focus mode.
 *
 * Response envelope: `{ data: [...], count }` where `count` is the
 * total BEFORE `limit` (consistency check against the feature's count —
 * on mismatch, trust the endpoint).
 *
 * The endpoint is not yet in the generated API client; the URL/param
 * construction and the row mapping live HERE so the swap to the typed
 * client is local once the backend PR lands. Endpoint contract + the
 * count-sync invariant are owned by the backend's openspec change
 * (cross-referenced from openspec/changes/amenity-interactions).
 */
import { publicApiBase } from '@services/apiBase';
import { currentLocale } from '@services/locale';
import { categoryTreeOfSubtree, type ForwardableClusterParam } from '@selection/cluster-behavior';

/** Field projection both popup modes render (one constant — the popup
 *  contract with the endpoint). */
const NEAR_FIELDS = 'slug,name,importance,category_identifier,color,parent_color,elevation';

/** One near-result place row as used by popups (member lists, what's
 *  here). */
export interface NearPlace {
  slug: string;
  name: string;
  importance?: number;
  /** Kind identifier (`restaurant.pizza`). */
  identifier?: string;
  color?: string;
  parentColor?: string;
  elevation?: number | null;
}

export interface NearResult {
  places: NearPlace[];
  /** Total before `limit` (the endpoint's count; absent → places.length). */
  count: number;
}

/** Parse one wire row into a NearPlace (null when unusable). */
function placeFromRow(row: unknown): NearPlace | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const slug = typeof r.slug === 'string' ? r.slug : '';
  const name = typeof r.name === 'string' ? r.name : '';
  if (!slug || !name) return null;
  const identifier =
    typeof r.category_identifier === 'string' && r.category_identifier
      ? r.category_identifier
      : undefined;
  const place: NearPlace = { slug, name };
  const importance = Number(r.importance);
  if (Number.isFinite(importance)) place.importance = importance;
  if (identifier) place.identifier = identifier;
  if (typeof r.color === 'string' && r.color) place.color = r.color;
  if (typeof r.parent_color === 'string' && r.parent_color) place.parentColor = r.parent_color;
  const elevationRaw = r.elevation;
  place.elevation =
    typeof elevationRaw === 'number' && Number.isFinite(elevationRaw) ? elevationRaw : null;
  return place;
}

/** Shared GET + parse for both modes (envelope-defensive). */
async function fetchNear(params: URLSearchParams, signal?: AbortSignal): Promise<NearResult> {
  const base = publicApiBase();
  if (!base) throw new Error('Near places request failed (no API base)');
  params.set('fields', NEAR_FIELDS);
  params.set('lang', currentLocale());
  const url = new URL('/v1/geoplaces/near', base);
  url.search = params.toString();
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Near places request failed (${res.status})`);
  }
  const body: unknown = await res.json();
  const rows: unknown = Array.isArray(body)
    ? body
    : ((body as { data?: unknown })?.data ?? (body as { items?: unknown })?.items ?? []);
  if (!Array.isArray(rows)) return { places: [], count: 0 };
  const places = rows.map(placeFromRow).filter((p): p is NearPlace => p !== null);
  const rawCount = Number((body as { count?: unknown } | null)?.count);
  return { places, count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : places.length };
}

export interface ClusterMembersQuery {
  /** Overlay subtree (`restaurant`, `accommodations`, …). */
  subtree: string;
  /** Cluster anchor (the click feature's geometry). */
  lat: number;
  lon: number;
  /** Served TILE zoom (integer, source-maxzoom-capped — NOT the
   *  fractional map zoom: overzoomed sources still serve z-maxzoom
   *  tiles; the grid snap needs the zoom the tile was built for). */
  tileZoom: number;
  /** Cluster count — the member `limit`. */
  count: number;
  /** The clicked feature's own `category_identifier` (e.g.
   *  'restaurant.pizza'). Clusters group by (category, grid cell) —
   *  one cell can hold several category clusters; without the pin the
   *  member list merges them (backend #483: unpinned cell count 1134
   *  vs pinned 789, verified live). */
  categoryIdentifier?: string;
  /** Cluster-shaping params forwarded from the overlay's tile URL
   *  (importance_threshold, cluster_max_zoom, cluster_radius_m,
   *  cluster_ref_zoom) so the grid snap sees the SAME cluster
   *  configuration the tiles were built with. Default order is
   *  importance-desc (the backend default) — matches the popup. */
  nearParams?: Partial<Record<ForwardableClusterParam, string>>;
  signal?: AbortSignal;
}

/**
 * Fetch a small cluster's members — the exact-tile-grid snap around the
 * cluster anchor. STRICT members only (no proximity supplement: the
 * graduated high-importance POIs are their own directly-clickable
 * markers next to the bubble — owner decision 2026-11). No app-level
 * caching: popups are ephemeral, the HTTP cache carries the rest.
 */
export async function fetchClusterMembers(query: ClusterMembersQuery): Promise<NearResult> {
  const params = new URLSearchParams();
  params.set('lat', String(query.lat));
  params.set('lon', String(query.lon));
  params.set('z', String(Math.max(0, Math.floor(query.tileZoom))));
  params.set('category_tree', categoryTreeOfSubtree(query.subtree));
  params.set('limit', String(Math.max(1, query.count)));
  if (query.categoryIdentifier) {
    params.set('category_identifier', query.categoryIdentifier);
  }
  for (const [key, value] of Object.entries(query.nearParams ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return fetchNear(params, query.signal);
}

/** What's-here probe radius: taps are imprecise (finger ≈ 30 px); 50 m
 *  covers the immediate tap neighborhood without listing the block. */
export const WHATS_HERE_RADIUS_M = 50;

/** What's-here result cap — a shortlist, not a directory. */
export const WHATS_HERE_LIMIT = 5;

export interface WhatsHereQuery {
  lat: number;
  lon: number;
  signal?: AbortSignal;
}

/**
 * What's-here probe: the places under an otherwise-unhandled tap. No
 * zoom, no category — pure proximity, distance-ordered (the backend's
 * default in this mode — nearest place first).
 */
export async function fetchWhatsHere(query: WhatsHereQuery): Promise<NearResult> {
  const params = new URLSearchParams();
  params.set('lat', String(query.lat));
  params.set('lon', String(query.lon));
  params.set('radius', String(WHATS_HERE_RADIUS_M));
  params.set('limit', String(WHATS_HERE_LIMIT));
  params.set('order', 'distance');
  return fetchNear(params, query.signal);
}
