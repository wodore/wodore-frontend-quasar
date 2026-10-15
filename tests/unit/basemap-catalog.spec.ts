/**
 * Martin-compatible basemap catalog compilation (backend PR #292) —
 * the basemap picker's data source: flat {slug → entry} with
 * spec-resolved style paths, no client-side composition.
 */
import { describe, it, expect } from 'vitest';
import { martinCatalogBasemap, LEGACY_BASEMAP_FALLBACKS } from '@stores/map/utils/catalog-mapping';
import type { BasemapCatalogEntry } from '@services/map-catalog';

function entry(overrides: Partial<BasemapCatalogEntry> = {}): BasemapCatalogEntry {
  return {
    path: '/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high',
    name: 'Wodore Outdoor (client relief)',
    role: 'basemap',
    order: 0,
    show: true,
    ...overrides,
  };
}

describe('martinCatalogBasemap', () => {
  it('maps the Martin entry onto a switch item', () => {
    const item = martinCatalogBasemap(
      'wd-outdoor-base-mtk-hill',
      entry(),
      '/style?x=1&v=1',
      () => 'thumb.png'
    );
    expect(item.name).toBe('wd-outdoor-base-mtk-hill');
    expect(item.label).toBe('Wodore Outdoor (client relief)');
    expect(item.style).toBe('/style?x=1&v=1');
    expect(item.img).toBe('thumb.png');
    expect(item.active).toBe(false);
    expect(item.fallback).toBeUndefined();
    expect(item.layers.ways).toBeDefined();
    expect(item.layers.background).toBeDefined();
  });

  it('carries the catalog fallback slug for auto-switching', () => {
    const item = martinCatalogBasemap(
      'wd-outdoor-base-mtk-hill',
      entry({ fallback: 'wd-outdoor-base-ofm-hill' }),
      '/style'
    );
    expect(item.fallback).toBe('wd-outdoor-base-ofm-hill');
  });

  it('marks coverage-bbox entries as country-only', () => {
    const item = martinCatalogBasemap(
      'ch-swisstopo-full',
      entry({ coverage_bbox: [5.9, 45.8, 10.5, 47.9] }),
      '/style'
    );
    expect(item.countryOnly).toBe(true);
    expect(item.bbox).toEqual([5.9, 45.8, 10.5, 47.9]);
  });

  it('falls back to the img fallback when no preview_url', () => {
    const item = martinCatalogBasemap(
      'world-topo',
      entry({ preview_url: null }),
      '/style',
      () => 'thumb.png'
    );
    expect(item.img).toBe('thumb.png');
  });

  it('keeps the legacy auto-switch chain for the hill variants', () => {
    expect(LEGACY_BASEMAP_FALLBACKS['wd-outdoor-base-mtk-hill']).toBe('wd-outdoor-base-ofm-hill');
    expect(LEGACY_BASEMAP_FALLBACKS['wd-outdoor-base-ofm-hill']).toBe('openfreemap-liberty');
  });
});
