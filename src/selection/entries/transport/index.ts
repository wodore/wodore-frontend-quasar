/**
 * Transport entry (external source, PR3) — the proof of the
 * external-source path: Transitland tile properties are NOT the
 * geoplace model; matching is claim-based (source family), the popup
 * renders the wire props defensively, and the canonical id is the
 * Transitland onestop_id (no URL — D10 reserves the pattern).
 */
import { definePresentation } from '@selection/types';
import {
  TRANSPORT_PRESENCE_LAYERS,
  TRANSPORT_PRESENCE_MIN_ZOOM,
  TRANSPORT_STOP_LAYERS,
} from '@selection/map-layer-ids';

export const transportEntry = definePresentation<Record<string, unknown>>({
  id: 'transport',
  match: { source: 'transport' },
  capabilities: ['popup'],
  surfaces: () => import('./surfaces'),
  // The overlay's own layers, PLUS the family's passive basemap presence
  // (station icons + names, backend #506): with the overlay OFF the
  // presence is the family's POI layer, and a click on a passive icon
  // opens the same place (the presence source promotes the same
  // onestop_id; the popup is keyed on this entry's match.source). With
  // the overlay ON the presence layers are visibility:none — hidden
  // layers are skipped where the click and the tap guard pick their
  // layers (interactive-layers.ts `interactiveLayerIsShown`); they are
  // NOT hidden from queryRenderedFeatures, which ignores visibility.
  mapLayers: [
    ...TRANSPORT_STOP_LAYERS.map(layer => ({
      layer,
      idProp: 'onestop_id',
      // The tiles start at z11 (source minzoom) — the gate mirrors the
      // huts convention; below it nothing renders anyway.
      minZoom: 8,
    })),
    ...TRANSPORT_PRESENCE_LAYERS.map(layer => ({
      layer,
      idProp: 'onestop_id',
      // strict gate (zoom > minZoom): floor − 1 opens from the floor
      minZoom: TRANSPORT_PRESENCE_MIN_ZOOM - 1,
    })),
  ],
});
