import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

// overlay-huts registers a map watcher at module scope; useMap must be mocked
// (hoisted, so it also applies to the dynamic import below).
vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

// The huts overlay split into huts + huts-availability (backend catalog
// parity): hutsStyle carries the hut symbols, availabilityStyle the
// occupation layers over the bookings geojson source. ONE pinia/module
// boot is shared by both describes — the module-level wiring binds to
// the huts store of the pinia active at import time.
let overlayHuts: typeof import('@stores/map/utils/overlay-huts');

beforeAll(async () => {
  process.env.WODORE_TILE_SERVER_URL = 'http://tiles.test';
  setActivePinia(createPinia());
  overlayHuts = await import('@stores/map/utils/overlay-huts');
});

describe('hutsStyle', () => {
  it('builds the vector hut source only (bookings split out)', () => {
    allure.label('feature', 'map-overlays');
    allure.severity('critical');

    const { hutsStyle } = overlayHuts;
    expect(hutsStyle.version).toBe(8);

    const sources = hutsStyle.sources as Record<string, Record<string, unknown>>;
    expect(Object.keys(sources)).toEqual(['wd-huts']);
    const huts = sources['wd-huts'];
    expect(huts.type).toBe('vector');
    expect(huts.promoteId).toBe('slug');
    expect(huts.url).toBe('http://tiles.test/huts');
  });

  it('registers the wd accommodation sprite from the tile server', () => {
    const { hutsStyle } = overlayHuts;
    expect(hutsStyle.sprite).toEqual([{ id: 'wd', url: 'http://tiles.test/sprite/accommodation' }]);
  });

  it('orders layers: selected, huts', () => {
    const { hutsStyle } = overlayHuts;
    const layerIds = hutsStyle.layers.map(l => l.id);
    expect(layerIds).toEqual(['wd-huts-selected', 'wd-huts']);

    const huts = hutsStyle.layers.find(l => l.id === 'wd-huts');
    expect(huts?.type).toBe('symbol');
    expect((huts as Record<string, unknown>)['source-layer']).toBe('huts');
  });
});

describe('availabilityStyle', () => {
  it('builds the geojson bookings source', () => {
    const { availabilityStyle } = overlayHuts;
    expect(availabilityStyle.version).toBe(8);

    const sources = availabilityStyle.sources as Record<string, Record<string, unknown>>;
    expect(Object.keys(sources)).toEqual(['wd-bookings']);
    const bookings = sources['wd-bookings'];
    expect(bookings.type).toBe('geojson');
    expect(bookings.promoteId).toBe('hut_id');
    // Initial data comes from the empty bookings geojson of the huts store
    expect(bookings.data).toMatchObject({ type: 'FeatureCollection', features: [] });
  });

  it('registers the wd availability sprite from the tile server', () => {
    const { availabilityStyle } = overlayHuts;
    expect(availabilityStyle.sprite).toEqual([
      { id: 'wd', url: 'http://tiles.test/sprite/availability' },
    ]);
  });

  it('orders layers: occupation days, occupation', () => {
    const { availabilityStyle } = overlayHuts;
    const layerIds = availabilityStyle.layers.map(l => l.id);
    expect(layerIds).toEqual([
      'wd-huts-occupation-day0',
      'wd-huts-occupation-day1',
      'wd-huts-occupation-day2',
      'wd-huts-occupation-day3',
      'wd-huts-occupation',
    ]);
  });

  it('configures zoom ranges for occupation and detail layers', () => {
    const { availabilityStyle } = overlayHuts;
    const day0 = availabilityStyle.layers.find(l => l.id === 'wd-huts-occupation-day0');
    expect(day0?.type).toBe('symbol');
    expect(day0?.source).toBe('wd-bookings');
    expect(day0?.minzoom).toBe(6);

    const occupation = availabilityStyle.layers.find(l => l.id === 'wd-huts-occupation');
    expect(occupation?.maxzoom).toBe(13);
  });

  it('maps occupancy status to availability colors and renders no background for unknown', () => {
    const { availabilityStyle } = overlayHuts;
    const occupation = availabilityStyle.layers.find(l => l.id === 'wd-huts-occupation');
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

  it('keeps the small day dots for unknown status and no day-layer filter', () => {
    const { availabilityStyle } = overlayHuts;
    for (const day of [0, 1, 2, 3]) {
      const layer = availabilityStyle.layers.find(
        l => l.id === `wd-huts-occupation-day${day}`
      ) as unknown as Record<string, unknown>;
      // No filter: unknown days keep rendering their small gray dot + "?" label.
      // Only the big background circle is suppressed for unknown (via the
      // transparent circle-color fallback tested above).
      expect(layer.filter).toBeUndefined();
      const layout = layer.layout as Record<string, unknown>;
      const iconImage = layout['icon-image'] as unknown[];
      expect(JSON.stringify(iconImage)).toContain('wd:detailed/availability.');
    }
  });

  it('labels unknown days with a single ? in the basemap label style', () => {
    const { availabilityStyle } = overlayHuts;
    const layer = availabilityStyle.layers.find(
      l => l.id === 'wd-huts-occupation-day0'
    ) as unknown as Record<string, unknown>;

    // text-field: unknown status collapses free/total to a single "?"
    const textField = layer.layout['text-field'] as unknown[];
    expect(textField[0]).toBe('case');
    const innerCase = textField[2] as unknown[];
    expect(innerCase[0]).toBe('case');
    // the single "?" branch precedes the free/total concat
    const unknownBranch = innerCase.indexOf('?');
    const concatBranch = innerCase.findIndex(part => Array.isArray(part) && part[0] === 'concat');
    expect(unknownBranch).toBeGreaterThan(-1);
    expect(concatBranch).toBeGreaterThan(unknownBranch);

    // font: the basemap style's place-label voice (Barlow), Noto fallback
    const font = layer.layout['text-font'] as string[];
    expect(font).toContain('Barlow Semi Condensed SemiBold');
    expect(font).toContain('Noto Sans Bold');

    // paint: no per-status text color (status colors live in the dots),
    // but the style's pale halo is applied
    const paint = layer.paint as Record<string, unknown>;
    expect(paint['text-color']).toBeUndefined();
    expect(paint['text-halo-color']).toBe('rgba(242, 247, 244, 0.9)');
    expect(paint['text-halo-width']).toBe(0.8);
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

    const source = overlayHuts.availabilityStyle.sources['wd-bookings'] as { data: unknown };
    const data = source.data as { type: string; features: unknown[] };
    expect(data.type).toBe('FeatureCollection');
    expect(data.features).toHaveLength(1);
  });
});
