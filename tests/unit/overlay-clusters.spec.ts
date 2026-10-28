/**
 * Unit tests for the overlay cluster conventions
 * (src/stores/map/utils/overlay-clusters.ts):
 *
 * - isClusterLayer — the `['has', 'point_count']` filter convention
 *   marking cluster render layers (backend TRANSPORT_STYLE),
 * - isClusterCountLayer — the `-cluster-count` id suffix of the count
 *   badge layer the user setting toggles,
 * - clusterCountVisibility — the overlay-switch × user-setting
 *   composition (clusters always render; ONLY badges hide),
 * - isClusterLayer/isClusterCountLayer — the layer conventions the
 *   fallback adapter parses the clustered subset twin with.
 */
import { describe, expect, it } from 'vitest';
import {
  CLUSTER_COUNT_LAYER_SUFFIX,
  clusterCountVisibility,
  isClusterCountLayer,
  isClusterLayer,
} from '@stores/map/utils/overlay-clusters';

describe('overlay-clusters', () => {
  it('isClusterLayer matches only the has-point_count filter', () => {
    expect(isClusterLayer({ filter: ['has', 'point_count'] })).toBe(true);
    // the unclustered layer's negated filter must NOT match
    expect(isClusterLayer({ filter: ['!', ['has', 'point_count']] })).toBe(false);
    expect(isClusterLayer({ filter: ['==', ['get', 'kind'], 'station'] })).toBe(false);
    expect(isClusterLayer({})).toBe(false);
    expect(isClusterLayer({ filter: 'point_count' })).toBe(false);
  });

  it('isClusterCountLayer keys on the id suffix', () => {
    expect(isClusterCountLayer('transport-stops-cluster-count')).toBe(true);
    // the cluster circle layer is NOT a count layer
    expect(isClusterCountLayer('transport-stops-clusters')).toBe(false);
    expect(isClusterCountLayer('transport-stops')).toBe(false);
    expect(CLUSTER_COUNT_LAYER_SUFFIX).toBe('-cluster-count');
  });

  it('clusterCountVisibility composes switch and setting (clusters always render)', () => {
    expect(clusterCountVisibility(true, true)).toBe('visible');
    // setting off hides ONLY the badges
    expect(clusterCountVisibility(true, false)).toBe('none');
    // overlay off hides everything
    expect(clusterCountVisibility(false, true)).toBe('none');
    expect(clusterCountVisibility(undefined, true)).toBe('none');
  });
});
