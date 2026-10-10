import { describe, it, expect, vi } from 'vitest';
import type { StyleLayer } from 'maplibre-gl';
import {
  INTERACTIVE_LAYERS,
  tapTargetsInteractiveLayer,
  type TapQueryMap,
} from '@stores/map/utils/interactive-layers';
import { MIN_HUT_CLICK_ZOOM } from '@stores/map/utils/map-constants';

/** Minimal MapLibre stub — only what tapTargetsInteractiveLayer needs. */
function stubMap(opts: { zoom: number; layers: string[]; hits?: number }): TapQueryMap {
  return {
    getZoom: () => opts.zoom,
    getLayer: (id: string) => (opts.layers.includes(id) ? ({ id } as StyleLayer) : undefined),
    queryRenderedFeatures: vi.fn(() => new Array(opts.hits ?? 0)),
  };
}

describe('interactive-layers', () => {
  it('registers the hut layer behind the shared hut-click zoom gate', () => {
    expect(INTERACTIVE_LAYERS).toContainEqual({
      id: 'wd-huts',
      minZoom: MIN_HUT_CLICK_ZOOM,
    });
  });

  it('falls through at the zoom gate even when a feature renders', () => {
    // zoom === gate is NOT handled (strict >), mirroring onHutLayerClick
    const map = stubMap({ zoom: MIN_HUT_CLICK_ZOOM, layers: ['wd-huts'], hits: 1 });
    expect(tapTargetsInteractiveLayer(map, 5, 5)).toBe(false);
  });

  it('claims the tap above the gate when a feature renders', () => {
    const map = stubMap({ zoom: MIN_HUT_CLICK_ZOOM + 1, layers: ['wd-huts'], hits: 2 });
    expect(tapTargetsInteractiveLayer(map, 5, 5)).toBe(true);
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith([5, 5], { layers: ['wd-huts'] });
  });

  it('falls through when no feature renders above the gate', () => {
    const map = stubMap({ zoom: 12, layers: ['wd-huts'], hits: 0 });
    expect(tapTargetsInteractiveLayer(map, 5, 5)).toBe(false);
  });

  it('ignores registry layers missing from the current map', () => {
    const map = stubMap({ zoom: 12, layers: [], hits: 0 });
    expect(tapTargetsInteractiveLayer(map, 5, 5)).toBe(false);
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it('falls through when the query throws (style not loaded)', () => {
    const map = stubMap({ zoom: 12, layers: ['wd-huts'] });
    map.queryRenderedFeatures = vi.fn(() => {
      throw new Error('style not loaded');
    });
    expect(tapTargetsInteractiveLayer(map, 5, 5)).toBe(false);
  });
});
