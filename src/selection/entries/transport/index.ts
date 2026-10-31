/**
 * Transport entry (external source, PR3) — the proof of the
 * external-source path: Transitland tile properties are NOT the
 * geoplace model; matching is claim-based (source family), the popup
 * renders the wire props defensively, and the canonical id is the
 * Transitland onestop_id (no URL — D10 reserves the pattern).
 */
import { definePresentation } from '@selection/types';
import { TRANSPORT_STOP_LAYERS } from '@selection/map-layer-ids';


export const transportEntry = definePresentation<Record<string, unknown>>({
  id: 'transport',
  match: { source: 'transport' },
  capabilities: ['popup'],
  surfaces: () => import('./surfaces'),
  mapLayers: TRANSPORT_STOP_LAYERS.map(layer => ({
    layer,
    idProp: 'onestop_id',
    // The tiles start at z11 (source minzoom) — the gate mirrors the
    // huts convention; below it nothing renders anyway.
    minZoom: 8,
  })),
});
