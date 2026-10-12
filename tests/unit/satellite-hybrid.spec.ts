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

  it('uses satellite-readable colors (translucent streets, white labels with dark halo)', () => {
    const style = getSatelliteHybridStyle(args);
    const byId = Object.fromEntries(style.layers.map(l => [l.id, l]));

    // Dark translucent casing beneath a SEMI-TRANSPARENT white road fill —
    // solid streets would cover the imagery (maptiler-style hybrid)
    expect(byId['road_minor_casing'].paint?.['line-color']).toBe('rgba(16, 22, 26, 0.5)');
    expect(byId['road_minor'].paint?.['line-color']).toBe('#FFFFFF');
    expect(Number(byId['road_minor'].paint?.['line-opacity'])).toBeLessThan(1);
    // Motorways keep their distinct yellow, a touch more opaque
    expect(byId['road_motorway'].paint?.['line-color']).toBe('#FFDD8A');
    expect(Number(byId['road_motorway'].paint?.['line-opacity'])).toBeLessThan(1);

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
