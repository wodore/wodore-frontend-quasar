// @vitest-environment happy-dom
//
// Map catalog store — boot cache + version sync + parameter application.
// The overlay store boots EMPTY (no factories): the catalog renders from
// the persisted layers cache or the network; styles refetch only when a
// layer's `modified` timestamp changes (backend #331).
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { StyleSpecification } from 'maplibre-gl';
import { useHutsStore } from '@stores/huts-store';

const notifyCalls: Array<{ message: string; caption?: string }> = [];

// Fake MapLibre map recording paint/layout/setData calls. The
// wd-bookings source stub is switchable: legacy geojson (setData) or
// Martin vector (setTiles) — the tests flip it per scenario.
const paintCalls: Array<[string, string, unknown]> = [];
const layoutCalls: Array<[string, string, unknown]> = [];
const setDataCalls: Array<unknown> = [];
const setTilesCalls: Array<string[]> = [];
const geojsonBookingsStub = {
  type: 'geojson',
  setData: (data: unknown) => setDataCalls.push(data),
};
const vectorBookingsStub = {
  type: 'vector',
  setTiles: (tiles: string[]) => setTilesCalls.push(tiles),
};
let bookingsSourceStub: Record<string, unknown> = geojsonBookingsStub;
// Minimal event bus: the store binds sourcedata/sourcedataabort for the
// availability loading state — specs emit to drive it.
const mapListeners = new Map<string, Array<(e: unknown) => void>>();
function emitMapEvent(event: string, e: unknown): void {
  for (const fn of mapListeners.get(event) ?? []) fn(e);
}
const fakeMap = {
  on: (event: string, fn: (e: unknown) => void) => {
    mapListeners.set(event, [...(mapListeners.get(event) ?? []), fn]);
  },
  getLayer: (id: string) => ({ id }),
  getSource: (id: string) => (id === 'wd-bookings' ? bookingsSourceStub : undefined),
  setPaintProperty: (id: string, prop: string, value: unknown) =>
    paintCalls.push([id, prop, value]),
  setLayoutProperty: (id: string, prop: string, value: unknown) =>
    layoutCalls.push([id, prop, value]),
  isStyleLoaded: () => true,
};
vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: fakeMap }),
}));

// The basemap store self-initializes (GPU detection, its own picker
// compile) — the catalog store only awaits its GPU-tier promise so one
// shared layers fetch carries the right spec.
vi.mock('@stores/map/basemap-store', () => ({
  useBasemapStore: () => ({ gpuSpecReady: Promise.resolve('high' as const) }),
}));

// Quasar: LocalStorage no-ops under happy-dom; Notify records calls.
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
    Notify: {
      create: (opts: { message: string; caption?: string }) => {
        notifyCalls.push(opts);
      },
    },
  };
});

// The storage service writes through @capacitor/preferences (a no-op
// under happy-dom) — back it with the real DOM storage for assertions.
vi.mock('@services/storage', async () => {
  const { storageGet, storageSet, storageHas, storageRemove } =
    await import('./helpers/storage-mock');
  return { storageGet, storageSet, storageHas, storageRemove };
});

// ── Network mocks: catalog + styles ──────────────────────────────────────

const MTB_TOKENIZED = {
  version: 8,
  sources: {
    'wd-mtb': {
      type: 'raster',
      tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'wd-mtb',
      type: 'raster',
      source: 'wd-mtb',
      paint: { 'raster-opacity': '{{mtb.opacity}}' },
    },
  ],
} as StyleSpecification;

const TRANSPORT_STYLE = {
  version: 8,
  sources: {
    'transport-stops': {
      type: 'geojson',
      data: 'https://example.com/stops.geojson',
      promoteId: 'id',
    },
  },
  layers: [
    {
      id: 'transport-stops',
      type: 'circle',
      source: 'transport-stops',
      paint: { 'circle-color': '#0079C7' },
    },
  ],
} as StyleSpecification;

/** Huts overlay layer + tokenized style: the availability source carries
 *  the {{date}} token (boot-defaulted to today) and an occupation layer
 *  that must bake hidden until a date is picked. */
