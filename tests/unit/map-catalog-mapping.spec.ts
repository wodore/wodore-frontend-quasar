// @vitest-environment happy-dom
//
// Catalog → switch-item mapping: overlay/basemap compilation, slug
// aliases, slot overrides, legend mapping, coverage-driven country
// fallback, sprite pack merge and the factory merge strategy.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { StyleSpecification } from 'maplibre-gl';

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

// i18n labels resolve through the app's locale service — the happy-dom
// environment boots it; factories are imported dynamically after pinia.
import {
  mapCatalogOverlay,
  mapCatalogBasemap,
  mergeSpritePacks,
  opacityFromParameters,
  isUsableStyle,
} from '@stores/map/utils/catalog-mapping';
import type { MapCatalogLayer, MapLayerParameter } from '@services/map-catalog';

function layer(partial: Partial<MapCatalogLayer> & { slug: string }): MapCatalogLayer {
  return {
    role: 'overlay',
    name: 'Test layer',
    description: '',
    icon: 'huts',
    icon_badge: '',
    slot: 'ways',
    order: 0,
    show: true,
    is_default: false,
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
    spec: 'high',
    style_url: '/v1/map/styles/x.json?spec=high',
    modified: null,
    ...partial,
  };
}

function style(): StyleSpecification {
  return {
    version: 8,
    sources: { 'wd-x': { type: 'raster', tiles: ['https://t/{z}/{x}/{y}.png'], tileSize: 256 } },
    layers: [{ id: 'wd-x', type: 'raster', source: 'wd-x' }],
  };
}

describe('mapCatalogOverlay', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  it('maps catalog fields onto the switch item', () => {
    const item = mapCatalogOverlay(
      layer({ slug: 'mtb', name: 'Mountain bike routes', icon: 'mtb' }),
      new Set(['background', 'ways']),
      { style: style() }
    );
    expect(item.name).toBe('mtb');
    expect(item.onLayer).toBe('ways');
    expect(item.icon).toBe('mtb');
    expect(item.show).toBe(true);
    expect(item.style.layers[0]!.id).toBe('wd-x');
    expect(item.parameters).toBeUndefined();
  });

  it('uses the catalog slug as the item identity (no aliases)', () => {
    const item = mapCatalogOverlay(
      layer({ slug: 'ch.swisstopo.swisstlm3d-wanderwege' }),
      new Set(['background', 'ways']),
      { style: style() }
    );
    expect(item.name).toBe('ch.swisstopo.swisstlm3d-wanderwege');
    expect(item.catalogSlug).toBe('ch.swisstopo.swisstlm3d-wanderwege');
  });

  it('moves huts to the places anchor while the seed lacks the slot', () => {
    const item = mapCatalogOverlay(
      layer({ slug: 'huts', slot: 'ways' }),
      new Set(['background', 'ways']),
      { style: style() }
    );
    expect(item.onLayer).toBe('places');
    // Once the catalog defines a places slot, the backend's slot value
    // is authoritative (the huts row would be re-slotted there)
    const seeded = mapCatalogOverlay(layer({ slug: 'huts', slot: 'places' }), new Set(['places']), {
      style: style(),
    });
    expect(seeded.onLayer).toBe('places');
  });

  it('compiles the overlay opacity from the opacity-curve parameter', () => {
    const parameters: MapLayerParameter[] = [
      {
        slug: 'mtb.opacity',
        kind: 'opacity-curve',
        label: 'Opacity',
        description: '',
        default: ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 0.7],
      },
    ];
    const item = mapCatalogOverlay(layer({ slug: 'mtb', parameters }), new Set(['ways']), {
      style: style(),
    });
    expect(item.opacity).toEqual(['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 0.7]);
    expect(opacityFromParameters(parameters)).toEqual(item.opacity);
    expect(opacityFromParameters([])).toBeUndefined();
  });

  it('clamps style layers to the registry min_zoom', () => {
    const item = mapCatalogOverlay(layer({ slug: 'slopes', min_zoom: 8 }), new Set(['ways']), {
      style: style(),
    });
    expect(item.style.layers[0]!.minzoom).toBe(8);
  });

  it('maps legends: static items resolve token colors, category sections degrade to the API source', () => {
    const legend = {
      sections: [
        {
          title: 'Routes',
          type: 'line',
          items: [{ label: 'Main', color: '{{routes.color}}' }],
        },
        {
          title: 'Accommodation',
          type: 'symbol_dual',
          category: {
            slug: 'accommodation',
            identifier: 'accommodation',
            name: 'Accommodation',
            color: null,
            use: 'legend',
            order: 0,
            children: [],
          },
        },
      ],
      links: [{ name: 'More', url: 'https://example.com' }],
    };
    const item = mapCatalogOverlay(
      layer({
        slug: 'mtb',
        legend,
        parameters: [
          {
            slug: 'routes.color',
            kind: 'color',
            label: 'Color',
            description: '',
            default: '#cc1f0c',
          },
        ],
      }),
      new Set(['ways']),
      { style: style() }
    );
    expect(item.config?.legend?.sections[0]?.items[0]?.color).toBe('#cc1f0c');
    // No symbols in the projection → string category (existing API fetch)
    expect(item.config?.legend?.sections[1]?.category).toBe('accommodation');
    expect(item.config?.legend?.links).toEqual([{ name: 'More', url: 'https://example.com' }]);
  });
});

