/**
 * Unit tests for the fallback's served-style tile source extraction
 * (fallback/huts-style-source): the Leaflet fallback's hut/availability
 * MLT tile URLs, pyramid bounds, MLT table names and sprite pack base
 * are extracted from the SAME backend-served style documents the
 * MapLibre path renders (subset twin on fallback sessions) — no
 * client-side TILE_SERVER fallback URLs.
 *
 * Shapes mirror the backend seed (apps/basemaps seed_lib HUTS_STYLE +
 * HUTS_STYLE_SUBSET: inline tiles with the serve-time tile origin,
 * {{date}} runtime token on wd-bookings, sprite array with the `wd`
 * pack) and the map-catalog store's compiled item (resolved style +
 * tokenized sibling).
 */
import { describe, expect, it } from 'vitest';
import type { StyleSpecification } from 'maplibre-gl';
import { fallbackHutsSource, expandTileUrl } from '@components/map/fallback/huts-style-source';

const ORIGIN = 'https://tiles.cdn.example.com';

/** The served subset-twin shape (backend #440), trimmed to the fields
 *  the extraction reads. */
function servedStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'huts',
    sources: {
      'wd-huts': {
        type: 'vector',
        tiles: [`${ORIGIN}/huts/{z}/{x}/{y}.mlt`],
        encoding: 'mlt',
        minzoom: 5,
        maxzoom: 9,
      },
      'wd-bookings': {
        type: 'vector',
        tiles: [`${ORIGIN}/availability/{z}/{x}/{y}.mlt?date=2026-01-01&days=4`],
        encoding: 'mlt',
        minzoom: 5,
        maxzoom: 9,
      },
    },
    sprite: [
      { id: 'wd', url: `${ORIGIN}/sprite/accommodation,availability` },
      { id: 'wd-sdf', url: `${ORIGIN}/sdf_sprite/accommodation` },
    ],
    layers: [
      {
        id: 'wd-huts-occupation',
        type: 'circle',
        source: 'wd-bookings',
        'source-layer': 'availability',
        paint: {},
      },
      {
        id: 'wd-huts',
        type: 'symbol',
        source: 'wd-huts',
        'source-layer': 'huts',
        layout: {},
      },
    ],
  } as unknown as StyleSpecification;
}

/** Tokenized sibling: {{date}} preserved in the wd-bookings tiles. */
function tokenizedStyle(): StyleSpecification {
  const style = servedStyle();
  const bookings = style.sources['wd-bookings'] as { tiles: string[] };
  bookings.tiles = [`${ORIGIN}/availability/{z}/{x}/{y}.mlt?date={{date}}&days=4`];
  return style;
}

describe('fallbackHutsSource', () => {
  it('extracts the huts template, pyramid and MLT table from the served style', () => {
    const src = fallbackHutsSource(servedStyle());
    expect(src).toBeDefined();
    expect(src!.huts.tiles).toBe(`${ORIGIN}/huts/{z}/{x}/{y}.mlt`);
    expect(src!.huts.minZoom).toBe(5);
    expect(src!.huts.maxZoom).toBe(9);
    expect(src!.huts.sourceLayer).toBe('huts');
  });

  it('prefers the TOKENIZED wd-bookings template ({{date}} stays substitutable)', () => {
    const src = fallbackHutsSource(servedStyle(), tokenizedStyle());
    expect(src!.avail?.tiles).toBe(`${ORIGIN}/availability/{z}/{x}/{y}.mlt?date={{date}}&days=4`);
    expect(src!.avail?.minZoom).toBe(5);
    expect(src!.avail?.maxZoom).toBe(9);
    expect(src!.avail?.sourceLayer).toBe('availability');
  });

  it('falls back to the RESOLVED wd-bookings template without a tokenized sibling', () => {
    const src = fallbackHutsSource(servedStyle());
    expect(src!.avail?.tiles).toBe(`${ORIGIN}/availability/{z}/{x}/{y}.mlt?date=2026-01-01&days=4`);
  });

  it('reads the wd sprite pack base URL from the sprite array', () => {
    expect(fallbackHutsSource(servedStyle())!.spriteBase).toBe(
      `${ORIGIN}/sprite/accommodation,availability`
    );
  });

  it('accepts a plain string sprite (pre-array dialect) as the pack base', () => {
    const style = servedStyle();
    style.sprite = `${ORIGIN}/sprite/all`;
    expect(fallbackHutsSource(style)!.spriteBase).toBe(`${ORIGIN}/sprite/all`);
  });

  it('no style (metadata-first placeholder), no wd-huts source, or a URL-less source → undefined (subset-or-nothing)', () => {
    expect(fallbackHutsSource(undefined)).toBeUndefined();
    expect(fallbackHutsSource({ version: 8, sources: {}, layers: [] })).toBeUndefined();
    const urlLess = servedStyle();
    (urlLess.sources['wd-huts'] as { tiles?: string[] }).tiles = [];
    expect(fallbackHutsSource(urlLess)).toBeUndefined();
    const wrongType = servedStyle();
    (wrongType.sources['wd-huts'] as { type?: string }).type = 'geojson';
    expect(fallbackHutsSource(wrongType)).toBeUndefined();
  });

  it('a missing wd-bookings source leaves huts renderable, availability off', () => {
    const style = servedStyle();
    delete style.sources['wd-bookings'];
    const src = fallbackHutsSource(style);
    expect(src?.huts.tiles).toBe(`${ORIGIN}/huts/{z}/{x}/{y}.mlt`);
    expect(src?.avail).toBeUndefined();
  });

  it('pyramid defaults mirror MapLibre vector-source defaults when the source omits them', () => {
    const style = servedStyle();
    const huts = style.sources['wd-huts'] as { minzoom?: number; maxzoom?: number };
    delete huts.minzoom;
    delete huts.maxzoom;
    const src = fallbackHutsSource(style);
    expect(src!.huts.minZoom).toBe(0);
    expect(src!.huts.maxZoom).toBe(22);
  });
});

describe('expandTileUrl', () => {
  it('expands the maplibre {z}/{x}/{y} placeholders', () => {
    expect(expandTileUrl(`${ORIGIN}/huts/{z}/{x}/{y}.mlt`, 9, 21, 42)).toBe(
      `${ORIGIN}/huts/9/21/42.mlt`
    );
  });

  it('substitutes runtime tokens ({{date}}) with catalog resolveTokens semantics', () => {
    expect(
      expandTileUrl(`${ORIGIN}/availability/{z}/{x}/{y}.mlt?date={{date}}&days=4`, 7, 1, 2, {
        date: '2026-02-06',
      })
    ).toBe(`${ORIGIN}/availability/7/1/2.mlt?date=2026-02-06&days=4`);
  });

  it('unknown and unprovided tokens pass through untouched', () => {
    expect(expandTileUrl(`${ORIGIN}/t/{z}/{x}/{y}.mlt?x={{other}}`, 1, 2, 3, { date: 'd' })).toBe(
      `${ORIGIN}/t/1/2/3.mlt?x={{other}}`
    );
  });

  it('an undefined template yields the empty string (callers gate; fails fast)', () => {
    expect(expandTileUrl(undefined, 1, 2, 3)).toBe('');
  });
});
