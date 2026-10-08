import type {
  LayerSpecification,
  LineLayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
  SymbolLayerSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl';

/**
 * World underlay — a minimal "maplibre demotiles" world (Natural Earth
 * data: country contours + names, nothing else) merged into EVERY
 * basemap's style at the bottom of the layer stack.
 *
 * Why: regional basemaps (swisstopo raster, basemap.at) only ship tiles
 * for their country. With world coverage the rest of the planet was blank.
 * The underlay sits *below* the basemap layers, so it only shows through
 * where a basemap has no data — "if it is empty we see something".
 *
 * Service: https://maplibre.org/projects/demotiles/ (free MapLibre demo
 * tiles, z0–z6). Layers are capped at z7: past that any basemap data
 * present should win, and the Natural Earth geometry overzooms badly.
 */

export const WORLD_UNDERLAY_SOURCE_ID = 'wd-world-underlay';

/** Layer id prefix — also used for idempotency checks. */
const UNDERLAY_LAYER_PREFIX = 'wd-world-underlay-';

const WORLD_UNDERLAY_TILES_URL = 'https://demotiles.maplibre.org/tiles/tiles.json';
const WORLD_UNDERLAY_GLYPHS = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

/** Underlay disappears at this zoom (demotiles data ends at z6). */
export const WORLD_UNDERLAY_MAX_ZOOM = 7;

export const worldUnderlaySource: VectorSourceSpecification = {
  type: 'vector',
  url: WORLD_UNDERLAY_TILES_URL,
  attribution:
    '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>',
};

/**
 * Country contours + names. Neutral blue-gray so it reads as "map" on the
 * blank gaps of light regional basemaps without clashing with any basemap
 * palette. Labels use "Noto Sans Regular": the glyph servers actually in
 * use (OpenFreeMap for the local raster styles, MapTiler for the vector
 * styles) both host that stack — demotiles' own "Open Sans Semibold" is
 * NOT hosted by them.
 */
function worldUnderlayLayers(): LayerSpecification[] {
  const boundaries: LineLayerSpecification = {
    id: `${UNDERLAY_LAYER_PREFIX}boundaries`,
    type: 'line',
    source: WORLD_UNDERLAY_SOURCE_ID,
    'source-layer': 'countries',
    maxzoom: WORLD_UNDERLAY_MAX_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'visible' },
    paint: {
      'line-color': '#5f7d9c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 5, 1.2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 7, 0.4],
    },
  };
  const labels: SymbolLayerSpecification = {
    id: `${UNDERLAY_LAYER_PREFIX}labels`,
    type: 'symbol',
    source: WORLD_UNDERLAY_SOURCE_ID,
    'source-layer': 'countries',
    maxzoom: WORLD_UNDERLAY_MAX_ZOOM,
    layout: {
      visibility: 'visible',
      // demotiles countries attributes: ABBREV (short code) and NAME —
      // abbreviations at planet zoom, full names from z4 up
      'text-field': ['step', ['zoom'], ['get', 'ABBREV'], 4, ['get', 'NAME']],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 4, 12, 6, 16],
      'text-max-width': 10,
      'text-transform': ['step', ['zoom'], 'uppercase', 2, 'none'],
      'text-letter-spacing': 0.08,
    },
    paint: {
      'text-color': '#3d5166',
      'text-halo-color': 'rgba(255, 255, 255, 0.85)',
      'text-halo-width': 1.2,
    },
  };
  return [boundaries, labels];
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
 * Styles without their own glyph server get demotiles' (labels need
 * glyphs; current styles all ship one — OpenFreeMap / MapTiler).
 */
export function withWorldUnderlay(style: StyleSpecification): StyleSpecification {
  if (style.sources[WORLD_UNDERLAY_SOURCE_ID] || hasUnderlayLayers(style)) {
    return style;
  }
  const layers = style.layers ?? [];
  const insertAt = worldUnderlayInsertIndex(layers);
  return {
    ...style,
    glyphs: style.glyphs ?? WORLD_UNDERLAY_GLYPHS,
    sources: { ...style.sources, [WORLD_UNDERLAY_SOURCE_ID]: worldUnderlaySource },
    layers: [...layers.slice(0, insertAt), ...worldUnderlayLayers(), ...layers.slice(insertAt)],
  };
}

/**
 * Runtime variant for the initial map load: adds source + layers to the
 * LIVE map when missing (the initial style may be a URL the underlay
 * cannot be merged into ahead of the fetch). Basemap switches get the
 * underlay via `withWorldUnderlay` in transformStyle instead.
 */
export function ensureWorldUnderlay(map: MapLibreMap): void {
  if (map.getSource(WORLD_UNDERLAY_SOURCE_ID)) return;
  const style = map.getStyle();
  if (style?.layers === undefined) return;

  // Symbol layers need a glyph server — raster styles ship OpenFreeMap's,
  // MapTiler styles their own; demotiles' as a last resort
  if (!style.glyphs) {
    map.setGlyphs(WORLD_UNDERLAY_GLYPHS);
  }

  const insertAt = worldUnderlayInsertIndex(style.layers);
  const beforeId = insertAt < style.layers.length ? style.layers[insertAt].id : undefined;
  map.addSource(WORLD_UNDERLAY_SOURCE_ID, worldUnderlaySource);
  for (const layer of worldUnderlayLayers()) {
    map.addLayer(layer, beforeId);
  }
}
