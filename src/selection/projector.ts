/**
 * Map projector — engine-agnostic position projection for anchored
 * overlays (WdMapPopup). A ~20-line module singleton: NOT an event bus,
 * NOT a Pinia store — registration returns an unregister function, and
 * a shallowRef handle lets consumers re-anchor reactively when the
 * engine changes (fallback swap, basemap switch).
 *
 * Semantics (place-popup spec): a projector unregister (engine swap)
 * closes the popup; feature-state cleanup belongs to the adapter that
 * set it. Canvas-relative projected px must be converted to viewport
 * px by the consumer (canvas bounding rect) when the overlay teleports
 * to body. PR2 wires the actual adapters — this scaffold lands in PR1a
 * so the module boundary exists (work doc PR table).
 */
import { shallowRef, type ShallowRef } from 'vue';
import type { LatLng } from './types';

export interface MapProjector {
  /** Project a geographic position to CONTAINER-relative pixels. */
  project(lngLat: LatLng): { x: number; y: number };
  readonly engine: 'maplibre' | 'leaflet';
}

const projector = shallowRef<MapProjector | null>(null);

/** Register the active engine's projector; returns the unregister
 *  function (engine teardown — must also clear its highlights). */
export function registerProjector(p: MapProjector): () => void {
  projector.value = p;
  return () => {
    if (projector.value === p) projector.value = null;
  };
}

/** Reactive read for overlay consumers (re-anchor on engine swap). */
export function useProjector(): ShallowRef<MapProjector | null> {
  return projector;
}
