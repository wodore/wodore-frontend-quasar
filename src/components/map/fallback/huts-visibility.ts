/**
 * Store-driven huts visibility for the Leaflet fallback (owner
 * decision, option B — the always-on special case is dropped).
 *
 * The fallback's built-in hut machinery (MLT tiles → canvas shields,
 * availability, clustering) stays in WdFallbackMapView; whether it
 * RENDERS is bound to the shared overlay store's `huts` row:
 *
 * * row PRESENT (the backend serves a huts subset variant to the
 *   fallback's profile=subset catalog) → follow its `active` flag:
 *   toggle on = the previous always-on behavior, toggle off = markers
 *   cleared + tile loading suspended (caches stay warm — re-enabling
 *   rebuilds without refetch). The menu row itself appears through the
 *   normal profile filtering; WdOverlayControl's toggle mutates the
 *   shared store — this binding renders the consequence.
 * * row ABSENT (backend variant undeployed, old catalogs) → default
 *   ACTIVE — exactly the pre-binding behavior, zero regression during
 *   the deploy window.
 */

/** The catalog overlay row that drives the fallback's huts (slug). */
export const HUTS_OVERLAY_NAME = 'huts';

/**
 * The visibility matrix: absent row → active (the deploy-window
 * default); present row → its active flag (an undefined flag on a
 * present row reads as off — catalog rows always carry a boolean).
 */
export function hutsRowVisible(row: { active?: boolean } | undefined | null): boolean {
  return row ? Boolean(row.active) : true;
}