const HUTS_LAYER: Record<string, unknown> = {
  slug: 'huts',
  role: 'overlay',
  name: 'Huts',
  icon: 'huts',
  icon_badge: '',
  slot: 'ways',
  order: 0,
  show: true,
  is_default: false,
  spec: 'high' as const,
  style_url: '/v1/map/styles/huts.json?spec=high',
  min_zoom: null,
  max_zoom: null,
  coverage_bbox: null,
  fallback_min_zoom: null,
  fallback: null,
  anchors: null,
  preview_url: null,
  config: null,
  interaction: null,
  categories: [],
  attributions: [],
  license: null,
  legend: null,
  parameters: [
    {
      slug: 'date',
      kind: 'date',
      label: 'Availability date',
      description: '',
      default: null,
      constraints: null,
    },
  ],
};
const HUTS_STYLE = {
  version: 8,
  sources: {
    'wd-bookings': {
      type: 'geojson',
      data: 'https://hub.example.com/v1/huts/availability/{{date}}.geojson',
    },
  },
  layers: [
    { id: 'wd-huts', type: 'symbol', source: 'wd-bookings' },
    {
      id: 'wd-huts-occupation',
      type: 'circle',
      source: 'wd-bookings',
      layout: { visibility: 'visible' },
    },
  ],
} as StyleSpecification;

const VERSION_A = '2026-10-14T10:00:00+00:00';

/** A resolved layers envelope (backend #331): `{data, count}`, one
 *  layer per slug with the served spec + spec-resolved style_url. */
const catalogFor = (mtbModified: string | undefined, extraLayer?: Record<string, unknown>) => {
  const layers = [
    {
      slug: 'transport-stops',
      role: 'overlay',
      name: 'Public transport stops',
      description: '',
      icon: 'transport',
      icon_badge: '',
      slot: 'ways',
      order: 2,
      show: true,
      is_default: false,
      spec: 'high' as const,
      style_url: '/v1/map/styles/transport-stops.json?spec=high',
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
      ...(mtbModified !== undefined ? { modified: mtbModified } : {}),
    },
    ...(extraLayer ? [extraLayer as never] : []),
    {
      slug: 'mtb',
      role: 'overlay',
      name: 'Mountain bike routes',
      description: '',
      icon: 'mtb',
      icon_badge: '',
      slot: 'ways',
      order: 4,
      show: true,
      is_default: false,
      spec: 'high' as const,
      style_url: '/v1/map/styles/mtb.json?spec=high',
      min_zoom: null,
      max_zoom: null,
      coverage_bbox: null,
      fallback_min_zoom: null,
      fallback: null,
      anchors: null,
      preview_url: null,
      config: null,
      interaction: null,
      parameters: [
        {
          slug: 'mtb.opacity',
          kind: 'opacity-curve',
          label: 'MTB routes opacity',
          description: '',
          default: ['interpolate', ['linear'], ['zoom'], 8, 0.6, 13, 0.9, 16, 0.7],
          constraints: null,
        },
      ],
      categories: [],
      attributions: [],
      license: null,
      legend: null,
      ...(mtbModified !== undefined ? { modified: mtbModified } : {}),
    },
  ];
  return { data: layers, count: layers.length };
};

const styleFetches: string[] = [];
const catalogFetch = vi.fn();
const slotsFetch = vi.fn();
const styleFetch = vi.fn();

vi.mock('@services/locale', async importOriginal => {
  const actual = await importOriginal<typeof import('@services/locale')>();
  return { ...actual, currentLocale: () => 'en' };
});

vi.mock('@services/map-catalog', async importOriginal => {
  const actual = await importOriginal<typeof import('@services/map-catalog')>();
  return {
    ...actual,
    fetchMapCatalog: (...args: unknown[]) => catalogFetch(...(args as [])),
    fetchMapSlots: (...args: unknown[]) => slotsFetch(...(args as [])),
    fetchMapStyle: (url: string) => {
      styleFetches.push(url);
      return styleFetch(url);
    },
  };
});

