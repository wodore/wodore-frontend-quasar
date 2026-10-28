/**
 * FALLBACK CLUSTER GROUPS — bucket helpers for the config-driven
 * markercluster grouping (backend #440 config.clustering; consumer:
 * WdFallbackMapView).
 *
 * Extracted as a pure module so the grouping invariants are unit-
 * testable without a Leaflet map.
 */

/**
 * Legacy (config-less) buckets: huts WITHOUT availability (plain) vs
 * WITH availability (avail). Kept for pre-#440 backends and while the
 * huts style is still loading — today's behavior, verbatim.
 */
export const PLAIN_BUCKET = '__wd_plain';
export const AVAIL_BUCKET = '__wd_avail';

/**
 * Markercluster groups are created lazily per bucket and map-added in
 * creation order — Leaflet paints later-added layers (and their marker
 * icons) above earlier ones. In the LEGACY mode the plain bucket's
 * group must therefore be created BEFORE the avail group so huts with
 * availability never paint below plain ones (owner invariant). Config
 * mode keeps first-hut-seen order (per-type buckets).
 *
 * Returns a NEW array ordered so PLAIN precedes AVAIL; other buckets
 * (config-mode values, the null bucket) sort last, stable among
 * themselves.
 */
export function orderLegacyBucketsFirst<T>(
  buckets: Array<[string | null, T]>
): Array<[string | null, T]> {
  const order = (bucket: string | null): number =>
    bucket === PLAIN_BUCKET ? 0 : bucket === AVAIL_BUCKET ? 1 : 2;
  return buckets
    .map((entry, index) => ({ entry, index, rank: order(entry[0]) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(item => item.entry);
}
