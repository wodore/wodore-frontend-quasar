import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

/**
 * Country basemap fallback — regional basemaps (swisstopo pixel raster,
 * basemap.at) only ship tiles for their country. Two gates decide which
 * layer set renders:
 *
 * - ZOOM: the country layers carry a layer-level `minzoom` — zooming out
 *   past country scale always shows the default world map (no whitish
 *   low-zoom country tiles on the planet).
 * - BOUNDING BOX: the basemap declares its country `bbox`; the store
 *   watches the camera and toggles visibility on moveend. Outside the
 *   bbox the default world map shows at EVERY zoom — inside it the
 *   country raster renders on top (MapLibre has no occlusion culling,
 *   so the fallback layers are hidden while the country tiles cover
 *   them — zero hidden GPU/tile work).
 *
 * The world raster underlay (world-underlay.ts) remains the final safety
 * net beneath everything.
 */

/**
 * Zoom at which country basemap layers start rendering (zooming out past
 * this always shows the default basemap, regardless of position).
 */
export const COUNTRY_BASEMAP_MIN_ZOOM = 6;

export type CountryBbox = readonly [number, number, number, number]; // w, s, e, n

/** Whether a camera center point is inside the country bounding box. */
export function isCenterInBbox(
  center: readonly [number, number], // [lng, lat]
  bbox: CountryBbox
): boolean {
  const [lng, lat] = center;
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/**
 * Compose the country style above the default (fallback) style. Pure —
 * returns a new style; the country style keeps its name/sprite identity
 * for MapLibre diffing.
 *
 * The fallback layers keep their full zoom range — their visibility is
 * runtime-gated by the bbox watcher (basemap-store). The country layers
 * get the zoom floor here.
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
