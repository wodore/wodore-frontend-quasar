import { describe, it, expect } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import {
  COUNTRY_BASEMAP_MIN_ZOOM,
  isCenterInBbox,
  withCountryFallback,
} from '@stores/map/utils/country-fallback';
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

  it('splits rendering: country layers get the zoom floor, fallback stays full-range', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle());

    // country layers stop rendering below the country max zoom-out…
    const chRaster = merged.layers.find(l => l.id === 'ch-raster');
    expect(chRaster?.minzoom).toBe(COUNTRY_BASEMAP_MIN_ZOOM);
    // layers that already start above the floor keep their own value
    expect(merged.layers.find(l => l.id === 'ch-overlay')?.minzoom).toBe(9);
    // …the fallback keeps its full zoom range — its VISIBILITY is runtime-
    // gated by the bbox watcher (basemap-store), not by a static maxzoom
    expect(merged.layers.find(l => l.id === 'bg')?.maxzoom).toBeUndefined();
    expect(merged.layers.find(l => l.id === 'land')?.maxzoom).toBeUndefined();
    // existing fallback maxzooms are preserved
    const fallback = fallbackStyle();
    (fallback.layers[1] as Record<string, unknown>).maxzoom = 11;
    const remerged = withCountryFallback(countryStyle(), fallback);
    expect(remerged.layers.find(l => l.id === 'land')?.maxzoom).toBe(11);
  });

  it('tests camera centers against the country bounding box', () => {
    const ch: [number, number, number, number] = [5.7, 45.6, 10.9, 48.1];

    expect(isCenterInBbox([8.2, 46.6], ch)).toBe(true); // Berner Oberland
    expect(isCenterInBbox([5.7, 45.6], ch)).toBe(true); // corner inclusive
    expect(isCenterInBbox([13.4, 52.5], ch)).toBe(false); // Berlin
    expect(isCenterInBbox([2.35, 48.85], ch)).toBe(false); // Paris
    expect(isCenterInBbox([8.2, 48.3], ch)).toBe(false); // just north
  });

  it('resolves glyphs and sprite from the fallback style', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle());
    expect(merged.glyphs).toContain('tiles.example.com');
    expect(Array.isArray(merged.sprite)).toBe(true);
  });

  it('accepts a per-basemap zoom floor (swisstopo hides one level earlier)', () => {
    const merged = withCountryFallback(countryStyle(), fallbackStyle(), 7);

    expect(merged.layers.find(l => l.id === 'ch-raster')?.minzoom).toBe(7);
    // layers that already start higher keep their own value
    expect(merged.layers.find(l => l.id === 'ch-overlay')?.minzoom).toBe(9);
  });

  it('keeps the country floor above the overlay floor', () => {
    // overlays appear from OVERLAY_MIN_ZOOM — the country basemap must
    // still be part of the picture there; the fallback only takes over
    // when zooming out past country scale
    expect(COUNTRY_BASEMAP_MIN_ZOOM).toBeGreaterThan(OVERLAY_MIN_ZOOM);
    expect(COUNTRY_BASEMAP_MIN_ZOOM).toBe(6);
  });
});
