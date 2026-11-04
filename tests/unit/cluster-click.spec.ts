//
// Server-side cluster click behavior (amenity overlays): the decision
// logic, tile-zoom derivation, tile-URL cluster-param forwarding and the
// synthetic popup target — pure functions of
// src/selection/cluster-behavior.ts.
import { describe, it, expect } from 'vitest';
import {
  CLUSTER_LIST_MAX,
  CLUSTER_ZOOM_STEP,
  categoryTreeOfSubtree,
  clusterClickAction,
  clusterCountOf,
  clusterParamsFromTilesUrl,
  clusterTargetFromFeature,
  isClusterLayerId,
  isClusterProps,
  servedTileZoom,
  subtreeOfLayerId,
} from '@selection/cluster-behavior';

describe('clusterCountOf / isClusterProps', () => {
  it('reads numeric counts and floors them', () => {
    expect(clusterCountOf({ count: 3 })).toBe(3);
    expect(clusterCountOf({ count: 2.7 })).toBe(2);
    expect(clusterCountOf({ count: '4' })).toBe(4);
  });

  it('tolerates absent or garbage counts', () => {
    expect(clusterCountOf(undefined)).toBe(0);
    expect(clusterCountOf({})).toBe(0);
    expect(clusterCountOf({ count: null })).toBe(0);
    expect(clusterCountOf({ count: 'many' })).toBe(0);
    expect(clusterCountOf({ count: -2 })).toBe(0);
  });

  it('clusters are count > 1 (count==1 features are individuals)', () => {
    expect(isClusterProps({ count: 2 })).toBe(true);
    expect(isClusterProps({ count: 12 })).toBe(true);
    expect(isClusterProps({ count: 1 })).toBe(false);
    expect(isClusterProps({})).toBe(false);
    expect(isClusterProps(null)).toBe(false);
  });
});

describe('clusterClickAction (member threshold 6)', () => {
  it('lists members below the threshold', () => {
    for (let n = 2; n < CLUSTER_LIST_MAX; n++) {
      expect(clusterClickAction(n)).toBe('members');
    }
  });

  it('zooms in at and above the threshold', () => {
    expect(clusterClickAction(CLUSTER_LIST_MAX)).toBe('zoom');
    expect(clusterClickAction(50)).toBe('zoom');
    expect(clusterClickAction(1000)).toBe('zoom');
  });

  it('degenerate counts zoom (never an empty list popup)', () => {
    expect(clusterClickAction(0)).toBe('zoom');
    expect(clusterClickAction(-3)).toBe('zoom');
  });

  it('exports the zoom step used by easeTo', () => {
    expect(CLUSTER_ZOOM_STEP).toBe(1.5);
  });
});

describe('servedTileZoom (integer floor, source-maxzoom cap)', () => {
  it('floors the fractional camera zoom', () => {
    expect(servedTileZoom(7.94)).toBe(7);
    expect(servedTileZoom(12.02)).toBe(12);
  });

  it('caps at the declared source maxzoom (overzoom rule)', () => {
    expect(servedTileZoom(12.5, 9)).toBe(9);
    expect(servedTileZoom(8.5, 9)).toBe(8);
    expect(servedTileZoom(9, 9)).toBe(9);
  });

  it('ignores garbage maxzoom declarations', () => {
    expect(servedTileZoom(12.9, Number.NaN)).toBe(12);
  });

  it('never goes negative', () => {
    expect(servedTileZoom(-1.2)).toBe(0);
  });
});

describe('clusterParamsFromTilesUrl (forwardable cluster params)', () => {
  const TILE_URL =
    'https://tiles.cdn.stg.wodore.com/geoplaces/{z}/{x}/{y}.mlt?category_tree=restaurant&fields=color,parent_color,parent_slug,importance,count,name,slug&max_label_zoom=11&cluster_max_zoom=7&cache_ttl_days=1&v=61819a9574f9';

  it('extracts only the forwardable cluster params', () => {
    expect(clusterParamsFromTilesUrl(TILE_URL)).toEqual({ cluster_max_zoom: '7' });
  });

  it('extracts several when present', () => {
    const url =
      'https://t.example/geoplaces/{z}/{x}/{y}.mlt?cluster_max_zoom=7&cluster_radius_m=5000&cluster_ref_zoom=8&importance_threshold=40';
    expect(clusterParamsFromTilesUrl(url)).toEqual({
      cluster_max_zoom: '7',
      cluster_radius_m: '5000',
      cluster_ref_zoom: '8',
      importance_threshold: '40',
    });
  });

  it('skips empty values and non-cluster params', () => {
    expect(clusterParamsFromTilesUrl('https://t.example/t.mlt?cluster_max_zoom=&lang=de')).toEqual(
      {}
    );
  });

  it('tolerates missing or malformed URLs', () => {
    expect(clusterParamsFromTilesUrl(undefined)).toEqual({});
    expect(clusterParamsFromTilesUrl(null)).toEqual({});
    expect(clusterParamsFromTilesUrl('not a url')).toEqual({});
  });
});

