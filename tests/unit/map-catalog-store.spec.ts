// @vitest-environment happy-dom
//
// Map catalog store — boot cache + version sync + parameter application.
// The overlay store boots EMPTY (no factories): the catalog renders from
// the persisted layers cache or the network; styles refetch only when a
// layer's `modified` timestamp changes (backend #331).
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { StyleSpecification } from 'maplibre-gl';

const notifyCalls: Array<{ message: string; caption?: string }> = [];

// Fake MapLibre map recording paint/layout/setData calls
const paintCalls: Array<[string, string, unknown]> = [];
const fakeMap = {
  getLayer: (id: string) => ({ id }),
  getSource: () => undefined,
  setPaintProperty: (id: string, prop: string, value: unknown) =>
    paintCalls.push([id, prop, value]),
  setLayoutProperty: () => undefined,
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

const VERSION_A = '2026-10-14T10:00:00+00:00';
const VERSION_B = '2026-10-14T12:00:00+00:00';

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

describe('map catalog store (boot cache + version sync)', () => {
  let stores: typeof import('@stores/map/map-catalog-store');
  let overlayStores: typeof import('@stores/map/overlay-store');

  const overlaysOf = () => {
    const store = overlayStores.useOverlayStore();
    return (store as unknown as { overlays: Array<{ name: string }> }).overlays;
  };

  beforeAll(async () => {
    // The wireBookingsSource helper evaluates Pinia at import time — one
    // pinia must be active BEFORE the dynamic imports.
    setActivePinia(createPinia());
    stores = await import('@stores/map/map-catalog-store');
    overlayStores = await import('@stores/map/overlay-store');
  });

  beforeEach(() => {
    window.localStorage.clear();
    notifyCalls.length = 0;
    styleFetches.length = 0;
    paintCalls.length = 0;
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
    const styleCache = JSON.parse(window.localStorage.getItem('mapCatalogStyleCache')!);
    expect(Object.keys(styleCache).sort()).toEqual([
      'mtb|high|tokenized',
      'transport-stops|high|resolved',
    ]);
    expect(styleCache['mtb|high|tokenized'].modified).toBe(VERSION_A);
  });

  it('warm boot: the persisted cache serves unchanged modified timestamps without refetching', async () => {
    // First session populates the cache
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();
    const firstSessionFetches = styleFetches.length;
    expect(firstSessionFetches).toBeGreaterThan(0);

    // Second session: same modified timestamps — no style fetches at all
    styleFetches.length = 0;
    await store.refreshCatalog({ background: true });
    expect(styleFetches).toHaveLength(0);
    expect(overlaysOf().map(o => o.name)).toEqual(['transport-stops', 'mtb']);
  });

  it('modified change: only the changed layer refetches', async () => {
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();
    styleFetches.length = 0;

    // Fresh catalog: the transport layer bumped, mtb unchanged
    const next = catalogFor(VERSION_A);
    const transport = next.data.find(l => l.slug === 'transport-stops')!;
    transport.modified = VERSION_B;
    catalogFetch.mockResolvedValue(next);
    await store.refreshCatalog({ background: true });

    // Only the transport style was fetched again (resolved mode)
    expect(styleFetches).toHaveLength(1);
    expect(styleFetches[0]).toContain('/v1/map/styles/transport-stops.json');
    expect(styleFetches[0]).toContain('spec=');
    expect(styleFetches[0]).not.toContain('tokenized');
    const styleCache = JSON.parse(window.localStorage.getItem('mapCatalogStyleCache')!);
    expect(styleCache['transport-stops|high|resolved'].modified).toBe(VERSION_B);
    expect(styleCache['mtb|high|tokenized'].modified).toBe(VERSION_A);
  });

  it('missing modified (pre-#331 backend): cached null-modified entries stay valid', async () => {
    catalogFetch.mockResolvedValue(catalogFor(undefined));
    const store = stores.useMapCatalogStore();
    await store.initOverlays();
    styleFetches.length = 0;

    // Same modified-less catalog again → cache serves
    await store.refreshCatalog({ background: true });
    expect(styleFetches).toHaveLength(0);
    // The first modified-bearing catalog invalidates the cache once
    styleFetches.length = 0;
    catalogFetch.mockResolvedValue(catalogFor(VERSION_A));
    await store.refreshCatalog({ background: true });
    expect(styleFetches).toHaveLength(2); // tokenized + resolved
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
    // Track every progressive application the store pushes out.
    const orig = overlayStore.applyCatalogOverlays.bind(overlayStore);
    (
      overlayStore as unknown as { applyCatalogOverlays: (i: never[]) => void }
    ).applyCatalogOverlays = (items: never[]) => {
      applied.push((items as unknown as Array<{ name: string }>).map(i => i.name));
      orig(items as never);
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
    catalogFetch.mockResolvedValue(
      catalogFor(VERSION_A, {
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
      })
    );
    styleFetch.mockImplementation(async (url: string) => {
      if (url.includes('/v1/map/styles/huts.json')) {
        return Promise.resolve({
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
        } as StyleSpecification);
      }
      return Promise.resolve(TRANSPORT_STYLE);
    });
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
    // resolved URL (and never a literal {{date}}). The date-picked
    // transition lives in overlay-huts.spec (single-pinia).
    expect(source?.data).toMatchObject({ type: 'FeatureCollection', features: [] });
    // Occupation layers bake hidden until a date is picked — the
    // availability strip must not render date-less.
    const occupation = huts!.style!.layers.find(l => l.id === 'wd-huts-occupation') as unknown as {
      layout: Record<string, string>;
    };
    expect(occupation.layout['visibility']).toBe('none');
  });
});
