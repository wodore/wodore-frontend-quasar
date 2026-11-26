// @vitest-environment happy-dom
//
// Basemap store — basemap presence ↔ interactive overlay contract
// (backend #506) on the REAL transformStyle and the country-fallback
// sweep.
//
// The backend composes passive presence layers (wd-basemap-<family>-*)
// into every wodore vector basemap; an ACTIVE overlay of the family
// replaces them (never doubled icons) and renders below the keeper
// labels (major cities + peaks paint over the icons — MapLibre places
// the topmost symbol layer first, an overlay on top evicts them on
// collision). A basemap switch builds a new style document, so the
// contract must be baked into transformStyle's output; the sweep that
// toggles the default basemap beneath a country raster must not undo it.
// The sprite packs of that document are NOT the store's business: an
// overlay drawing from the same sheet as a presence pack gets that sheet
// shared live by the overlay control (see sprite-sheets.spec.ts).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { MapCatalogLayer } from '@services/map-catalog';
import type { BasemapSwitchItem, OverlaySwitchItem } from '@stores/map/utils/interfaces';

vi.mock('@services/analytics', () => ({
  default: vi.fn(),
  umamiOptedOut: () => false,
  trackWhenUmamiReady: vi.fn(),
}));

const API_HOST = 'https://hub.stg.wodore.com';

// ── Hoisted fake map ──────────────────────────────────────────────────
// The store applies basemaps via setStyle(style, { transformStyle }) —
// the test drives the captured transformStyle the way MapLibre would
// (previous = the serialized live style, next = the incoming document)
// and installs the result as the live style. setLayoutProperty mutates
// the live layers, so the runtime contract is observable directly.
const h = vi.hoisted(() => {
  type TransformStyle = (previousStyle: unknown, nextStyle: unknown) => StyleSpecification;
  type Listener = () => void;
  const setStyleCalls: Array<{ style: unknown; options?: { transformStyle?: TransformStyle } }> =
    [];
  const listeners = new Map<string, Array<{ fn: Listener; once: boolean }>>();
  const layoutCalls: Array<[string, string, unknown]> = [];
  const live = {
    layers: [] as Array<Record<string, unknown>>,
    center: { lng: 8.2, lat: 46.8 },
    zoom: 12,
  };
  const add = (event: string, fn: Listener, once: boolean) =>
    void listeners.set(event, [...(listeners.get(event) ?? []), { fn, once }]);
  const fakeMap = {
    setStyle: (style: unknown, options?: { transformStyle?: TransformStyle }) =>
      void setStyleCalls.push({ style, options }),
    on: (event: string, fn: Listener) => add(event, fn, false),
    once: (event: string, fn: Listener) => add(event, fn, true),
    off: (event: string, fn: Listener) =>
      void listeners.set(
        event,
        (listeners.get(event) ?? []).filter(l => l.fn !== fn)
      ),
    getStyle: () => ({ layers: live.layers }),
    getLayer: (id: string) => live.layers.find(l => l.id === id),
    getLayoutProperty: (id: string, name: string) => {
      const layer = live.layers.find(l => l.id === id);
      return ((layer?.layout as Record<string, unknown> | undefined) ?? {})[name];
    },
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      layoutCalls.push([id, name, value]);
      const layer = live.layers.find(l => l.id === id);
      if (layer) {
        const layout = (layer.layout as Record<string, unknown> | undefined) ?? {};
        layer.layout = { ...layout, [name]: value };
      }
    },
    getCenter: () => live.center,
    getZoom: () => live.zoom,
  };
  const fire = (event: string): void => {
    const due = listeners.get(event) ?? [];
    listeners.set(
      event,
      due.filter(l => !l.once)
    );
    for (const { fn } of due) fn();
  };
  return { setStyleCalls, layoutCalls, live, fakeMap, fire };
});

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: h.fakeMap }),
}));

vi.mock('@pmndrs/detect-gpu', () => ({
  getGPUTier: () => Promise.resolve({ tier: 3, gpu: 'Test GPU', fps: 60 }),
}));

vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  return { ...actual, Notify: { create: () => {} } };
});

const storageState = vi.hoisted(() => new Map<string, unknown>());
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
  prewarmStyleGlyphs: () => {},
}));

const catalogResponse = vi.hoisted(() => ({ layers: [] as MapCatalogLayer[] }));
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

