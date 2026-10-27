// @vitest-environment happy-dom
//
// Basemap store — catalog refresh recovery for vanishing selections.
//
// The staging 2026-10 incident: a stale persisted layers snapshot
// booted onto wd-outdoor-base-mtk, whose style then 404'd ("No active
// map layer with slug"). The background catalog refresh returned a
// fresh layers list WITHOUT the slug — and the refresh skipped the
// re-apply block entirely, leaving no active basemap and a blank map
// until a reload rewrote the snapshot. The refresh must now switch to
// the catalog default when the active selection vanished, and keep
// the selection (without re-applying) when nothing changed.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope } from 'vue';
import type { MapCatalogLayer } from '@services/map-catalog';

const API_HOST = 'https://hub.stg.wodore.com';

// ── Hoisted mock state (vi.mock factories run before the suite) ─────────
const { setStyleCalls, fakeMap, storageState, catalogResponse } = vi.hoisted(() => {
  const setStyleCalls: Array<{ style: unknown }> = [];
  const fakeMap = {
    // The store applies basemaps via setStyle — recording the style
    // argument is the observable behavior under test.
    setStyle: (style: unknown) => setStyleCalls.push({ style }),
    on: () => {},
    once: () => {},
    getStyle: () => ({ layers: [] }),
  };
  return {
    setStyleCalls,
    fakeMap,
    storageState: new Map<string, unknown>(),
    catalogResponse: { layers: [] as MapCatalogLayer[] },
  };
});

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: fakeMap }),
}));

// Deterministic capable GPU → weak-GPU raster paths never engage.
vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: async () => ({ tier: 3, gpu: 'Test GPU', fps: 60 }),
}));

vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  return { ...actual, Notify: { create: () => {} } };
});

vi.mock('@services/storage', () => ({
  storageGet: (key: string) => (storageState.has(key) ? storageState.get(key) : null),
  storageSet: (key: string, value: unknown) => void storageState.set(key, value),
  storageHas: (key: string) => storageState.has(key),
  storageRemove: (key: string) => void storageState.delete(key),
}));

vi.mock('@services/locale', () => ({
  currentLocale: () => 'en',
  i18n: { global: { t: (key: string) => key, te: () => false } },
}));

vi.mock('@services/idle', () => ({ whenIdle: () => Promise.resolve() }));

vi.mock('@services/map-prewarm', () => ({
  prewarmCatalogStyles: () => {},
  prewarmStyleAssets: () => {},
}));

// The catalog service: controlled layers response, cold boot (no
// persisted snapshot — the network answer is the only input).
vi.mock('@services/map-catalog', async importOriginal => {
  const actual = await importOriginal<typeof import('@services/map-catalog')>();
  return {
    ...actual,
    fetchMapCatalog: vi.fn(async () => ({
      data: catalogResponse.layers,
      count: catalogResponse.layers.length,
    })),
    loadPersistedLayers: () => null,
  };
});

// ── Deterministic style fetch ─────────────────────────────────────
// The staged boot path (prepareStagedStyle → loadStyleObject) fetches
// the style document via global fetch — without a stub every test does
// REAL network I/O to the staging host and the boot waitFor flakes with
// network latency (locally AND on CI). The stubbed style has nothing
// deferrable (no raster-dem/hillshade), so the splitter returns null
// and boot applies the style URL as-is — exactly the behavior the
// original assertions were written against.
const styleDoc = {
  version: 8,
  name: 'test-style',
  sources: { mtk: { type: 'vector', url: 'https://tiles.example.com/mtk.json' } },
  layers: [{ id: 'background', type: 'background' }],
};
vi.stubGlobal(
  'fetch',
  vi.fn(async () => ({ ok: true, json: async () => styleDoc }))
);

// ── Catalog fixtures ────────────────────────────────────────────────────

function layer(partial: Partial<MapCatalogLayer> & { slug: string }): MapCatalogLayer {
  return {
    role: 'basemap',
    name: partial.name ?? `Layer ${partial.slug}`,
    description: '',
    icon: 'outdoor',
    icon_badge: '',
    slot: null,
    order: 0,
    show: true,
    is_default: false,
    spec: 'high',
    style_url: `/v1/map/styles/${partial.slug}.json?spec=high`,
    modified: '2026-10-20T10:00:00.000Z',
    min_zoom: null,
    max_zoom: null,
    coverage_bbox: null,
    fallback_min_zoom: null,
    fallback: null,
    anchors: null,
    preview_url: null,
    config: null,
    interaction: null,
    parameters: [],
    categories: [],
    attributions: [],
    license: null,
    legend: null,
    ...partial,
  };
}

