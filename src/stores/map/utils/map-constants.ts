/**
 * Shared map policy constants.
 */

import type { SkySpecification } from 'maplibre-gl';

/**
 * Zoom floor for overlay layers (huts, transport, …). Below this zoom the
 * map shows the world / globe with the plain basemap only: overlay data is
 * regional and would clutter the planet-scale view. Implemented as a
 * layer-level `minzoom` (see `withOverlayMinZoom`) so it composes with the
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
 * Atmosphere rim around the globe: soft horizon glow that fades out over
 * z6–9 (at street zooms no sky is rendered at all, so tilted close-up
 * views keep a daylight horizon). The dark space BACKDROP itself is CSS
 * on `.maplibregl-canvas-container` (WdMapView) — `sky` alone only paints
 * the rim, not the backdrop. Applied on map load (WdMapView) and carried
 * across basemap switches (basemap-store transformStyle), same as the
 * globe projection.
 */
export const GLOBE_SKY: SkySpecification = {
  'sky-color': ['interpolate', ['linear'], ['zoom'], 5, '#02040a', 10, '#88c6fc'],
  'horizon-color': '#aac9f0',
  'sky-horizon-blend': 0.6,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 1, 9, 0],
};

/**
 * Strict lower zoom bound for opening a hut detail from the map
 * (`zoom > MIN_HUT_CLICK_ZOOM`, both map views). Below it, taps/clicks on
 * hut symbols fall through — e.g. to focus-mode toggling: the focus tap
 * guard consults the same gate via interactive-layers.ts, so a tap that
 * can never open a detail is never swallowed.
 */
export const MIN_HUT_CLICK_ZOOM = 8;

/**
 * Zoom floor for the map camera: the globe should stay comfortably in
 * view — below ~z2 the planet shrinks into a dot surrounded by empty
 * space. (MapLibre itself allows far lower zooms in v6.)
 */
export const MAP_MIN_ZOOM = 2;
