/**
 * Feature → target mapping — the click-pipeline core (OpenSpec
 * `place-interactions`): canonical id per claim idProp, Point location,
 * per-claim zoom gates, global key dedup (same layer AND cross-layer —
 * the hut symbol + its occupation circle collapse), claim-entry
 * passthrough, topmost order.
 */
import { describe, it, expect } from 'vitest';
import {
  targetsFromFeatures,
  targetFromFeature,
  type ClaimRef,
  type RenderedFeatureLike,
} from '@selection/props-from-feature';
import { definePresentation } from '@selection/types';

const hutEntry = definePresentation<Record<string, unknown>>({
  id: 'accommodation',
  match: { source: 'geoplace', kindParent: 'accommodation' },
  capabilities: ['detail'],
});

const claims: Array<ClaimRef & { layer: string }> = [
  { layer: 'wd-huts', source: 'geoplace', idProp: 'slug', minZoom: 8, entry: hutEntry },
  { layer: 'wd-huts-occupation', source: 'geoplace', idProp: 'slug', minZoom: 8, entry: hutEntry },
  // NOTE: no claim for the 'unclaimed' layer — features of layers
  // without a claim are ignored.
];

function feature(
  layer: string,
  props: Record<string, unknown>,
  id = 7,
  geometry: RenderedFeatureLike['geometry'] = { type: 'Point', coordinates: [8.15, 46.55] }
): RenderedFeatureLike {
  return { layer: { id: layer }, source: 'wd-huts', sourceLayer: 'huts', id, properties: props, geometry };
}

describe('targetFromFeature', () => {
  it('builds the target from the claim idProp, Point geometry and raw props', () => {
    const t = targetFromFeature(
      feature('wd-huts', { slug: 'aarbiwak', name_de: 'Aarbiwak', elevation: 2310 }),
      { source: 'geoplace', idProp: 'slug' }
    );
    expect(t).not.toBeNull();
    expect(t!.id).toBe('aarbiwak');
    expect(t!.source).toBe('geoplace');
    expect(t!.location).toEqual({ lat: 46.55, lon: 8.15 });
    expect(t!.props).toEqual({ slug: 'aarbiwak', name_de: 'Aarbiwak', elevation: 2310 });
    expect(t!.featureRef).toEqual({
      engine: 'maplibre',
      handle: { source: 'wd-huts', sourceLayer: 'huts', id: 7 },
    });
  });

  it('defaults the id property to slug', () => {
    const t = targetFromFeature(feature('x', { slug: 's1' }), { source: 'geoplace' });
    expect(t!.id).toBe('s1');
  });

  it('returns null when the canonical id property is missing (skip, not guess)', () => {
    expect(targetFromFeature(feature('x', { name: 'no id' }), { source: 'geoplace' })).toBeNull();
    expect(targetFromFeature(feature('x', { slug: '' }), { source: 'geoplace' })).toBeNull();
  });

  it('omits location for non-Point geometry', () => {
    const t = targetFromFeature(
      feature('x', { slug: 's' }, 1, { type: 'LineString', coordinates: [] }),
      { source: 'geoplace' }
    );
    expect(t!.location).toBeUndefined();
  });
});

describe('targetsFromFeatures', () => {
  it('ignores features of unclaimed layers and enforces the strict zoom gate', () => {
    const items = targetsFromFeatures(
      [feature('unclaimed', { slug: 'u' }), feature('wd-huts', { slug: 'h1' })],
      claims,
      8 // zoom === gate: strict > fails
    );
    expect(items).toEqual([]);
  });

  it('claims features above the gate and passes the claim entry through', () => {
    const items = targetsFromFeatures([feature('wd-huts', { slug: 'h1' })], claims, 9);
    expect(items).toHaveLength(1);
    expect(items[0].target.id).toBe('h1');
    expect(items[0].entry).toBe(hutEntry);
  });

  it('dedupes the same key ACROSS layers (symbol + occupation circle = one item)', () => {
    const items = targetsFromFeatures(
      [
        feature('wd-huts-occupation', { slug: 'same-hut' }, 42), // topmost
        feature('wd-huts', { slug: 'same-hut' }, 7),
      ],
      claims,
      9
    );
    expect(items).toHaveLength(1);
    // Topmost (first) feature wins the featureRef.
    expect((items[0].target.featureRef as { handle: { id: number } }).handle.id).toBe(42);
  });

  it('dedupes stacked features of the SAME layer (no 1/1 switcher)', () => {
    const items = targetsFromFeatures(
      [feature('wd-huts', { slug: 'a' }, 1), feature('wd-huts', { slug: 'a' }, 2)],
      claims,
      9
    );
    expect(items).toHaveLength(1);
  });

  it('keeps DISTINCT targets in topmost order', () => {
    const items = targetsFromFeatures(
      [feature('wd-huts', { slug: 'b' }, 1), feature('wd-huts', { slug: 'a' }, 2)],
      claims,
      9
    );
    expect(items.map(i => i.target.id)).toEqual(['b', 'a']);
  });
});