// ── Style documents (fetched by URL fragment) ─────────────────────────
// The served mtk-hill order, trimmed to the layers the contract reads
// (real indices in comments) — no terrain layers, so the staged boot
// path has nothing to split and the style applies unsplit.
const MTK_HILL_LAYERS: Array<Record<string, unknown>> = [
  { id: 'land', type: 'fill', source: 'mtk', 'source-layer': 'landcover' },
  { id: 'road_path_oneway_symbol', type: 'symbol', source: 'mtk', layout: { 'text-field': 'x' } }, // 56
  {
    id: 'water_waterway_label_rank_5',
    type: 'symbol',
    source: 'mtk',
    layout: { 'text-field': 'x' },
  },
  {
    id: 'wd-basemap-accommodations-icons', // 86
    type: 'symbol',
    source: 'wd-basemap-accommodations',
    minzoom: 10,
    layout: { 'icon-image': 'wd-sdf-accommodations:mono/x', 'text-field': 'x' },
  },
  // ONE symbol per presence: icon + name in a single placement box
  // (separate icon/label layers collided and the label evicted its own
  // icon when zoomed in — backend presence merge 2026-11-26)
  {
    id: 'wd-basemap-transit-stations', // 87
    type: 'symbol',
    source: 'wd-basemap-transitland-stops',
    minzoom: 13,
    layout: { 'icon-image': 'wd-basemap-transport:mono/x', 'text-field': 'x' },
  },
  { id: 'place_point_label_rank_5', type: 'symbol', source: 'mtk', minzoom: 13 },
  { id: 'place_point_label_rank_4', type: 'symbol', source: 'mtk', minzoom: 10 },
  { id: 'place_peak_label_rank_3', type: 'symbol', source: 'mtk', minzoom: 11.5 }, // 108
  { id: 'place_line_label_rank_3', type: 'symbol', source: 'mtk', minzoom: 10 },
  { id: 'place_point_label_rank_3', type: 'symbol', source: 'mtk', minzoom: 6 },
  { id: 'place_peak_label_rank_2', type: 'symbol', source: 'mtk', minzoom: 8 },
  { id: 'place_line_label_rank_2', type: 'symbol', source: 'mtk', minzoom: 7 },
  { id: 'place_point_label_rank_2', type: 'symbol', source: 'mtk', minzoom: 6 },
  { id: 'place_peak_label_rank_1', type: 'symbol', source: 'mtk', minzoom: 7 },
  { id: 'place_line_label_rank_1', type: 'symbol', source: 'mtk', minzoom: 3 },
  { id: 'place_point_label_rank_1', type: 'symbol', source: 'mtk', minzoom: 1 }, // 120
];
const MTK_HILL_IDS = MTK_HILL_LAYERS.map(l => l.id as string);
const BAND = 'place_peak_label_rank_3';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function basemapDoc(): StyleSpecification {
  return {
    version: 8,
    name: 'Wodore Outdoor Base (Maptoolkit)',
    glyphs: 'https://tiles.example.com/font/{fontstack}/{range}.pbf',
    // the served packs — the transport overlay draws from the same sheet
    // as its presence pack (wd-transport ‖ wd-basemap-transport)
    sprite: [
      { id: 'sdf', url: 'https://tiles.example.com/sprite' },
      { id: 'wd-sdf-accommodations', url: 'https://tiles.example.com/sdf_sprite/accommodation' },
      { id: 'wd-basemap-transport', url: 'https://tiles.example.com/sdf_sprite/transport' },
    ],
    sources: {
      mtk: { type: 'vector', tiles: ['https://tiles.example.com/mtk/{z}/{x}/{y}.pbf'] },
      'wd-basemap-accommodations': {
        type: 'vector',
        tiles: ['https://tiles.example.com/geoplaces/{z}/{x}/{y}.mlt'],
      },
      'wd-basemap-transitland-stops': {
        type: 'vector',
        tiles: ['https://tiles.example.com/transitland_stops/{z}/{x}/{y}.mlt'],
      },
    },
    layers: clone(MTK_HILL_LAYERS) as LayerSpecification[],
  };
}

const COUNTRY_DOC = {
  version: 8,
  name: 'Swiss raster',
  sources: {
    'ch-raster': { type: 'raster', tiles: ['https://tiles.example.com/ch/{z}/{x}/{y}.jpeg'] },
  },
  layers: [{ id: 'ch-raster', type: 'raster', source: 'ch-raster' }],
};

vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string) => {
    const doc = url.includes('ch-swisstopo-full.json')
      ? clone(COUNTRY_DOC)
      : url.includes('wd-outdoor-base-mtk-hill.json')
        ? basemapDoc()
        : null;
    if (!doc) throw new Error(`unexpected fetch ${url}`);
    return { ok: true, json: async () => doc };
  })
);

// ── Catalog + overlay fixtures ────────────────────────────────────────

function layer(partial: Partial<MapCatalogLayer> & { slug: string }): MapCatalogLayer {
  return {
    role: 'basemap',
    name: `Layer ${partial.slug}`,
    description: '',
    icon: 'outdoor',
    icon_badge: '',
    slot: null,
    order: 0,
    show: true,
    is_default: false,
    spec: 'high',
    style_url: `/v1/map/styles/${partial.slug}.json?spec=high`,
    modified: '2026-11-25T07:45:15.000Z',
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

const HILL = () =>
  layer({
    slug: 'wd-outdoor-base-mtk-hill',
    name: 'Outdoor (relief)',
    is_default: true,
    anchors: {
      places: { before: 'place_point_label_rank_2' },
      routes: { before: 'road_path_oneway_symbol' },
    },
  });
// Switzerland (the catalog's ch-swisstopo coverage bbox shape).
const CH_BBOX = [5.9, 45.8, 10.5, 47.9];
const COUNTRY = () =>
  layer({
    slug: 'ch-swisstopo-full',
    coverage_bbox: CH_BBOX,
    fallback_min_zoom: 7,
  });

const style = (slug: string) => `${API_HOST}/v1/map/styles/${slug}.json?spec=high`;

const OVERLAY_SPECS = {
  accommodations: {
    onLayer: 'ways',
    layerIds: ['wd-accommodations-clusters', 'wd-accommodations'],
  },
  'transport-stops': { onLayer: 'ways', layerIds: ['transport-stops-primitives'] },
  huts: { onLayer: 'places', layerIds: ['wd-huts-occupation', 'wd-huts'] },
  'ch.swisstopo.swisstlm3d-wanderwege': { onLayer: 'routes', layerIds: ['wd-hiking'] },
} as const;

const TRANSPORT_URL = 'https://tiles.example.com/sdf_sprite/transport';

function overlayItem(
  name: keyof typeof OVERLAY_SPECS,
  active?: boolean,
  sprite?: StyleSpecification['sprite']
): OverlaySwitchItem {
  const spec = OVERLAY_SPECS[name];
  const source = `src-${name}`;
  const overlayStyle: StyleSpecification = {
    version: 8,
    name,
    sources: {
      [source]: { type: 'vector', tiles: ['https://tiles.example.com/x/{z}/{x}/{y}.pbf'] },
    },
    layers: spec.layerIds.map(id => ({
      id,
      type: 'symbol',
      source,
      layout: { 'icon-image': 'x' },
    })),
    ...(sprite ? { sprite } : {}),
  };
  return {
    name,
    label: name,
    show: true,
    active: active ?? false,
    onLayer: spec.onLayer,
    icon: 'x',
    style: overlayStyle,
    catalogSlug: name,
  };
}

type Stores = typeof import('@stores/map/basemap-store');
type OverlayStore = ReturnType<typeof import('@stores/map/overlay-store').useOverlayStore>;

const visibilityOf = (layers: Array<Record<string, unknown>>, id: string): unknown => {
  const layer = layers.find(l => l.id === id);
  return ((layer?.layout as Record<string, unknown> | undefined) ?? {}).visibility;
};

/** Push overlay items into the reactive list (the widened cast breaks the maplibre-style TS2589). */
function seedOverlays(overlayStore: OverlayStore, items: OverlaySwitchItem[]): void {
  (overlayStore.overlays as unknown as OverlaySwitchItem[]).push(...items);
}

describe('basemap store — presence ↔ overlay contract (transformStyle)', () => {
  let stores: Stores;
  let overlays: OverlayStore;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    stores = await import('@stores/map/basemap-store');
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    h.setStyleCalls.length = 0;
    h.layoutCalls.length = 0;
    h.live.layers = [];
    storageState.clear();
    storageState.set('basemapName', 'wd-outdoor-base-mtk-hill');
    catalogResponse.layers = [HILL()];
    process.env.WODORE_API_HOST = API_HOST;
    stores.useBasemapStore();
    await vi.waitFor(() => expect(h.setStyleCalls.length).toBe(1), { timeout: 4000 });
    expect(h.setStyleCalls[0]!.style).toBe(style('wd-outdoor-base-mtk-hill'));

    overlays = (await import('@stores/map/overlay-store')).useOverlayStore();
    seedOverlays(overlays, [
      overlayItem('accommodations', true),
      overlayItem('transport-stops', false),
      overlayItem('huts', true),
      overlayItem('ch.swisstopo.swisstlm3d-wanderwege', true),
    ]);
  });

  afterEach(() => {
    delete process.env.WODORE_API_HOST;
  });

  function transform(nextStyle: StyleSpecification): StyleSpecification {
    return runTransform(overlays, nextStyle);
  }

  it('bakes the replaced presence hidden into the incoming basemap', () => {
    const nextStyle = basemapDoc();
    const out = transform(nextStyle);
    const outLayers = out.layers as unknown as Array<Record<string, unknown>>;

    expect(visibilityOf(outLayers, 'wd-basemap-accommodations-icons')).toBe('none');
    // transport-stops is OFF: its presence stays, the served layer object untouched
    const transitIndex = MTK_HILL_IDS.indexOf('wd-basemap-transit-stations');
    const transit = outLayers.find(l => l.id === 'wd-basemap-transit-stations');
    expect(transit).toBe(nextStyle.layers[transitIndex]);
    expect(visibilityOf(outLayers, 'wd-basemap-transit-stations')).toBeUndefined();
    // the served document itself is never mutated
    expect(
      nextStyle.layers[MTK_HILL_IDS.indexOf('wd-basemap-accommodations-icons')].layout
    ).toEqual({
      'icon-image': 'wd-sdf-accommodations:mono/x',
      'text-field': 'x', // icon + name, one symbol
    });
  });

  it('leaves the served sprite packs alone — sheets are shared live, nothing is dropped', () => {
    // The transport overlay draws from the same sheet as its presence
    // (`wd-transport` ‖ `wd-basemap-transport`). That is not the document's
    // business: the packs stay exactly as served, and the overlay control
    // shares the loaded sheet when it adds its own pack (sprite-sheets.ts).
    seedOverlays(overlays, [
      overlayItem('transport-stops', true, [{ id: 'wd-transport', url: TRANSPORT_URL }]),
    ]);
    const out = transform(basemapDoc());
    expect(out.sprite).toEqual(basemapDoc().sprite);
    expect((out.sprite as Array<{ id: string }>).map(s => s.id)).toContain('wd-basemap-transport');
  });

  it('inserts ways and places overlays below the keeper labels, above the presence block', () => {
    const out = transform(basemapDoc());
    const ids = (out.layers as unknown as Array<Record<string, unknown>>).map(l => l.id);
    const band = ids.indexOf(BAND);
    expect(band).toBeGreaterThan(0);

    for (const id of [...OVERLAY_SPECS.accommodations.layerIds, ...OVERLAY_SPECS.huts.layerIds]) {
      expect(ids.indexOf(id)).toBeGreaterThan(ids.indexOf('wd-basemap-accommodations-icons'));
      expect(ids.indexOf(id)).toBeLessThan(band);
    }
    // render order preserved: ways below places
    expect(ids.indexOf('wd-accommodations')).toBeLessThan(ids.indexOf('wd-huts'));
    // the keeper band itself is untouched and still ends with rank 1
    expect(ids.slice(band)).toEqual(MTK_HILL_IDS.slice(MTK_HILL_IDS.indexOf(BAND)));
    expect(ids.at(-1)).toBe('place_point_label_rank_1');
  });

  it('keeps routes on the basemap anchor and the overlay visibility from the store', () => {
    const out = transform(basemapDoc());
    const outLayers = out.layers as unknown as Array<Record<string, unknown>>;
    const ids = outLayers.map(l => l.id);
    expect(ids.indexOf('wd-hiking')).toBe(ids.indexOf('road_path_oneway_symbol') - 1);
    expect(visibilityOf(outLayers, 'wd-accommodations')).toBe('visible');
    expect(visibilityOf(outLayers, 'wd-huts')).toBe('visible');
    // the inactive overlay's layers ride along hidden
    expect(visibilityOf(outLayers, 'transport-stops-primitives')).toBe('none');
  });

  it('replaces the transport presence once transport-stops is active', () => {
    const transport = (overlays.overlays as unknown as OverlaySwitchItem[]).find(
      o => o.name === 'transport-stops'
    )!;
    transport.active = true;
    const outLayers = transform(basemapDoc()).layers as unknown as Array<Record<string, unknown>>;
    expect(visibilityOf(outLayers, 'wd-basemap-transit-stations')).toBe('none');
    expect(visibilityOf(outLayers, 'wd-basemap-transit-stations')).toBe('none');
    expect(visibilityOf(outLayers, 'wd-basemap-accommodations-icons')).toBe('none');
  });

  it('leaves the served document untouched when no family is active', () => {
    for (const o of overlays.overlays as unknown as OverlaySwitchItem[]) o.active = false;
    const nextStyle = basemapDoc();
    const out = transform(nextStyle);
    const base = (out.layers as unknown as Array<Record<string, unknown>>).filter(l =>
      MTK_HILL_IDS.includes(l.id as string)
    );
    expect(base.map(l => l.id)).toEqual(MTK_HILL_IDS);
    // same objects, no visibility key added anywhere
    base.forEach((l, i) => expect(l).toBe(nextStyle.layers[i]));
  });

  it('falls back to the basemap anchors on a style without keeper labels', () => {
    const external: StyleSpecification = {
      version: 8,
      name: 'external',
      sources: { x: { type: 'vector', tiles: ['https://tiles.example.com/x/{z}/{x}/{y}.pbf'] } },
      layers: [
        { id: 'land', type: 'fill', source: 'x' },
        { id: 'label_city', type: 'symbol', source: 'x', layout: { 'text-field': 'x' } },
      ],
    };
    // the applied basemap (composingLayers) carries the mtk-hill anchors,
    // which this style lacks → both groups append at the end, as before
    const ids = (transform(external).layers as unknown as Array<Record<string, unknown>>).map(
      l => l.id
    );
    expect(ids.slice(0, 2)).toEqual(['land', 'label_city']);
    expect(ids.indexOf('wd-hiking')).toBe(2); // routes anchor missing → end of the base
    expect(ids.indexOf('wd-accommodations-clusters')).toBeGreaterThan(1);
    expect(ids.indexOf('wd-huts')).toBeGreaterThan(ids.indexOf('wd-accommodations'));
  });
});

