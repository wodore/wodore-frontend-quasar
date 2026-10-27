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

// Deterministic capable GPU → weak-GPU raster paths never engage. The
// hoisted promise is MUTABLE so the gpu-tier event tests can hang it
// (detect-timeout race) or vary the result per test.
const { detectGpuResult, DEFAULT_DETECT_RESULT } = vi.hoisted(() => {
  const DEFAULT_DETECT_RESULT = Promise.resolve({ tier: 3, gpu: 'Test GPU', fps: 60 });
  return { detectGpuResult: { value: DEFAULT_DETECT_RESULT }, DEFAULT_DETECT_RESULT };
});
vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: () => detectGpuResult.value,
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

describe('classifyGpuTier — render-profile buckets (shared with the gpu-tier Umami event)', () => {
  // The classification is the single vocabulary behind
  // mapProfileForTier, shouldUseRaster AND the `gpu-tier` analytics
  // event — what gets reported is exactly what the renderer decided.
  // All fallback buckets (non-WebGL, software renderer, unidentifiable
  // GPU, detection failure incl. the detect-timeout race) must stay
  // distinguishable. tier < 0 is decided FIRST — main's capable-failure
  // doctrine: never treat failed detection as weak hardware.

  it('non-webgl: WEBGL_UNSUPPORTED (tier -1), even with a stale gpu string', () => {
    expect(classifyGpuTier({ tier: -1, type: 'WEBGL_UNSUPPORTED' })).toBe('non-webgl');
    expect(classifyGpuTier({ tier: -1, type: 'WEBGL_UNSUPPORTED', gpu: 'stale cache' })).toBe(
      'non-webgl'
    );
  });

  it('detection-failed: every other tier<0 outcome — blocklisted, timeout fallback, fetch failure', () => {
    expect(classifyGpuTier({ tier: -1, type: 'BLOCKLISTED', gpu: 'PowerVR Rogue' })).toBe(
      'detection-failed'
    );
    // the store's GPU-detect timeout race resolves this shape (never cached)
    expect(classifyGpuTier({ tier: -1, type: 'FALLBACK' })).toBe('detection-failed');
    expect(classifyGpuTier({ tier: -1, type: 'BENCHMARK_FETCH_FAILED' })).toBe('detection-failed');
  });

  it('no-gpu-name: tier ≥ 0 without a renderer string', () => {
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
  // Pins the switch mapping after the classifyGpuTier refactor. dpr=3
  // exercises every Math.min cap. ONE deliberate unification vs the
  // historical inline branches: tier<0 WITHOUT a gpu string (benchmark
  // fetch failed, detect timeout) now gets the CAPABLE detection-failed
  // profile — the old !gpu-first order gave it LOWEST while
  // shouldUseRaster already treated it as vector. The timeout shape is
  // never cached, so the cache-fed mapProfileForTier callers rarely
  // see it at all.
  const dpr = 3;
  const LOWEST = {
    pixelRatio: 1,
    fadeDuration: 0,
    maxTileCacheSize: 100,
    maxParallelImageRequests: 8,
  };
  const CAPABLE = {
    pixelRatio: 2, // min(3, 2)
    fadeDuration: 0,
    maxTileCacheSize: 100,
    maxParallelImageRequests: 8,
  };

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
    expect(mapProfileForTier({ tier: -1, type: 'WEBGL_UNSUPPORTED' }, dpr)).toEqual(LOWEST);
    expect(mapProfileForTier({ tier: 2 }, dpr)).toEqual(LOWEST);
    expect(mapProfileForTier({ tier: 3, gpu: 'ANGLE (Google, Vulkan SwiftShader)' }, dpr)).toEqual(
      LOWEST
    );
  });

  it('detection-failed (named, timeout, fetch-failed) → the capable profile', () => {
    expect(mapProfileForTier({ tier: -1, gpu: 'PowerVR Rogue', type: 'BLOCKLISTED' }, dpr)).toEqual(
      CAPABLE
    );
    expect(mapProfileForTier({ tier: -1, type: 'FALLBACK' }, dpr)).toEqual(CAPABLE);
    expect(mapProfileForTier({ tier: -1, type: 'BENCHMARK_FETCH_FAILED' }, dpr)).toEqual(CAPABLE);
  });

  it('weak / medium / high → their historical profiles', () => {
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
    detectGpuResult.value = DEFAULT_DETECT_RESULT;
    vi.mocked(trackWhenUmamiReady).mockClear();
    catalogResponse.layers = [HILL()];
    process.env.WODORE_API_HOST = API_HOST;
  });

  afterEach(() => {
    scope?.stop();
    delete process.env.WODORE_API_HOST;
  });

  const eventCall = async (timeout = 4000): Promise<[string, Record<string, unknown>]> => {
    await vi.waitFor(() => expect(trackWhenUmamiReady).toHaveBeenCalledTimes(1), { timeout });
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
    expect(data).not.toHaveProperty('override');
    // present (value is environment-dependent: happy-dom has no WebGL)
    expect(typeof data.webgl2).toBe('boolean');
  });

  it('fresh detection: source=detected, optional keys absent from the tier are omitted', async () => {
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

  it('cached detection failure: treated as capable (detection-failed → vector, spec high)', async () => {
    // tier < 0 with a NAMED gpu — main's doctrine: a failed detection
    // is NOT weak hardware; raster must stay off (Leaflet-vs-MapLibre
    // and the render profile follow the same capable treatment).
    storageState.set('gpuTier', { tier: -1, gpu: 'PowerVR Rogue GE8320', type: 'BLOCKLISTED' });
    storageState.set('gpuTierTime', Date.now());
    bootStore();
    const [, data] = await eventCall();
    expect(data).toMatchObject({
      tier: -1,
      type: 'BLOCKLISTED',
      classification: 'detection-failed',
      spec: 'high',
      raster: false,
      source: 'cached',
    });
  });

  it('cached weak tier: raster path engaged (weak → spec low)', async () => {
    storageState.set('gpuTier', { tier: 1, gpu: 'Adreno 505', type: 'BENCHMARK' });
    storageState.set('gpuTierTime', Date.now());
    bootStore();
    const [, data] = await eventCall();
    expect(data).toMatchObject({
      tier: 1,
      classification: 'weak',
      spec: 'low',
      raster: true,
      source: 'cached',
    });
  });

  it(
    'detection timeout: capable timeout fallback (source=timeout, detection-failed, vector)',
    { timeout: 12_000 },
    async () => {
      // A hung benchmark fetch (unpkg unreachable) trips the 3.5s
      // GPU-detect timeout race → {tier:-1, type:'FALLBACK'}, uncached.
      detectGpuResult.value = new Promise(() => {});
      bootStore();
      const [, data] = await eventCall(9000);
      expect(data).toMatchObject({
        tier: -1,
        type: 'FALLBACK',
        classification: 'detection-failed',
        source: 'timeout',
        raster: false,
        spec: 'high',
      });
      // the timeout fallback is never cached
      expect(storageState.has('gpuTier')).toBe(false);
    }
  );
});
