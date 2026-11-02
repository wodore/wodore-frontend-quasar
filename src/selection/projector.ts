/**
 * Map projector — engine-agnostic position projection for anchored
 * overlays (WdMapPopup). A ~20-line module singleton: NOT an event bus,
 * NOT a Pinia store — registration returns an unregister function, and
 * a shallowRef handle lets consumers re-anchor reactively when the
 * engine changes (fallback swap, basemap switch).
 *
 * Semantics (place-popup spec):
 * - `project` returns VIEWPORT-RELATIVE px (the adapter folds in its
 *   canvas/container offset — consumers teleport to body and use the
 *   result verbatim).
 * - `onMove` subscribes to CONTINUOUS movement (not just `moveend`) so
 *   overlays glue through flyTo animations; returns the unsubscribe.
 * - A projector unregister (engine swap) closes the popup; feature-state
 *   cleanup belongs to the adapter that set it (the unregister path).
 */
import { shallowRef, type ShallowRef } from 'vue';
import type { LatLng } from './types';

export interface MapProjector {
  /** Project a geographic position to VIEWPORT-relative pixels. */
  project(lngLat: LatLng): { x: number; y: number };
  /** Subscribe to continuous map movement; returns the unsubscribe. */
  onMove(cb: () => void): () => void;
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
