import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { StyleSpecification } from 'maplibre-gl';

const STYLE_PATH = resolve(process.cwd(), 'dist/martin/wd-outdoor-base-ofm/style.json');

/**
 * Guards for the generated outdoor basemap style
 * (scripts/style/build-outdoor-style.mjs). These pin the keyless,
 * no-MapTiler contract and the layer hooks the app depends on.
 */
describe('outdoor basemap style', () => {
  const style: StyleSpecification = JSON.parse(readFileSync(STYLE_PATH, 'utf8'));
  const layerIds = style.layers.map(l => l.id);

  it('validates against the MapLibre style spec', () => {
    allure.label('feature', 'basemap-styles');
    allure.severity('critical');
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('is keyless: no api.maptiler.com or key= URLs anywhere', () => {
    const raw = JSON.stringify(style);
    expect(raw).not.toContain('api.maptiler.com');
    expect(raw).not.toMatch(/[?&]key=/);
  });

  it('uses OpenFreeMap planet tiles and the Mapterhorn DEM', () => {
    expect(style.sources['openmaptiles']).toMatchObject({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
    expect(style.sources['dem-mapterhorn']).toMatchObject({
      type: 'raster-dem',
      encoding: 'terrarium',
      maxzoom: 15,
    });
  });

  it('registers contour tiles via the client-side dem-contour:// protocol', () => {
    const contours = style.sources['contours'] as { type: string; tiles: string[] };
    expect(contours.type).toBe('vector');
    expect(contours.tiles[0]).toMatch(/^dem-contour:\/\//);
    // thresholds must stay in sync with src/services/outdoorContours.ts
    expect(contours.tiles[0]).toContain('thresholds=11*200*1000');
  });

  it('carries the required attributions on its sources', () => {
    const all = JSON.stringify(style.sources);
    expect(all).toContain('openstreetmap.org/copyright');
    expect(all).toContain('openfreemap.org');
    expect(all).toContain('mapterhorn.com');
  });

  it('has the hillshade, contour and peak layers the basemap promises', () => {
    for (const id of [
      'hillshade',
      'contour-lines',
      'contour-labels',
      'peak-rank1',
      'peak-rank2',
      'peak-minor',
    ]) {
      expect(layerIds, `missing layer ${id}`).toContain(id);
    }
    const hillshade = style.layers.find(l => l.id === 'hillshade');
    expect(hillshade?.source).toBe('dem-mapterhorn');
  });

  it('renders the full trail hierarchy (track, footway, cycleway, steps)', () => {
    for (const id of [
      'trail-track',
      'trail-cycleway',
      'trail-footway',
      'trail-pedestrian',
      'trail-steps',
    ]) {
      expect(layerIds, `missing layer ${id}`).toContain(id);
    }
  });

  it('keeps huts anonymous: no generic POI layers, buildings only', () => {
    // Liberty's rank-based POI layers must be gone (hut overlay owns POIs)
    for (const id of ['poi_r1', 'poi_r7', 'poi_r20']) {
      expect(layerIds, `layer ${id} must not exist`).not.toContain(id);
    }
    // the only POI symbol layers left are functional ones
    const poiLayers = style.layers.filter(l => l['source-layer'] === 'poi');
    expect(poiLayers.map(l => l.id)).toEqual(
      expect.arrayContaining(['poi_transit', 'poi-parking'])
    );
    // peaks come from mountain_peak, not poi
    expect(style.layers.some(l => l['source-layer'] === 'mountain_peak')).toBe(true);
  });

  it('has unique layer ids and every layer source exists', () => {
    expect(new Set(layerIds).size).toBe(layerIds.length);
    for (const l of style.layers) {
      if ('source' in l && l.source) {
        expect(Object.keys(style.sources), `layer ${l.id}`).toContain(l.source);
      }
    }
  });
});
