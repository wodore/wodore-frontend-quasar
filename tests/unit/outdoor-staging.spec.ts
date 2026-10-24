import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as allure from 'allure-js-commons';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Staged basemap loading (perf/staged-map-load): the outdoor style's
 * terrain stack (raster-DEM sources, hillshade/color-relief/contour
 * layers) and pattern-only sprite sets are stripped from the FIRST
 * style apply and re-attached after the base map rendered. These specs
 * pin the classification and the attach contract.
 */

// The contour protocol registration must not build a real DemSource
// (web worker) in the node test environment.
const setupSpy = vi.fn();
vi.mock('@services/outdoorContours', () => ({
  setupOutdoorContours: (...args: unknown[]) => setupSpy(...args),
  isOutdoorStyle: (style: unknown) => typeof style === 'string' && style.includes('wd-outdoor'),
  OUTDOOR_STYLE_IDS: ['wd-outdoor-base-mtk', 'wd-outdoor-base-ofm'],
}));

import {
  stageStyleEnhancements,
  attachStagedEnhancements,
  attachStagedSprites,
  isDeferredTerrainLayer,
  type StagingMapLike,
} from '@services/outdoor-staging';

/** A trimmed outdoor-style shape: vector base + terrain stack +
 *  essential and pattern-only sprites. */
function outdoorStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Wodore Outdoor Base (test)',
    glyphs: 'https://tiles.example.com/font/{fontstack}/{range}.pbf',
    sprite: [
      { id: 'sdf', url: 'https://icons.example.com/sprite' },
      { id: 'nature', url: 'https://icons.example.com/nature' },
      { id: 'water', url: 'https://icons.example.com/water' },
      { id: 'wd-maps', url: 'https://tiles.example.com/sprite/wd-maps' },
    ],
    sources: {
      mtk: { type: 'vector', url: 'https://tiles.example.com/mtk.json' },
      contours: { type: 'vector', url: 'https://tiles.example.com/contours.json' },
      'rgb-tiles': { type: 'raster-dem', url: 'https://tiles.example.com/terrainrgb.json' },
      bathymetry: { type: 'raster-dem', url: 'https://tiles.example.com/bathymetry.json' },
      'swiss-relief': { type: 'raster', tiles: ['https://wmts.example.com/{z}/{x}/{y}'] },
    },
    layers: [
      { id: 'background', type: 'background' },
      {
        id: 'relief_hillshade_lowzoom',
        type: 'hillshade',
        source: 'rgb-tiles',
      },
      {
        id: 'nature_naturalearth',
        type: 'raster',
        source: 'mtk',
      } as LayerSpecification,
      {
        id: 'water_bathymetry',
        type: 'color-relief',
        source: 'bathymetry',
      },
      {
        id: 'relief_contour_multicolored',
        type: 'line',
        source: 'contours',
      },
      {
        id: 'relief_contour_multicolored_label',
        type: 'symbol',
        source: 'contours',
        layout: { 'text-field': ['get', 'ele'] },
      } as LayerSpecification,
      {
        id: 'swiss-relief',
        type: 'raster',
        source: 'swiss-relief',
      } as LayerSpecification,
      {
        id: 'place_point_label_rank_1',
        type: 'symbol',
        source: 'mtk',
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'category'], 'capital'],
            'wd-maps:star',
            'wd-maps:ring-dot',
          ],
          'text-font': ['literal', ['Barlow Regular']],
        },
      } as LayerSpecification,
      {
        id: 'poi_generic_label_rank_2',
        type: 'symbol',
        source: 'mtk',
        layout: { 'icon-image': ['concat', 'sdf:', ['get', 'type']] },
      } as LayerSpecification,
      {
        id: 'water_area_texture',
        type: 'fill',
        source: 'mtk',
        paint: { 'fill-pattern': ['step', ['zoom'], 'water:water_small', 16, 'water:water_large'] },
      } as LayerSpecification,
      {
        id: 'nature_natural_texture',
        type: 'fill',
        source: 'mtk',
        paint: { 'fill-pattern': ['concat', 'nature:', ['get', 'type']] },
      } as LayerSpecification,
      {
        // individual tree symbols — z15 icons must NOT bind the (huge)
        // nature sprite to the first render
        id: 'nature_natural_tree_texture',
        type: 'symbol',
        source: 'mtk',
        minzoom: 15,
        layout: { 'icon-image': 'nature:tree' },
      } as LayerSpecification,
    ],
  } as unknown as StyleSpecification;
}

