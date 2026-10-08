import type {
  LayerSpecification,
  Map as MapLibreMap,
  RasterSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

/**
 * World underlay — a cheap, colored world raster (classic OpenStreetMap
 * tiles) merged into EVERY basemap's style at the bottom of the layer
 * stack.
 *
 * Why: regional basemaps (swisstopo raster, basemap.at) only ship tiles
 * for their country. With world coverage the rest of the planet was blank.
 * The underlay sits *below* the basemap layers, so it only shows through
 * where a basemap has no data — "if it is empty we see something".
 *
 * Why OSM raster and not vector: the underlay is a LAST resort — it must
 * be fast and cheap (plain raster tiles, trivial to composite on software
 * GL) and colored (a bare country-contour vector layer read as a broken,
 * colorless map). tile.openstreetmap.org is keyless and already the app's
 * weak-GPU basemap; low-volume gap-filling use is fine.
 *
 * Country basemaps additionally carry the DEFAULT basemap merged beneath
 * their own layers (see country-fallback.ts) — the underlay stays the
 * final safety net beneath everything.
 */

export const WORLD_UNDERLAY_SOURCE_ID = 'wd-world-underlay';

/** Layer id prefix — also used for idempotency checks. */
const UNDERLAY_LAYER_PREFIX = 'wd-world-underlay-';

/**
 * Underlay disappears at this zoom: above it, in-country coverage is dense
 * (and the country-basemap fallback basemap is active), while past z7 a
 * 256-px world raster would look mushy anyway.
 */
export const WORLD_UNDERLAY_MAX_ZOOM = 7;

export const worldUnderlaySource: RasterSourceSpecification = {
  type: 'raster',
  // HOT (Humanitarian OSM Team) style — muted cartography that reads well
  // as a gap-filler beneath basemaps and overlays. {s} is not expanded by
  // MapLibre (unlike Leaflet) — subdomains are listed explicitly.
  tiles: [
    'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  ],
  tileSize: 256,
  attribution:
    '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>' +
    ' · <a href="https://www.hotosm.org/">HOT</a>',
};

function worldUnderlayLayers(): LayerSpecification[] {
  const raster: LayerSpecification = {
    id: `${UNDERLAY_LAYER_PREFIX}raster`,
    type: 'raster',
    source: WORLD_UNDERLAY_SOURCE_ID,
    minzoom: 0,
    maxzoom: WORLD_UNDERLAY_MAX_ZOOM,
    layout: { visibility: 'visible' },
    paint: { 'raster-opacity': 1 },
  } as LayerSpecification;
  return [raster];
}

/**
 * Index in `layers` below which the underlay must sit: directly above the
 * basemap's own background layers (a solid background would otherwise
 * paint over the underlay), below every data layer.
 */
export function worldUnderlayInsertIndex(layers: ReadonlyArray<{ type: string }>): number {
  let index = 0;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].type === 'background') {
      index = i + 1;
    }
  }
  return index;
}

function hasUnderlayLayers(style: StyleSpecification): boolean {
  return (style.layers ?? []).some(l => l.id.startsWith(UNDERLAY_LAYER_PREFIX));
}

/**
 * Merge the world underlay into a style (pure — returns a new style).
 * Idempotent: styles that already carry the underlay are returned as-is.
 */
export function withWorldUnderlay(style: StyleSpecification): StyleSpecification {
  if (style.sources[WORLD_UNDERLAY_SOURCE_ID] || hasUnderlayLayers(style)) {
    return style;
  }
  const layers = style.layers ?? [];
  const insertAt = worldUnderlayInsertIndex(layers);
  return {
    ...style,
    sources: { ...style.sources, [WORLD_UNDERLAY_SOURCE_ID]: worldUnderlaySource },
    layers: [...layers.slice(0, insertAt), ...worldUnderlayLayers(), ...layers.slice(insertAt)],
  };
}

/**
 * Runtime variant for the initial map load: adds source + layer to the
 * LIVE map when missing (the initial style may be a URL the underlay
 * cannot be merged into ahead of the fetch). Basemap switches get the
 * underlay via `withWorldUnderlay` in transformStyle instead.
 */
export function ensureWorldUnderlay(map: MapLibreMap): void {
  if (map.getSource(WORLD_UNDERLAY_SOURCE_ID)) return;
  const style = map.getStyle();
  if (style?.layers === undefined) return;

  const insertAt = worldUnderlayInsertIndex(style.layers);
  const beforeId = insertAt < style.layers.length ? style.layers[insertAt].id : undefined;
  map.addSource(WORLD_UNDERLAY_SOURCE_ID, worldUnderlaySource);
  for (const layer of worldUnderlayLayers()) {
    map.addLayer(layer, beforeId);
  }
}
