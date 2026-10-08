import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Country basemap fallback — regional basemaps (swisstopo pixel raster,
 * basemap.at) only ship tiles for their country. When the camera zooms
 * out past country scale they would show blank space / open ocean.
 *
 * Fix: compose the country style ON TOP of the DEFAULT basemap style
 * (wd-outdoor-base-mtk, world-covering vector). The country layers get a
 * layer-level `minzoom` (their "max zoom-out"): below it they simply
 * don't render and the default world map shows instead — no runtime
 * style switching, no flicker. The world raster underlay
 * (world-underlay.ts) remains the final safety net beneath everything.
 *
 * Known trade-off: while a country basemap is active, the default vector
 * layers also render at high zoom beneath the (mostly opaque) country
 * tiles. Correctness first; the zoom-gated visibility of the under-layer
 * can be a follow-up optimization if it ever shows on weak GPUs.
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

  return {
    ...country,
    glyphs: fallback.glyphs ?? country.glyphs,
    sprite: fallback.sprite ?? country.sprite,
    sources: { ...fallback.sources, ...country.sources },
    layers: [...(fallback.layers ?? []), ...countryLayers],
  };
}

function clampLayerMinZoom(layer: LayerSpecification, minZoom: number): LayerSpecification {
  if ((layer.minzoom ?? 0) >= minZoom) return layer;
  return { ...layer, minzoom: minZoom } as LayerSpecification;
}
