// @vitest-environment happy-dom
/**
 * Unit tests for the fallback overlay adapter's geojson CIRCLE support
 * (the transport-stops subset variant, backend #442):
 *
 * * evalStyleExpr (fallback/overlay-adapter) — the whitelisted subset
 *   expression evaluator (get/has/literal/in/==/case/match +
 *   interpolate-on-zoom, linear, nested stop-value expressions).
 * * circleSpecFor — extracting a Leaflet-servable circle spec from a
 *   resolved style (geojson data URL, no tokens; zoom floor).
 * * circleMarkerStyle — evaluating the transport-stops paints per
 *   feature + zoom into Leaflet CircleMarker options.
 * * rasterSpecFor — the raster path keeps its shape (kind tag).
 *
 * happy-dom: overlay-adapter imports leaflet (module side effects need
 * a window), same docblock pattern as the styling spec.
 */
import { describe, expect, it } from 'vitest';
import {
  circleMarkerStyle,
  circleSpecFor,
  evalStyleExpr,
  rasterSpecFor,
} from '@components/map/fallback/overlay-adapter';
import type { StyleSpecification } from 'maplibre-gl';

// ── Fixtures ─────────────────────────────────────────────────────────────

const DATA_URL =
  'https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson';

/** The transport-stops color expression (served shape, verbatim). */
const TRANSPORT_COLOR = [
  'case',
  ['in', 'train', ['get', 'types']],
  '#C60018',
  ['in', 'bus', ['get', 'types']],
  '#2d327d',
  '#0079C7',
];

/** The transport-stops radius curve (served shape, verbatim): stop
 * VALUES are nested case expressions — the evaluator must recurse. */
const TRANSPORT_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  7,
  ['case', ['in', 'train', ['get', 'types']], 3, ['in', 'bus', ['get', 'types']], 2, 1],
  9,
  ['case', ['in', 'train', ['get', 'types']], 4, ['in', 'bus', ['get', 'types']], 3, 3],
  16,
  ['case', ['in', 'train', ['get', 'types']], 9, ['in', 'bus', ['get', 'types']], 8, 8],
];

/** The transport-stops style as staging serves it (full variant — no
 * layer minzoom; the subset twin adds `minzoom: 10` and drops
 * promoteId/layout). Paints verbatim from hub.stg.wodore.com
 * /v1/map/styles/transport-stops.json (2026-10-28). */
const transportStyle = (minzoom?: number): StyleSpecification =>
  ({
    version: 8,
    name: 'transport-stops',
    glyphs: 'https://tiles.cdn.stg.wodore.com/font/{fontstack}/{range}?v=x',
    sources: {
      'transport-stops': { type: 'geojson', data: DATA_URL, promoteId: 'id' },
    },
    layers: [
      {
        id: 'transport-stops',
        type: 'circle',
        source: 'transport-stops',
        ...(minzoom !== undefined ? { minzoom } : {}),
        layout: { visibility: 'visible' },
        paint: {
          'circle-color': TRANSPORT_COLOR,
          'circle-radius': TRANSPORT_RADIUS,
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 0.3, 8, 0.6, 12, 1],
          'circle-stroke-color': '#F6F6F6',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 1, 16, 2],
        },
      },
    ],
    metadata: { 'wd:served_spec': 'medium', 'wd:slug': 'transport-stops' },
  }) as unknown as StyleSpecification;

const rasterStyle = (): StyleSpecification =>
  ({
    version: 8,
    sources: {
      slopes: {
        type: 'raster',
        tiles: ['https://tiles.example.com/slopes/{z}/{x}/{y}.png'],
        maxzoom: 12,
      },
    },
    layers: [
      {
        id: 'slopes',
        type: 'raster',
        source: 'slopes',
        minzoom: 8,
        paint: { 'raster-opacity': 0.7 },
      },
    ],
  }) as unknown as StyleSpecification;

// ── evalStyleExpr ────────────────────────────────────────────────────────

