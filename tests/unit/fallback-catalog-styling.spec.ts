// @vitest-environment happy-dom
/**
 * Unit tests for the fallback map's backend-driven styling modules
 * (backend #440 style-profiles-subset):
 *
 * * parseStatusColors (fallback/status-colors) — deriving the occupation
 *   status palette from the served huts style's `wd-huts-occupation`
 *   circle-color match expression, with the offline fallback semantics.
 * * paintOpacityAtZoom (fallback/overlay-adapter) — evaluating the
 *   raster overlays' resolved `raster-opacity` (number or
 *   interpolate-on-zoom expression) for Leaflet's constant-opacity API.
 *
 * happy-dom: overlay-adapter imports leaflet (module side effects need
 * a window), same docblock pattern as the store specs.
 */
import { describe, expect, it } from 'vitest';
import { parseStatusColors, STATUS_COLORS } from '@components/map/fallback/status-colors';
import { paintOpacityAtZoom } from '@components/map/fallback/overlay-adapter';
import type { StyleSpecification } from 'maplibre-gl';

const style = (layers: unknown): StyleSpecification =>
  ({ version: 8, sources: {}, layers }) as unknown as StyleSpecification;

/** The served shape (backend seed_lib _avail_colors(0) verbatim). */
const SERVED_MATCH = [
  'match',
  ['get', 'd0_status'],
  'empty',
  '#25BF5E',
  'low',
  '#F6AD4B',
  'medium',
  '#EA9A37',
  'free_unknown',
  '#7FAB88',
  'high',
  '#C3731F',
  'full',
  '#961A17',
  'rgba(0,0,0,0)',
];

const hutsStyle = (circleColor: unknown): StyleSpecification =>
  style([
    {
      id: 'wd-huts',
      type: 'symbol',
      source: 'wd-huts',
      paint: {},
    },
    {
      id: 'wd-huts-occupation',
      type: 'circle',
      source: 'wd-bookings',
      sourceLayer: 'availability',
      paint: { 'circle-color': circleColor },
    },
  ]);

describe('parseStatusColors', () => {
  it('parses the served match expression into the status palette', () => {
    const parsed = parseStatusColors(hutsStyle(SERVED_MATCH));
    expect(parsed).toEqual({
      empty: '#25BF5E',
      low: '#F6AD4B',
      medium: '#EA9A37',
      free_unknown: '#7FAB88',
      high: '#C3731F',
      full: '#961A17',
    });
  });

  it('parses a served palette that drifted from the offline copy', () => {
    const parsed = parseStatusColors(
      hutsStyle([
        'match',
        ['get', 'd0_status'],
        'empty',
        '#00FF00',
        'full',
        '#FF0000',
        'rgba(0,0,0,0)',
      ])
    );
    expect(parsed).toEqual({ empty: '#00FF00', full: '#FF0000' });
  });

  it('returns undefined (keep offline palette) for missing layer/style', () => {
    expect(parseStatusColors(undefined)).toBeUndefined();
    expect(parseStatusColors(style([]))).toBeUndefined();
    expect(parseStatusColors(style([{ id: 'wd-huts', type: 'symbol' }]))).toBeUndefined();
  });

  it('returns undefined for non-match or malformed paint', () => {
    expect(parseStatusColors(hutsStyle('#25BF5E'))).toBeUndefined();
    expect(
      parseStatusColors(hutsStyle(['step', ['get', 'd0_status'], '#fff', 5, '#000']))
    ).toBeUndefined();
    // A match on an unrelated property must not masquerade as statuses.
    expect(
      parseStatusColors(hutsStyle(['match', ['get', 'type'], 'hut', '#fff', '#000']))
    ).toBeUndefined();
    // Non-hex color values (theme tokens) keep the offline palette.
    expect(
      parseStatusColors(hutsStyle(['match', ['get', 'd0_status'], 'empty', 'red', '#fff']))
    ).toBeUndefined();
  });

  it('offline fallback stays a valid superset of the served palette', () => {
    // The hardcoded STATUS_COLORS must cover every status the served
    // expression carries — an offline session never loses a status.
    const parsed = parseStatusColors(hutsStyle(SERVED_MATCH))!;
    for (const status of Object.keys(parsed)) {
      expect(STATUS_COLORS[status]).toBeDefined();
    }
  });
});

describe('paintOpacityAtZoom', () => {
  const curve = ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 0.6, 22, 0.5];

  it('passes static numbers through, clamped', () => {
    expect(paintOpacityAtZoom(0.75, 10)).toBe(0.75);
    expect(paintOpacityAtZoom(1.4, 10)).toBe(1);
    expect(paintOpacityAtZoom(-0.2, 10)).toBe(0);
  });

  it('interpolates linearly between stops', () => {
    expect(paintOpacityAtZoom(curve, 8)).toBe(0.9);
    expect(paintOpacityAtZoom(curve, 11)).toBeCloseTo(0.75); // midpoint 8→14
    expect(paintOpacityAtZoom(curve, 14)).toBe(0.6);
  });

  it('clamps at the stop range ends (MapLibre semantics)', () => {
    expect(paintOpacityAtZoom(curve, 2)).toBe(0.9); // below first stop
    expect(paintOpacityAtZoom(curve, 30)).toBe(0.5); // above last stop
  });

  it('renders unknown shapes fully opaque', () => {
    expect(paintOpacityAtZoom(undefined, 10)).toBe(1);
    expect(paintOpacityAtZoom('{{mtb.opacity}}', 10)).toBe(1); // unresolved token
    expect(paintOpacityAtZoom(['interpolate', ['linear'], ['get', 'x'], 1, 0.5], 10)).toBe(1);
  });
});

// ── Cluster bucket ordering (legacy mode z-order invariant) ────────────
import {
  AVAIL_BUCKET,
  PLAIN_BUCKET,
  orderLegacyBucketsFirst,
} from '@components/map/fallback/cluster-groups';

describe('orderLegacyBucketsFirst', () => {
  it('creates the plain group before avail regardless of hut-seen order', () => {
    // Owner invariant: availability huts never paint BELOW plain ones —
    // the plain bucket's group must be created (map-added) first, even
    // when an avail hut was seen first in the tile stream.
    const shuffled: Array<[string | null, string[]]> = [
      [AVAIL_BUCKET, ['a']],
      [null, ['n']],
      [PLAIN_BUCKET, ['p']],
    ];
    expect(orderLegacyBucketsFirst(shuffled).map(([b]) => b)).toEqual([
      PLAIN_BUCKET,
      AVAIL_BUCKET,
      null,
    ]);
  });

  it('keeps config-mode buckets in first-seen (stable) order after the legacy pair', () => {
    const buckets: Array<[string | null, string[]]> = [
      ['hut', ['h1']],
      [null, ['n1']],
      ['bivouac', ['b1']],
    ];
    // No legacy buckets present: order is unchanged (stable sort).
    expect(orderLegacyBucketsFirst(buckets).map(([b]) => b)).toEqual(['hut', null, 'bivouac']);
  });
});
