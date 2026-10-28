import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as allure from 'allure-js-commons';
import { storageClear } from '@services/storage';
import {
  resolveTokens,
  collectTokens,
  gpuSpec,
  styleVariantUrl,
  absolutizeStyleUrl,
  fetchMapCatalog,
  clearMapCatalogCache,
  isOpacityCurve,
  parseOpacityCurve,
  serializeOpacityCurve,
  persistLayers,
  loadPersistedLayers,
} from '@services/map-catalog';

// The layers/slots fetches ride the generated clientWodore — mock
// the transport so the specs pin paths, params and envelopes.
vi.mock('@clients/index', () => ({
  clientWodore: { GET: vi.fn() },
}));
import { clientWodore } from '@clients/index';

const layersGet = vi.mocked(clientWodore.GET);

function layerSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    spec: 'high',
    style_url: '/v1/map/styles/mtb.json?spec=high',
    modified: '2026-10-15T22:29:11.528Z',
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
    ...overrides,
  };
}

describe('map catalog token resolver', () => {
  it('substitutes whole-node tokens with scalars', () => {
    allure.label('feature', 'map-catalog');
    const style = {
      layers: [{ id: 'a', paint: { 'raster-opacity': '{{mtb.opacity}}' } }],
    };
    const resolved = resolveTokens(style, { 'mtb.opacity': 0.9 });
    expect((resolved.layers[0]!.paint as Record<string, unknown>)['raster-opacity']).toBe(0.9);
  });

  it('substitutes whole-node tokens with expression subtrees', () => {
    const curve = ['interpolate', ['linear'], ['zoom'], 8, 0, 16, 1];
    const style = { paint: { 'line-opacity': '{{hiking.opacity}}' } };
    const resolved = resolveTokens(style, { 'hiking.opacity': curve }) as typeof style;
    expect(resolved.paint['line-opacity']).toEqual(curve);
  });

  it('substitutes inline tokens inside longer strings (URL templates)', () => {
    const source = { data: 'https://api.example.com/v1/huts/availability/{{date}}.geojson' };
    const resolved = resolveTokens(source, { date: '2026-10-14' });
    expect((resolved as typeof source).data).toBe(
      'https://api.example.com/v1/huts/availability/2026-10-14.geojson'
    );
  });

  it('passes unknown tokens through untouched', () => {
    const style = { paint: { 'x-opacity': '{{unknown.param}}' } };
    expect(resolveTokens(style, {})).toEqual(style);
  });

  it('never substitutes null values (runtime params stay tokenized)', () => {
    const source = { data: '…/{{date}}.geojson' };
    const resolved = resolveTokens(source, { date: null });
    expect((resolved as typeof source).data).toBe('…/{{date}}.geojson');
  });

  it('collects every token slug in a tree', () => {
    const tokens = collectTokens({
      a: '{{one}}',
      b: ['{{two}}', { c: 'url/{{three}}.geojson' }],
    });
    expect([...tokens].sort()).toEqual(['one', 'three', 'two']);
  });
});

describe('map catalog spec tiers', () => {
  it('maps the GPU raster flag onto spec tiers', () => {
    expect(gpuSpec(true)).toBe('low');
    expect(gpuSpec(false)).toBe('high');
  });
});

