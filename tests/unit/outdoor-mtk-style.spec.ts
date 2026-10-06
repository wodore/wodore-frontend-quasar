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

  it('tunes terrain for presence: hillshade from country zoom, rocks z12–17', () => {
    // Linear zoom interpolation of an ["interpolate", ["linear"], ["zoom"], z, v, …] stop list
    const zoomValue = (stops: unknown[], z: number): number => {
      const pairs = (stops as unknown[]).slice(3); // ["interpolate", ["linear"], ["zoom"], z, v, …]
      let lo = [pairs[0] as number, pairs[1] as number];
      let hi = lo;
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const zStop = pairs[i] as number;
        const vStop = pairs[i + 1] as number;
        if (zStop <= z) lo = [zStop, vStop];
        if (zStop >= z) {
          hi = [zStop, vStop];
          break;
        }
      }
      if (lo[0] === hi[0]) return lo[1];
      return lo[1] + ((hi[1] - lo[1]) * (z - lo[0])) / (hi[0] - lo[0]);
    };

    // swisstopo runs relief from z0 — our AO must be clearly present at
    // country zoom, not only in the mountains up close
    for (const id of ['relief_hillshade_ao_min', 'relief_hillshade_ao_med']) {
      const ex = style.layers.find(l => l.id === id)!.paint['hillshade-exaggeration'] as unknown[];
      expect(zoomValue(ex, 5.5)).toBeGreaterThanOrEqual(0.2);
      expect(zoomValue(ex, 13)).toBeGreaterThanOrEqual(0.4);
    }

    // Rock drawing: swisstopo scree spans z11→z17 — ours starts fading
    // in at z12 and keeps a floor into the overzoomed range instead of
    // dropping out at z15.5
    const rocks = style.layers.find(l => l.id === 'nature_rocks')!;
    expect(rocks.minzoom).toBeLessThanOrEqual(12);
    expect(rocks.maxzoom).toBeGreaterThanOrEqual(17);
    const op = rocks.paint['raster-opacity'] as unknown[];
    expect(zoomValue(op, 13)).toBeGreaterThanOrEqual(0.25); // visible mid-band
    expect(zoomValue(op, 15.5)).toBeGreaterThanOrEqual(0.3); // no more cliff at 15.5
    expect(zoomValue(op, 16)).toBeGreaterThanOrEqual(0.25); // stays on when zoomed in

    // Vector stipple textures carry full detail at hiking zooms
    // (swisstopo's pattern_landcover_z16 band)
    const texture = style.layers.find(l => l.id === 'nature_natural_texture')!;
    const ramp = texture.paint['fill-opacity'] as unknown[];
    expect(zoomValue(ramp, 16.5)).toBeGreaterThanOrEqual(0.55);
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

  it('draws swisstopo-style streets when zoomed in: dark casings hug the fills', () => {
    const zoomValue = (stops: unknown[], z: number): number => {
      const pairs = (stops as unknown[]).slice(3);
      // road_minor widths carry per-type match arms — resolve the
      // minor/service branch
      const resolve = (v: unknown): number => {
        if (Array.isArray(v) && v[0] === 'match') {
          const idx = (v as unknown[]).findIndex(
            a => Array.isArray(a) && a[0] === 'minor' && a[1] === 'service'
          );
          return (idx >= 0 ? (v as unknown[])[idx + 1] : (v as unknown[])[v.length - 1]) as number;
        }
        return v as number;
      };
      let lo = [pairs[0] as number, resolve(pairs[1])];
      let hi = lo;
      for (let i = 0; i + 1 < pairs.length; i += 2) {
        const zStop = pairs[i] as number;
        const vStop = resolve(pairs[i + 1]);
        if (zStop <= z) lo = [zStop, vStop];
        if (zStop >= z) {
          hi = [zStop, vStop];
          break;
        }
      }
      if (lo[0] === hi[0]) return lo[1];
      return lo[1] + ((hi[1] - lo[1]) * (z - lo[0])) / (hi[0] - lo[0]);
    };
    // Casings must be solid underlays: no inherited line-gap-width
    // (mtk's hollow strokes float off our narrower fills)
    for (const id of [
      'road_minor_casing',
      'road_minor_casing_bridge',
      'road_major_casing',
      'road_major_casing_bridge',
    ]) {
      const l = style.layers.find(x => x.id === id)!;
      expect(l.paint['line-gap-width'] ?? 0, `${id} gap-width`).toBe(0);
    }
    // Minor roads carry the swisstopo look: bold-ish white fill with a
    // dark ~1px edge per side (casing ≈ fill + 2) from z14 on
    const minor = style.layers.find(l => l.id === 'road_minor')!;
    const minorW = minor.paint['line-width'] as unknown[];
    expect(zoomValue(minorW, 16)).toBeGreaterThanOrEqual(5);
    const minorCasing = style.layers.find(l => l.id === 'road_minor_casing')!;
    const casingW = minorCasing.paint['line-width'] as unknown[];
    expect(zoomValue(casingW, 16) - zoomValue(minorW, 16)).toBeGreaterThanOrEqual(1.8);
    // Casing ink: near-black grey (swisstopo rgb(60,60,60) = #3C3C3C)
    expect(JSON.stringify(minorCasing.paint['line-color'])).toContain('#3C3C3C');
    // Paths + tracks use swisstopo ink, too
    for (const id of ['road_path', 'road_path_urban', 'wd-track']) {
      const col = JSON.stringify(style.layers.find(l => l.id === id)!.paint['line-color']);
      expect(col, `${id} ink`).toContain('rgb(');
      expect(col).not.toContain('hsla(0, 0%, 6');
    }
    // Parking: crisp white patch with dark edge (swisstopo landuse_parking)
    expect(layerIds).toContain('wd-parking');
    expect(layerIds).toContain('wd-parking-casing');
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
