/**
 * Availability overlay wiring — any catalog style that declares a
 * `wd-bookings` geojson source (the `huts` overlay since the backend
 * merged `huts-availability` into it — backend #327) rides the huts
 * store's live `bookingsGeojson` instead of the style's
 * `…/{{date}}.geojson` URL: the URL fetch would drop the date-picker
 * flow's auth/lang/days query params and the latest-wins guard, and
 * would load data even when no date is picked (the `{{date}}` token
 * boot-defaults to today).
 *
 * Keeping the source as a live OBJECT (not the catalog style's URL)
 * preserves the date-picker fetch flow, and binds the occupation
 * layers' visibility to the picked date (set → visible, unset →
 * hidden) — baked into the style spec for basemap switches / native
 * composition and applied live via setLayoutProperty.
 */
import { storeToRefs } from 'pinia';
import type { GeoJSONSource, GeoJSONSourceSpecification, StyleSpecification } from 'maplibre-gl';
import { useHutsStore } from '@stores/huts-store';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { watchEffect } from 'vue';

const { bookingsGeojson, selectedDate } = storeToRefs(useHutsStore());
const mapRef = useMap();

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

/** The intended visibility of the date-gated layers right now —
 *  authoritative for overlay toggles (the same state the wiring
 *  bakes into styles and applies live on date changes). */
export function dateGatedVisibility(): 'visible' | 'none' {
  return selectedDate.value ? 'visible' : 'none';
}

/** A style's `wd-bookings` geojson source, if it declares one. */
function bookingsSourceOf(style: StyleSpecification): GeoJSONSourceSpecification | undefined {
  const source = style.sources['wd-bookings'] as GeoJSONSourceSpecification | undefined;
  return source?.type === 'geojson' ? source : undefined;
}

/** Bake the date-gated visibility into a style spec (add-time state
 *  for basemap switches and native composition — live updates go
 *  through setLayoutProperty). */
function bakeOccupationVisibility(style: StyleSpecification, visible: boolean): void {
  for (const layer of style.layers) {
    if (!('id' in layer) || !OCCUPATION_LAYER_IDS.includes(layer.id as string)) continue;
    // In place is safe: resolveTokens builds a fresh tree per compile,
    // so wired styles are never the persisted cache documents.
    const record = layer as { layout?: Record<string, unknown> };
    record.layout = record.layout ?? {};
    record.layout['visibility'] = visible ? 'visible' : 'none';
  }
}

/** Live stop handles per wired style — styles replaced by parameter
 *  re-resolution (applyOverlayParameters) are unwired to keep exactly
 *  one watcher pair per live style document. */
const wiredStyles = new WeakMap<StyleSpecification, Array<() => void>>();

/**
 * Wire a style's `wd-bookings` source to the huts store's live
 * bookingsGeojson: keeps the style object and (once the map carries
 * the source) the MapLibre source in sync on every availability
 * refetch (date change, locale change). Also binds the occupation
 * layers' visibility to the picked date. Idempotent per style object.
 */
export function wireBookingsSource(style: StyleSpecification): void {
  const source = bookingsSourceOf(style);
  if (!source || wiredStyles.has(style)) return;
  wiredStyles.set(style, []);

  // Static wiring: live object data (never a URL fetch) + the current
  // date-gated visibility baked into the spec.
  source.data = bookingsGeojson.value as GeoJSON.GeoJSON;
  bakeOccupationVisibility(style, Boolean(selectedDate.value));

  /** Availability layers follow the picked date (set → visible, unset
   *  → hidden): baked into the style spec (basemap switches keep the
   *  state) and applied live via setLayoutProperty. */
  const stopVisibility = watchEffect(() => {
    const visible = Boolean(selectedDate.value);
    bakeOccupationVisibility(style, visible);
    if (mapRef.map && mapRef.map.isStyleLoaded()) {
      for (const id of OCCUPATION_LAYER_IDS) {
        if (mapRef.map.getLayer(id)) {
          mapRef.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
    }
  });

  const stopData = watchEffect(() => {
    source.data = bookingsGeojson.value as GeoJSON.GeoJSON;

    // Check if map is available and style is loaded before trying to access sources
    if (!mapRef.map || !mapRef.map.isStyleLoaded()) {
      return;
    }

    const mapSource = mapRef.map.getSource('wd-bookings') as GeoJSONSource | undefined;
    // Source may not exist if basemap was just changed
    if (mapSource && bookingsGeojson.value !== undefined) {
      mapSource.setData(bookingsGeojson.value as GeoJSON.GeoJSON);
    }
  });

  wiredStyles.get(style)!.push(stopVisibility, stopData);
}

/** Stop a style's wiring when it is dropped (replaced by a fresh
 *  resolved document in applyOverlayParameters). No-op for styles
 *  that were never wired. */
export function unwireBookingsSource(style: StyleSpecification | undefined): void {
  if (!style) return;
  for (const stop of wiredStyles.get(style) ?? []) stop();
  wiredStyles.delete(style);
}