describe('fetchMapCatalog (resolved layers API, backend #331)', () => {
  beforeEach(() => {
    layersGet.mockReset();
    // The service dedupes in-session per (lang, spec, role) — a clean
    // slate keeps the specs independent.
    clearMapCatalogCache();
  });

  it('fetches /v1/map/layers with lang + spec and consumes the {data, count} envelope', async () => {
    layersGet.mockResolvedValueOnce({
      data: { data: [layerSummary()], count: 1 },
      error: undefined,
      response: new Response(),
    });
    const res = await fetchMapCatalog('de', 'low');
    expect(layersGet).toHaveBeenCalledWith(
      '/v1/map/layers',
      expect.objectContaining({ params: { query: { lang: 'de', spec: 'low' } } })
    );
    expect(res.count).toBe(1);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]!.slug).toBe('mtb');
    // ONE resolved layer per slug — served spec + style_url embedded,
    // no variants[] anymore.
    expect(res.data[0]!.spec).toBe('high');
    expect(res.data[0]!.style_url).toBe('/v1/map/styles/mtb.json?spec=high');
    expect('variants' in res.data[0]!).toBe(false);
  });

  it('sends no cache-busting params (server ETags own freshness)', async () => {
    layersGet.mockResolvedValueOnce({
      data: { data: [], count: 0 },
      error: undefined,
      response: new Response(),
    });
    await fetchMapCatalog('en');
    const query = layersGet.mock.calls[0]![1]!.params!.query as Record<string, unknown>;
    expect(query.v).toBeUndefined();
    expect(Object.keys(query)).toEqual(['lang']);
  });

  it('shares one in-session request across concurrent callers', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    layersGet.mockReturnValue(
      new Promise(resolve => {
        resolveFetch = resolve;
      }) as never
    );
    const a = fetchMapCatalog('fr', 'high');
    const b = fetchMapCatalog('fr', 'high');
    resolveFetch({ data: { data: [], count: 0 }, error: undefined });
    await expect(a).resolves.toBe(await b);
    expect(layersGet).toHaveBeenCalledTimes(1);
  });

  it('declares profile=subset for fallback sessions (backend #440) — the param rides the generated client structurally', async () => {
    layersGet.mockResolvedValue({
      data: { data: [], count: 0 },
      error: undefined,
      response: new Response(),
    });
    await fetchMapCatalog('de', 'low', undefined, 'subset');
    // The generated client carries no `profile` field yet (unreleased
    // schema) — the query object passes through structurally and
    // openapi-fetch serializes every key, so the param still reaches
    // backends that declare it (e2e-asserted on the wire).
    expect(layersGet).toHaveBeenCalledWith(
      '/v1/map/layers',
      expect.objectContaining({
        params: { query: { lang: 'de', spec: 'low', profile: 'subset' } },
      })
    );
  });

  it('caches per profile — a subset fetch never serves the default session (and vice versa)', async () => {
    let calls = 0;
    layersGet.mockImplementation(async () => {
      calls += 1;
      return { data: { data: [], count: calls }, error: undefined, response: new Response() };
    });
    const subset = fetchMapCatalog('de', 'low', undefined, 'subset');
    const fallbackDefault = fetchMapCatalog('de', 'low');
    const subsetAgain = fetchMapCatalog('de', 'low', undefined, 'subset');
    expect(subsetAgain).toBe(subset); // deduped onto the subset request
    await Promise.all([subset, fallbackDefault]);
    expect(layersGet).toHaveBeenCalledTimes(2); // one per profile
  });
});

describe('layers snapshot views (persistLayers/loadPersistedLayers)', () => {
  const layers = () => [layerSummary()] as never[];

  beforeEach(() => {
    // The storage service keeps a module-level memory cache — a fresh
    // slate keeps the view-isolation specs independent of each other.
    storageClear();
  });

  it('persists and loads the DEFAULT view under mapLayersCache', () => {
    persistLayers(layers(), 'en', null);
    const loaded = loadPersistedLayers(null);
    expect(loaded?.profile).toBeNull();
    expect(loaded?.lang).toBe('en');
    expect(loaded?.data).toHaveLength(1);
  });

  it('persists and loads the SUBSET view under its own slot', () => {
    persistLayers(layers(), 'en', 'subset');
    const loaded = loadPersistedLayers('subset');
    expect(loaded?.profile).toBe('subset');
    expect(loaded?.data).toHaveLength(1);
  });

  it('never leaks a view into the other session (both directions)', () => {
    // A fallback session must not warm-boot default rows (the menu
    // would hide subset-servable overlays again); a MapLibre session
    // must not warm-boot subset rows (full-only overlays missing).
    // Slots are independent — clearing between the halves proves the
    // READ isolation (one view persisted at a time).
    persistLayers(layers(), 'en', null);
    expect(loadPersistedLayers(null)?.data).toHaveLength(1); // own view loads
    expect(loadPersistedLayers('subset')).toBeNull(); // other view misses
    storageClear();
    persistLayers(layers(), 'en', 'subset');
    expect(loadPersistedLayers('subset')?.profile).toBe('subset'); // own view loads
    expect(loadPersistedLayers(null)).toBeNull(); // other view misses
  });

  it('reads pre-profile snapshots as the default view (backward compat)', () => {
    // Written by app versions before the subset split — no `profile`
    // field; MapLibre sessions keep warm-booting them untouched.
    loadPersistedLayers(null); // no-op read
    persistLayers(layers(), 'en', null);
    const raw = loadPersistedLayers(null)!;
    expect(raw.profile ?? null).toBeNull();
  });
});