beforeEach(() => {
  setupSpy.mockClear();
});

describe('isDeferredTerrainLayer', () => {
  it('classifies hillshade, color-relief, contour and raster relief layers', () => {
    expect(
      isDeferredTerrainLayer({ id: 'x', type: 'hillshade', source: 'dem' } as LayerSpecification)
    ).toBe(true);
    expect(
      isDeferredTerrainLayer({ id: 'x', type: 'color-relief', source: 'dem' } as LayerSpecification)
    ).toBe(true);
    expect(
      isDeferredTerrainLayer({
        id: 'relief_contour_x',
        type: 'line',
        source: 'c',
      } as LayerSpecification)
    ).toBe(true);
    expect(
      isDeferredTerrainLayer({
        id: 'contour-labels',
        type: 'symbol',
        source: 'c',
      } as LayerSpecification)
    ).toBe(true);
    expect(
      isDeferredTerrainLayer({
        id: 'swiss-relief',
        type: 'raster',
        source: 'r',
      } as LayerSpecification)
    ).toBe(true);
  });

  it('keeps the base map: fills, lines, labels, non-relief rasters', () => {
    expect(
      isDeferredTerrainLayer({
        id: 'water_area',
        type: 'fill',
        source: 'mtk',
      } as LayerSpecification)
    ).toBe(false);
    expect(
      isDeferredTerrainLayer({
        id: 'road_major',
        type: 'line',
        source: 'mtk',
      } as LayerSpecification)
    ).toBe(false);
    expect(
      isDeferredTerrainLayer({
        id: 'place_point_label_rank_1',
        type: 'symbol',
        source: 'mtk',
      } as LayerSpecification)
    ).toBe(false);
    // rocks raster is imagery, not relief; naturalearth is the z0-5 base paper
    expect(
      isDeferredTerrainLayer({
        id: 'nature_rocks',
        type: 'raster',
        source: 'rocks',
      } as LayerSpecification)
    ).toBe(false);
    expect(
      isDeferredTerrainLayer({
        id: 'nature_naturalearth',
        type: 'raster',
        source: 'ne',
      } as LayerSpecification)
    ).toBe(false);
  });
});

