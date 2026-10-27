/**
 * Unit tests for the catalog-driven fallback basemap mapping
 * (fallback-basemaps.ts) — raster-base detection and legacy id
 * migration. The catalog/style fetches are NOT exercised here (they
 * need the network); loadCatalogBasemaps only calls the tested pure
 * mapping on top of fetchMapCatalog/fetchMapStyle.
 */
import { describe, expect, it } from 'vitest';
import { firstRasterBase, migrateBasemapId } from '@components/map/fallback-basemaps';
import type { StyleSpecification } from 'maplibre-gl';

const style = (partial: Record<string, unknown>): StyleSpecification =>
  partial as unknown as StyleSpecification;

describe('firstRasterBase', () => {
  it('detects a single-source raster style (world-topo shape)', () => {
    const s = style({
      sources: {
        'wd-world-topo': { type: 'raster', tiles: ['https://t/{z}/{x}/{y}.webp'], maxzoom: 16 },
      },
      layers: [{ id: 'l0', type: 'raster', source: 'wd-world-topo' }],
    });
    expect(firstRasterBase(s)).toEqual({
      tiles: ['https://t/{z}/{x}/{y}.webp'],
      maxzoom: 16,
      attribution: undefined,
    });
  });

  it('picks the raster base of a hybrid style (raster base + vector labels)', () => {
    const s = style({
      sources: {
        'wd-satellite-raster': {
          type: 'raster',
          tiles: ['https://s/{z}/{x}/{y}.webp'],
          maxzoom: 19,
        },
        openmaptiles: { type: 'vector', url: 'https://v/tiles.json' },
      },
      layers: [
        { id: 'base', type: 'raster', source: 'wd-satellite-raster' },
        { id: 'labels', type: 'symbol', source: 'openmaptiles' },
      ],
    });
    expect(firstRasterBase(s)?.tiles[0]).toBe('https://s/{z}/{x}/{y}.webp');
  });

  it('rejects a vector-base style even when raster OVERLAY sources exist (mtk-hill shape)', () => {
    const s = style({
      sources: {
        mtk: { type: 'vector', url: 'https://m/tiles.json' },
        rocks: { type: 'raster', tiles: ['https://r/{z}/{x}/{y}.png'], tileSize: 360 },
      },
      layers: [
        { id: 'background', type: 'background' },
        { id: 'landcover', type: 'fill', source: 'mtk' },
        { id: 'rocks', type: 'raster', source: 'rocks' },
      ],
    });
    expect(firstRasterBase(s)).toBeUndefined();
  });

  it('returns undefined for a background-only style', () => {
    const s = style({ sources: {}, layers: [{ id: 'background', type: 'background' }] });
    expect(firstRasterBase(s)).toBeUndefined();
  });
});

describe('migrateBasemapId', () => {
  it('maps legacy POC ids to catalog slugs', () => {
    expect(migrateBasemapId('topo')).toBe('world-topo');
    expect(migrateBasemapId('satellite')).toBe('world-satellite-hybrid');
  });

  it('passes catalog slugs and unknown ids through', () => {
    expect(migrateBasemapId('osm')).toBe('osm');
    expect(migrateBasemapId('world-topo')).toBe('world-topo');
    expect(migrateBasemapId('ch-swisstopo-full')).toBe('ch-swisstopo-full');
  });
});
