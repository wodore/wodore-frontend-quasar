/**
 * Interactive map layers — the single source of truth for which style
 * layers consume taps/clicks.
 *
 * WdMapView registers hover-cursor + click handlers for every layer
 * listed here, and the mobile focus-mode tap guard predicts MapLibre's
 * layer-scoped click dispatch with the SAME registry: a tap that hits no
 * interactive layer toggles focus mode. Adding an interactive layer
 * later is one entry here (+ a click handler in WdMapView) — the guard
 * and the cursor affordance stay in sync automatically. The per-layer
 * zoom gate also prevents the dead-tap bug class: a tap is never
 * suppressed "for the detail" when that detail cannot open at the
 * current zoom.
 */
import type { StyleLayer } from 'maplibre-gl';
import { MIN_HUT_CLICK_ZOOM } from './map-constants';

export interface InteractiveLayer {
  /** MapLibre style layer id */
  id: string;
  /**
   * Strict lower zoom bound for handled interactions (`zoom > minZoom`,
   * mirroring the gate in the layer's click handler). Below it, taps on
   * the layer fall through to focus mode instead of being swallowed.
   * Omit = interactive at all zooms.
   */
  minZoom?: number;
}

/**
 * Minimal structural view of a MapLibre map needed for tap hit-testing —
 * the real `maplibre-gl` Map satisfies it, and tests can stub it without
 * instantiating GL.
 */
export interface TapQueryMap {
  getZoom(): number;
  getLayer(id: string): StyleLayer | undefined;
  queryRenderedFeatures(point: [number, number], options: { layers: string[] }): unknown[];
}

export const INTERACTIVE_LAYERS: readonly InteractiveLayer[] = [
  // Hut symbols → hut detail (WdMapView onHutLayerClick). The gate
  // mirrors its `zoom > MIN_HUT_CLICK_ZOOM` check.
  { id: 'wd-huts', minZoom: MIN_HUT_CLICK_ZOOM },
];

/**
 * Whether any interactive layer claims the tap at this point: a layer
 * above its zoom gate that exists on the current map AND renders a
 * feature under the point. Mirrors MapLibre's layer-scoped click
 * dispatch, so the focus-mode guard cannot drift from the handlers.
 */
export function tapTargetsInteractiveLayer(map: TapQueryMap, x: number, y: number): boolean {
  const zoom = map.getZoom();
  const ids: string[] = [];
  for (const layer of INTERACTIVE_LAYERS) {
    if ((layer.minZoom === undefined || zoom > layer.minZoom) && map.getLayer(layer.id)) {
      ids.push(layer.id);
    }
  }
  if (ids.length === 0) return false;
  try {
    return map.queryRenderedFeatures([x, y], { layers: ids }).length > 0;
  } catch {
    // Style not loaded / mid-basemap-switch — treat as empty map
    return false;
  }
}