describe('evalStyleExpr', () => {
  const props = { types: ['train', 'tram'], name: 'Bern', code: 42 };

  it('passes plain scalars through', () => {
    expect(evalStyleExpr('#123456', 10, props)).toBe('#123456');
    expect(evalStyleExpr(4, 10, props)).toBe(4);
    expect(evalStyleExpr(true, 10, props)).toBe(true);
    expect(evalStyleExpr(null, 10, props)).toBeNull();
  });

  it('reads feature properties (get/has)', () => {
    expect(evalStyleExpr(['get', 'name'], 10, props)).toBe('Bern');
    expect(evalStyleExpr(['get', 'missing'], 10, props)).toBeUndefined();
    expect(evalStyleExpr(['get', 'name'], 10, undefined)).toBeUndefined();
    expect(evalStyleExpr(['has', 'types'], 10, props)).toBe(true);
    expect(evalStyleExpr(['has', 'nope'], 10, props)).toBe(false);
  });

  it('returns literals un-nested', () => {
    expect(evalStyleExpr(['literal', ['a', 'b']], 10, props)).toEqual(['a', 'b']);
  });

  it('checks membership (in) on arrays and substrings in strings', () => {
    expect(evalStyleExpr(['in', 'train', ['get', 'types']], 10, props)).toBe(true);
    expect(evalStyleExpr(['in', 'bus', ['get', 'types']], 10, props)).toBe(false);
    expect(evalStyleExpr(['in', 'er', 'Bern'], 10, props)).toBe(true);
    expect(evalStyleExpr(['in', 'x', 'Bern'], 10, props)).toBe(false);
  });

  it('compares equality (==)', () => {
    expect(evalStyleExpr(['==', ['get', 'code'], 42], 10, props)).toBe(true);
    expect(evalStyleExpr(['==', ['get', 'code'], '42'], 10, props)).toBe(false);
    expect(evalStyleExpr(['==', 1, 2], 10, props)).toBe(false);
  });

  it('walks case branches to the first true condition', () => {
    expect(evalStyleExpr(TRANSPORT_COLOR, 10, { types: ['train'] })).toBe('#C60018');
    expect(evalStyleExpr(TRANSPORT_COLOR, 10, { types: ['bus', 'tram'] })).toBe('#2d327d');
    expect(evalStyleExpr(TRANSPORT_COLOR, 10, { types: ['ship'] })).toBe('#0079C7');
    expect(evalStyleExpr(TRANSPORT_COLOR, 10, {})).toBe('#0079C7'); // no types → default
  });

  it('matches labels, label sets and the fallback', () => {
    const expr = [
      'match',
      ['get', 'name'],
      'Bern',
      '#111111',
      ['Basel', 'Zurich'],
      '#222222',
      '#333333',
    ];
    expect(evalStyleExpr(expr, 10, { name: 'Bern' })).toBe('#111111');
    expect(evalStyleExpr(expr, 10, { name: 'Basel' })).toBe('#222222');
    expect(evalStyleExpr(expr, 10, { name: 'Zurich' })).toBe('#222222');
    expect(evalStyleExpr(expr, 10, { name: 'Genève' })).toBe('#333333');
  });

  it('interpolates linearly on zoom with nested expression stop values', () => {
    const train = { types: ['train'] };
    expect(evalStyleExpr(TRANSPORT_RADIUS, 7, train)).toBe(3); // at a stop
    expect(evalStyleExpr(TRANSPORT_RADIUS, 8, train)).toBe(3.5); // midpoint 7→9
    expect(evalStyleExpr(TRANSPORT_RADIUS, 12, train)).toBeCloseTo(4 + (9 - 4) * (3 / 7)); // 9→16
    expect(evalStyleExpr(TRANSPORT_RADIUS, 5, train)).toBe(3); // below first stop
    expect(evalStyleExpr(TRANSPORT_RADIUS, 18, train)).toBe(9); // above last stop
    expect(evalStyleExpr(TRANSPORT_RADIUS, 8, { types: ['bus'] })).toBe(2.5);
    expect(evalStyleExpr(TRANSPORT_RADIUS, 8, {})).toBe(2); // default branch
  });

  it('rejects interpolate on a non-zoom input', () => {
    expect(
      evalStyleExpr(['interpolate', ['linear'], ['get', 'x'], 1, 0.5, 2, 1], 10, props)
    ).toBeUndefined();
  });

  it('evaluates unknown or malformed expressions to undefined', () => {
    expect(evalStyleExpr(['step', ['get', 'x'], 1, 5, 2], 10, props)).toBeUndefined(); // not whitelisted
    expect(evalStyleExpr(['coalesce', ['get', 'x']], 10, props)).toBeUndefined();
    expect(evalStyleExpr(['feature-state', 'x'], 10, props)).toBeUndefined();
    expect(evalStyleExpr(undefined, 10, props)).toBeUndefined();
    expect(evalStyleExpr({ object: true }, 10, props)).toBeUndefined();
    expect(evalStyleExpr([], 10, props)).toBeUndefined();
  });
});

// ── circleSpecFor ────────────────────────────────────────────────────────

