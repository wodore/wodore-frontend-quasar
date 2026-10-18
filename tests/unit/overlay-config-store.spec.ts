// @vitest-environment happy-dom
//
// Regression: category-driven filter options (the accommodation-types
// filter of the huts overlay) must populate when the backend map catalog
// swaps the overlay items in. The config store's creation-time init runs
// while `overlays` is still EMPTY (the catalog loads asynchronously via
// map-catalog-store and replaces the items afterwards), so population
// has to re-run on every catalog swap (overlaysEpoch bump) — without
// it the filter panel renders no options and selecting types does
// nothing.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const setFilterCalls: Array<[string, unknown]> = [];

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({
    map: {
      getLayer: (id: string) => ({ id }),
      setFilter: (id: string, filter: unknown) => setFilterCalls.push([id, filter]),
    },
  }),
}));

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
      setItem: (key: string, value: unknown) =>
        window.localStorage.setItem(key, JSON.stringify(value)),
      hasItem: (key: string) => window.localStorage.getItem(key) !== null,
      removeItem: (key: string) => window.localStorage.removeItem(key),
    },
    Notify: { create: vi.fn() },
  };
});

vi.mock('@services/locale', async () => {
  const { ref } = await import('vue');
  const locale = ref('en');
  return {
    currentLocale: () => locale.value,
    // Minimal composer for the module-level `i18n.global.t` reads in
    // the store graph (huts-store, basemap-store, …).
    i18n: { global: { t: (key: string) => key } },
  };
});

// The storage service writes through @capacitor/preferences (a no-op
// under happy-dom) — back it with the real DOM storage.
vi.mock('@services/storage', async () => {
  const { storageGet, storageSet, storageHas, storageRemove } =
    await import('./helpers/storage-mock');
  return { storageGet, storageSet, storageHas, storageRemove };
});

// The basemap store reads the i18n composer at module level and
// self-initializes GPU detection — neither is needed here.
vi.mock('@stores/map/basemap-store', () => ({
  useBasemapStore: () => ({ gpuSpecReady: Promise.resolve('high' as const) }),
}));

// Category API: two accommodation types, identifier-first (the filter's
// option value must be the identifier — the tile property carries the
// same domain).
vi.mock('@clients/index', () => ({
  clientWodore: {
    GET: vi.fn(async () => ({
      data: [
        {
          slug: 'hut',
          name: 'Hut',
          identifier: 'accommodation.hut',
          symbol_color: null,
          symbol_primitive: null,
        },
        {
          slug: 'bivouac',
          name: 'Bivouac',
          identifier: 'accommodation.bivouac',
          symbol_color: null,
          symbol_primitive: null,
        },
      ],
      error: undefined,
    })),
  },
}));

interface FilterDef {
  id: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
  category?: string;
  defaultValue?: unknown;
  mapLayers?: string[];
  mapProperty?: string;
}

/** A catalog-compiled huts overlay carrying the accommodation filter. */
function hutsOverlayItem(): Record<string, unknown> {
  return {
    name: 'huts',
    label: 'Huts',
    active: false,
    show: true,
    onLayer: 'ways',
    icon: 'huts',
    style: { version: 8, sources: {}, layers: [] },
    config: {
      filters: [
        {
          id: 'hutTypes',
          label: 'Accommodation types',
          type: 'multi-select',
          category: 'accommodation',
          defaultValue: [],
          mapLayers: ['wd-huts'],
          mapProperty: 'type_standard_identifier',
          filterExpression: 'in',
        },
        {
          id: 'mode',
          label: 'Mode',
          type: 'single-select',
          defaultValue: 'all',
          mapLayers: ['wd-huts'],
          mapProperty: 'mode',
        },
      ],
    },
  };
}

