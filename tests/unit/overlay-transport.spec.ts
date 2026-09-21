import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import { transportStyle } from '@stores/map/utils/overlay-transport';

describe('transportStyle', () => {
  it('builds a geojson source with promoted ids', () => {
    allure.label('feature', 'map-overlays');
    allure.severity('critical');

    expect(transportStyle.version).toBe(8);
    const sources = transportStyle.sources as Record<string, Record<string, unknown>>;
    const source = sources['transport-stops'];
    expect(source.type).toBe('geojson');
    expect(source.promoteId).toBe('id');
    expect(String(source.data)).toContain('bav-haltestellen');
  });

  it('adds one circle layer that is hidden by default', () => {
    expect(transportStyle.layers).toHaveLength(1);
    const layer = transportStyle.layers[0];
    expect(layer.id).toBe('transport-stops');
    expect(layer.type).toBe('circle');
    expect(layer.source).toBe('transport-stops');
    expect((layer.layout as Record<string, unknown>).visibility).toBe('none');
  });

  it('colors stops by type with train before bus before other', () => {
    const layer = transportStyle.layers[0];
    const color = (layer.paint as Record<string, unknown>)['circle-color'] as unknown[];
    // ['case', ['in', 'train', ...], trainColor, ['in', 'bus', ...], busColor, otherColor]
    expect(color[0]).toBe('case');
    expect(color[1]).toEqual(['in', 'train', ['get', 'types']]);
    expect(color[2]).toBe('#C60018'); // train (SBB red)
    expect(color[3]).toEqual(['in', 'bus', ['get', 'types']]);
    expect(color[4]).toBe('#2d327d'); // bus
    expect(color[5]).toBe('#0079C7'); // other/fallback
  });

  it('scales the radius by zoom with per-type values', () => {
    const layer = transportStyle.layers[0];
    const radius = (layer.paint as Record<string, unknown>)['circle-radius'] as unknown[];
    expect(radius[0]).toBe('interpolate');
    expect(radius[1]).toEqual(['linear']);
    expect(radius[2]).toEqual(['zoom']);
    const stops = radius.filter((_, i) => i >= 3 && i % 2 === 1);
    const values = radius.filter((_, i) => i >= 4 && i % 2 === 0);
    expect(stops).toEqual([7, 9, 16]);
    // zoom 7: train 3 / bus 2 / other 1; zoom 9: 4/3/3; zoom 16: 9/8/8
    const typeValue = (expr: unknown[]) => {
      const caseExpr = expr as unknown[];
      // case: train, bus, other values at indices 2, 4, 5
      return [caseExpr[2], caseExpr[4], caseExpr[5]];
    };
    expect(typeValue(values[0] as unknown[])).toEqual([3, 2, 1]);
    expect(typeValue(values[1] as unknown[])).toEqual([4, 3, 3]);
    expect(typeValue(values[2] as unknown[])).toEqual([9, 8, 8]);
  });
});
