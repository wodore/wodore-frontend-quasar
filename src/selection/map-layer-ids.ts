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
