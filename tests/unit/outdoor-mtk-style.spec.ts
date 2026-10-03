import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { StyleSpecification } from 'maplibre-gl';

const STYLE_DIR = resolve(process.cwd(), 'public/styles/outdoor-mtk');
const STYLE_PATH = resolve(STYLE_DIR, 'style.json');

/**
 * Guards for the Maptoolkit-based default outdoor basemap
 * (scripts/style/build-mtk-style.mjs). Community License: attribution
 * via TileJSON, logo overlay required in the app, no pre-fetch/offline/
 * print use (OFM fallback covers those).
 */
describe('outdoor-mtk basemap style', () => {
  const style: StyleSpecification = JSON.parse(readFileSync(STYLE_PATH, 'utf8'));
  const layerIds = style.layers.map(l => l.id);

  it('validates against the MapLibre style spec', () => {
    allure.label('feature', 'basemap-styles');
    allure.severity('critical');
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('is the Wodore fork of the Maptoolkit hiking style', () => {
    expect(style.name).toBe('Wodore Outdoor (Maptoolkit)');
  });

  it('uses the mtk tiles and the server-side contour tileset', () => {
    expect(style.sources['mtk']).toMatchObject({
      type: 'vector',
      url: expect.stringContaining('tiles.maptoolkit.org'),
    });
    expect(style.sources['contours']).toMatchObject({
      type: 'vector',
      url: expect.stringContaining('tiles.maptoolkit.org'),
    });
  });

  it('carries the terrain stack: contours, rock drawing, hillshade', () => {
    for (const id of [
      'relief_contour_multicolored', // server contours (ele/divisor/terrain_type)
      'relief_hillshade_ao_min', // ambient-occlusion hillshade
      'road_path_alpine', // alpine paths incl. via ferrata (dashed)
    ]) {
      expect(layerIds, `missing layer ${id}`).toContain(id);
    }
    // rock drawing ships as raster + vector textures
    expect(Object.keys(style.sources)).toContain('rocks');
  });

  it('renders NO routes — the hiking overlay owns them', () => {
    for (const id of [
      'road_hiking',
      'road_hiking_label',
      'road_hiking_shield',
      'road_hiking_node_shield',
      'road_path_scale_label',
    ]) {
      expect(layerIds, `layer ${id} must not exist`).not.toContain(id);
    }
  });

  it('keeps huts anonymous: no hut POI layer', () => {
    expect(layerIds, 'poi_hut_label must not exist (hut overlay owns huts)').not.toContain(
      'poi_hut_label'
    );
  });

  it('ships a single style with local names only', () => {
    // no per-locale variants — one style, mtk's local name fields
    for (const loc of ['de', 'en', 'fr', 'it']) {
      expect(existsSync(resolve(STYLE_DIR, `style.${loc}.json`)), `style.${loc}.json`).toBe(false);
    }
    const tf = JSON.stringify(style.layers.find(l => l.id === 'place_point_label_rank_1'));
    // primary name is the local one (mtk's own nonlatin latin-second-line
    // ladder may still reference name_en/name_fr/… — that stays)
    for (const loc of ['de', 'fr', 'it', 'en']) {
      expect(tf).not.toContain(`["get","name_${loc}"],["get","name"]`);
    }
    expect(tf).toContain('["get","name"]');
  });

  it('renders no accommodation POIs (lodging + hut layers gone)', () => {
    for (const l of style.layers.filter(l => l.id.startsWith('poi_generic_label'))) {
      expect(JSON.stringify(l.filter), `${l.id} excludes lodging`).toContain('lodging');
    }
  });

  it('adds swisstopo-style settlement dots mirroring label rank bands', () => {
    // one dot layer per place-label rank band: a dot appears exactly
    // when its place label layer becomes active
    for (const n of ['1', '2', '3', '4', '5']) {
      expect(layerIds).toContain(`wd-place-dot-${n}`);
    }
    expect(layerIds).not.toContain('wd-place-dot-big');
    expect(layerIds).not.toContain('wd-place-dot-small');
    const border = style.layers.find(l => l.id === 'border_admin_country');
    expect(JSON.stringify(border?.paint)).toContain('hsla(306, 30%, 40%, 1)');
  });

  it('declutters generic POIs (rank 4/5 pushed to later zooms)', () => {
    const r4 = style.layers.find(l => l.id === 'poi_generic_label_rank_4');
    const r5 = style.layers.find(l => l.id === 'poi_generic_label_rank_5');
    expect(r4?.minzoom).toBeGreaterThanOrEqual(14);
    expect(r5?.minzoom).toBeGreaterThanOrEqual(15.5);
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