describe('circleSpecFor', () => {
  it('extracts the served transport-stops shape with the default zoom floor', () => {
    const spec = circleSpecFor(transportStyle());
    expect(spec).toBeDefined();
    expect(spec).toMatchObject({
      kind: 'circle',
      dataUrl: DATA_URL,
      minZoom: 10, // no layer minzoom → low-spec default
      colorPaint: TRANSPORT_COLOR,
      radiusPaint: TRANSPORT_RADIUS,
    });
  });

  it('honors an explicit layer minzoom (subset variant)', () => {
    expect(circleSpecFor(transportStyle(10))?.minZoom).toBe(10);
    expect(circleSpecFor(transportStyle(12))?.minZoom).toBe(12);
    expect(circleSpecFor(transportStyle(4))?.minZoom).toBe(4); // author wins, no re-floor
  });

  it('rejects tokenized data URLs, inline geojson and vector sources', () => {
    const tokenized = transportStyle();
    (tokenized.sources['transport-stops'] as { data: string }).data =
      'https://tiles.example.com/stops.geojson?date={{date}}';
    expect(circleSpecFor(tokenized)).toBeUndefined();

    const inline = transportStyle();
    (inline.sources['transport-stops'] as { data: unknown }).data = {
      type: 'FeatureCollection',
      features: [],
    };
    expect(circleSpecFor(inline)).toBeUndefined();

    const vector = transportStyle();
    vector.sources['transport-stops'] = {
      type: 'vector',
      tiles: ['https://tiles.example.com/stops/{z}/{x}/{y}.pbf'],
    } as unknown as (typeof vector.sources)['transport-stops'];
    expect(circleSpecFor(vector)).toBeUndefined();
  });

  it('returns undefined without a style, circle layer or raster styles', () => {
    expect(circleSpecFor(undefined)).toBeUndefined();
    expect(circleSpecFor(rasterStyle())).toBeUndefined();
    const symbolOnly = transportStyle();
    (symbolOnly.layers[0] as { type: string }).type = 'symbol';
    expect(circleSpecFor(symbolOnly)).toBeUndefined();
  });

  it('falls back to MapLibre circle paint defaults for missing keys', () => {
    const bare = transportStyle();
    (bare.layers[0] as { paint?: unknown }).paint = undefined;
    const spec = circleSpecFor(bare)!;
    expect(spec.colorPaint).toBe('#000000');
    expect(spec.radiusPaint).toBe(5);
    expect(spec.opacityPaint).toBe(1);
    expect(spec.strokeWidthPaint).toBe(0);
  });
});

// ── circleMarkerStyle ────────────────────────────────────────────────────

describe('circleMarkerStyle', () => {
  const spec = circleSpecFor(transportStyle())!;

  it('styles train stops red at z12 (radius curve + stroke from paint)', () => {
    const style = circleMarkerStyle(spec, 12, { types: ['train'] });
    expect(style.fillColor).toBe('#C60018');
    expect(style.radius).toBeCloseTo(4 + (9 - 4) * (3 / 7)); // 7→9→16 curve at 12
    expect(style.fillOpacity).toBe(1); // opacity curve saturates at 12
    expect(style.stroke).toBe(true); // stroke-width curve: 0@10 → 1@12 → 2@16
    expect(style.weight).toBe(1);
    expect(style.color).toBe('#F6F6F6');
  });

  it('styles bus stops indigo with the dimmer early-zoom values', () => {
    const style = circleMarkerStyle(spec, 8, { types: ['bus'] });
    expect(style.fillColor).toBe('#2d327d');
    expect(style.radius).toBe(2.5); // 2@7 → 3@9 midpoint
    expect(style.fillOpacity).toBe(0.6); // opacity curve at 8
    expect(style.stroke).toBe(false); // stroke-width 0 below 10
  });

  it('styles other stops with the case default', () => {
    expect(circleMarkerStyle(spec, 12, { types: ['ship'] }).fillColor).toBe('#0079C7');
    expect(circleMarkerStyle(spec, 12, {}).fillColor).toBe('#0079C7');
  });

  it('degrades to MapLibre defaults on unknown operators', () => {
    const broken = {
      ...spec,
      radiusPaint: ['step', ['zoom'], 1, 10, 9],
      colorPaint: ['rgb', 1, 2, 3],
    };
    const style = circleMarkerStyle(broken, 12, { types: ['train'] });
    expect(style.radius).toBe(5); // default, not a crash
    expect(style.fillColor).toBe('#000000'); // rgb() not whitelisted → default
  });

  it('clamps opacity into [0,1]', () => {
    const over = { ...spec, opacityPaint: 1.7 };
    expect(circleMarkerStyle(over, 12, {}).fillOpacity).toBe(1);
    const under = { ...spec, opacityPaint: -0.5 };
    expect(circleMarkerStyle(under, 12, {}).fillOpacity).toBe(0);
  });
});

// ── rasterSpecFor (regression: the raster path keeps its shape) ──────────

describe('rasterSpecFor', () => {
  it('tags raster specs and keeps the swisstopo-style extraction', () => {
    const spec = rasterSpecFor(rasterStyle());
    expect(spec).toMatchObject({
      kind: 'raster',
      url: 'https://tiles.example.com/slopes/{z}/{x}/{y}.png',
      minZoom: 8,
      maxNativeZoom: 12,
      opacityPaint: 0.7,
    });
    expect(rasterSpecFor(transportStyle())).toBeUndefined();
  });
});