describe('map catalog store (layers snapshot + versioned style URLs)', () => {
  let stores: typeof import('@stores/map/map-catalog-store');
  let overlayStores: typeof import('@stores/map/overlay-store');

  const overlaysOf = () => {
    const store = overlayStores.useOverlayStore();
    return (store as unknown as { overlays: Array<{ name: string }> }).overlays;
  };

  beforeAll(async () => {
    // One pinia must be active before the dynamic imports (the overlay
    // utilities resolve stores per call against the active instance).
    setActivePinia(createPinia());
    stores = await import('@stores/map/map-catalog-store');
    overlayStores = await import('@stores/map/overlay-store');
  });

  beforeEach(() => {
    window.localStorage.clear();
    notifyCalls.length = 0;
    styleFetches.length = 0;
    paintCalls.length = 0;
    layoutCalls.length = 0;
    setDataCalls.length = 0;
    setTilesCalls.length = 0;
    bookingsSourceStub = geojsonBookingsStub;
    mapListeners.clear();
    catalogFetch.mockReset();
    slotsFetch.mockReset();
    styleFetch.mockReset();
    catalogFetch.mockReset();
    slotsFetch.mockResolvedValue([
      { slug: 'background', label: 'Background', order: 0 },
      { slug: 'ways', label: 'Ways', order: 1 },
    ]);
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('mode=tokenized')
        ? structuredClone(MTB_TOKENIZED)
        : structuredClone(TRANSPORT_STYLE)
    );
    // Fresh stores per test: a cold-boot failure must not inherit the
    // previous test's applied overlays (the app boots a fresh session).
    setActivePinia(createPinia());
  });

  it('cold boot: fetches the catalog + styles, applies them and persists both', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    expect(store.status).toBe('ready');
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);
    // Persisted: layers snapshot ({savedAt, lang, data}) + one style
    // entry per layer (tokenized for the parameterized layer, resolved
    // for the plain one).
    const persistedLayers = JSON.parse(window.localStorage.getItem('mapLayersCache')!);
    expect(persistedLayers.data).toHaveLength(2);
    expect(persistedLayers.lang).toBe('en');
  });

  it('style fetches use the catalog style_url verbatim (+ mode=tokenized), never client-built URLs', async () => {
    const cat = catalogFor(VERSION_A);
    cat.data[0]!.style_url = '/v1/map/styles/transport-stops.json?spec=medium&v=3114e2da1253';
    cat.data[cat.data.length - 1]!.style_url = '/v1/map/styles/mtb.json?spec=medium&v=9e9ddf24f942';
    catalogFetch.mockResolvedValue(cat);
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    // Non-parameterized layer: the resolved variant, style_url VERBATIM —
    // served spec and immutable version token preserved (backend #434);
    // no client-guessed spec, no dropped token. (endsWith: the spec env
    // absolutizes against the API host — CI serves it root-relative.)
    expect(
      styleFetches.some(u =>
        u.endsWith('/v1/map/styles/transport-stops.json?spec=medium&v=3114e2da1253')
      )
    ).toBe(true);
    // Parameterized layer (mtb): the tokenized sibling — `mode=tokenized`
    // appended to the SAME canonical URL so the v token rides along and
    // the variant caches immutable.
    expect(
      styleFetches.some(u =>
        u.endsWith('/v1/map/styles/mtb.json?spec=medium&v=9e9ddf24f942&mode=tokenized')
      )
    ).toBe(true);
  });

  it('a layer without style_url is skipped loudly (no fetch, no crash)', async () => {
    const cat = catalogFor(VERSION_A);
    (cat.data[0] as { style_url: string | null }).style_url = null; // transport-stops
    catalogFetch.mockResolvedValue(cat);
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    // Only mtb's style was fetched; the broken layer dropped with a
    // user-visible notice, the rest of the catalog still compiled.
    expect(styleFetches).toHaveLength(1);
    expect(notifyCalls.length).toBeGreaterThan(0);
    expect(store.status).toBe('ready');
    expect(overlaysOf().map(o => o.name)).toEqual(['mtb']);
  });

  it('warm boot: the refresh refetches styles through the SAME immutable URLs (browser-cache hits)', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();
    const firstFetches = [...styleFetches].sort();
    expect(firstFetches.length).toBeGreaterThan(0);

    // No local style persistence anymore: every compile fetches again —
    // through the identical versioned URLs, which is what makes the
    // repeat fetch a free browser disk-cache hit in production.
    styleFetches.length = 0;
    await store.refreshCatalog({ background: true });
    expect([...styleFetches].sort()).toEqual(firstFetches);
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);
  });

  it('boot purges the retired localStorage style caches once', async () => {
    window.localStorage.setItem('mapCatalogStyleCache', '{"stale":1}');
    window.localStorage.setItem('basemapStyleCache', '{"stale":1}');
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();
    expect(window.localStorage.getItem('mapCatalogStyleCache')).toBeNull();
    expect(window.localStorage.getItem('basemapStyleCache')).toBeNull();
  });

  it('cold boot failure: error status + user-visible notice, no overlays', async () => {
    catalogFetch.mockRejectedValue(new Error('network down'));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    expect(store.status).toBe('error');
    expect(overlaysOf()).toHaveLength(0);
    expect(notifyCalls.length).toBeGreaterThan(0);
  });

  it('invalid served style: the layer is skipped with a loud notice', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    styleFetch.mockImplementation(async (url: string) => {
      if (url.includes('transport-stops')) {
        // Invalid: zoom expression nested inside a product (the seeded
        // huts bug class) — MapLibre rejects it at addLayer.
        const broken = structuredClone(TRANSPORT_STYLE);
        (broken.layers[0] as unknown as { layout: Record<string, unknown> }).layout = {
          'icon-size': ['*', 1, ['interpolate', ['linear'], ['zoom'], 7, 0.1, 20, 2]],
        };
        return broken;
      }
      return url.includes('mode=tokenized')
        ? structuredClone(MTB_TOKENIZED)
        : structuredClone(TRANSPORT_STYLE);
    });
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    expect(overlaysOf().map(o => o.name)).toEqual(['mtb']);
    expect(notifyCalls.some(n => n.message === 'Public transport stops')).toBe(true);
  });

  it('metadata-first: placeholder rows apply before styles resolve; skipped layers drop', async () => {
    // mtb's style fetch hangs until released; transport resolves instantly.
    let releaseMtb: (() => void) | undefined;
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    styleFetch.mockImplementation(async (url: string) => {
      if (url.includes('mtb')) {
        await new Promise<void>(resolve => {
          releaseMtb = resolve;
        });
      }
      return url.includes('mode=tokenized')
        ? structuredClone(MTB_TOKENIZED)
        : structuredClone(TRANSPORT_STYLE);
    });

    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    const applied: string[][] = [];
    // Track every progressive application the store pushes out. The opts
    // are FORWARDED (review nit, PR #357): dropping them would silently
    // default bumpEpoch to true and stop this test from validating the
    // metadata-first emit's epoch suppression.
    const orig = overlayStore.applyCatalogOverlays.bind(overlayStore);
    (
      overlayStore as unknown as {
        applyCatalogOverlays: (i: never[], opts?: { bumpEpoch?: boolean }) => void;
      }
    ).applyCatalogOverlays = (items: never[], opts?: { bumpEpoch?: boolean }) => {
      applied.push((items as unknown as Array<{ name: string }>).map(i => i.name));
      orig(items as never, opts);
    };

    const initDone = store.initOverlays();
    // Let the catalog + instant transport style settle, mtb still pending.
    await new Promise(resolve => setTimeout(resolve, 30));

    // Metadata-first: BOTH rows exist already (mtb as a placeholder with
    // an empty style) — the menu never waits on the style endpoint.
    expect(applied.length).toBeGreaterThan(0);
    const firstNames = [...applied[0]!].sort();
    expect(firstNames).toEqual(['mtb', 'transport-stops']);
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);

    releaseMtb?.();
    await initDone;
    // Final list: both layers with real styles (placeholder replaced).
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);
    const mtb = overlaysOf().find(o => o.name === 'mtb') as { tokenizedStyle?: unknown };
    expect(mtb.tokenizedStyle).toBeTruthy();
  });

  it('boot priority: ACTIVE overlay styles fetch first; only their arrival bumps the swap epoch', async () => {
    window.localStorage.setItem(
      'overlays',
      JSON.stringify([
        { name: 'transport-stops', active: false, show: true },
        { name: 'mtb', active: true, show: true },
      ])
    );
    let releaseTransport: (() => void) | undefined;
    let releaseMtb: (() => void) | undefined;
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    styleFetch.mockImplementation(async (url: string) => {
      await new Promise<void>(resolve => {
        if (url.includes('mtb')) releaseMtb = resolve;
        else releaseTransport = resolve;
      });
      return url.includes('mode=tokenized')
        ? structuredClone(MTB_TOKENIZED)
        : structuredClone(TRANSPORT_STYLE);
    });

    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    const epochBefore = overlayStore.overlaysEpoch;
    const initDone = store.initOverlays();
    await new Promise(resolve => setTimeout(resolve, 20));

    // Only the ACTIVE layer's style endpoint fetched so far — the
    // inactive wave waits for the active one (reveal-path priority).
    expect(styleFetches).toHaveLength(1);
    expect(styleFetches[0]).toContain('mtb');
    // The metadata-first placeholder emit is a menu-only update: no epoch.
    expect(overlayStore.overlaysEpoch - epochBefore).toBe(0);

    releaseMtb?.();
    await new Promise(resolve => setTimeout(resolve, 20));
    // Active wave settled → reveal latch open with ONE epoch bump, while
    // the inactive wave (transport-stops) is still pending.
    expect(store.mapStylesReady).toBe(true);
    expect(overlayStore.overlaysEpoch - epochBefore).toBe(1);
    expect(store.status).not.toBe('ready');

    releaseTransport?.();
    await initDone;
    expect(store.status).toBe('ready');
    // Inactive arrivals are menu-only: never another epoch bump.
    expect(overlayStore.overlaysEpoch - epochBefore).toBe(1);
  });

  it('mapStylesReady settles even when an ACTIVE overlay style fails (skip, not hang)', async () => {
    window.localStorage.setItem(
      'overlays',
      JSON.stringify([
        { name: 'transport-stops', active: false, show: true },
        { name: 'mtb', active: true, show: true },
      ])
    );
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    let releaseTransport: (() => void) | undefined;
    styleFetch.mockImplementation(async (url: string) => {
      if (url.includes('mtb')) throw new Error('style endpoint down');
      await new Promise<void>(resolve => {
        releaseTransport = resolve;
      });
      return structuredClone(TRANSPORT_STYLE);
    });

    const store = stores.useMapCatalogStore();
    const initDone = store.initOverlays();
    await new Promise(resolve => setTimeout(resolve, 20));

    // The active layer failed → skipped loudly (notice + dropped row),
    // but the reveal latch still settles: failure counts, the reveal
    // must never hang on a dead style endpoint.
    expect(store.mapStylesReady).toBe(true);
    expect(notifyCalls.length).toBeGreaterThan(0);
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops']);

    releaseTransport?.();
    await initDone;
    expect(store.status).toBe('ready');
    expect(store.mapStylesReady).toBe(true);
  });

  it('resolveActiveSlugs mirrors the state applyCatalogOverlays adopts (persisted + fresh-install)', async () => {
    window.localStorage.setItem(
      'overlays',
      JSON.stringify([{ name: 'mtb', active: true, show: true }])
    );
    const overlayStore = overlayStores.useOverlayStore();
    const names = ['transport-stops', 'mtb', 'huts'];
    // Seed the active-group view EXPLICITLY (review nit, PR #357): the
    // default group shipping 'huts' made the expectation below implicit —
    // a default change would break this test cryptically.
    const activeGroup = overlayStore.groupSettings.groups.find(
      g => g.id === overlayStore.groupSettings.activeGroupId
    );
    if (activeGroup) activeGroup.activeLayerSlugs = ['huts'];

    // First application (live empty): persisted flags win; unknown slugs
    // fall to the active-group view seeded above.
    const resolved = overlayStore.resolveActiveSlugs(names);
    expect([...resolved].sort()).toEqual(['huts', 'mtb']);

    // After the apply, the live actives equal the pre-resolved set — the
    // compile's fetch order and epoch signal can rely on it.
    overlayStore.applyCatalogOverlays(
      names.map(n => ({ name: n, label: n, active: false, show: true })) as never
    );
    const liveActive = (
      overlayStore.overlays as unknown as Array<{ name: string; active?: boolean }>
    )
      .filter(o => o.active)
      .map(o => o.name)
      .sort();
    expect(liveActive).toEqual([...resolved].sort());
  });

  it('locale rebuild: active arrivals bump the epoch once; a failed rebuild keeps overlays (silent fallback)', async () => {
    window.localStorage.setItem(
      'overlays',
      JSON.stringify([
        { name: 'transport-stops', active: false, show: true },
        { name: 'mtb', active: true, show: true },
      ])
    );
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    await store.initOverlays();
    expect(store.status).toBe('ready');
    const epochAfterBoot = overlayStore.overlaysEpoch;
    const fetchesAfterBoot = styleFetches.length;

    // Locale rebuild with unchanged `modified`: every style refetches
    // through its immutable URL (browser disk-cache hit in production) —
    // the ACTIVE layer's arrival bumps the epoch once, the inactive
    // layer's does not.
    await store.rebuildOverlaysFromCatalog();
    expect(overlayStore.overlaysEpoch - epochAfterBoot).toBe(1);
    expect(styleFetches).toHaveLength(2 * fetchesAfterBoot);

    // A failing rebuild is silent by design: overlays stay, status and
    // the reveal latch stay ready (review finding PR #357).
    catalogFetch.mockRejectedValue(new Error('locale fetch down'));
    await store.rebuildOverlaysFromCatalog();
    expect(store.status).toBe('ready');
    expect(store.mapStylesReady).toBe(true);
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);
    expect(overlayStore.overlaysEpoch - epochAfterBoot).toBe(1);
  });

  it('overlay toggled ON mid-compile bumps the epoch when its style arrives', async () => {
    // No persisted overlay state: both layers start inactive, so both
    // ride the background wave (empty active wave → latch open early).
    let releaseTransport: (() => void) | undefined;
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    styleFetch.mockImplementation(async (url: string) => {
      if (!url.includes('mtb')) {
        await new Promise<void>(resolve => {
          releaseTransport = resolve;
        });
      }
      return url.includes('mode=tokenized')
        ? structuredClone(MTB_TOKENIZED)
        : structuredClone(TRANSPORT_STYLE);
    });

    const store = stores.useMapCatalogStore();
    const overlayStore = overlayStores.useOverlayStore();
    const initDone = store.initOverlays();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(store.mapStylesReady).toBe(true);
    const epochBefore = overlayStore.overlaysEpoch;

    // User toggles the pending placeholder row ON while its style is
    // still in flight — the arrival now IS map content: the live-state
    // re-check in the compile bumps the epoch (review finding PR #357).
    const row = (
      overlayStore.overlays as unknown as Array<{
        name: string;
        active: boolean;
        show: boolean;
      }>
    ).find(o => o.name === 'transport-stops')!;
    overlayStore.toggleOverlay(row as never);
    expect(row.active).toBe(true);

    releaseTransport?.();
    await initDone;
    expect(overlayStore.overlaysEpoch - epochBefore).toBe(1);
  });

  it('parameter overrides apply live from the tokenized cache (no style reload)', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    const curve = {
      stops: [
        { zoom: 8, opacity: 0 },
        { zoom: 13, opacity: 0.5 },
        { zoom: 16, opacity: 1 },
      ],
    };
    paintCalls.length = 0;
    store.setParameterValue('mtb', 'mtb.opacity', curve);

    expect(paintCalls).toHaveLength(1);
    const [layerId, prop, value] = paintCalls[0]!;
    expect(layerId).toBe('wd-mtb');
    expect(prop).toBe('raster-opacity');
    expect(value).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.5, 16, 1]);
    // Persisted to the parameter preferences
    const prefs = JSON.parse(window.localStorage.getItem('mapParameterValues')!);
    expect(prefs.mtb['mtb.opacity']).toEqual(curve);
  });

  it('date params default to today at boot and the bookings source is wired to the live store geojson — no URL fetch, no {{date}}', async () => {
    // Staging incident 2026-10-16: the huts overlay's wd-bookings
    // geojson source carried {{date}} (tokenized) and no runtime value
    // was set until the user picked a date — MapLibre fetched
    // /v1/huts/availability/{{date}}.geojson (404/500 retries). The
    // boot default resolves the token, and the source wiring replaces
    // the URL with the huts store's live object (auth/lang/days flow).
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('/v1/map/styles/huts.json')
        ? Promise.resolve(structuredClone(HUTS_STYLE))
        : Promise.resolve(TRANSPORT_STYLE)
    );
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    const overlays = (
      overlayStores.useOverlayStore() as unknown as {
        overlays: Array<{ name: string; style?: StyleSpecification }>;
      }
    ).overlays;
    const huts = overlays.find(o => o.name === 'huts');
    expect(huts).toBeTruthy();
    const source = (huts!.style!.sources as Record<string, { data?: unknown }>)['wd-bookings'];
    // Wired to the huts store's live geojson OBJECT — never the
    // resolved URL (and never a literal {{date}}).
    expect(source?.data).toMatchObject({ type: 'FeatureCollection', features: [] });
    // Occupation layers bake hidden until a date is picked — the
    // availability strip must not render date-less.
    const occupation = huts!.style!.layers.find(l => l.id === 'wd-huts-occupation') as unknown as {
      layout: Record<string, string>;
    };
    expect(occupation.layout['visibility']).toBe('none');
  });

  it('date pick re-resolves {{date}} but keeps the bookings source on the live object and applies the date gate live', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('/v1/map/styles/huts.json')
        ? Promise.resolve(structuredClone(HUTS_STYLE))
        : Promise.resolve(TRANSPORT_STYLE)
    );
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    const overlays = (
      overlayStores.useOverlayStore() as unknown as {
        overlays: Array<{ name: string; style?: StyleSpecification; active?: boolean }>;
      }
    ).overlays;
    const huts = overlays.find(o => o.name === 'huts');
    expect(huts).toBeTruthy();
    // Overlay switched on: the live visibility may follow the date.
    huts!.active = true;
    layoutCalls.length = 0;

    useHutsStore().selectedDate = '2026-10-20';
    await nextTick();

    // The re-resolved style keeps riding the live object — the resolved
    // URL (…/2026-10-20.geojson) must NOT be pushed onto the source
    // (the URL-skip in applyOverlayParameters + synchronous fixup
    // replaced the former per-style watcher wiring).
    const source = (huts!.style!.sources as Record<string, { data?: unknown }>)['wd-bookings'];
    expect(source?.data).toMatchObject({ type: 'FeatureCollection' });
    // Occupation layer baked visible in the re-resolved spec …
    const occupation = huts!.style!.layers.find(l => l.id === 'wd-huts-occupation') as unknown as {
      layout: Record<string, string>;
    };
    expect(occupation.layout['visibility']).toBe('visible');
    // … and applied to the live map.
    expect(layoutCalls).toContainEqual(['wd-huts-occupation', 'visibility', 'visible']);

    // Bookings data arrival pushes the live object through the ONE
    // store-level watch (no per-style wiring to leak).
    setDataCalls.length = 0;
    const hutsStore = useHutsStore();
    hutsStore.bookingsGeojson = {
      type: 'FeatureCollection',
      features: [],
    } as unknown as typeof hutsStore.bookingsGeojson;
    await nextTick();
    expect(setDataCalls).toHaveLength(1);
    expect(setDataCalls[0]).toMatchObject({ type: 'FeatureCollection' });
  });

  it('date pick hot-swaps a vector bookings source\u2019s tile URLs via setTiles', async () => {
    // Martin `availability` vector source (backend #341): tile URLs
    // carry the {{date}} token; the runtime date re-resolve pushes the
    // resolved URLs onto the live source instead of any geojson data.
    const vectorStyle = structuredClone(HUTS_STYLE);
    vectorStyle.sources['wd-bookings'] = {
      type: 'vector',
      tiles: ['https://tiles.example.com/availability/{z}/{x}/{y}?date={{date}}&days=4'],
    };
    // Vector sources need a source-layer on every layer (MapLibre
    // validation rejects the style otherwise).
    for (const layer of vectorStyle.layers) {
      (layer as Record<string, unknown>)['source-layer'] = 'availability';
    }
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('/v1/map/styles/huts.json')
        ? Promise.resolve(vectorStyle)
        : Promise.resolve(TRANSPORT_STYLE)
    );
    bookingsSourceStub = vectorBookingsStub;
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    useHutsStore().selectedDate = '2026-10-20';
    await nextTick();
    expect(setTilesCalls).toHaveLength(1);
    expect(setTilesCalls[0]).toEqual([
      'https://tiles.example.com/availability/{z}/{x}/{y}?date=2026-10-20&days=4',
    ]);
    // The vector path never touches the geojson bridge.
    expect(setDataCalls).toHaveLength(0);
  });

  it('a selected date that predates the store still resolves into the tile URLs (boot order)', async () => {
    // Staging incident 2026-10-27: WdSelectDate restores the date from
    // the ?date= query at layout mount, while this store is only created
    // when the idle-gated async WdMapView mounts. A non-immediate mirror
    // watch never fired for the pre-existing value, runtimeValues stayed
    // empty, and the wd-bookings tiles kept the today boot default — the
    // map showed the wrong date's availability while the pill showed the
    // picked date. The mirror watch must seed from the current value.
    const vectorStyle = structuredClone(HUTS_STYLE);
    vectorStyle.sources['wd-bookings'] = {
      type: 'vector',
      tiles: ['https://tiles.example.com/availability/{z}/{x}/{y}.mlt?date={{date}}&days=4'],
    };
    for (const layer of vectorStyle.layers) {
      (layer as Record<string, unknown>)['source-layer'] = 'availability';
    }
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('/v1/map/styles/huts.json')
        ? Promise.resolve(vectorStyle)
        : Promise.resolve(TRANSPORT_STYLE)
    );
    bookingsSourceStub = vectorBookingsStub;

    // The date is set BEFORE the catalog store exists (boot order:
    // WdSelectDate restore → async map mount → this store).
    useHutsStore().selectedDate = '31.10.2026';
    await nextTick();
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    // The runtime date seeds from the pre-existing value …
    expect(store.runtimeValues.date).toBe('2026-10-31');
    // … and the compiled overlay's tile URLs carry the PICKED date, not
    // the today boot default.
    const overlays = (
      overlayStores.useOverlayStore() as unknown as {
        overlays: Array<{ name: string; style?: StyleSpecification }>;
      }
    ).overlays;
    const huts = overlays.find(o => o.name === 'huts');
    const source = (huts!.style!.sources as Record<string, { tiles?: string[] }>)['wd-bookings'];
    expect(source?.tiles).toEqual([
      'https://tiles.example.com/availability/{z}/{x}/{y}.mlt?date=2026-10-31&days=4',
    ]);
  });

  it('runs the date-load spinner until the source settles, min 600ms', async () => {
    vi.useFakeTimers();
    try {
      const vectorStyle = structuredClone(HUTS_STYLE);
      vectorStyle.sources['wd-bookings'] = {
        type: 'vector',
        tiles: ['https://tiles.example.com/availability/{z}/{x}/{y}?date={{date}}&days=4'],
      };
      for (const layer of vectorStyle.layers) {
        (layer as Record<string, unknown>)['source-layer'] = 'availability';
      }
      catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
      styleFetch.mockImplementation(async (url: string) =>
        url.includes('/v1/map/styles/huts.json')
          ? Promise.resolve(vectorStyle)
          : Promise.resolve(TRANSPORT_STYLE)
      );
      bookingsSourceStub = vectorBookingsStub;
      const store = stores.useMapCatalogStore();
      await store.initOverlays();

      // Date pick → tiles swap → spinner starts immediately.
      useHutsStore().selectedDate = '2026-10-20';
      await nextTick();
      expect(store.availabilityLoading).toBe(true);

      // Source settles fast (empty tiles load instantly) — the 600ms
      // minimum still holds the spinner.
      emitMapEvent('sourcedata', { sourceId: 'wd-bookings', isSourceLoaded: true });
      vi.advanceTimersByTime(300);
      expect(store.availabilityLoading).toBe(true);
      vi.advanceTimersByTime(400);
      expect(store.availabilityLoading).toBe(false);

      // Events from other sources never settle the spinner.
      useHutsStore().selectedDate = '2026-10-21';
      await nextTick();
      expect(store.availabilityLoading).toBe(true);
      emitMapEvent('sourcedata', { sourceId: 'wd-huts', isSourceLoaded: true });
      vi.advanceTimersByTime(300);
      expect(store.availabilityLoading).toBe(true);

      // …only the wd-bookings settle does.
      emitMapEvent('sourcedata', { sourceId: 'wd-bookings', isSourceLoaded: true });
      vi.advanceTimersByTime(400);
      expect(store.availabilityLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes picker and deep-link date formats to ISO in tile URLs', async () => {
    // The huts store carries DD.MM.YY from the picker and DD.MM.YYYY
    // from the ?date= deep link; the availability tile function only
    // accepts ISO dates (anything else is an intentional empty tile).
    const vectorStyle = structuredClone(HUTS_STYLE);
    vectorStyle.sources['wd-bookings'] = {
      type: 'vector',
      tiles: ['https://tiles.example.com/availability/{z}/{x}/{y}?date={{date}}&days=4'],
    };
    for (const layer of vectorStyle.layers) {
      (layer as Record<string, unknown>)['source-layer'] = 'availability';
    }
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A, HUTS_LAYER));
    styleFetch.mockImplementation(async (url: string) =>
      url.includes('/v1/map/styles/huts.json')
        ? Promise.resolve(vectorStyle)
        : Promise.resolve(TRANSPORT_STYLE)
    );
    bookingsSourceStub = vectorBookingsStub;
    const store = stores.useMapCatalogStore();
    await store.initOverlays();

    // Picker format (DD.MM.YY)
    useHutsStore().selectedDate = '31.10.26';
    await nextTick();
    expect(setTilesCalls.at(-1)).toEqual([
      'https://tiles.example.com/availability/{z}/{x}/{y}?date=2026-10-31&days=4',
    ]);

    // Deep-link format (DD.MM.YYYY)
    useHutsStore().selectedDate = '01.11.2026';
    await nextTick();
    expect(setTilesCalls.at(-1)).toEqual([
      'https://tiles.example.com/availability/{z}/{x}/{y}?date=2026-11-01&days=4',
    ]);

    // Garbage clears the runtime value — the token falls back to its
    // boot default (today), never a broken/picker-format tile URL.
    useHutsStore().selectedDate = 'sommer';
    await nextTick();
    const huts = (
      overlayStores.useOverlayStore() as unknown as {
        overlays: Array<{ style?: StyleSpecification }>;
      }
    ).overlays.find(o => o.name === 'huts');
    expect(JSON.stringify(huts?.style?.sources['wd-bookings'])).toMatch(
      /date=\d{4}-\d{2}-\d{2}&days=4/
    );
  });
});