describe('mapCatalogBasemap', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  it('compiles coverage into the country fallback fields', () => {
    const item = mapCatalogBasemap(
      layer({
        slug: 'ch-swisstopo-full',
        role: 'basemap',
        coverage_bbox: [5.9, 45.8, 10.5, 47.9],
        fallback_min_zoom: 7,
      }),
      'https://hub/v1/map/styles/ch-swisstopo-full.json?spec=high'
    );
    expect(item.countryOnly).toBe(true);
    expect(item.bbox).toEqual([5.9, 45.8, 10.5, 47.9]);
    expect(item.countryMinZoom).toBe(7);
    expect(item.style).toBe('https://hub/v1/map/styles/ch-swisstopo-full.json?spec=high');
  });

  it('keeps the fallback field and merges legacy anchors under catalog anchors', () => {
    const item = mapCatalogBasemap(
      layer({
        slug: 'wd-outdoor-base-mtk',
        role: 'basemap',
        fallback: 'wd-outdoor-base-ofm',
        anchors: { ways: { before: null }, background: { before: null } },
      }),
      'https://hub/v1/map/styles/wd-outdoor-base-mtk.json?spec=high'
    );
    expect(item.fallback).toBe('wd-outdoor-base-ofm');
    // Catalog anchors win for their slots…
    expect(item.layers.ways.before).toBeUndefined();
    // …legacy anchors fill the slots the seed does not carry
    expect(item.layers.places?.before).toBe('place_point_label_rank_2');
    expect(item.layers.routes?.before).toBe('wd-station-label');
  });

  it('uses catalog anchors verbatim when they define the slot', () => {
    const item = mapCatalogBasemap(
      layer({
        slug: 'ch-swisstopo-light',
        role: 'basemap',
        anchors: {
          ways: { before: 'Other place labels' },
          background: { before: 'Building line' },
        },
      }),
      'https://hub/v1/map/styles/ch-swisstopo-light.json?spec=low'
    );
    expect(item.layers.ways.before).toBe('Other place labels');
    expect(item.layers.background.before).toBe('Building line');
  });
});

describe('isUsableStyle', () => {
  beforeAll(() => {
    setActivePinia(createPinia());
  });

  it('accepts a structurally valid style', () => {
    expect(isUsableStyle(style())).toBe(true);
  });

  it('rejects an invalid authored expression (zoom inside a product)', () => {
    // The seeded huts icon-size: ["*", scale, ["interpolate", …, ["zoom"], …]]
    // — MapLibre rejects it at addLayer; the catalog item must fall back.
    const broken = style();
    (broken.layers[0] as unknown as { layout: Record<string, unknown> }).layout = {
      'icon-size': ['*', 1, ['interpolate', ['linear'], ['zoom'], 7, 0.1, 20, 2]],
    };
    expect(isUsableStyle(broken)).toBe(false);
  });
});

describe('mergeSpritePacks', () => {
  it('unions same-base sprite packs across overlays under one URL', () => {
    const a = {
      name: 'huts',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/accommodation' }],
        layers: [],
      } as StyleSpecification,
    };
    const b = {
      name: 'huts-availability',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/availability' }],
        layers: [],
      } as StyleSpecification,
    };
    mergeSpritePacks([a, b]);
    expect(a.style.sprite).toEqual([
      { id: 'wd', url: 'https://tiles/sprite/accommodation,availability' },
    ]);
    expect(b.style.sprite).toEqual([
      { id: 'wd', url: 'https://tiles/sprite/accommodation,availability' },
    ]);
  });

  it('leaves foreign sprite URLs alone', () => {
    const a = {
      name: 'x',
      style: {
        version: 8,
        sprite: [{ id: 'other', url: 'https://other/sprite.json' }],
        layers: [],
      } as StyleSpecification,
    };
    mergeSpritePacks([a]);
    expect(a.style.sprite).toEqual([{ id: 'other', url: 'https://other/sprite.json' }]);
  });

  it('keeps the version query out of the pack list and re-appends it once', () => {
    // Served sprite URLs carry the sprites-group content version
    // (?v=…) — the union must not fold it into the pack list
    // (…/sprite/a?v=X,b?v=Y 404s and BOTH packs load for no overlay).
    const a = {
      name: 'huts',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/accommodation,availability?v=abc123' }],
        layers: [],
      } as StyleSpecification,
    };
    const b = {
      name: 'transport',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/transport?v=abc123' }],
        layers: [],
      } as StyleSpecification,
    };
    mergeSpritePacks([a, b]);
    const expected = 'https://tiles/sprite/accommodation,availability,transport?v=abc123';
    expect(a.style.sprite).toEqual([{ id: 'wd', url: expected }]);
    expect(b.style.sprite).toEqual([{ id: 'wd', url: expected }]);
  });

  it('leaves entries unmerged when version queries differ', () => {
    const a = {
      name: 'huts',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/accommodation?v=abc' }],
        layers: [],
      } as StyleSpecification,
    };
    const b = {
      name: 'transport',
      style: {
        version: 8,
        sprite: [{ id: 'wd', url: 'https://tiles/sprite/transport?v=def' }],
        layers: [],
      } as StyleSpecification,
    };
    mergeSpritePacks([a, b]);
    // differing versions on one base: no merge is safer than guessing
    expect(a.style.sprite).toEqual([{ id: 'wd', url: 'https://tiles/sprite/accommodation?v=abc' }]);
    expect(b.style.sprite).toEqual([{ id: 'wd', url: 'https://tiles/sprite/transport?v=def' }]);
  });
});