const MTK = () => layer({ slug: 'wd-outdoor-base-mtk', fallback: 'wd-outdoor-base-ofm', order: 1 });
const OFM = () => layer({ slug: 'wd-outdoor-base-ofm', show: false, order: 2 });
const HILL = () =>
  layer({ slug: 'wd-outdoor-base-mtk-hill', is_default: true, order: 0, name: 'Outdoor (relief)' });

const style = (slug: string) => `${API_HOST}/v1/map/styles/${slug}.json?spec=high`;

// ── Suite ───────────────────────────────────────────────────────────────

describe('basemap store — catalog refresh recovery', () => {
  let stores: typeof import('@stores/map/basemap-store');
  let warnSpy: ReturnType<typeof vi.spyOn>;
  // The store registers a document-level visibilitychange listener via
  // useEventListener; without an active scope it is never disposed and
  // EVERY test's store piles another listener onto the shared document —
  // stale stores then race on the hoisted fixtures and the file flakes.
  // Running each store inside an effectScope (stopped in afterEach)
  // makes vueuse dispose the listener with the test.
  let scope: ReturnType<typeof effectScope>;

  beforeAll(async () => {
    stores = await import('@stores/map/basemap-store');
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    setStyleCalls.length = 0;
    storageState.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The user's saved selection is the layer the backend deactivates.
    storageState.set('basemapName', 'wd-outdoor-base-mtk');
    catalogResponse.layers = [HILL(), MTK(), OFM()];
    process.env.WODORE_API_HOST = API_HOST;
    scope = effectScope();
    scope.run(() => stores.useBasemapStore());
    // Cold boot: the saved selection resolves from the catalog and is
    // applied exactly once.
    await vi.waitFor(() => expect(setStyleCalls.length).toBe(1), { timeout: 4000 });
    expect(setStyleCalls[0]!.style).toBe(style('wd-outdoor-base-mtk'));
  });

  afterEach(() => {
    scope?.stop();
    warnSpy.mockRestore();
    delete process.env.WODORE_API_HOST;
  });

  it('keeps the active selection across an unchanged catalog refresh (no re-apply)', async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    // Let the revalidation settle — same style URL → no second setStyle.
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(setStyleCalls.length).toBe(1);
    expect(storageState.get('basemapName')).toBe('wd-outdoor-base-mtk');
  });

  it('switches to the catalog default when the active selection vanished from the catalog', async () => {
    // Backend deactivated the layer — the fresh catalog drops the slug.
    catalogResponse.layers = [HILL(), OFM()];
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(
      () => expect(setStyleCalls.at(-1)?.style).toBe(style('wd-outdoor-base-mtk-hill')),
      // Loaded CI runners need more than the 1s default for the
      // visibilitychange → refresh → fallback chain.
      { timeout: 4000 }
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no longer in the catalog - switching to 'wd-outdoor-base-mtk-hill'")
    );
    // Persisted: the dead selection must not walk the same dead path
    // at the next boot.
    expect(storageState.get('basemapName')).toBe('wd-outdoor-base-mtk-hill');
    // The picker list carries an active default afterwards.
    const active = stores
      .useBasemapStore()
      .basemaps.filter(b => b.active)
      .map(b => b.name);
    expect(active).toEqual(['wd-outdoor-base-mtk-hill']);
  });

  it('falls back to the first remaining basemap when the default vanished too', async () => {
    // Even the default slug left the catalog — the terminal answer is
    // the order-first remaining basemap (same terminal as boot).
    catalogResponse.layers = [
      layer({ slug: 'wd-outdoor-base-ofm-hill', show: false, order: 1 }),
      OFM(),
    ];
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(
      () => expect(setStyleCalls.at(-1)?.style).toBe(style('wd-outdoor-base-ofm-hill')),
      { timeout: 4000 }
    );
  });
});
