/**
 * Availability overlay wiring — any catalog style that declares a
 * `wd-bookings` source (the `huts` overlay since the backend merged
 * `huts-availability` into it — backend #327) gets its availability data
 * wired here. Two shapes, picked by the served style:
 *
 * - **vector** (Martin `availability` function source, backend #341):
 *   nothing is injected — tile URLs carry the resolved `{{date}}` token
 *   and maplibre fetches per-viewport MVT; date changes hot-swap the URLs
 *   via applyOverlayParameters (setTiles in map-catalog-store).
 * - **geojson** (legacy): rides the huts store's live `bookingsGeojson`
 *   instead of the style's `…/{{date}}.geojson` URL — the URL fetch would
 *   drop the date-picker flow's auth/lang/days query params and the
 *   latest-wins guard, and would load data even when no date is picked
 *   (the `{{date}}` token boot-defaults to today).
 *
 * Pure synchronous fixups — no per-style watchers: date changes already
 * flow through applyOverlayParameters (map-catalog-store re-resolves
 * the tokenized style and calls fixupBookingsStyle + applyBookingsToMap),
 * and bookings-data arrival goes through ONE store-level watch there.
 */
import type {
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map as MlMap,
  StyleSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { useHutsStore } from '@stores/huts-store';

/** Availability layers hide until a date is picked — they compose into
 *  the huts overlay and only mean anything for a selected date (empty
 *  bookings source otherwise). Hiding them also skips the source fetch
 *  (MapLibre skips sources whose layers are all hidden). */
const OCCUPATION_LAYER_IDS = [
  'wd-huts-occupation',
  'wd-huts-occupation-day0',
  'wd-huts-occupation-day1',
  'wd-huts-occupation-day2',
  'wd-huts-occupation-day3',
];

/** Layers whose visibility is owned by the picked date, not the
 *  overlay switch — WdOverlayControl must not force-show them. */
export function isDateGatedLayer(id: string): boolean {
  return OCCUPATION_LAYER_IDS.includes(id);
}

/** The intended visibility of the date-gated layers right now — the
 *  single source of truth for overlay toggles, style baking and live
 *  map updates alike. */
export function dateGatedVisibility(): 'visible' | 'none' {
  return useHutsStore().selectedDate ? 'visible' : 'none';
}

/** A style's `wd-bookings` source, in either shape (see header). */
function bookingsSourceOf(style: StyleSpecification): {
  vector?: VectorSourceSpecification;
  geojson?: GeoJSONSourceSpecification;
} {
  const source = style.sources['wd-bookings'];
  if (source?.type === 'vector') return { vector: source as VectorSourceSpecification };
  if (source?.type === 'geojson') return { geojson: source as GeoJSONSourceSpecification };
  return {};
}

/** Bake the date-gated visibility into a style spec (add-time state
 *  for basemap switches and native composition — live updates go
 *  through applyBookingsToMap). */
function bakeOccupationVisibility(style: StyleSpecification): void {
  const visible = dateGatedVisibility() === 'visible';
  for (const layer of style.layers) {
    if (!('id' in layer) || !OCCUPATION_LAYER_IDS.includes(layer.id as string)) continue;
    // In place is safe: resolveTokens builds a fresh tree per compile,
    // so fixed-up styles are never the persisted cache documents.
    const record = layer as { layout?: Record<string, unknown> };
    record.layout = record.layout ?? {};
    record.layout['visibility'] = visible ? 'visible' : 'none';
  }
}

/**
 * Synchronously fix up a resolved catalog style that declares the
 * `wd-bookings` source: ride the huts store's live bookings object
 * (never the style's URL) and bake the date-gated occupation
 * visibility. Idempotent; returns false (no-op) for styles without
 * the source. Live map updates: applyBookingsToMap.
 */
export function fixupBookingsStyle(style: StyleSpecification): boolean {
  const { vector, geojson } = bookingsSourceOf(style);
  if (!vector && !geojson) return false;
  // Legacy geojson source: ride the store's live bookings object
  // (never the style's URL). SAFETY: the generated availability schema
  // follows RFC 7946 nullable geometry/properties; the live object is a
  // valid FeatureCollection.
  if (geojson) {
    geojson.data = useHutsStore().bookingsGeojson as GeoJSON.GeoJSON;
  }
  // Vector source: tile URLs already carry the resolved {{date}} —
  // nothing to inject; live date changes go through setTiles in
  // applyOverlayParameters (map-catalog-store).
  bakeOccupationVisibility(style);
  return true;
}

/**
 * Push the current bookings state to the live map: occupation layers
 * follow the picked date — and the overlay switch, so hiding the whole
 * overlay still hides them — and the map source rides the live object.
 * No-ops when the map or its style is not ready.
 */
export function applyBookingsToMap(map: MlMap | undefined, overlayActive: boolean): void {
  if (!map || !map.isStyleLoaded()) return;
  const visibility = overlayActive ? dateGatedVisibility() : 'none';
  for (const id of OCCUPATION_LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
  const mapSource = map.getSource('wd-bookings');
  if (mapSource?.type === 'geojson') {
    // SAFETY: same RFC 7946 → maplibre GeoJSON bridge as the fixup.
    (mapSource as GeoJSONSource).setData(useHutsStore().bookingsGeojson as GeoJSON.GeoJSON);
  }
  // Vector source needs no live push: date changes swap the tile URLs
  // via applyOverlayParameters (setTiles); visibility above is all that
  // applies per-overlay-toggle.
}
