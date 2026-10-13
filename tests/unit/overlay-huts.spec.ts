// @vitest-environment happy-dom
//
// wireBookingsSource — the availability overlay's `wd-bookings` geojson
// source rides the huts store's live bookingsGeojson (date-picker flow).
// The former factory styles are gone; the backend map catalog owns the
// layer definitions (see map-catalog-store / catalog-mapping).
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { StyleSpecification } from 'maplibre-gl';

// overlay-huts registers a map watcher at module scope; useMap must be mocked
// (hoisted, so it also applies to the dynamic import below).
vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

const wiredStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    'wd-bookings': {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'hut_id',
    },
  },
  layers: [{ id: 'wd-huts-occupation', type: 'circle', source: 'wd-bookings' }],
});

describe('wireBookingsSource', () => {
  let overlayHuts: typeof import('@stores/map/utils/overlay-huts');

  // The module evaluates Pinia at import time — pinia must be active
  // BEFORE the dynamic import.
  beforeAll(async () => {
    setActivePinia(createPinia());
    overlayHuts = await import('@stores/map/utils/overlay-huts');
  });

  it('wires the wd-bookings source to the huts store geojson', () => {
    const style = wiredStyle();
    overlayHuts.wireBookingsSource(style);
    const source = style.sources['wd-bookings'] as { data: unknown };
    expect(source.data).toMatchObject({ type: 'FeatureCollection' });
  });

  it('updates the wired source when the store geojson changes', async () => {
    const style = wiredStyle();
    overlayHuts.wireBookingsSource(style);

    const { useHutsStore } = await import('@stores/huts-store');
    const store = useHutsStore();
    store.bookingsGeojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'h1',
          geometry: { type: 'Point', coordinates: [7.75, 46.0] },
          properties: { hut_id: 'h1' },
        },
      ],
    } as unknown as typeof store.bookingsGeojson;

    await nextTick();

    const source = style.sources['wd-bookings'] as { data: { type: string; features: unknown[] } };
    expect(source.data.type).toBe('FeatureCollection');
    expect(source.data.features).toHaveLength(1);
  });

  it('no-ops for styles without a wd-bookings source', () => {
    const style: StyleSpecification = { version: 8, sources: {}, layers: [] };
    expect(() => overlayHuts.wireBookingsSource(style)).not.toThrow();
  });
});
