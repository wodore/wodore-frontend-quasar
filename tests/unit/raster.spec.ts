import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { getRasterStyle, getSwisstopoOverlay } from '@stores/map/utils/raster';

describe('getRasterStyle', () => {
  const BASE = {
    name: 'test-basemap',
    tiles: ['https://tiles.example.com/{z}/{x}/{y}.png'],
  };

  it('builds one raster source and layer per layer name with the wd- prefix', () => {
    allure.label('feature', 'basemap-styles');
    allure.severity('critical');

    const style = getRasterStyle(BASE);

    expect(style.version).toBe(8);
    expect(style.name).toBe('test-basemap');
    expect(style.sources).toHaveProperty('wd-test-basemap');
    const source = style.sources['wd-test-basemap'] as { type: string; tiles: string[] };
    expect(source.type).toBe('raster');
    expect(source.tiles).toEqual(BASE.tiles);
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0]).toMatchObject({
      id: 'wd-test-basemap',
      type: 'raster',
      source: 'wd-test-basemap',
    });
  });

  it('replaces the <NAME> placeholder per layer', () => {
    const style = getRasterStyle({
      name: 'test-basemap',
      layers: ['layer-a', 'layer-b'],
      tiles: ['https://t.example.com/<NAME>/{z}/{x}/{y}.png'],
    });

    expect(style.sources).toHaveProperty('wd-layer-a');
    expect(style.sources).toHaveProperty('wd-layer-b');
    const a = style.sources['wd-layer-a'] as { tiles: string[] };
    const b = style.sources['wd-layer-b'] as { tiles: string[] };
    expect(a.tiles[0]).toContain('/layer-a/');
    expect(b.tiles[0]).toContain('/layer-b/');
    expect(style.layers.map(l => l.id)).toEqual(['wd-layer-a', 'wd-layer-b']);
  });

  it('prefixes a cdn host when cdn is enabled', () => {
    process.env.WODORE_CLOUDINARY_ENV = 'test-env';
    try {
      const style = getRasterStyle({ ...BASE, cdn: true });
      const source = style.sources['wd-test-basemap'] as { tiles: string[] };
      // The cdn prefix is prepended to the full source URL (Cloudinary image/fetch)
      expect(source.tiles[0]).toBe(
        'https://res.cloudinary.com/test-env/image/fetch/f_auto/q_auto/' + BASE.tiles[0]
      );
    } finally {
      delete process.env.WODORE_CLOUDINARY_ENV;
    }
  });
});

describe('getSwisstopoOverlay', () => {
  it('creates a swisstopo overlay item with wmts tiles and a raster style', () => {
    allure.label('feature', 'basemap-styles');
    allure.severity('critical');

    const overlay = getSwisstopoOverlay({
      name: 'ch.swisstopo.pixelkarte-farbe',
      label: 'Pixelkarte',
    });

    expect(overlay.name).toBe('ch.swisstopo.pixelkarte-farbe');
    expect(overlay.label).toBe('Pixelkarte');
    expect(overlay.show).toBe(true);

    const style = overlay.style as { sources: Record<string, { tiles: string[] }> };
    expect(style.sources).toHaveProperty('wd-ch.swisstopo.pixelkarte-farbe');
    const tiles = Object.values(style.sources).flatMap(s => s.tiles ?? []);
    expect(tiles).toHaveLength(10);
    expect(
      tiles.every(t => t.includes('wmts') && t.includes('ch.swisstopo.pixelkarte-farbe'))
    ).toBe(true);
  });
});
