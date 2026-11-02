/**
 * Basemap compilation from the RESOLVED layers API (backend #331
 * `/v1/map/layers`): one layer per slug, served spec + style_url
 * embedded — the picker compiles config-shaped entries, no client-side
 * variant picking.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mapCatalogBasemap, LEGACY_BASEMAP_FALLBACKS } from '@stores/map/utils/catalog-mapping';
import { absolutizeStyleUrl, type MapCatalogLayer } from '@services/map-catalog';

function layer(partial: Partial<MapCatalogLayer> & { slug: string }): MapCatalogLayer {
  return {
    role: 'basemap',
    name: 'Wodore Outdoor (client relief)',
    description: '',
    icon: 'outdoor',
    icon_badge: '',
    slot: null,
    order: 0,
    show: true,
    is_default: false,
    spec: 'high',
    style_url: '/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high',
    modified: '2026-10-15T22:29:11.528Z',
    min_zoom: null,
    max_zoom: null,
    coverage_bbox: null,
    fallback_min_zoom: null,
    fallback: null,
    anchors: null,
    preview_url: null,
    config: null,
    interaction: null,
    parameters: [],
    categories: [],
    attributions: [],
    license: null,
    legend: null,
    ...partial,
  };
}

describe('mapCatalogBasemap (resolved layers entries)', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  it('maps the resolved layer onto a switch item with the served style_url', () => {
    // Hermetic: the switch item must carry the SERVED url verbatim —
    // whatever absolutizeStyleUrl yields in this environment (raw stays
    // raw without WODORE_API_HOST, absolutizes with it).
    const served = absolutizeStyleUrl('/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high');
    const item = mapCatalogBasemap(
      layer({ slug: 'wd-outdoor-base-mtk-hill' }),
      served,
      () => 'thumb.png'
    );
    expect(item.name).toBe('wd-outdoor-base-mtk-hill');
    expect(item.label).toBe('Wodore Outdoor (client relief)');
    expect(item.style).toBe(served);
    expect(item.img).toBe('thumb.png');
    expect(item.active).toBe(false);
    expect(item.fallback).toBeUndefined();
    expect(item.layers.ways).toBeDefined();
    expect(item.layers.background).toBeDefined();
  });

  it('regression #285: root-relative style_url absolutizes against the API host', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    const entry = layer({
      slug: 'wd-outdoor-base-mtk-hill',
      style_url: '/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high',
    });
    // The store passes absolutizeStyleUrl(entry.style_url) — the URL the
    // picker carries must resolve against WODORE_API_HOST, never the
    // page origin (the #285 staging incident: blank basemaps).
    const item = mapCatalogBasemap(entry, absolutizeStyleUrl(entry.style_url!));
    expect(item.style).toBe(
      'https://hub.example.com/v1/map/styles/wd-outdoor-base-mtk-hill.json?spec=high'
    );
    delete process.env.WODORE_API_HOST;
  });

  it('external (env-resolved) style URLs pass through untouched', () => {
    process.env.WODORE_API_HOST = 'https://hub.example.com';
    const entry = layer({
      slug: 'maptiler-hybrid',
      style_url: 'https://api.maptiler.com/maps/hybrid/style.json?key=k',
    });
    const item = mapCatalogBasemap(entry, absolutizeStyleUrl(entry.style_url!));
    expect(item.style).toBe('https://api.maptiler.com/maps/hybrid/style.json?key=k');
    delete process.env.WODORE_API_HOST;
  });

  it('carries the catalog fallback slug for auto-switching', () => {
    const item = mapCatalogBasemap(
      layer({ slug: 'wd-outdoor-base-mtk-hill', fallback: 'wd-outdoor-base-ofm-hill' }),
      '/style'
    );
    expect(item.fallback).toBe('wd-outdoor-base-ofm-hill');
  });

  it('keeps hidden fallback basemaps in the list (show=false) for chain resolution', () => {
    const item = mapCatalogBasemap(
      layer({ slug: 'wd-outdoor-base-ofm-hill', show: false }),
      '/style'
    );
    // The picker filters by show; the fallback chain still resolves the slug.
    expect(item.show).toBe(false);
    expect(item.name).toBe('wd-outdoor-base-ofm-hill');
  });

  it('marks coverage-bbox entries as country-only with the fallback_min_zoom', () => {
    const item = mapCatalogBasemap(
      layer({
        slug: 'ch-swisstopo-full',
        coverage_bbox: [5.9, 45.8, 10.5, 47.9],
        fallback_min_zoom: 7,
      }),
      '/style'
    );
    expect(item.countryOnly).toBe(true);
    expect(item.bbox).toEqual([5.9, 45.8, 10.5, 47.9]);
    expect(item.countryMinZoom).toBe(7);
  });

  it('falls back to the img fallback when no preview_url', () => {
    const item = mapCatalogBasemap(
      layer({ slug: 'world-topo', preview_url: null }),
      '/style',
      () => 'thumb.png'
    );
    expect(item.img).toBe('thumb.png');
  });

  it('merges legacy anchors under catalog anchors for the mtk basemap', () => {
    const item = mapCatalogBasemap(
      layer({
        slug: 'wd-outdoor-base-mtk',
        fallback: 'wd-outdoor-base-ofm',
        anchors: { ways: { before: null }, background: { before: null } },
      }),
      '/style'
    );
    expect(item.fallback).toBe('wd-outdoor-base-ofm');
    // Catalog anchors win for their slots…
    expect(item.layers.ways.before).toBeUndefined();
    // …legacy anchors fill the slots the seed does not carry
    expect(item.layers.places?.before).toBe('place_point_label_rank_2');
    expect(item.layers.routes?.before).toBe('wd-station-label');
  });

  it('keeps the legacy auto-switch chain for the hill variants', () => {
    expect(LEGACY_BASEMAP_FALLBACKS['wd-outdoor-base-mtk-hill']).toBe('wd-outdoor-base-ofm-hill');
    expect(LEGACY_BASEMAP_FALLBACKS['wd-outdoor-base-ofm-hill']).toBe('openfreemap-liberty');
  });
});
