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
    expect(day0?.minzoom).toBe(6);

    const occupation = hutsStyle.layers.find(l => l.id === 'wd-huts-occupation');
    expect(occupation?.maxzoom).toBe(13);

    const huts = hutsStyle.layers.find(l => l.id === 'wd-huts');
    expect(huts?.type).toBe('symbol');
    expect((huts as Record<string, unknown>)['source-layer']).toBe('huts');
  });

  it('maps occupancy status to availability colors and renders no background for unknown', () => {
    const { hutsStyle } = overlayHuts;
    const occupation = hutsStyle.layers.find(l => l.id === 'wd-huts-occupation');
    const color = (occupation?.paint as Record<string, unknown>)['circle-color'] as unknown[];
    expect(color[0]).toBe('match');

    const flat = color.slice(2);
    const pairs: Array<[unknown, unknown]> = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      pairs.push([flat[i], flat[i + 1]]);
    }
    expect(pairs).toContainEqual(['empty', '#25BF5E']);
    expect(pairs).toContainEqual(['low', '#F6AD4B']);
    expect(pairs).toContainEqual(['medium', '#EA9A37']);
    expect(pairs).toContainEqual(['high', '#C3731F']);
    expect(pairs).toContainEqual(['full', '#961A17']);
    // Fallback for unknown/missing status: fully transparent (no background)
    expect(color[color.length - 1]).toBe('rgba(0,0,0,0)');
  });

  it('filters occupation day layers to known occupancy statuses', () => {
    const { hutsStyle } = overlayHuts;
    for (const day of [0, 1, 2, 3]) {
      const layer = hutsStyle.layers.find(
        l => l.id === `wd-huts-occupation-day${day}`
      ) as unknown as Record<string, unknown>;
      const filter = layer.filter as unknown[];
      // ['in', ['get', 'occupancy_status', ['at', day, ['get', 'data']]], ['literal', [...]]]
      expect(filter?.[0]).toBe('in');
      const at = filter[1] as unknown[];
      expect(at[0]).toBe('get');
      expect(at[1]).toBe('occupancy_status');
      const atIndex = at[2] as unknown[];
      expect(atIndex[0]).toBe('at');
      expect(atIndex[1]).toBe(day);
      const literal = filter[2] as unknown[];
      expect(literal[0]).toBe('literal');
      expect(literal[1]).toEqual(
        expect.arrayContaining(['empty', 'low', 'medium', 'high', 'full', 'free_unknown'])
      );
      // "unknown" and missing entries must not render a background
      expect(literal[1]).not.toContain('unknown');
    }
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