describe('map catalog URLs', () => {
  it('derives style variants from the catalog style_url (served spec + version token preserved)', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    // Backend #434: style_url embeds the backend-SERVED spec and the
    // immutable version token — variants keep both, only appending the
    // mode. The client must never rebuild the URL from a slug (it would
    // guess the spec and drop the token).
    const catalogUrl = '/v1/map/styles/mtb.json?spec=medium&v=9e9ddf24f942';
    expect(styleVariantUrl(catalogUrl)).toBe(
      'https://hub.example.com/v1/map/styles/mtb.json?spec=medium&v=9e9ddf24f942'
    );
    expect(styleVariantUrl(catalogUrl, { tokenized: true })).toBe(
      'https://hub.example.com/v1/map/styles/mtb.json?spec=medium&v=9e9ddf24f942&mode=tokenized'
    );
    // Bare style_url (no query yet) — tokenized appends '?', resolved
    // passes through; external URLs are never re-based.
    expect(styleVariantUrl('/v1/map/styles/x.json', { tokenized: true })).toBe(
      'https://hub.example.com/v1/map/styles/x.json?mode=tokenized'
    );
    expect(styleVariantUrl('https://api.maptiler.com/maps/x?key=k')).toBe(
      'https://api.maptiler.com/maps/x?key=k'
    );
    // Idempotence guard: a URL already carrying a mode never gets a
    // second — both the real case (mode=tokenized re-requested) and a
    // foreign mode value pass through unchanged (URLParams-based, so a
    // future `x-mode=` param cannot falsely match).
    expect(
      styleVariantUrl('/v1/map/styles/x.json?spec=high&mode=tokenized', {
        tokenized: true,
      })
    ).toBe('https://hub.example.com/v1/map/styles/x.json?spec=high&mode=tokenized');
    expect(
      styleVariantUrl('/v1/map/styles/x.json?spec=high&x-mode=1', {
        tokenized: true,
      })
    ).toBe('https://hub.example.com/v1/map/styles/x.json?spec=high&x-mode=1&mode=tokenized');
    delete process.env.WODORE_API_HOST;
  });

  it('absolutizes root-relative style URLs against the API host', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    expect(absolutizeStyleUrl('/v1/map/styles/x.json?spec=high')).toBe(
      'https://hub.example.com/v1/map/styles/x.json?spec=high'
    );
    // External (env-resolved) URLs pass through untouched
    expect(absolutizeStyleUrl('https://api.maptiler.com/maps/x?key=k')).toBe(
      'https://api.maptiler.com/maps/x?key=k'
    );
    delete process.env.WODORE_API_HOST;
  });

  it('regression #285: style_url from /v1/map/layers resolves against WODORE_API_HOST, never the page origin', () => {
    // The #285 incident: catalog-served style URLs resolved against the
    // FRONTEND origin (blank basemaps on subpath deploys). The layers
    // entries carry root-relative style_urls — they must absolutize
    // against the API host before reaching MapLibre.
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    const entry = layerSummary({
      slug: 'wd-outdoor-base-mtk-hill',
      role: 'basemap',
      style_url: '/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high',
    }) as { style_url: string };
    const url = absolutizeStyleUrl(entry.style_url);
    expect(new URL(url).origin).toBe('https://hub.example.com');
    expect(url).toBe(
      'https://hub.example.com/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high'
    );
    delete process.env.WODORE_API_HOST;
  });
});

describe('opacity curve helpers', () => {
  const curve = {
    stops: [
      { zoom: 8, opacity: 0 },
      { zoom: 13, opacity: 0.8 },
      { zoom: 16, opacity: 0.3 },
    ],
  };

  it('parses the interpolate expression into stops', () => {
    const expr = ['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.8, 16, 0.3];
    expect(parseOpacityCurve(expr)).toEqual(curve);
    expect(parseOpacityCurve(['match', ['get', 'x']])).toBeUndefined();
    expect(parseOpacityCurve('nope')).toBeUndefined();
  });

  it('serializes stops back into the expression', () => {
    expect(serializeOpacityCurve(curve)).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      0,
      13,
      0.8,
      16,
      0.3,
    ]);
  });

  it('guards persisted curve values structurally', () => {
    expect(isOpacityCurve(curve)).toBe(true);
    expect(isOpacityCurve({ stops: [{ zoom: 5, opacity: 0.5 }] })).toBe(false); // < 2 stops
    expect(
      isOpacityCurve({
        stops: [
          { zoom: 5, opacity: 0.5 },
          { zoom: 5, opacity: 1 },
        ],
      })
    ).toBe(false); // non-ascending
    expect(
      isOpacityCurve({
        stops: [
          { zoom: 5, opacity: 2 },
          { zoom: 9, opacity: 1 },
        ],
      })
    ).toBe(false); // out of range
    expect(isOpacityCurve(null)).toBe(false);
    expect(isOpacityCurve(['interpolate'])).toBe(false);
  });

  it('round-trips parse → serialize', () => {
    const expr = serializeOpacityCurve(curve);
    expect(parseOpacityCurve(expr)).toEqual(curve);
  });
});
