import { describe, it, expect } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import { COUNTRY_BASEMAP_MIN_ZOOM, withCountryFallback } from '@stores/map/utils/country-fallback';
import { OVERLAY_MIN_ZOOM } from '@stores/map/utils/map-constants';

const fallbackStyle = (): StyleSpecification => ({
  version: 8,
  name: 'wd-outdoor-base-mtk',
  glyphs: 'https://tiles.example.com/fonts/{fontstack}/{range}.pbf',
  sprite: [{ id: 'default', url: 'https://tiles.example.com/sprite/default' }],
  sources: {
    mtk: { type: 'vector', url: 'https://tiles.example.com/tiles.json' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#f6f9f7' } },
    { id: 'land', type: 'fill', source: 'mtk', 'source-layer': 'land' },
  ],
});

const countryStyle = (): StyleSpecification => ({
  version: 8,
  name: 'ch-swisstopo-raster',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'ch-swisstopo-raster': {
      type: 'raster',
      tiles: ['https://wmts0.geo.admin.ch/{z}/{x}/{y}.jpeg'],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'ch-raster', type: 'raster', source: 'ch-swisstopo-raster' },
    { id: 'ch-overlay', type: 'line', source: 'mtk', minzoom: 9 },
  ],
});

describe('country-fallback', () => {
  it('composes the country layers above the default world layers', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle());

    expect(merged.layers.map(l => l.id)).toEqual(['bg', 'land', 'ch-raster', 'ch-overlay']);
    expect(Object.keys(merged.sources)).toEqual(
      expect.arrayContaining(['mtk', 'ch-swisstopo-raster'])
    );
    // the country style keeps its identity (MapLibre style diffing)
    expect(merged.name).toBe('ch-swisstopo-raster');
  });

  it('splits the zoom bands: fallback below, country at and above', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle());

    // country layers stop rendering below the country max zoom-out…
    const chRaster = merged.layers.find(l => l.id === 'ch-raster');
    expect(chRaster?.minzoom).toBe(COUNTRY_BASEMAP_MIN_ZOOM);
    // layers that already start above the floor keep their own value
    expect(merged.layers.find(l => l.id === 'ch-overlay')?.minzoom).toBe(9);
    // …and the fallback layers stop at country scale — MapLibre has no
    // occlusion culling, so hidden layers would still cost GPU every frame
    expect(merged.layers.find(l => l.id === 'bg')?.maxzoom).toBe(COUNTRY_BASEMAP_MIN_ZOOM);
    expect(merged.layers.find(l => l.id === 'land')?.maxzoom).toBe(COUNTRY_BASEMAP_MIN_ZOOM);
  });

  it('keeps tighter existing maxzooms of fallback layers', () => {
    const fallback = fallbackStyle();
    (fallback.layers[1] as Record<string, unknown>).maxzoom = 4;
    const merged = withCountryFallback(countryStyle(), fallback);
    expect(merged.layers.find(l => l.id === 'land')?.maxzoom).toBe(4);
  });

  it('resolves glyphs and sprite from the fallback style', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle());
    expect(merged.glyphs).toContain('tiles.example.com');
    expect(Array.isArray(merged.sprite)).toBe(true);
  });

  it('keeps the country floor above the overlay floor', () => {
    // overlays appear from OVERLAY_MIN_ZOOM — the country basemap must
    // still be part of the picture there; the fallback only takes over
    // when zooming out past country scale
    expect(COUNTRY_BASEMAP_MIN_ZOOM).toBeGreaterThan(OVERLAY_MIN_ZOOM);
    expect(COUNTRY_BASEMAP_MIN_ZOOM).toBe(6);
  });
});
