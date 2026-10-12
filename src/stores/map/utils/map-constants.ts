/**
 * Shared map policy constants.
 */

/**
 * Zoom floor for the map camera. World copies are disabled and the map
 * renders in plain mercator — at z3 the single world copy still fills
 * typical viewports; below that empty bands flank the map edges.
 */
export const MAP_MIN_ZOOM = 3;

/**
 * Zoom floor for overlay layers (huts, transport, …). Below this zoom the
 * map shows the plain basemap only: overlay data is regional and would
 * clutter the far zoomed-out view. Implemented as a layer-level
 * `minzoom` (see `withOverlayMinZoom`) so it composes with the
 * per-overlay visibility toggles — layers reappear automatically when the
 * camera zooms back in. Overlay paint ramps (opacity/size) are shifted to
 * match: overlays fade in from this zoom.
 */
export const OVERLAY_MIN_ZOOM = 5;

/**
 * Clamp a style layer's `minzoom` up to the overlay zoom floor. Layers
 * that already start at a higher zoom keep their own value.
 */
export function withOverlayMinZoom<L extends { minzoom?: number }>(layer: L): L {
  if ((layer.minzoom ?? 0) >= OVERLAY_MIN_ZOOM) {
    return layer;
  }
  return { ...layer, minzoom: OVERLAY_MIN_ZOOM };
}

/**
 * Strict lower zoom bound for opening a hut detail from the map
 * (`zoom > MIN_HUT_CLICK_ZOOM`, both map views). Below it, taps/clicks on
 * hut symbols fall through — e.g. to focus-mode toggling: the focus tap
 * guard consults the same gate via interactive-layers.ts, so a tap that
 * can never open a detail is never swallowed.
 */
export const MIN_HUT_CLICK_ZOOM = 8;
