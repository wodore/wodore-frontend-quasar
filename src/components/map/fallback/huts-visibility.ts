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

/**
 * One-time deploy-window adoption (the rollout gap, Opus review):
 * fresh installs land huts active via the active-group default and
 * maplibre-history users have it in their persisted group view — but
 * existing PURE-fallback users who toggled overlays persisted a group
 * view from before a 'huts' row existed, so the catalog compiles it
 * INACTIVE while the fallback rendered their huts always-on until now.
 * Adopting the row ACTIVE once (a real store toggle) keeps menu
 * checkbox, rendering and persistence in agreement — the first user
 * toggle then writes persisted state and the flag takes over
 * permanently.
 *
 * Adopt only when: the row is present AND compiled inactive AND the
 * user has NO persisted 'huts' overlay state (never toggled it — the
 * overlay store's savedOverlayState, a pre-session snapshot).
 */
export function shouldAdoptHutsActive(
  row: { active?: boolean } | undefined | null,
  hasPersistedHutsState: boolean
): boolean {
  return row?.active === false && !hasPersistedHutsState;
}