describe('basemap store — presence sync on the live map', () => {
  let stores: Stores;
  let overlays: OverlayStore;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    stores = await import('@stores/map/basemap-store');
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    h.setStyleCalls.length = 0;
    h.layoutCalls.length = 0;
    h.live.layers = [];
    storageState.clear();
    storageState.set('basemapName', 'wd-outdoor-base-mtk-hill');
    // hill + the country raster basemap (composed over the default)
    catalogResponse.layers = [HILL(), COUNTRY()];
    process.env.WODORE_API_HOST = API_HOST;
    stores.useBasemapStore();
    await vi.waitFor(() => expect(h.setStyleCalls.length).toBe(1), { timeout: 4000 });
    overlays = (await import('@stores/map/overlay-store')).useOverlayStore();
    seedOverlays(overlays, [
      overlayItem('accommodations', true),
      overlayItem('transport-stops', false),
    ]);
  });

  afterEach(() => {
    delete process.env.WODORE_API_HOST;
  });

  it('hides the active family and restores it on toggle, writing only what changes', () => {
    const store = stores.useBasemapStore();
    h.live.layers = clone(MTK_HILL_LAYERS);
    store.syncPresenceVisibility();

    expect(visibilityOf(h.live.layers, 'wd-basemap-accommodations-icons')).toBe('none');
    // the family that is simply OFF stays exactly as served — no explicit
    // visibility written, no layout call at all
    expect(visibilityOf(h.live.layers, 'wd-basemap-transit-stations')).toBeUndefined();
    // ONE write: a presence is one symbol now (icon + name together)
    expect(h.layoutCalls).toEqual([['wd-basemap-accommodations-icons', 'visibility', 'none']]);
    // idempotent: a second run writes nothing
    h.layoutCalls.length = 0;
    store.syncPresenceVisibility();
    expect(h.layoutCalls).toEqual([]);

    const accommodations = (overlays.overlays as unknown as OverlaySwitchItem[]).find(
      o => o.name === 'accommodations'
    )!;
    accommodations.active = false;
    store.syncPresenceVisibility();
    expect(visibilityOf(h.live.layers, 'wd-basemap-accommodations-icons')).toBe('visible');
    // the restore writes once (the accumulator was cleared above): a
    // presence is ONE symbol now (icon + name together)
    expect(h.layoutCalls).toHaveLength(1);
  });

  it('keeps an active family replaced across the country-fallback visibility sweep', async () => {
    const store = stores.useBasemapStore();
    // Switch to the country raster: the default basemap is composed
    // beneath it (presence layers included) — the switch runs the real
    // transformStyle over the live style.
    // SAFETY: basemaps is the reactive BasemapSwitchItem[]; the widened
    // cast breaks the maplibre-style TS2589 recursion (same as the store).
    const country = (store.basemaps as unknown as BasemapSwitchItem[]).find(
      b => b.name === 'ch-swisstopo-full'
    )!;
    await store.setBasemap(country);
    expect(h.setStyleCalls.length).toBe(2);
    const transformStyle = h.setStyleCalls[1]!.options!.transformStyle!;
    const previous = previousStyleFor(overlays);
    const applied = transformStyle(
      previous,
      clone(h.setStyleCalls[1]!.style)
    ) as StyleSpecification;
    h.live.layers = clone(applied.layers) as unknown as Array<Record<string, unknown>>;
    expect(h.live.layers.map(l => l.id)).toContain('ch-raster');

    // style.load → the sweep: inside the bbox at z12 the raster shows and
    // the default basemap underneath is switched off as a whole.
    h.fire('style.load');
    expect(visibilityOf(h.live.layers, 'ch-raster')).toBe('visible');
    expect(visibilityOf(h.live.layers, 'land')).toBe('none');
    // both presences hidden — the active one by the contract, the other
    // by the sweep (and NOT restored underneath the opaque raster)
    expect(visibilityOf(h.live.layers, 'wd-basemap-accommodations-icons')).toBe('none');
    expect(visibilityOf(h.live.layers, 'wd-basemap-transit-stations')).toBe('none');

    // Pan outside Switzerland (Paris): the sweep turns every default
    // layer visible — the replaced presence must flip back to hidden.
    h.live.center = { lng: 2.35, lat: 48.86 };
    h.fire('moveend');
    expect(visibilityOf(h.live.layers, 'ch-raster')).toBe('none');
    expect(visibilityOf(h.live.layers, 'land')).toBe('visible');
    expect(visibilityOf(h.live.layers, 'wd-basemap-accommodations-icons')).toBe('none');
    expect(visibilityOf(h.live.layers, 'wd-basemap-accommodations-icons')).toBe('none');
    // transport-stops is off: its presence is back with the rest
    expect(visibilityOf(h.live.layers, 'wd-basemap-transit-stations')).toBe('visible');
    // the sweep's 'visible' precedes the contract's 'none' for the icon layer
    const iconCalls = h.layoutCalls.filter(([id]) => id === 'wd-basemap-accommodations-icons');
    expect(iconCalls.at(-1)).toEqual(['wd-basemap-accommodations-icons', 'visibility', 'none']);
    expect(iconCalls.filter(([, , value]) => value === 'visible').length).toBeGreaterThan(0);
  });
});

