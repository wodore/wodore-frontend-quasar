import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Country basemap fallback — regional basemaps (swisstopo pixel raster,
 * basemap.at) only ship tiles for their country. When the camera zooms
 * out past country scale they would show blank space / open ocean.
 *
 * Fix: compose the country style ON TOP of the DEFAULT basemap style
 * (wd-outdoor-base-mtk, world-covering vector). The country layers get a
 * layer-level `minzoom`, the fallback layers a matching `maxzoom` — they
 * occupy disjoint zoom bands: below COUNTRY_BASEMAP_MIN_ZOOM the world
 * map shows, at and above it only the (cheap) country raster renders.
 * No runtime style switching, no hidden GPU work beneath opaque tiles.
 * The world raster underlay (world-underlay.ts) remains the final safety
 * net beneath everything.
 */

/**
 * Zoom at which country basemap layers stop rendering (zooming out past
 * this crossfades into the default basemap). At country zoom and above
 * the country tiles cover their area; the default beneath only shows
 * where country tiles are missing (outside the country).
 */
export const COUNTRY_BASEMAP_MIN_ZOOM = 6;

/**
 * Compose the country style above the default (fallback) style. Pure —
 * returns a new style; the country style keeps its name/sprite identity
 * for MapLibre diffing.
 *
 * The fallback layers are clamped to `maxzoom = COUNTRY_BASEMAP_MIN_ZOOM`:
 * MapLibre has NO occlusion culling — every visible layer renders every
 * frame even beneath opaque country tiles — so the world fallback renders
 * exactly where it is needed (below country scale) and costs nothing
 * above. Outside the country at high zoom the map shows its plain light
 * background instead (pre-fallback behavior; the country basemap is
 * explicitly country-scoped).
 */
export function withCountryFallback(
  country: StyleSpecification,
  fallback: StyleSpecification
): StyleSpecification {
  // Country layers stop rendering below country scale — the fallback
  // shows instead. Layers that already start higher keep their own value.
  const countryLayers = (country.layers ?? []).map(layer =>
    clampLayerMinZoom(layer, COUNTRY_BASEMAP_MIN_ZOOM)
  );
  // Fallback layers stop rendering AT country scale (no hidden GPU work
  // beneath the opaque country tiles above it).
  const fallbackLayers = (fallback.layers ?? []).map(layer =>
    clampLayerMaxZoom(layer, COUNTRY_BASEMAP_MIN_ZOOM)
  );

  return {
    ...country,
    glyphs: fallback.glyphs ?? country.glyphs,
    sprite: fallback.sprite ?? country.sprite,
    sources: { ...fallback.sources, ...country.sources },
    layers: [...fallbackLayers, ...countryLayers],
  };
}

function clampLayerMinZoom(layer: LayerSpecification, minZoom: number): LayerSpecification {
  if ((layer.minzoom ?? 0) >= minZoom) return layer;
  return { ...layer, minzoom: minZoom } as LayerSpecification;
}

function clampLayerMaxZoom(layer: LayerSpecification, maxZoom: number): LayerSpecification {
  if ((layer.maxzoom ?? Infinity) <= maxZoom) return layer;
  return { ...layer, maxzoom: maxZoom } as LayerSpecification;
}
