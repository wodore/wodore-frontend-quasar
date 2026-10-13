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

const { bookingsGeojson } = storeToRefs(useHutsStore());
const mapRef = useMap();

/**
 * Wire a style's `wd-bookings` source to the huts store's live
 * bookingsGeojson: keeps the style object and (once the map carries
 * the source) the MapLibre source in sync on every availability
 * refetch (date change, locale change).
 */
export function wireBookingsSource(style: StyleSpecification): void {
  const source = style.sources['wd-bookings'] as GeoJSONSourceSpecification | undefined;
  if (!source) return;
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
