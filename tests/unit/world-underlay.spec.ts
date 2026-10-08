import { describe, it, expect } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import {
  WORLD_UNDERLAY_MAX_ZOOM,
  WORLD_UNDERLAY_SOURCE_ID,
  withWorldUnderlay,
  worldUnderlayInsertIndex,
} from '@stores/map/utils/world-underlay';
import { GLOBE_SKY, MAP_MIN_ZOOM, OVERLAY_MIN_ZOOM } from '@stores/map/utils/map-constants';

const baseStyle = (): StyleSpecification => ({
  version: 8,
  name: 'test',
  sources: {
    osm: { type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'], tileSize: 256 },
  },
  glyphs: 'https://example.com/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#fff' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
});

describe('world-underlay', () => {
  it('merges source and layers below all data layers', () => {
    const merged = withWorldUnderlay(baseStyle());

    expect(merged.sources[WORLD_UNDERLAY_SOURCE_ID]).toBeDefined();
    const underlay = merged.layers.filter(l => l.id.startsWith('wd-world-underlay-'));
    expect(underlay).toHaveLength(2);
    // both inserted after the background, before the raster data layer
    expect(merged.layers.map(l => l.id)).toEqual([
      'bg',
      'wd-world-underlay-boundaries',
      'wd-world-underlay-labels',
      'osm',
    ]);
  });

  it('inserts at index 0 when the style has no background layer', () => {
    const style = baseStyle();
    style.layers = style.layers.filter(l => l.type !== 'background');

    const merged = withWorldUnderlay(style);
    expect(merged.layers[0].id).toBe('wd-world-underlay-boundaries');
  });

  it('is idempotent', () => {
    const once = withWorldUnderlay(baseStyle());
    const twice = withWorldUnderlay(once);

    expect(twice).toBe(once);
  });

  it('keeps existing glyphs and defaults them when missing', () => {
    expect(withWorldUnderlay(baseStyle()).glyphs).toContain('example.com');

    const style = baseStyle();
    delete style.glyphs;
    const merged = withWorldUnderlay(style);
    expect(merged.glyphs).toContain('demotiles.maplibre.org');
  });

  it('caps underlay layers at the world-underlay max zoom', () => {
    const merged = withWorldUnderlay(baseStyle());
    for (const layer of merged.layers.filter(l => l.id.startsWith('wd-world-underlay-'))) {
      expect(layer.maxzoom).toBe(WORLD_UNDERLAY_MAX_ZOOM);
    }
  });

  it('finds the position above the LAST background layer', () => {
    const layers = [{ type: 'background' }, { type: 'background' }, { type: 'raster' }];
    expect(worldUnderlayInsertIndex(layers)).toBe(2);
    expect(worldUnderlayInsertIndex([])).toBe(0);
  });
});

describe('map-constants', () => {
  it('keeps the camera floor below the overlay floor', () => {
    // zooming out past the overlay floor must remain possible (that is
    // where the globe view lives)
    expect(MAP_MIN_ZOOM).toBeLessThan(OVERLAY_MIN_ZOOM);
    expect(MAP_MIN_ZOOM).toBe(2);
  });

  it('defines a dark space sky that fades back to daylight by z10', () => {
    const skyColor = GLOBE_SKY['sky-color'] as unknown as Array<unknown>;
    expect(Array.isArray(skyColor)).toBe(true);
    expect(skyColor[0]).toBe('interpolate');
    // dark near the planet, MapLibre's default daylight blue up close
    expect(JSON.stringify(skyColor)).toContain('#02040a');
    expect(JSON.stringify(skyColor)).toContain('#88c6fc');
    // no atmosphere haze once zoomed in
    const blend = GLOBE_SKY['atmosphere-blend'] as unknown as Array<unknown>;
    expect(blend[blend.length - 1]).toBe(0);
  });
});