describe('overlay config store (category-driven filters)', () => {
  let overlayStore: ReturnType<typeof import('@stores/map/overlay-store').useOverlayStore>;
  let configStore: ReturnType<typeof import('@stores/map/overlay-config-store').useOverlayConfigStore>;

  function hutTypesFilter(): FilterDef | undefined {
    const huts = (
      overlayStore.overlays as unknown as Array<{ name: string; config?: { filters?: FilterDef[] } }>
    ).find(o => o.name === 'huts');
    return huts?.config?.filters?.find(f => f.id === 'hutTypes');
  }

  beforeAll(async () => {
    window.localStorage.clear();
    setActivePinia(createPinia());
    const overlay = await import('@stores/map/overlay-store');
    const config = await import('@stores/map/overlay-config-store');
    overlayStore = overlay.useOverlayStore();
    // Creation happens while the overlay list is EMPTY — exactly the boot
    // order in the app (the catalog swaps items in asynchronously).
    configStore = config.useOverlayConfigStore();
  });

  beforeEach(() => {
    window.localStorage.clear();
    setFilterCalls.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('populates filter options when the catalog swaps overlays in after store creation', async () => {
    const item = hutsOverlayItem();
    expect(hutTypesFilter()).toBeUndefined(); // overlays boot empty

    // The catalog swap replaces the items and bumps the epoch — the
    // debounced category population must follow.
    (
      overlayStore as unknown as { applyCatalogOverlays: (items: never[]) => void }
    ).applyCatalogOverlays([item as never]);

    await vi.advanceTimersByTimeAsync(500);

    const filter = hutTypesFilter();
    expect(filter).toBeDefined();
    expect(filter!.options?.map(o => o.value)).toEqual([
      'accommodation.hut',
      'accommodation.bivouac',
    ]);
    expect(filter!.options?.map(o => o.label)).toEqual(['Hut', 'Bivouac']);
  });

  it('repopulates options after a later catalog swap (progressive emit)', async () => {
    (
      overlayStore as unknown as { applyCatalogOverlays: (items: never[]) => void }
    ).applyCatalogOverlays([hutsOverlayItem() as never]);
    await vi.advanceTimersByTimeAsync(500);
    expect(hutTypesFilter()?.options?.length).toBe(2);

    // A second swap replaces the config objects with fresh (empty) ones
    // — the population must run again.
    (
      overlayStore as unknown as { applyCatalogOverlays: (items: never[]) => void }
    ).applyCatalogOverlays([hutsOverlayItem() as never]);
    expect(hutTypesFilter()?.options).toBeUndefined();

    await vi.advanceTimersByTimeAsync(500);
    expect(hutTypesFilter()?.options?.length).toBe(2);
  });

  it('applies a multi-select filter to the configured map layers', async () => {
    (
      overlayStore as unknown as { applyCatalogOverlays: (items: never[]) => void }
    ).applyCatalogOverlays([hutsOverlayItem() as never]);
    await vi.advanceTimersByTimeAsync(500);

    // No preference saved: the seed's `[]` default surfaces as undefined
    // (all selected), not an empty selection.
    expect(configStore.getFilterValue('huts', 'hutTypes')).toBeUndefined();

    configStore.setFilterValue('huts', 'hutTypes', ['accommodation.hut']);
    await vi.advanceTimersByTimeAsync(200); // filter application debounce

    expect(setFilterCalls).toContainEqual([
      'wd-huts',
      ['in', ['get', 'type_standard_identifier'], ['literal', ['accommodation.hut']]],
    ]);

    // Deselect all (empty selection) HIDES the layers — `in` over an
    // empty haystack matches nothing.
    configStore.setFilterValue('huts', 'hutTypes', []);
    await vi.advanceTimersByTimeAsync(200);
    expect(setFilterCalls).toContainEqual([
      'wd-huts',
      ['in', ['get', 'type_standard_identifier'], ['literal', []]],
    ]);
    expect(configStore.getFilterValue('huts', 'hutTypes')).toEqual([]);

    // Select all (full array) lifts the filter again.
    configStore.setFilterValue('huts', 'hutTypes', [
      'accommodation.hut',
      'accommodation.bivouac',
    ]);
    await vi.advanceTimersByTimeAsync(200);
    expect(setFilterCalls).toContainEqual(['wd-huts', null]);
  });

  it('isFilterActive: default / subset / empty / full / single-select', async () => {
    // Isolate from the preferences saved by the earlier tests.
    configStore.resetAllPreferences();

    const huts = (
      overlayStore.overlays as unknown as Array<{ name: string; config?: { filters?: FilterDef[] } }>
    ).find(o => o.name === 'huts');
    const multi = huts?.config?.filters?.find(f => f.id === 'hutTypes');
    const single = huts?.config?.filters?.find(f => f.id === 'mode');
    expect(multi).toBeDefined();
    expect(single).toBeDefined();

    // No preference: the multi-select `[]` default surfaces as undefined
    // (NOT active — the B1 regression), the single-select default passes
    // through unchanged (also not active).
    expect(configStore.getFilterValue('huts', 'hutTypes')).toBeUndefined();
    expect(configStore.isFilterActive(configStore.getFilterValue('huts', 'hutTypes'), multi!)).toBe(
      false
    );
    expect(configStore.getFilterValue('huts', 'mode')).toBe('all');
    expect(configStore.isFilterActive(configStore.getFilterValue('huts', 'mode'), single!)).toBe(
      false
    );

    // Single-select: a non-default value is active.
    configStore.setFilterValue('huts', 'mode', 'open');
    expect(configStore.isFilterActive(configStore.getFilterValue('huts', 'mode'), single!)).toBe(
      true
    );

    // Multi-select: subset active, EMPTY selection active (Deselect all
    // hides the layer), full array inactive.
    expect(configStore.isFilterActive(['accommodation.hut'], multi!)).toBe(true);
    expect(configStore.isFilterActive([], multi!)).toBe(true);
    expect(
      configStore.isFilterActive(['accommodation.hut', 'accommodation.bivouac'], multi!)
    ).toBe(false);
  });

  it('reapplyAllFilters re-applies a persisted empty selection (legacy deselect state)', async () => {
    configStore.resetAllPreferences();
    configStore.setFilterValue('huts', 'hutTypes', []);
    await vi.advanceTimersByTimeAsync(200);
    setFilterCalls.length = 0;

    configStore.reapplyAllFilters();
    expect(setFilterCalls).toContainEqual([
      'wd-huts',
      ['in', ['get', 'type_standard_identifier'], ['literal', []]],
    ]);
  });
});
