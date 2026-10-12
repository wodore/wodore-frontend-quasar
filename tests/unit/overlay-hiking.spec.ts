import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';

import hikingLayersJson from '@stores/map/utils/overlay-hiking.json';
import {
  hikingStyle,
  HIKING_LAYER_IDS,
  HIKING_SOURCE,
  MTK_TILES_URL,
} from '@stores/map/utils/overlay-hiking';

/** Recursively collect every string from an expression tree. */
function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach(n => strings(n, out));
  return out;
}

describe('overlay-hiking', () => {
  it('reuses the basemap mtk source id (no duplicate tile downloads)', () => {
    allure.label('feature', 'map-overlays');
    expect(HIKING_SOURCE).toBe('mtk');
    const source = hikingStyle.sources[HIKING_SOURCE];
    expect(source).toBeDefined();
    expect(source.type).toBe('vector');
    expect(source.url).toBe(MTK_TILES_URL);
    // mtk serves vector tiles up to z15 — overzoom beyond
    expect(source.maxzoom).toBe(15);
    // Community License: attribution must be carried
    expect(source.attribution).toContain('OpenStreetMap');
    expect(source.attribution).toContain('Maptoolkit');
  });

  it('exposes unique wd-hiking-* layer ids', () => {
    expect(HIKING_LAYER_IDS.length).toBeGreaterThan(0);
    expect(new Set(HIKING_LAYER_IDS).size).toBe(HIKING_LAYER_IDS.length);
    for (const id of HIKING_LAYER_IDS) expect(id).toMatch(/^wd-hiking-/);
    expect(hikingStyle.layers.map(l => l.id)).toEqual(HIKING_LAYER_IDS);
  });

  it('renders only OSM walking-network ways, per Swiss color code', () => {
    const lineLayers = hikingLayersJson.filter(l => l.type === 'line');
    expect(lineLayers.length).toBe(5);
    for (const layer of lineLayers) {
      // every tier filters on the walking networks (iwn/nwn/rwn/lwn)
      const s = strings(layer.filter);
      for (const network of ['iwn', 'nwn', 'rwn', 'lwn']) {
        expect(s).toContain(network);
      }
      expect(layer.source).toBe('mtk');
      expect(layer['source-layer']).toBe('road');
    }

    const byId = Object.fromEntries(hikingLayersJson.map(l => [l.id, l]));

    // Swiss color code: yellow easy / red mountain / blue alpine
    expect(byId['wd-hiking-easy'].paint['line-color']).toBe('#fdc200');
    expect(byId['wd-hiking-mountain-dashed'].paint['line-color']).toBe('#ff0000');
    expect(byId['wd-hiking-mountain-sparse'].paint['line-color']).toBe('#ff0000');
    expect(byId['wd-hiking-alpine-dashed'].paint['line-color']).toBe('#0000ff');
    expect(byId['wd-hiking-alpine-dots'].paint['line-color']).toBe('#0000ff');
  });

  it('encodes difficulty in the dash grammar (solid → dashed → dots)', () => {
    const byId = Object.fromEntries(hikingLayersJson.map(l => [l.id, l]));

    // T1 (and untagged ways) stays solid
    expect(byId['wd-hiking-easy'].paint['line-dasharray']).toBeUndefined();
    expect(strings(byId['wd-hiking-easy'].filter)).toContain('T1');

    // dash periods shrink as difficulty grows — the same ladder the
    // wd-outdoor-base-mtk basemap uses for its path layers
    expect(byId['wd-hiking-mountain-dashed'].paint['line-dasharray']).toEqual([3, 2]);
    expect(strings(byId['wd-hiking-mountain-dashed'].filter)).toContain('T2');
    expect(byId['wd-hiking-mountain-sparse'].paint['line-dasharray']).toEqual([2, 2.5]);
    expect(strings(byId['wd-hiking-mountain-sparse'].filter)).toContain('T3');
    expect(byId['wd-hiking-alpine-dashed'].paint['line-dasharray']).toEqual([1.5, 3]);
    expect(strings(byId['wd-hiking-alpine-dashed'].filter)).toContain('T4');

    // T5/T6 + via ferrata: dots with round caps (butt caps would
    // vanish at [0.1, 2])
    const dots = byId['wd-hiking-alpine-dots'];
    expect(dots.paint['line-dasharray']).toEqual([0.1, 2]);
    expect(dots.layout['line-cap']).toBe('round');
    expect(strings(dots.filter)).toContain('T5');
    expect(strings(dots.filter)).toContain('T6');
    expect(strings(dots.filter)).toContain('via_ferrata');

    // dashed tiers use butt caps — round caps bridge the gaps
    expect(byId['wd-hiking-mountain-dashed'].layout['line-cap']).toBe('butt');
    expect(byId['wd-hiking-alpine-dashed'].layout['line-cap']).toBe('butt');
    // the solid tier keeps round caps
    expect(byId['wd-hiking-easy'].layout['line-cap']).toBe('round');
  });

  it('never colors via ferrata as easy, and defaults untagged ways to easy', () => {
    const easy = Object.fromEntries(hikingLayersJson.map(l => [l.id, l]))['wd-hiking-easy'];
    // explicit via_ferrata exclusion next to the T1/untagged match
    expect(strings(easy.filter)).toContain('via_ferrata');
    expect(JSON.stringify(easy.filter)).toContain('"!",["has","sac_scale"]');
  });

  it('labels come from road_label (names + ref shields) on walking networks', () => {
    const byId = Object.fromEntries(hikingLayersJson.map(l => [l.id, l]));

    const name = byId['wd-hiking-name'];
    expect(name.type).toBe('symbol');
    expect(name['source-layer']).toBe('road_label');
    expect(strings(name.filter)).toContain('network');
    expect(name.minzoom).toBeGreaterThanOrEqual(12);

    const shield = byId['wd-hiking-shield'];
    expect(shield.type).toBe('symbol');
    expect(shield['source-layer']).toBe('road_label');
    // LineString-only (node shields excluded), ref required
    expect(strings(shield.filter)).toContain('LineString');
    expect(strings(shield.filter)).toContain('ref');
    // icon-optional: text survives basemaps without the sdf sprite
    expect(shield.layout['icon-optional']).toBe(true);
  });

  it('shows routes early but calm: rwn from z7, lwn from z8, thin at country zoom', () => {
    const easy = hikingLayersJson.find(l => l.id === 'wd-hiking-easy')!;
    const opacity = JSON.stringify(easy.paint['line-opacity']);
    // z7 stop: international + national + REGIONAL visible, local still 0
    expect(opacity).toContain('["iwn","nwn","rwn"],0.7,0');
    // z7.8 stop: local joins slightly fainter (0.7) than the rest (0.9)
    expect(opacity).toContain('["lwn"],0.7,0.9');
    // the mtk tiles carry NO walking networks below z7 anywhere (checked
    // against live tiles) — nothing renders below the data floor
    expect(easy.minzoom).toBeLessThanOrEqual(7);
    // thin threads at country zoom growing to the full ribbon
    const width = easy.paint['line-width'];
    const z7 = width[width.indexOf(7) + 1];
    const z13 = width[width.indexOf(13) + 1];
    expect(z7).toBeLessThanOrEqual(0.8);
    expect(z13).toBeGreaterThanOrEqual(3);
  });

  it('route-number badges (Wanderland Routenfeld style) only at reading zoom', () => {
    const shield = hikingLayersJson.find(l => l.id === 'wd-hiking-shield')!;
    // yellow badge, upright along the line, from hiking zoom — earlier it
    // floats without context (mapy.cz / SchweizMobil show numbers only
    // when the trail mesh is distinguishable)
    expect(shield.minzoom).toBeGreaterThanOrEqual(11);
    expect(shield.layout['symbol-placement']).toBe('line');
    expect(shield.layout['icon-rotation-alignment']).toBe('viewport');
    expect(shield.paint['icon-color']).toBe('#fdc200');
  });

  it('composes a valid style for the overlay switch', () => {
    expect(hikingStyle.version).toBe(8);
    expect(hikingStyle.name).toBe('hiking');
    expect(Object.keys(hikingStyle.sources)).toEqual(['mtk']);
  });

  it('uses at most ONE zoom-based expression per paint/layout property', () => {
    // MapLibre rule: "Only one zoom-based step or interpolate
    // subexpression may be used in an expression" — zoom may ONLY appear
    // as the input (3rd element) of the property's ROOT interpolate/step.
    // A violation silently drops the whole layer at addLayer time (this
    // exact bug shipped as step × interpolate and was caught in browser
    // testing — never again without a test).
    const isZoom = (node: unknown) =>
      Array.isArray(node) && node.length === 1 && node[0] === 'zoom';

    /** Count `['zoom']` nodes that are NOT the input of the root
     * interpolate/step (i.e. illegal nested zoom expressions). NOTE the
     * spec shapes: ["interpolate", curve, input, …] (input at index 2)
     * but ["step", input, …] (input at index 1). */
    function illegalZoomUses(node: unknown, isRoot: boolean): number {
      if (!Array.isArray(node)) return 0;
      if (isZoom(node)) return isRoot ? 0 : 1;
      if (isRoot && (node[0] === 'interpolate' || node[0] === 'step')) {
        const input = node[0] === 'step' ? node[1] : node[2];
        const rest = node[0] === 'step' ? node.slice(2) : node.slice(3);
        // root with zoom input: everything below must be zoom-free
        if (isZoom(input)) return rest.reduce((n, x) => n + illegalZoomUses(x, false), 0);
      }
      return node.reduce((n, x) => n + illegalZoomUses(x, false), 0);
    }

    for (const layer of hikingLayersJson) {
      for (const [group, props] of [
        ['paint', layer.paint],
        ['layout', layer.layout],
      ] as const) {
        for (const [prop, value] of Object.entries(props ?? {})) {
          const illegal = illegalZoomUses(value, true);
          expect(illegal, `${layer.id}.${group}.${prop}`).toBe(0);
        }
      }
    }
  });
});
