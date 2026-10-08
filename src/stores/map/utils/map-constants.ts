/**
 * Shared map policy constants.
 */

/**
 * Zoom floor for overlay layers (huts, transport, …). Below this zoom the
 * map shows the world / globe with the plain basemap only: overlay data is
 * regional and would clutter the planet-scale view. Implemented as a
 * layer-level `minzoom` (see `withOverlayMinZoom`) so it composes with the
 * per-overlay visibility toggles — layers reappear automatically when the
 * camera zooms back in. Equals the app's previous minimum zoom, i.e. the
 * farthest zoom-out at which overlays were ever visible.
 */
export const OVERLAY_MIN_ZOOM = 7;

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
