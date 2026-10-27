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
import { classifyGpuTier, mapProfileForTier } from '@stores/map/basemap-store';
import { trackWhenUmamiReady } from '@services/analytics';

// Capture (not perform) the gpu-tier telemetry: the store under test
// calls trackWhenUmamiReady — the deferred-fire behavior itself is
// covered by analytics.spec.ts.
vi.mock('@services/analytics', () => ({
  default: vi.fn(),
  umamiOptedOut: () => false,
  trackWhenUmamiReady: vi.fn(),
}));

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

describe('basemap store — persisted style SWR', () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => styleDoc }));
  let scope: ReturnType<typeof effectScope> | null = null;
  let stores: typeof import('@stores/map/basemap-store');

  beforeAll(async () => {
    stores = await import('@stores/map/basemap-store');
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    setStyleCalls.length = 0;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    storageState.clear();
    storageState.set('basemapName', 'wd-outdoor-base-mtk');
    catalogResponse.layers = [HILL(), MTK(), OFM()];
    process.env.WODORE_API_HOST = API_HOST;
    scope = effectScope();
    scope.run(() => stores.useBasemapStore());
  });

  afterEach(() => {
    scope?.stop();
    delete process.env.WODORE_API_HOST;
    vi.unstubAllGlobals();
  });

  it('boot applies a persisted style without awaiting the network', async () => {
    // Seed the persisted cache for the ACTIVE style URL exactly as a
    // previous warm boot would have left it.
    storageState.set('basemapStyleCache', {
      [style('wd-outdoor-base-mtk')]: { savedAt: new Date().toISOString(), style: styleDoc },
    });
    fetchMock.mockClear();

    await vi.waitFor(() => expect(setStyleCalls.length).toBe(1), { timeout: 4000 });
    expect(setStyleCalls[0]!.style).toBe(style('wd-outdoor-base-mtk'));
    // The network revalidate still runs in the background (SWR), but
    // the boot NEVER waited for it: the style was on the map before
    // the fetch response resolved.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('persists a fetched style for the next warm boot', async () => {
    await vi.waitFor(() => expect(setStyleCalls.length).toBe(1), { timeout: 4000 });
    const cache = storageState.get('basemapStyleCache') as Record<string, { style: unknown }>;
    const key = style('wd-outdoor-base-mtk');
    expect(cache[key]).toBeDefined();
    expect(cache[key]!.style).toEqual(styleDoc);
  });
});

describe('classifyGpuTier — render-profile buckets (shared with the gpu-tier Umami event)', () => {
  // The classification is the single vocabulary behind
  // mapProfileForTier, shouldUseRaster AND the `gpu-tier` analytics
  // event — what gets reported is exactly what the renderer decided.
  // All fallback buckets (non-WebGL, software renderer, unidentifiable
  // GPU, detection failure) must stay distinguishable.

  it('non-webgl: detect-gpu WEBGL_UNSUPPORTED outranks everything', () => {
    expect(classifyGpuTier({ tier: -1, type: 'WEBGL_UNSUPPORTED' })).toBe('non-webgl');
    // even with a (stale) gpu string — the type is authoritative
    expect(classifyGpuTier({ tier: 3, type: 'WEBGL_UNSUPPORTED', gpu: 'Some GPU' })).toBe(
      'non-webgl'
    );
  });

  it('no-gpu-name: unidentifiable GPU without a renderer string', () => {
    expect(classifyGpuTier({ tier: 1, type: 'BENCHMARK' })).toBe('no-gpu-name');
    expect(classifyGpuTier({ tier: 3, type: 'FALLBACK', gpu: null })).toBe('no-gpu-name');
    // the trimmed cached shape ({ tier }) classifies the same way
    expect(classifyGpuTier({ tier: 2 })).toBe('no-gpu-name');
  });

  it('software-renderer: known software rasterizers', () => {
    expect(classifyGpuTier({ tier: 3, gpu: 'ANGLE (Google, Vulkan SwiftShader)' })).toBe(
      'software-renderer'
    );
    expect(classifyGpuTier({ tier: 0, gpu: 'llvmpipe (Mesa)' })).toBe('software-renderer');
  });

  it('detection-failed: named GPU the benchmarks could not classify', () => {
    expect(classifyGpuTier({ tier: -1, type: 'BLOCKLISTED', gpu: 'PowerVR Rogue' })).toBe(
      'detection-failed'
    );
  });

  it('weak / medium / high by tier', () => {
    expect(classifyGpuTier({ tier: 0, gpu: 'Mali-400' })).toBe('weak');
    expect(classifyGpuTier({ tier: 1, gpu: 'Adreno 505' })).toBe('weak');
    expect(classifyGpuTier({ tier: 2, gpu: 'Iris Plus' })).toBe('medium');
    expect(classifyGpuTier({ tier: 3, gpu: 'RTX 4080' })).toBe('high');
  });

  it('software names match case-insensitively', () => {
    expect(classifyGpuTier({ tier: 3, gpu: 'SwiftShader' })).toBe('software-renderer');
  });
});