/** Drive the captured transformStyle the way MapLibre does on a basemap
 *  switch: previous = the serialized live style, next = the incoming
 *  document. */
function runTransform(overlays: OverlayStore, nextStyle: StyleSpecification): StyleSpecification {
  const transformStyle = h.setStyleCalls.at(-1)!.options!.transformStyle!;
  return transformStyle(previousStyleFor(overlays), nextStyle) as StyleSpecification;
}

/** The live style as MapLibre would serialize it before a switch: the
 *  previous basemap's layers with EVERY overlay layer appended on top
 *  (the pre-contract position) and the overlay sources merged in. */
function previousStyleFor(overlayStore: OverlayStore): StyleSpecification {
  const doc = basemapDoc();
  const items = overlayStore.overlays as unknown as OverlaySwitchItem[];
  const overlayLayers = items.flatMap(o =>
    o.style.layers.map(l => ({
      ...clone(l),
      layout: { ...clone(l.layout ?? {}), visibility: 'visible' as const },
    }))
  );
  const overlaySources = Object.fromEntries(
    items.map(o => [Object.keys(o.style.sources)[0], Object.values(o.style.sources)[0]])
  );
  return {
    ...doc,
    name: 'previous',
    sources: { ...doc.sources, ...overlaySources },
    layers: [...doc.layers, ...overlayLayers],
  };
}
