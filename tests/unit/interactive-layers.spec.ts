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
import { amenityEntry } from '@selection/entries/amenity';
import { amenityClusterEntry } from '@selection/entries/amenity-cluster';
import { geoplaceDefaultEntry } from '@selection/entries/geoplace-default';
import { transportEntry } from '@selection/entries/transport';
import {
  ACCOMMODATIONS_PRESENCE_LAYERS,
  ACCOMMODATIONS_PRESENCE_MIN_ZOOM,
  AMENITY_SUBTREES,
  TRANSPORT_PRESENCE_LAYERS,
  TRANSPORT_PRESENCE_MIN_ZOOM,
  WD_ACCOMMODATIONS_CLUSTER_LAYER,
  WD_ACCOMMODATIONS_LAYER,
} from '@selection/map-layer-ids';

/** Minimal MapLibre stub — only what the tap guard needs. `hidden`:
 *  layers whose visibility is `none` — set at runtime or baked into the
 *  style document; MapLibre reports both through getLayoutProperty. */
function stubMap(opts: {
  zoom: number;
  layers: string[];
  hits?: number;
  hidden?: string[];
}): TapQueryMap {
  return {
    getZoom: () => opts.zoom,
    getLayer: (id: string) => (opts.layers.includes(id) ? ({ id } as StyleLayer) : undefined),
    getLayoutProperty: (id: string) => ((opts.hidden ?? []).includes(id) ? 'none' : undefined),
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
    setDefaultRegistry(
      createRegistry([
        accommodationEntry,
        amenityEntry,
        amenityClusterEntry,
        transportEntry,
        geoplaceDefaultEntry,
      ])
    );
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

  it('claims the accommodations overlay layer at floor 5 (hut details view)', () => {
    setDefaultRegistry(createRegistry([accommodationEntry]));
    try {
      const layers = derivedInteractiveLayers();
      expect(layers).toContainEqual({ id: WD_ACCOMMODATIONS_LAYER, minZoom: 5 });
      // Both claim families resolve to the SAME entry (the accommodation
      // detail surface serves huts and geoplace accommodations alike).
      const claims = derivedClaimedLayers();
      expect(claims.find(c => c.id === WD_ACCOMMODATIONS_LAYER)?.entry.id).toBe('accommodation');
      expect(claims.find(c => c.id === 'wd-huts')?.entry.id).toBe('accommodation');
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('claims the TRANSPORT presence layers — a passive station icon is clickable (backend #506)', () => {
    // With the overlay OFF the presence IS the family's POI layer: a click
    // on a passive station icon/names opens the same place the overlay's
    // popup opens (owner 2026-11-26). Same entry → same popup pipeline.
    setDefaultRegistry(createRegistry([transportEntry]));
    try {
      const layers = derivedInteractiveLayers();
      const claims = derivedClaimedLayers();
      for (const layer of TRANSPORT_PRESENCE_LAYERS) {
        // the click gate is strict (zoom > minZoom): floor − 1 opens
        // exactly from the presence's own style floor
        expect(layers).toContainEqual({ id: layer, minZoom: TRANSPORT_PRESENCE_MIN_ZOOM - 1 });
        const claim = claims.find(c => c.id === layer);
        expect(claim?.entry.id).toBe('transport');
        expect(claim?.idProp).toBe('onestop_id');
      }
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('presence ids follow the ONE naming source (legacy transit- alias included)', () => {
    // Derived from presenceLayerPrefix — a rename there follows here.
    expect([...TRANSPORT_PRESENCE_LAYERS]).toEqual([
      'wd-basemap-transit-stations',
      'wd-basemap-transit-stations-label',
    ]);
    expect([...ACCOMMODATIONS_PRESENCE_LAYERS]).toEqual([
      'wd-basemap-accommodations-icons',
      'wd-basemap-accommodations-labels',
    ]);
  });

  it('claims the ACCOMMODATIONS presence layers — a passive icon is clickable', () => {
    setDefaultRegistry(createRegistry([accommodationEntry]));
    try {
      const layers = derivedInteractiveLayers();
      const claims = derivedClaimedLayers();
      for (const layer of ACCOMMODATIONS_PRESENCE_LAYERS) {
        expect(layers).toContainEqual({ id: layer, minZoom: ACCOMMODATIONS_PRESENCE_MIN_ZOOM - 1 });
        const claim = claims.find(c => c.id === layer);
        expect(claim?.entry.id).toBe('accommodation');
        expect(claim?.idProp).toBe('slug');
      }
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('a tap on a presence station opens from its floor (strict gate)', () => {
    const map = stubMap({
      zoom: TRANSPORT_PRESENCE_MIN_ZOOM,
      layers: [...TRANSPORT_PRESENCE_LAYERS],
      hits: 1,
    });
    expect(
      tapTargetsInteractiveLayer(map, 10, 10, [
        { id: TRANSPORT_PRESENCE_LAYERS[0], minZoom: TRANSPORT_PRESENCE_MIN_ZOOM - 1 },
      ])
    ).toBe(true);
    // one zoom below the floor nothing renders → no claim
    const below = stubMap({
      zoom: TRANSPORT_PRESENCE_MIN_ZOOM - 1,
      layers: [...TRANSPORT_PRESENCE_LAYERS],
      hits: 1,
    });
    expect(
      tapTargetsInteractiveLayer(below, 10, 10, [
        { id: TRANSPORT_PRESENCE_LAYERS[0], minZoom: TRANSPORT_PRESENCE_MIN_ZOOM - 1 },
      ])
    ).toBe(false);
  });

  it('claims all ten amenity symbol layers at their tier floors', () => {
    setDefaultRegistry(createRegistry([amenityEntry]));
    try {
      const layers = derivedInteractiveLayers();
      expect(layers).toEqual(
        AMENITY_SUBTREES.map(({ subtree, minZoom }) => ({ id: `wd-${subtree}`, minZoom }))
      );
      // spot-check the three tiers (backend importance bands)
      expect(layers.find(l => l.id === 'wd-restaurant')).toEqual({
        id: 'wd-restaurant',
        minZoom: 5,
      });
      expect(layers.find(l => l.id === 'wd-groceries')).toEqual({
        id: 'wd-groceries',
        minZoom: 9,
      });
      expect(layers.find(l => l.id === 'wd-automotive')).toEqual({
        id: 'wd-automotive',
        minZoom: 13,
      });
      // claims resolve to the amenity entry (popup surface)
      for (const claim of derivedClaimedLayers()) {
        expect(claim.entry.id).toBe('amenity');
        expect(claim.idProp).toBe('slug');
      }
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('claims the cluster layers at the same tier floors (cluster entry)', () => {
    setDefaultRegistry(createRegistry([amenityClusterEntry]));
    try {
      const layers = derivedInteractiveLayers();
      // ten subtree clusters + the accommodations cluster, floors mirror
      // the symbol layers
      expect(layers).toEqual([
        ...AMENITY_SUBTREES.map(({ subtree, minZoom }) => ({
          id: `wd-${subtree}-clusters`,
          minZoom,
        })),
        { id: WD_ACCOMMODATIONS_CLUSTER_LAYER, minZoom: 5 },
      ]);
      for (const claim of derivedClaimedLayers()) {
        expect(claim.entry.id).toBe('amenity-cluster');
      }
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

  it('ignores a HIDDEN claimed layer even where a feature renders', () => {
    // queryRenderedFeatures does not check `visibility`: a family's
    // passive presence, hidden while its overlay is on, still answers.
    // Without this filter an invisible stop would claim the tap and
    // keep it from the overlay's own icons. (A visibility baked into the
    // style document by a basemap switch is reported the same way.)
    const hidden = stubMap({ zoom: 12, layers: ['wd-huts'], hits: 1, hidden: ['wd-huts'] });
    expect(tapTargetsInteractiveLayer(hidden, 5, 5, LAYERS)).toBe(false);
    expect(hidden.queryRenderedFeatures).not.toHaveBeenCalled();
    // a layer with no visibility set is shown
    const shown = stubMap({ zoom: 12, layers: ['wd-huts'], hits: 1 });
    expect(tapTargetsInteractiveLayer(shown, 5, 5, LAYERS)).toBe(true);
    // …and the check never serializes the style: no getStyle on the map
    expect('getStyle' in shown).toBe(false);
  });

  it('treats a layer as not shown while its style cannot answer', () => {
    const broken = {
      ...stubMap({ zoom: 12, layers: ['wd-huts'], hits: 1 }),
      getLayoutProperty: () => {
        throw new Error('style not loaded');
      },
    };
    expect(tapTargetsInteractiveLayer(broken, 5, 5, LAYERS)).toBe(false);
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
