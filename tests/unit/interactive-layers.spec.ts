import { describe, it, expect, vi } from 'vitest';
import type { StyleLayer } from 'maplibre-gl';
import {
  derivedClaimedLayers,
  derivedInteractiveLayers,
  tapTargetsInteractiveLayer,
  type TapQueryMap,
} from '@stores/map/utils/interactive-layers';
import { MIN_HUT_CLICK_ZOOM } from '@stores/map/utils/map-constants';
import { createRegistry, setDefaultRegistry } from '@selection/registry';
import { definePresentation, type Presentation } from '@selection/types';
import { accommodationEntry } from '@selection/entries/accommodation';
import { geoplaceDefaultEntry } from '@selection/entries/geoplace-default';

/** Minimal MapLibre stub — only what tapTargetsInteractiveLayer needs. */
function stubMap(opts: { zoom: number; layers: string[]; hits?: number }): TapQueryMap {
  return {
    getZoom: () => opts.zoom,
    getLayer: (id: string) => (opts.layers.includes(id) ? ({ id } as StyleLayer) : undefined),
    queryRenderedFeatures: vi.fn(() => new Array(opts.hits ?? 0)),
  };
}

function entryWithClaim(id: string, layer: string, minZoom?: number): Presentation {
  return definePresentation<Record<string, unknown>>({
    id,
    match: { source: 'geoplace' },
    capabilities: ['detail'],
    mapLayers: [{ layer, minZoom }],
  });
}

describe('derived interactive layers', () => {
  it('compiles entry layer claims into the interactive list (order, gates)', () => {
    const a = entryWithClaim('a', 'layer-a', 7);
    const b = entryWithClaim('b', 'layer-b');
    expect(derivedInteractiveLayers([a, b])).toEqual([
      { id: 'layer-a', minZoom: 7 },
      { id: 'layer-b', minZoom: undefined },
    ]);
    // Claimed layers carry their owning entry (claim-based resolution).
    expect(derivedClaimedLayers([a, b]).map(c => c.entry.id)).toEqual(['a', 'b']);
  });

  it('includes the wd-huts claim with the hut-click zoom gate from the entries', () => {
    // The INSTALLED registry (entries/index via the store import chain is
    // not part of this spec — install explicitly).
    setDefaultRegistry(createRegistry([accommodationEntry, geoplaceDefaultEntry]));
    try {
      const layers = derivedInteractiveLayers();
      const huts = layers.find(l => l.id === 'wd-huts');
      expect(huts).toEqual({ id: 'wd-huts', minZoom: MIN_HUT_CLICK_ZOOM });
      // The occupation circles carry the same claim (PR2 behavior
      // change): every wd-huts-family layer is interactive.
      expect(layers.filter(l => l.id.startsWith('wd-huts')).length).toBeGreaterThan(1);
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });
});

describe('tapTargetsInteractiveLayer', () => {
  const LAYERS = [
    { id: 'wd-huts', minZoom: MIN_HUT_CLICK_ZOOM },
    { id: 'wd-huts-occupation', minZoom: MIN_HUT_CLICK_ZOOM },
  ];

  it('falls through at the zoom gate even when a feature renders', () => {
    // zoom === gate is NOT handled (strict >), mirroring the click handler
    const map = stubMap({ zoom: MIN_HUT_CLICK_ZOOM, layers: ['wd-huts'], hits: 1 });
    expect(tapTargetsInteractiveLayer(map, 5, 5, LAYERS)).toBe(false);
  });

  it('claims the tap above the gate when a feature renders', () => {
    const map = stubMap({ zoom: MIN_HUT_CLICK_ZOOM + 1, layers: ['wd-huts'], hits: 2 });
    expect(tapTargetsInteractiveLayer(map, 5, 5, LAYERS)).toBe(true);
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith([5, 5], { layers: ['wd-huts'] });
  });

  it('falls through when no feature renders above the gate', () => {
    const map = stubMap({ zoom: 12, layers: ['wd-huts'], hits: 0 });
    expect(tapTargetsInteractiveLayer(map, 5, 5, LAYERS)).toBe(false);
  });

  it('skips layers absent from the current style (catalog epoch safety)', () => {
    const map = stubMap({ zoom: 12, layers: [], hits: 0 });
    expect(tapTargetsInteractiveLayer(map, 5, 5, LAYERS)).toBe(false);
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it('survives a style-not-loaded queryRenderedFeatures throw', () => {
    const map = stubMap({ zoom: 12, layers: ['wd-huts'], hits: 1 });
    (map.queryRenderedFeatures as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('style not loaded');
    });
    expect(tapTargetsInteractiveLayer(map, 5, 5, LAYERS)).toBe(false);
  });
});