describe('stageStyleEnhancements', () => {
  it('splits the outdoor style into a base-first initial and deferred terrain + sprites', () => {
    allure.label('feature', 'map-performance');
    const staged = stageStyleEnhancements(outdoorStyle())!;

    // initial keeps the base: background, labels, fills, naturalearth
    const initialIds = staged.initial.layers.map(l => l.id);
    expect(initialIds).toEqual([
      'background',
      'nature_naturalearth',
      'place_point_label_rank_1',
      'poi_generic_label_rank_2',
      'water_area_texture',
      'nature_natural_texture',
      'nature_natural_tree_texture',
    ]);

    // terrain sources are gone from the initial style
    expect(Object.keys(staged.initial.sources)).toEqual(['mtk']);
    // …and the initial sprite array only carries icon-referenced sets
    expect(staged.initial.sprite).toEqual([
      { id: 'sdf', url: 'https://icons.example.com/sprite' },
      { id: 'wd-maps', url: 'https://tiles.example.com/sprite/wd-maps' },
    ]);

    // deferred: DEM sources + the contour tileset only terrain uses
    expect(Object.keys(staged.deferred.sources).sort()).toEqual([
      'bathymetry',
      'contours',
      'rgb-tiles',
      'swiss-relief',
    ]);
    expect(staged.deferred.layers.map(l => l.layer.id)).toEqual([
      'relief_hillshade_lowzoom',
      'water_bathymetry',
      'relief_contour_multicolored',
      'relief_contour_multicolored_label',
      'swiss-relief',
    ]);
    // pattern-only sprite packs are deferred
    expect(staged.deferred.sprites).toEqual([
      { id: 'nature', url: 'https://icons.example.com/nature' },
      { id: 'water', url: 'https://icons.example.com/water' },
    ]);
  });

  it('computes re-insertion anchors from the original layer order', () => {
    const staged = stageStyleEnhancements(outdoorStyle())!;
    const anchors = Object.fromEntries(staged.deferred.layers.map(l => [l.layer.id, l.beforeId]));
    // hillshade sat before naturalearth; bathymetry, contours and
    // swiss-relief all sit before the place labels (their anchor)
    expect(anchors['relief_hillshade_lowzoom']).toBe('nature_naturalearth');
    expect(anchors['water_bathymetry']).toBe('place_point_label_rank_1');
    expect(anchors['relief_contour_multicolored']).toBe('place_point_label_rank_1');
    expect(anchors['relief_contour_multicolored_label']).toBe('place_point_label_rank_1');
    expect(anchors['swiss-relief']).toBe('place_point_label_rank_1');
  });

  it('anchors a deferred layer at the very top with undefined (append)', () => {
    const style = outdoorStyle();
    style.layers = [
      ...style.layers,
      { id: 'relief_hillshade_server', type: 'raster', source: 'mtk' } as LayerSpecification,
    ];
    const staged = stageStyleEnhancements(style)!;
    const top = staged.deferred.layers.at(-1)!;
    expect(top.layer.id).toBe('relief_hillshade_server');
    expect(top.beforeId).toBeUndefined();
  });

  it('is non-mutating — the input style object stays complete', () => {
    const style = outdoorStyle();
    const layersBefore = style.layers.map(l => l.id);
    stageStyleEnhancements(style);
    expect(style.layers.map(l => l.id)).toEqual(layersBefore);
    expect(Object.keys(style.sources)).toHaveLength(5);
    expect(style.sprite).toHaveLength(4);
  });

  it('returns null for styles without deferrable parts (satellite/topo)', () => {
    const plain = {
      ...outdoorStyle(),
      sources: { sat: { type: 'raster', tiles: ['https://t.example.com/{z}/{x}/{y}'] } },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      sprite: 'https://tiles.example.com/sprite/wd-maps',
    } as unknown as StyleSpecification;
    expect(stageStyleEnhancements(plain)).toBeNull();
  });

  it('registers the dem-contour protocol before staging such a style', () => {
    const style = outdoorStyle();
    (style.sources.contours as { tiles: string[] }).tiles = [
      'dem-contour://9/{z}/{x}/{y}?thresholds=11*200*1000',
    ];
    delete (style.sources.contours as { url?: string }).url;
    stageStyleEnhancements(style);
    expect(setupSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps a raster-dem source deferred even when layers are absent', () => {
    const style = outdoorStyle();
    style.layers = style.layers.filter(l => l.type !== 'hillshade');
    const staged = stageStyleEnhancements(style)!;
    expect(staged.deferred.sources['rgb-tiles']).toBeDefined();
    expect(staged.initial.sources['rgb-tiles']).toBeUndefined();
  });

  it('bails out of staging when a top-level terrain references a deferred raster-dem (review B1)', () => {
    // A style-level terrain whose DEM source would be deferred must not
    // produce an initial style referencing a deleted source — staging is
    // skipped entirely and the caller applies the full style.
    const style = outdoorStyle();
    (style as { terrain?: unknown }).terrain = { source: 'rgb-tiles', exaggeration: 1.2 };
    expect(stageStyleEnhancements(style)).toBeNull();

    // Terrain over a RETAINED source (the vector basemap) does not block staging.
    const retainedDem = outdoorStyle();
    (retainedDem as { terrain?: unknown }).terrain = { source: 'mtk', exaggeration: 1.0 };
    const staged = stageStyleEnhancements(retainedDem)!;
    expect(staged.initial.sources['rgb-tiles']).toBeUndefined();
  });

  it('binds a sprite to the first render only via sub-z13 icon layers', () => {
    // a sprite whose icon refs all sit at z13+ defers (nature trees);
    // one referenced below z13 (poi icons at z7, place labels at z1) stays
    const staged = stageStyleEnhancements(outdoorStyle())!;
    const deferredIds = staged.deferred.sprites.map(s => s.id);
    expect(deferredIds).toContain('nature');
    expect(deferredIds).toContain('water');
    expect(deferredIds).not.toContain('sdf');
    expect(deferredIds).not.toContain('wd-maps');

    // same sprite referenced at z12.9 → essential again
    const boundary = outdoorStyle();
    const poi = boundary.layers.find(
      l => l.id === 'poi_generic_label_rank_2'
    ) as LayerSpecification;
    (poi as { minzoom?: number }).minzoom = 12.9;
    const stagedBoundary = stageStyleEnhancements(boundary)!;
    expect(stagedBoundary.deferred.sprites.map(s => s.id)).not.toContain('sdf');
    expect(stagedBoundary.deferred.sprites.map(s => s.id)).toContain('nature');
  });
});

describe('attachStagedEnhancements', () => {
  function stubMap(
    opts: { existingLayers?: string[]; existingSources?: string[]; existingSprites?: string[] } = {}
  ) {
    const layers = new Set(opts.existingLayers ?? []);
    const sources = new Set(opts.existingSources ?? []);
    const sprites = new Set(opts.existingSprites ?? []);
    const calls: { op: string; args: unknown[] }[] = [];
    const map: StagingMapLike & { calls: typeof calls } = {
      calls,
      getLayer: id => (layers.has(id) ? { id } : undefined),
      addLayer: (layer, beforeId) => {
        layers.add(layer.id);
        calls.push({ op: 'addLayer', args: [layer.id, beforeId] });
      },
      getSource: id => (sources.has(id) ? { id } : undefined),
      addSource: (id, source) => {
        sources.add(id);
        calls.push({ op: 'addSource', args: [id, source] });
      },
      getSprite: () => [...sprites].map(id => ({ id })),
      addSprite: (id, url) => {
        sprites.add(id);
        calls.push({ op: 'addSprite', args: [id, url] });
      },
    };
    return map;
  }

  const anchors = ['background', 'nature_naturalearth', 'place_point_label_rank_1'];

  it('re-adds sources, layers at their anchors (sprites attach on demand)', () => {
    const staged = stageStyleEnhancements(outdoorStyle())!;
    const map = stubMap({ existingLayers: anchors });
    expect(attachStagedEnhancements(map, staged.deferred)).toBe(true);
    const ops = map.calls.map(c => `${c.op}:${String(c.args[0])}`);
    expect(ops).toContain('addSource:rgb-tiles');
    expect(ops).toContain('addLayer:relief_hillshade_lowzoom');
    // Sprites are split out of the terrain attach (zoom >= 13 / settle):
    // the base attach must NOT add them, the dedicated call does.
    expect(ops).not.toContain('addSprite:nature');
    attachStagedSprites(map, staged.deferred);
    const opsAfter = map.calls.map(c => `${c.op}:${String(c.args[0])}`);
    expect(opsAfter).toContain('addSprite:nature');
    // layer insertions use their captured anchors
    const hillshade = map.calls.find(
      c => c.op === 'addLayer' && c.args[0] === 'relief_hillshade_lowzoom'
    )!;
    expect(hillshade.args[1]).toBe('nature_naturalearth');
    const contours = map.calls.find(
      c => c.op === 'addLayer' && c.args[0] === 'relief_contour_multicolored'
    )!;
    expect(contours.args[1]).toBe('place_point_label_rank_1');
    // swiss-relief sat before the place labels → anchored there
    const swiss = map.calls.find(c => c.op === 'addLayer' && c.args[0] === 'swiss-relief')!;
    expect(swiss.args[1]).toBe('place_point_label_rank_1');
  });

  it('is idempotent — a second attach (idle + safety timer) adds nothing', () => {
    const staged = stageStyleEnhancements(outdoorStyle())!;
    const map = stubMap({ existingLayers: anchors });
    attachStagedEnhancements(map, staged.deferred);
    const first = map.calls.length;
    expect(attachStagedEnhancements(map, staged.deferred)).toBe(true);
    expect(map.calls.length).toBe(first);
  });

  it('aborts when an anchor layer is gone — the style changed under us', () => {
    const staged = stageStyleEnhancements(outdoorStyle())!;
    // basemap switched: anchor layers no longer present
    const map = stubMap({ existingLayers: ['some-other-style-layer'] });
    expect(attachStagedEnhancements(map, staged.deferred)).toBe(false);
    expect(map.calls).toHaveLength(0);
  });

  it('registers the dem-contour protocol before adding such sources', () => {
    const style = outdoorStyle();
    (style.sources.contours as { tiles: string[] }).tiles = ['dem-contour://9/{z}/{x}/{y}'];
    delete (style.sources.contours as { url?: string }).url;
    const staged = stageStyleEnhancements(style)!;
    setupSpy.mockClear();
    const map = stubMap({ existingLayers: anchors });
    attachStagedEnhancements(map, staged.deferred);
    const proto = map.calls.findIndex(c => c.op === 'addSource' && c.args[0] === 'contours');
    expect(setupSpy).toHaveBeenCalledTimes(1);
    expect(proto).toBeGreaterThanOrEqual(0);
  });
});
