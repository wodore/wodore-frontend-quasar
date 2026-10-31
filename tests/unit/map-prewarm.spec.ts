import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { styleAssetUrls, spriteVariantUrl, prewarmCatalogStyles } from '@services/map-prewarm';
import { absolutizeStyleUrl, type MapCatalogLayer } from '@services/map-catalog';
import type { StyleSpecification } from 'maplibre-gl';

/** Staged-map prewarm URL grammar: MapLibre loads `sprite.json` /
 *  `sprite@2x.json` with the suffix BEFORE the query string. */
describe('map-prewarm styleAssetUrls', () => {
  it('warms TileJSON urls and sprite variants with the suffix before the query', () => {
    const style = {
      version: 8,
      sources: {
        mtk: { type: 'vector', url: 'https://tiles.example.com/mtk.json?v=abc' },
        dem: { type: 'raster-dem', tiles: ['https://dem.example.com/{z}/{x}/{y}.webp'] },
      },
      sprite: [
        { id: 'sdf', url: 'https://icons.example.com/sprite?v=02200ad9' },
        { id: 'wd-maps', url: 'https://tiles.example.com/sprite/wd-maps' },
      ],
    } as unknown as StyleSpecification;

    expect(styleAssetUrls(style)).toEqual([
      'https://tiles.example.com/mtk.json?v=abc',
      'https://icons.example.com/sprite.json?v=02200ad9',
      'https://icons.example.com/sprite@2x.json?v=02200ad9',
      'https://tiles.example.com/sprite/wd-maps.json',
      'https://tiles.example.com/sprite/wd-maps@2x.json',
    ]);
  });

  it('spriteVariantUrl never glues the suffix onto the query value', () => {
    expect(spriteVariantUrl('https://x.example/sprite?a=1', '.json')).toBe(
      'https://x.example/sprite.json?a=1'
    );
    expect(spriteVariantUrl('https://x.example/sprite', '@2x.json')).toBe(
      'https://x.example/sprite@2x.json'
    );
  });
});

describe('map-prewarm prewarmCatalogStyles', () => {
  const fetchMock = vi.fn(async () => ({ ok: true }));
  const layer = (partial: Partial<MapCatalogLayer> & { slug: string }): MapCatalogLayer =>
    ({
      role: 'overlay',
      name: partial.name ?? `Layer ${partial.slug}`,
      description: '',
      icon: '',
      icon_badge: '',
      slot: null,
      order: 0,
      show: true,
      is_default: false,
      min_zoom: null,
      max_zoom: null,
      coverage_bbox: null,
      fallback_min_zoom: null,
      fallback: null,
      preview_url: null,
      spec: 'high',
      style_url: `https://hub.example.com/v1/map/styles/${partial.slug}.json?spec=high`,
      ...partial,
    }) as MapCatalogLayer;

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warms only VISIBLE layers and skips the critical (active) style', async () => {
    const layers = [
      layer({ slug: 'wd-outdoor-base-mtk-hill', role: 'basemap' }), // active → skipped
      layer({ slug: 'world-topo', role: 'basemap' }),
      layer({ slug: 'huts' }),
      // Hidden layers must never be warmed:
      layer({ slug: 'maptiler-hybrid', role: 'basemap', show: false }),
      layer({ slug: 'openfreemap-liberty', role: 'basemap', show: false }),
      layer({ slug: 'wd-outdoor-base-ofm-hill', role: 'basemap', show: false }),
      // Layers without a style document have nothing to warm:
      layer({ slug: 'styleless', style_url: null }),
    ];
    prewarmCatalogStyles(
      layers,
      'https://hub.example.com/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high'
    );
    await Promise.resolve();
    const warmed = fetchMock.mock.calls.map(c => String(c[0]));
    expect(warmed).toEqual([
      'https://hub.example.com/v1/map/styles/world-topo.json?spec=high',
      'https://hub.example.com/v1/map/styles/huts.json?spec=high',
    ]);
  });

  it('skips the critical style by its RAW (root-relative) form as well', async () => {
    const layers = [
      layer({ slug: 'huts', style_url: '/v1/map/styles/huts.json?spec=high' }),
      layer({ slug: 'mtb', style_url: '/v1/map/styles/mtb.json?spec=high' }),
    ];
    prewarmCatalogStyles(layers, '/v1/map/styles/huts.json?spec=high');
    const warmed = fetchMock.mock.calls.map(c => String(c[0]));
    // Hermetic: prewarm warms the ABSOLUTIZED url (whatever apiBase()
    // yields here — raw without WODORE_API_HOST); the INTENT of this test
    // is that the critical style still gets skipped when exceptStyleUrl
    // is given in its RAW root-relative form.
    expect(warmed).toEqual([absolutizeStyleUrl('/v1/map/styles/mtb.json?spec=high')]);
  });
});
