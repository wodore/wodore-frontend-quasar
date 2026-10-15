import { describe, it, expect } from 'vitest';
import * as allure from 'allure-js-commons';
import {
  resolveTokens,
  collectTokens,
  pickVariant,
  gpuSpec,
  styleEndpointUrl,
  absolutizeStyleUrl,
  martinEntryStyleUrl,
  STYLE_VERSION,
  isOpacityCurve,
  parseOpacityCurve,
  serializeOpacityCurve,
  type MapLayerVariant,
} from '@services/map-catalog';

describe('map catalog token resolver', () => {
  it('substitutes whole-node tokens with scalars', () => {
    allure.label('feature', 'map-catalog');
    const style = {
      layers: [{ id: 'a', paint: { 'raster-opacity': '{{mtb.opacity}}' } }],
    };
    const resolved = resolveTokens(style, { 'mtb.opacity': 0.9 });
    expect((resolved.layers[0]!.paint as Record<string, unknown>)['raster-opacity']).toBe(0.9);
  });

  it('substitutes whole-node tokens with expression subtrees', () => {
    const curve = ['interpolate', ['linear'], ['zoom'], 8, 0, 16, 1];
    const style = { paint: { 'line-opacity': '{{hiking.opacity}}' } };
    const resolved = resolveTokens(style, { 'hiking.opacity': curve }) as typeof style;
    expect(resolved.paint['line-opacity']).toEqual(curve);
  });

  it('substitutes inline tokens inside longer strings (URL templates)', () => {
    const source = { data: 'https://api.example.com/v1/huts/availability/{{date}}.geojson' };
    const resolved = resolveTokens(source, { date: '2026-10-14' });
    expect((resolved as typeof source).data).toBe(
      'https://api.example.com/v1/huts/availability/2026-10-14.geojson'
    );
  });

  it('passes unknown tokens through untouched', () => {
    const style = { paint: { 'x-opacity': '{{unknown.param}}' } };
    expect(resolveTokens(style, {})).toEqual(style);
  });

  it('never substitutes null values (runtime params stay tokenized)', () => {
    const source = { data: '…/{{date}}.geojson' };
    const resolved = resolveTokens(source, { date: null });
    expect((resolved as typeof source).data).toBe('…/{{date}}.geojson');
  });

  it('collects every token slug in a tree', () => {
    const tokens = collectTokens({
      a: '{{one}}',
      b: ['{{two}}', { c: 'url/{{three}}.geojson' }],
    });
    expect([...tokens].sort()).toEqual(['one', 'three', 'two']);
  });
});

describe('map catalog variant selection', () => {
  it('prefers the exact spec', () => {
    const variants: MapLayerVariant[] = [
      { spec: 'high', style_url: '/x?spec=high' },
      { spec: 'low', inline_style: {} },
    ];
    expect(pickVariant(variants, 'low')?.spec).toBe('low');
    expect(pickVariant(variants, 'high')?.spec).toBe('high');
  });

  it('falls back to the nearest tier in both directions', () => {
    const variants: MapLayerVariant[] = [{ spec: 'high', style_url: '/x' }];
    expect(pickVariant(variants, 'low')?.spec).toBe('high');

    const lowOnly: MapLayerVariant[] = [{ spec: 'low', style_url: '/x' }];
    expect(pickVariant(lowOnly, 'high')?.spec).toBe('low');

    const ends: MapLayerVariant[] = [
      { spec: 'low', style_url: '/x' },
      { spec: 'high', style_url: '/x' },
    ];
    expect(pickVariant(ends, 'medium')?.spec).toBe('low');
  });
});

