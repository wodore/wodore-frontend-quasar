import { describe, expect, it } from 'vitest';

import { getSatelliteHybridStyle } from '@stores/map/utils/satellite-hybrid';

const args = {
  tiles: ['https://tiles.example.com/raster/tiles/world_satellite/webmercator/{z}/{x}/{y}.webp'],
  attribution: 'Esri &#124; swisstopo',
  sourceMaxZoom: 19,
  vectorUrl: 'https://tiles.openfreemap.org/planet',
  glyphs: 'https://tiles.example.com/font/{fontstack}/{range}.pbf',
  spriteUrl: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
};

describe('getSatelliteHybridStyle', () => {
  it('composes the raster imagery source beneath the vector overlay', () => {
    const style = getSatelliteHybridStyle(args);
    expect(style.name).toBe('satellite-hybrid');
    expect(style.glyphs).toBe(args.glyphs);

    // Raster imagery source with the facade tiles and maxzoom
    const raster = style.sources['satellite-raster'];
    expect(raster).toBeDefined();
    expect(raster).toMatchObject({
      type: 'raster',
      tiles: args.tiles,
      maxzoom: args.sourceMaxZoom,
    });

    // OpenMapTiles vector source for streets/place labels
    expect(style.sources.openmaptiles).toMatchObject({
      type: 'vector',
      url: args.vectorUrl,
    });

    // Sprite for the settlement dots, namespaced to avoid collisions
    // with the hut overlay sprite ('wd') when the styles are composed
    expect(style.sprite).toEqual([{ id: 'ofm-satellite', url: args.spriteUrl }]);
  });

  it('renders the raster first, then roads, then labels on top', () => {
    const style = getSatelliteHybridStyle(args);
    const ids = style.layers.map(l => l.id);

    // The raster layer is the bottom of the stack
    expect(ids[0]).toBe('satellite-raster');

    // Every road casing renders before its fill (casing below the line)
    for (const id of ids) {
      if (id.includes('_casing')) {
        const fill = id.replace('_casing', '');
        expect(ids.indexOf(id)).toBeLessThan(ids.indexOf(fill));
      }
    }

    // All street layers below every place/water label
    const lastStreet = Math.max(
      ...ids.map(id => ids.indexOf(id)).filter(i => !ids[i].includes('label'))
    );
    const firstLabel = ids.findIndex(id => id.includes('label'));
    expect(firstLabel).toBeGreaterThan(lastStreet);

    // The village labels render last (smallest places on top)
    expect(ids[ids.length - 1]).toBe('label_village');
  });

  it('uses satellite-readable colors (translucent streets fading out at street level)', () => {
    const style = getSatelliteHybridStyle(args);
    const byId = Object.fromEntries(style.layers.map(l => [l.id, l]));

    // Street fills are zoom-ramped: constant while zoomed out, fading to
    // 0 at street level so the imagery takes over
    const ramp = (id: string): Array<[number, number]> => {
      const expr = byId[id].paint?.['line-opacity'] as unknown[];
      const pairs: Array<[number, number]> = [];
      for (let i = 3; i + 1 < expr.length; i += 2) {
        pairs.push([expr[i] as number, expr[i + 1] as number]);
      }
      return pairs;
    };

    // White fills: 0.4 from outside, gone by z17
    expect(ramp('road_minor')[0]).toEqual([14.5, 0.4]);
    expect(ramp('road_minor').at(-1)).toEqual([17, 0]);
    // Motorways: capped at 0.65, gone by z18
    expect(ramp('road_motorway')[0]).toEqual([15.5, 0.65]);
    expect(ramp('road_motorway').at(-1)).toEqual([18, 0]);

    // No street line exceeds 0.65 effective opacity (ramp max × casing alpha)
    for (const layer of style.layers) {
      if (layer.type !== 'line') continue;
      const values = ramp(layer.id).map(([, v]) => v);
      const color = String(layer.paint?.['line-color']);
      const alpha = color.startsWith('rgba') ? Number(color.split(',')[3]?.replace(')', '')) : 1;
      for (const v of values) {
        expect(v * alpha, `layer ${layer.id}`).toBeLessThanOrEqual(0.66);
      }
    }

    // Dark translucent casing beneath the fills
    expect(byId['road_minor_casing'].paint?.['line-color']).toBe('rgba(16, 22, 26, 0.5)');
    expect(byId['road_minor'].paint?.['line-color']).toBe('#FFFFFF');
    expect(byId['road_motorway'].paint?.['line-color']).toBe('#FFDD8A');

    // Place labels: white text with a dark halo to read over imagery
    for (const id of ['label_city', 'label_town', 'label_village', 'label_country_1']) {
      expect(byId[id].paint?.['text-color']).toBe('#FFFFFF');
      expect(byId[id].paint?.['text-halo-color']).toMatch(/rgba\(/);
      expect(Number(byId[id].paint?.['text-halo-width'])).toBeGreaterThan(1);
    }
    // Water labels stay distinguishable from place labels
    expect(byId['water_name_point_label'].paint?.['text-color']).not.toBe('#FFFFFF');
  });

  it('references only existing sources and known source-layers', () => {
    const style = getSatelliteHybridStyle(args);
    const sourceIds = new Set(Object.keys(style.sources));
    for (const layer of style.layers) {
      if (layer.type === 'raster') continue;
      expect(sourceIds.has(layer.source as string), `layer ${layer.id}`).toBe(true);
      expect(layer.source).toBe('openmaptiles');
      expect(['transportation', 'place', 'water_name', 'waterway']).toContain(
        (layer as { 'source-layer'?: string })['source-layer']
      );
    }
  });
});
