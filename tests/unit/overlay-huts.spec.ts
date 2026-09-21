import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

// overlay-huts registers a map watcher at module scope; useMap must be mocked
// (hoisted, so it also applies to the dynamic import below).
vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

describe('hutsStyle', () => {
  let overlayHuts: typeof import('@stores/map/utils/overlay-huts');

  // The module evaluates Pinia + tile-server env at import time, so pinia must
  // be active and the env fixed BEFORE the dynamic import.
  beforeAll(async () => {
    process.env.WODORE_TILE_SERVER_URL = 'http://tiles.test';
    setActivePinia(createPinia());
    overlayHuts = await import('@stores/map/utils/overlay-huts');
  });

  it('builds vector hut and geojson bookings sources', () => {
    allure.label('feature', 'map-overlays');
    allure.severity('critical');

    const { hutsStyle } = overlayHuts;
    expect(hutsStyle.version).toBe(8);

    const sources = hutsStyle.sources as Record<string, Record<string, unknown>>;
    const huts = sources['wd-huts'];
    expect(huts.type).toBe('vector');
    expect(huts.promoteId).toBe('slug');
    expect(huts.url).toBe('http://tiles.test/huts');

    const bookings = sources['wd-bookings'];
    expect(bookings.type).toBe('geojson');
    expect(bookings.promoteId).toBe('hut_id');
    // Initial data comes from the empty bookings geojson of the huts store
    expect(bookings.data).toMatchObject({ type: 'FeatureCollection', features: [] });
  });

  it('registers the wd sprite from the tile server', () => {
    const { hutsStyle } = overlayHuts;
    expect(hutsStyle.sprite).toEqual([
      { id: 'wd', url: 'http://tiles.test/sprite/accommodation,availability' },
    ]);
  });

  it('orders layers: occupation days, occupation, selected, huts', () => {
    const { hutsStyle } = overlayHuts;
    const layerIds = hutsStyle.layers.map(l => l.id);
    expect(layerIds).toEqual([
      'wd-huts-occupation-day0',
      'wd-huts-occupation-day1',
      'wd-huts-occupation-day2',
      'wd-huts-occupation-day3',
      'wd-huts-occupation',
      'wd-huts-selected',
      'wd-huts',
    ]);
  });

  it('configures zoom ranges for occupation and detail layers', () => {
    const { hutsStyle } = overlayHuts;
    const day0 = hutsStyle.layers.find(l => l.id === 'wd-huts-occupation-day0');
    expect(day0?.type).toBe('symbol');
    expect(day0?.source).toBe('wd-bookings');
    expect(day0?.minzoom).toBe(8);

    const occupation = hutsStyle.layers.find(l => l.id === 'wd-huts-occupation');
    expect(occupation?.maxzoom).toBe(13);

    const huts = hutsStyle.layers.find(l => l.id === 'wd-huts');
    expect(huts?.type).toBe('symbol');
    expect((huts as Record<string, unknown>)['source-layer']).toBe('huts');
  });

  it('maps occupancy status to availability colors with gray fallback', () => {
    const { hutsStyle } = overlayHuts;
    const occupation = hutsStyle.layers.find(l => l.id === 'wd-huts-occupation');
    const color = (occupation?.paint as Record<string, unknown>)['circle-color'] as unknown[];
    expect(color[0]).toBe('match');

    const flat = color.slice(2);
    const pairs: Array<[unknown, unknown]> = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      pairs.push([flat[i], flat[i + 1]]);
    }
    expect(pairs).toContainEqual(['empty', '#33FF33']);
    expect(pairs).toContainEqual(['low', '#99CC33']);
    expect(pairs).toContainEqual(['medium', '#FFA726']);
    expect(pairs).toContainEqual(['high', '#EF6C00']);
    expect(pairs).toContainEqual(['full', '#D32F2F']);
    // Fallback for missing/unknown status
    expect(color[color.length - 1]).toBe('#D4D4D4');
  });

  it('updates the bookings source when the store geojson changes', async () => {
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

    const source = overlayHuts.hutsStyle.sources['wd-bookings'] as { data: unknown };
    const data = source.data as { type: string; features: unknown[] };
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);
  });
});