describe('layer-id mapping', () => {
  it('recognizes cluster layer ids (suffix, amenity family)', () => {
    expect(isClusterLayerId('wd-restaurant-clusters')).toBe(true);
    expect(isClusterLayerId('wd-accommodations-clusters')).toBe(true);
    expect(isClusterLayerId('wd-health_and_emergency-clusters')).toBe(true);
  });

  it('rejects symbol layers, badges and foreign ids', () => {
    expect(isClusterLayerId('wd-restaurant')).toBe(false);
    expect(isClusterLayerId('wd-restaurant-cluster-count')).toBe(false);
    expect(isClusterLayerId('wd-restaurant-selected')).toBe(false);
    expect(isClusterLayerId('transport-stops')).toBe(false);
    expect(isClusterLayerId(null)).toBe(false);
  });

  it('extracts the subtree from symbol and cluster layer ids', () => {
    expect(subtreeOfLayerId('wd-restaurant')).toBe('restaurant');
    expect(subtreeOfLayerId('wd-restaurant-clusters')).toBe('restaurant');
    expect(subtreeOfLayerId('wd-accommodations')).toBe('accommodations');
    expect(subtreeOfLayerId('wd-utilities-clusters')).toBe('utilities');
    expect(subtreeOfLayerId('transport-stops')).toBeNull();
    expect(subtreeOfLayerId('wd-')).toBeNull();
  });

  it('maps subtrees to near-endpoint category trees', () => {
    expect(categoryTreeOfSubtree('restaurant')).toBe('restaurant');
    expect(categoryTreeOfSubtree('accommodations')).toBe('accommodation');
  });
});

describe('clusterTargetFromFeature', () => {
  const feature = {
    layer: { id: 'wd-restaurant-clusters' },
    source: 'wd-restaurant',
    sourceLayer: 'geoplaces',
    id: 42,
    properties: { count: 3, color: '#4B8E43', parent_color: '#777', parent_slug: 'restaurant' },
    geometry: { type: 'Point', coordinates: [8.5417, 47.3769] },
  };

  it('builds a cluster-source target anchored at the feature geometry', () => {
    const target = clusterTargetFromFeature(feature, {
      tileZoom: 7,
      nearParams: { cluster_max_zoom: '7' },
    })!;
    expect(target).not.toBeNull();
    expect(target.source).toBe('cluster');
    expect(target.location).toEqual({ lat: 47.3769, lon: 8.5417 });
    expect(target.key).toContain('wd-restaurant-clusters@');
    expect(target.key).toContain(String(target.id));
    expect(target.props.count).toBe(3);
    expect(target.props.subtree).toBe('restaurant');
    // the near-query context travels for the member fetch
    expect(target.props.tileZoom).toBe(7);
    expect(target.props.nearParams).toEqual({ cluster_max_zoom: '7' });
    // colors travel for the member-list markers
    expect(target.props.color).toBe('#4B8E43');
    // the featureRef (selection highlight) rides along
    expect(target.featureRef?.engine).toBe('maplibre');
    expect(target.featureRef?.handle).toEqual({
      source: 'wd-restaurant',
      sourceLayer: 'geoplaces',
      id: 42,
    });
  });

  it('is stable for the same feature (popup toggle key)', () => {
    const a = clusterTargetFromFeature(feature, { tileZoom: 7, nearParams: {} })!;
    const b = clusterTargetFromFeature(feature, { tileZoom: 8, nearParams: {} })!;
    expect(a.key).toBe(b.key);
  });

  it('drops the highlight handle for empty-string feature ids (placeholder slugs)', () => {
    // Cluster features carry slug='' under promoteId — an ''-id
    // feature-state write selects EVERY cluster in the source at once
    // (mass blue halos, staging 2026-11-04). The synthetic popup id
    // stays unique; only the highlight handle must vanish.
    const emptyId = clusterTargetFromFeature(
      { ...feature, id: '' },
      { tileZoom: 7, nearParams: {} }
    )!;
    expect(emptyId).not.toBeNull();
    expect(emptyId.key).toContain('wd-restaurant-clusters@');
    expect(emptyId.featureRef).toBeUndefined();

    const numericId = clusterTargetFromFeature(feature, { tileZoom: 7, nearParams: {} })!;
    expect(numericId.featureRef?.handle).toMatchObject({ id: 42 });
  });

  it('returns null for individuals, non-cluster layers, missing geometry', () => {
    expect(
      clusterTargetFromFeature(
        { ...feature, properties: { count: 1 } },
        { tileZoom: 6, nearParams: {} }
      )
    ).toBeNull();
    expect(
      clusterTargetFromFeature(
        { ...feature, layer: { id: 'wd-restaurant' }, properties: { count: 3 } },
        { tileZoom: 6, nearParams: {} }
      )
    ).toBeNull();
    expect(
      clusterTargetFromFeature({ ...feature, geometry: null }, { tileZoom: 6, nearParams: {} })
    ).toBeNull();
    expect(
      clusterTargetFromFeature(
        { ...feature, geometry: { type: 'LineString', coordinates: [] } },
        { tileZoom: 6, nearParams: {} }
      )
    ).toBeNull();
  });
});