describe('map catalog URLs', () => {
  it('maps the GPU raster flag onto spec tiers', () => {
    expect(gpuSpec(true)).toBe('low');
    expect(gpuSpec(false)).toBe('high');
  });

  it('builds the style endpoint with spec, mode and version params', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    // v= rotates the API/browser cache keys on deploy (STYLE_VERSION) —
    // the API ignores the undeclared parameter.
    expect(styleEndpointUrl('mtb', { spec: 'low' })).toBe(
      'https://hub.example.com/v1/map/styles/mtb.json?spec=low&v=2026-10-16'
    );
    expect(styleEndpointUrl('mtb', { spec: 'high', tokenized: true })).toBe(
      'https://hub.example.com/v1/map/styles/mtb.json?spec=high&mode=tokenized&v=2026-10-16'
    );
    expect(styleEndpointUrl('mtb')).toBe(
      'https://hub.example.com/v1/map/styles/mtb.json?v=2026-10-16'
    );
    delete process.env.WODORE_API_HOST;
  });

  it('absolutizes root-relative style URLs against the API host', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    expect(absolutizeStyleUrl('/v1/map/styles/x.json?spec=high')).toBe(
      'https://hub.example.com/v1/map/styles/x.json?spec=high'
    );
    // External (env-resolved) URLs pass through untouched
    expect(absolutizeStyleUrl('https://api.maptiler.com/maps/x?key=k')).toBe(
      'https://api.maptiler.com/maps/x?key=k'
    );
    delete process.env.WODORE_API_HOST;
  });

  it('builds absolute, cache-busted style URLs for Martin-catalog entries', () => {
    // Regression: the picker fed the entry's root-relative `path` to
    // MapLibre as-is — the browser resolved it against the PAGE origin
    // (no /v1 on the frontend host → SPA shell instead of the style →
    // blank basemaps). The URL must carry the API origin.
    process.env.WODORE_API_HOST = 'https://hub.example.com/';
    expect(martinEntryStyleUrl('/v1/map/styles/wd-outdoor-base-mtk.json')).toBe(
      `https://hub.example.com/v1/map/styles/wd-outdoor-base-mtk.json?v=${STYLE_VERSION}`
    );
    expect(martinEntryStyleUrl('/v1/map/styles/wd-outdoor-base-mtk.json?spec=high')).toBe(
      `https://hub.example.com/v1/map/styles/wd-outdoor-base-mtk.json?spec=high&v=${STYLE_VERSION}`
    );
    // External styles (env-resolved by the backend) stay untouched
    expect(martinEntryStyleUrl('https://api.maptiler.com/maps/hybrid/style.json')).toBe(
      `https://api.maptiler.com/maps/hybrid/style.json?v=${STYLE_VERSION}`
    );
    delete process.env.WODORE_API_HOST;
  });
});

describe('opacity curve helpers', () => {
  const curve = {
    stops: [
      { zoom: 8, opacity: 0 },
      { zoom: 13, opacity: 0.8 },
      { zoom: 16, opacity: 0.3 },
    ],
  };

  it('parses the interpolate expression into stops', () => {
    const expr = ['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.8, 16, 0.3];
    expect(parseOpacityCurve(expr)).toEqual(curve);
    expect(parseOpacityCurve(['match', ['get', 'x']])).toBeUndefined();
    expect(parseOpacityCurve('nope')).toBeUndefined();
  });

  it('serializes stops back into the expression', () => {
    expect(serializeOpacityCurve(curve)).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      0,
      13,
      0.8,
      16,
      0.3,
    ]);
  });

  it('guards persisted curve values structurally', () => {
    expect(isOpacityCurve(curve)).toBe(true);
    expect(isOpacityCurve({ stops: [{ zoom: 5, opacity: 0.5 }] })).toBe(false); // < 2 stops
    expect(
      isOpacityCurve({
        stops: [
          { zoom: 5, opacity: 0.5 },
          { zoom: 5, opacity: 1 },
        ],
      })
    ).toBe(false); // non-ascending
    expect(
      isOpacityCurve({
        stops: [
          { zoom: 5, opacity: 2 },
          { zoom: 9, opacity: 1 },
        ],
      })
    ).toBe(false); // out of range
    expect(isOpacityCurve(null)).toBe(false);
    expect(isOpacityCurve(['interpolate'])).toBe(false);
  });

  it('round-trips parse → serialize', () => {
    const expr = serializeOpacityCurve(curve);
    expect(parseOpacityCurve(expr)).toEqual(curve);
  });
});
