/**
 * Interactive map layers — the single source of truth for which style
 * layers consume taps/clicks.
 *
 * DERIVED from the presentation registry (OpenSpec
 * `add-place-interactions`, D5): each entry's `mapLayers` claims compile
 * into the interactive list. The mobile focus-mode tap guard predicts
 * MapLibre's layer-scoped click dispatch with the SAME registry — adding
 * an interactive layer is one claim on an entry; guard, cursor
 * affordance and the click handler follow automatically. The per-layer
 * zoom gate also prevents the dead-tap bug class: a tap is never
 * suppressed "for the detail" when that detail cannot open at the
 * current zoom.
 *
 * Entries install at module init (selection-store imports
 * '@selection/entries'); the derived list is stable per session. Style
 * layers come and go with catalog epoch bumps — the click handler
 * queries at click time and filters to layers that exist on the map, so
 * it never goes stale (per-layer bindings would).
 */
import type { StyleLayer } from 'maplibre-gl';
import { defaultRegistry } from '@selection/registry';
import type { Presentation } from '@selection/types';

export interface InteractiveLayer {
  /** MapLibre style layer id */
  id: string;
  /**
   * Strict lower zoom bound for handled interactions (`zoom > minZoom`,
   * mirrored by the click pipeline's per-claim gate). Omit = interactive
   * at all zooms.
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

/** A registry entry's compiled claim: gate + target-building data. */
export interface ClaimedLayer extends InteractiveLayer {
  /** Owning presentation (claim-based resolution: layer → entry). */
  entry: Presentation;
  /** Which tile property carries the canonical id (default 'slug'). */
  idProp?: string;
}

/** All claimed layers across the installed entries, in registry order. */
export function derivedClaimedLayers(entries: readonly Presentation[] = defaultRegistry().entries()): ClaimedLayer[] {
  const claimed: ClaimedLayer[] = [];
  for (const entry of entries) {
    for (const claim of entry.mapLayers ?? []) {
      claimed.push({
        id: claim.layer,
        minZoom: claim.minZoom,
        idProp: claim.idProp,
        entry,
      });
    }
  }
  return claimed;
}

/** The derived interactive list (guard/cursor view of the claims). */
export function derivedInteractiveLayers(entries?: readonly Presentation[]): InteractiveLayer[] {
  return derivedClaimedLayers(entries).map(({ id, minZoom }) => ({ id, minZoom }));
}

/**
 * Whether any interactive layer claims the tap at this point: a layer
 * above its zoom gate that exists on the current map AND renders a
 * feature under the point. Mirrors MapLibre's layer-scoped click
 * dispatch, so the focus-mode guard cannot drift from the handlers.
 */
export function tapTargetsInteractiveLayer(
  map: TapQueryMap,
  x: number,
  y: number,
  layers: readonly InteractiveLayer[] = derivedInteractiveLayers()
): boolean {
  const zoom = map.getZoom();
  const ids: string[] = [];
  for (const layer of layers) {
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
