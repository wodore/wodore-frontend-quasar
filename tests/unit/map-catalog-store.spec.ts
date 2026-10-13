// @vitest-environment happy-dom
//
// Map catalog store — parameter value resolution and live paint
// re-resolution. The overlay store boots from factories; the catalog
// store compiles catalog layers over them (fetch mocked) and applies
// parameter overrides to a fake map.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { StyleSpecification } from 'maplibre-gl';

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: fakeMap }),
}));

// The storage service writes through @capacitor/preferences (a no-op
// under happy-dom) — back it with the real DOM storage for assertions.
vi.mock('@services/storage', async () => {
  const { storageGet, storageSet, storageHas, storageRemove } = await import(
    './helpers/storage-mock'
  );
  return { storageGet, storageSet, storageHas, storageRemove };
});

// Quasar's LocalStorage no-ops under happy-dom; back it with the real DOM storage
vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  return {
    ...actual,
    LocalStorage: {
      getItem: (key: string) => {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      setItem: (key: string, value: unknown) => {
        window.localStorage.setItem(key, JSON.stringify(value));
      },
      removeItem: (key: string) => window.localStorage.removeItem(key),
    },
  };
});

// Fake MapLibre map recording paint/layout/setData calls
const paintCalls: Array<[string, string, unknown]> = [];
const layoutCalls: Array<[string, string, unknown]> = [];
const dataCalls: Array<[string, unknown]> = [];
const fakeMap = {
  getLayer: (id: string) => ({ id }),
  getSource: (id: string) => ({ setData: (v: unknown) => dataCalls.push([id, v]) }),
  setPaintProperty: (id: string, prop: string, value: unknown) => paintCalls.push([id, prop, value]),
  setLayoutProperty: (id: string, prop: string, value: unknown) => layoutCalls.push([id, prop, value]),
  isStyleLoaded: () => true,
};

const TOKENIZED_STYLE = {
  version: 8,
  name: 'mtb',
  sources: {
    'wd-mtb': { type: 'raster', tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'], tileSize: 256 },
  },
  layers: [
    {
      id: 'wd-mtb',
      type: 'raster',
      source: 'wd-mtb',
      paint: { 'raster-opacity': '{{mtb.opacity}}' },
      layout: { visibility: 'visible' },
    },
  ],
} as StyleSpecification;

const PARAMETERS = [
  {
    slug: 'mtb.opacity',
    kind: 'opacity-curve',
    label: 'MTB routes opacity',
    description: '',
    default: ['interpolate', ['linear'], ['zoom'], 8, 0.6, 9, 0.72, 13, 0.9, 16, 0.7],
    constraints: null,
  },
  {
    slug: 'mtb.color',
    kind: 'color',
    label: 'Route color',
    description: '',
    default: '#cc1f0c',
    constraints: null,
  },
] as const;

describe('map catalog store parameters', () => {
  let stores: typeof import('@stores/map/map-catalog-store');
  let overlayStores: typeof import('@stores/map/overlay-store');

  // overlay-huts evaluates Pinia at import time — pinia must be active
  // BEFORE the dynamic imports below (same pattern as overlays.spec).
  beforeAll(async () => {
    window.localStorage.clear();
    setActivePinia(createPinia());
    stores = await import('@stores/map/map-catalog-store');
    overlayStores = await import('@stores/map/overlay-store');
  });

  it('serves authored defaults for untouched parameters', () => {
    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    // Simulate a catalog overlay: tokenized style + parameters on a
    // factory item slot (name reuse keeps group state intact).
    const mtb = overlayStore.overlays.find(o => o.name === 'mtb')!;
    mtb.parameters = [...PARAMETERS];
    mtb.tokenizedStyle = JSON.parse(JSON.stringify(TOKENIZED_STYLE));

    const value = store.getParameterValue('mtb', 'mtb.opacity') as { stops: unknown[] };
    expect(value.stops.length).toBe(4);
    expect(store.getParameterValue('mtb', 'mtb.color')).toBe('#cc1f0c');
    expect(store.hasParameterOverride('mtb')).toBe(false);
  });

  it('persists overrides and applies token-bearing paint live', () => {
    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    const mtb = overlayStore.overlays.find(o => o.name === 'mtb')!;
    paintCalls.length = 0;

    const curve = { stops: [
      { zoom: 8, opacity: 0 },
      { zoom: 13, opacity: 0.5 },
      { zoom: 16, opacity: 1 },
    ] };
    store.setParameterValue('mtb', 'mtb.opacity', curve);

    // Persisted (localStorage) and served
    const raw = window.localStorage.getItem('mapParameterValues');
    expect(JSON.parse(raw!)).toEqual({
      mtb: { 'mtb.opacity': curve },
    });
    expect(store.hasParameterOverride('mtb')).toBe(true);
    expect((store.getParameterValue('mtb', 'mtb.opacity') as typeof curve).stops).toEqual(
      curve.stops
    );

    // Applied to the live map at the token path only
    expect(paintCalls).toHaveLength(1);
    const [layerId, prop, value] = paintCalls[0]!;
    expect(layerId).toBe('wd-mtb');
    expect(prop).toBe('raster-opacity');
    expect(value).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.5, 16, 1]);
    // Layout without tokens is untouched
    expect(layoutCalls).toHaveLength(0);
    // The overlay-level opacity follows the resolved curve
    expect(mtb.opacity).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.5, 16, 1]);
    // The resolved style carries the substituted paint
    expect(
      (mtb.style.layers[0] as { paint?: Record<string, unknown> }).paint?.['raster-opacity']
    ).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.5, 16, 1]);
  });

  it('reset drops the override and re-resolves the authored default', () => {
    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    const mtb = overlayStore.overlays.find(o => o.name === 'mtb')!;
    paintCalls.length = 0;

    store.resetLayerParameters('mtb');
    expect(store.hasParameterOverride('mtb')).toBe(false);
    expect(paintCalls).toHaveLength(1);
    expect(paintCalls[0]![2]).toEqual(PARAMETERS[0].default);
    expect(mtb.opacity).toEqual(PARAMETERS[0].default);
    expect(window.localStorage.getItem('mapParameterValues')).toBe('{}');
  });

  it('runtime values override persisted ones and never persist', () => {
    const store = stores.useMapCatalogStore();
    store.setParameterValue('mtb', 'mtb.color', '#00ff00');
    store.setRuntimeDate('14.10.26');
    expect(store.runtimeValues.date).toBe('14.10.26');
    // date is runtime-scope: not in the persisted map
    expect(JSON.parse(window.localStorage.getItem('mapParameterValues')!)).toEqual({
      mtb: { 'mtb.color': '#00ff00' },
    });
    store.resetLayerParameters('mtb');
    window.localStorage.clear();
  });
});
