/**
 * Occupation status palette and marker zoom ramps for the fallback map.
 *
 * ⚠️ FOLLOW-UP: STATUS_COLORS is a hardcoded copy of the MapLibre
 * `wd-huts-occupation` paint palette. The code flags this as a drift
 * risk — derive from the served style's circle-color match expression
 * when the catalog-driven basemap work lands.
 */

/** Day-0 occupation status → ring/disc color. Same palette the MapLibre
 * `wd-huts-occupation` layer paints (live catalog style). */
export const STATUS_COLORS: Record<string, string> = {
  empty: '#25BF5E',
  low: '#F6AD4B',
  medium: '#EA9A37',
  free_unknown: '#7FAB88',
  high: '#C3731F',
  full: '#961A17',
};

/** Brand fallback when no type color is known for a hut. */
export const DEFAULT_DOT_COLOR = '#346751'; // $primary

/** Selection color: glacier-blue from the design system (DESIGN.md
 * "selected states" token). */
export const SELECTION_COLOR = '#2673bf';

/** Label color: glacier-blue (lighter than turquoise-deep). */
export const LABEL_COLOR = '#2673bf';

/** Label font (Barlow Semi Condensed, the design-system instrument font). */
export const OCC_LABEL_FONT = '600 11px "Barlow Semi Condensed", "Barlow", sans-serif';

// ── Zoom ramps ───────────────────────────────────────────────────────────

/** Marker floor — below this zoom, no markers render. */
export const HUT_MIN_ZOOM = 7;
/** Occupation status word appears from here. */
export const OCC_LABEL_MIN_ZOOM = 12;

/** Marker transparency ramp (owner spec): 50% opaque at z7, solid by z9.
 *  High zoom: fade markers so basemap detail dominates. */
export function markerOpacityFor(zoom: number): number {
  if (zoom >= 19) return 0.3; // z19: 70% transparent
  if (zoom >= 18) return 0.5; // z18: 50% transparent
  if (zoom >= 17) return 0.7; // z17: 30% transparent
  return Math.min(0.5 + ((zoom - HUT_MIN_ZOOM) / 2) * 0.5, 1);
}

/** Shield size ramp: 13px at z7-10, 19px at z11-13 (owner-tuned:
 *  icons must be larger once clusters disappear), grows to 28px at z17. */
export function shieldPxFor(zoom: number): number {
  if (zoom <= 10) return 13;
  if (zoom <= 13) return 19;
  return Math.min(17 + (zoom - 14) * 2.75, 28);
}

/** Darken a hex color by the given fraction (0=unchanged, 1=black). */
export function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = 1 - amount;
  return (
    '#' +
    [r, g, b]
      .map(c =>
        Math.round(c * d)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
