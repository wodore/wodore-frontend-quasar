/**
 * Availability overlay wiring — the `wd-bookings` geojson source rides
 * the huts store's live `bookingsGeojson` (the factory-era overlay
 * styles lived here too; the backend map catalog owns them now — see
 * map-catalog-store / catalog-mapping).
 *
 * Keeping the source as a live OBJECT (not the catalog style's
 * `…/{{date}}.geojson` URL) preserves the date-picker fetch flow with
 * its auth/lang/days query params a raw MapLibre URL fetch would not
 * carry.
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

/**
 * Wire a style's `wd-bookings` source to the huts store's live
 * bookingsGeojson: keeps the style object and (once the map carries
 * the source) the MapLibre source in sync on every availability
 * refetch (date change, locale change). Also binds the occupation
 * layers' visibility to the picked date (set → visible, unset →
 * hidden) — baked into the style spec for basemap switches and
 * applied live via setLayoutProperty.
 */
export function wireBookingsSource(style: StyleSpecification): void {
  const source = style.sources['wd-bookings'] as GeoJSONSourceSpecification | undefined;
  if (!source) return;

  /** Availability layers follow the picked date (set → visible, unset →
   *  hidden): baked into the style spec (basemap switches keep the
   *  state) and applied live via setLayoutProperty. */
  const applyAvailabilityVisibility = (): void => {
    const visible = Boolean(selectedDate.value);
    for (const layer of style.layers) {
      if (
        'id' in layer &&
        OCCUPATION_LAYER_IDS.includes(layer.id as string) &&
        'layout' in layer &&
        layer.layout
      ) {
        layer.layout['visibility'] = visible ? 'visible' : 'none';
      }
    }
    if (mapRef.map && mapRef.map.isStyleLoaded()) {
      for (const id of OCCUPATION_LAYER_IDS) {
        if (mapRef.map.getLayer(id)) {
          mapRef.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
    }
  };
  applyAvailabilityVisibility();
  // Re-apply when the picked date changes (selectedDate is the tracked
  // dependency — read BEFORE any early return).
  watchEffect(applyAvailabilityVisibility);

  watchEffect(() => {
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
}