describe('mapProfileForTier — class → render profile table (refactor lock)', () => {
  // Pins the switch mapping after the classifyGpuTier refactor — the
  // profiles must stay exactly what the historical inline branches
  // returned. dpr=3 exercises every Math.min cap.
  const dpr = 3;
  const LOWEST = { pixelRatio: 1, fadeDuration: 0, maxTileCacheSize: 100, maxParallelImageRequests: 8 };

  it('null (first visit, no cached tier) → HIGH defaults', () => {
    expect(mapProfileForTier(null, dpr)).toEqual({
      pixelRatio: 3,
      fadeDuration: 300,
      maxTileCacheSize: 400,
      maxParallelImageRequests: 32,
    });
  });

  it('degraded buckets → lowest-spec profile', () => {
    // non-webgl, no-gpu-name (incl. the trimmed cached {tier} shape),
    // software-renderer — all cap at pixelRatio 1
    expect(mapProfileForTier({ tier: 3, type: 'WEBGL_UNSUPPORTED' }, dpr)).toEqual(LOWEST);
    expect(mapProfileForTier({ tier: 2 }, dpr)).toEqual(LOWEST);
    expect(mapProfileForTier({ tier: 3, gpu: 'ANGLE (Google, Vulkan SwiftShader)' }, dpr)).toEqual(
      LOWEST
    );
  });

  it('detection-failed / weak / medium / high → their historical profiles', () => {
    expect(mapProfileForTier({ tier: -1, gpu: 'PowerVR Rogue', type: 'BLOCKLISTED' }, dpr)).toEqual({
      pixelRatio: 2, // min(3, 2)
      fadeDuration: 0,
      maxTileCacheSize: 100,
      maxParallelImageRequests: 8,
    });
    expect(mapProfileForTier({ tier: 1, gpu: 'Adreno 505' }, dpr)).toEqual({
      pixelRatio: 1.5, // min(3, 1.5)
      fadeDuration: 0,
      maxTileCacheSize: 100,
      maxParallelImageRequests: 8,
    });
    expect(mapProfileForTier({ tier: 2, gpu: 'Iris Plus' }, dpr)).toEqual({
      pixelRatio: 2, // min(3, 2)
      fadeDuration: 300,
      maxTileCacheSize: 200,
      maxParallelImageRequests: 16,
    });
    expect(mapProfileForTier({ tier: 3, gpu: 'RTX 4080' }, dpr)).toEqual({
      pixelRatio: 3, // uncapped
      fadeDuration: 300,
      maxTileCacheSize: 400,
      maxParallelImageRequests: 32,
    });
  });
});

describe('basemap store — gpu-tier Umami event (runBasemapInit wiring)', () => {
  let stores: typeof import('@stores/map/basemap-store');
  let scope: ReturnType<typeof effectScope>;

  beforeAll(async () => {
    stores = await import('@stores/map/basemap-store');
  });

  const bootStore = () => {
    scope = effectScope();
    scope.run(() => stores.useBasemapStore());
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    setStyleCalls.length = 0;
    storageState.clear();
    vi.mocked(trackWhenUmamiReady).mockClear();
    catalogResponse.layers = [HILL()];
    process.env.WODORE_API_HOST = API_HOST;
  });

  afterEach(() => {
    scope?.stop();
    delete process.env.WODORE_API_HOST;
  });

  const eventCall = async (): Promise<[string, Record<string, unknown>]> => {
    await vi.waitFor(() => expect(trackWhenUmamiReady).toHaveBeenCalledTimes(1), { timeout: 4000 });
    return vi.mocked(trackWhenUmamiReady).mock.calls[0]! as [string, Record<string, unknown>];
  };

  it('cached high tier: reports the bucket fields, never the raw gpu string', async () => {
    storageState.set('gpuTier', {
      tier: 3,
      gpu: 'Test GPU',
      type: 'BENCHMARK',
      fps: 60,
      isMobile: false,
    });
    storageState.set('gpuTierTime', Date.now());
    bootStore();
    const [name, data] = await eventCall();
    expect(name).toBe('gpu-tier');
    expect(data).toMatchObject({
      tier: 3,
      type: 'BENCHMARK',
      classification: 'high',
      spec: 'high',
      raster: false,
      source: 'cached',
      fps: 60,
      isMobile: false,
    });
    // privacy (review decision): the unmasked renderer string is a
    // fingerprinting vector — it must not be transmitted
    expect(data).not.toHaveProperty('gpu');
    // present (value is environment-dependent: happy-dom has no WebGL)
    expect(typeof data.webgl2).toBe('boolean');
  });

  it('fresh detection: source=detected, optional keys absent from a stale/mocked tier are omitted', async () => {
    // no cached tier → the getGPUTier mock runs; it returns neither
    // `type` nor `isMobile` — those keys must be ABSENT, not undefined
    bootStore();
    const [name, data] = await eventCall();
    expect(name).toBe('gpu-tier');
    expect(data).toMatchObject({
      tier: 3,
      classification: 'high',
      source: 'detected',
      raster: false,
      spec: 'high',
      fps: 60,
    });
    expect(data).not.toHaveProperty('type');
    expect(data).not.toHaveProperty('isMobile');
    expect(data).not.toHaveProperty('gpu');
  });

  it('cached detection failure: raster fallback engaged (detection-failed → spec low)', async () => {
    // tier < 0 with a NAMED gpu: the subtlest shouldUseRaster case —
    // old logic sent it to raster via tier < 2; the classification
    // path must keep it there.
    storageState.set('gpuTier', { tier: -1, gpu: 'PowerVR Rogue GE8320', type: 'BLOCKLISTED' });
    storageState.set('gpuTierTime', Date.now());
    bootStore();
    const [, data] = await eventCall();
    expect(data).toMatchObject({
      tier: -1,
      type: 'BLOCKLISTED',
      classification: 'detection-failed',
      spec: 'low',
      raster: true,
      source: 'cached',
    });
  });
});
