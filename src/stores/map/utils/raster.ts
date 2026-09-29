import { StyleSpecification } from 'maplibre-gl';

import { OverlaySwitchItem, LayerNames, OpacitySpecification } from './interfaces';

interface getRasterStyleArgs {
  name: string;
  layers?: string | Array<string>;
  tiles: string[];
  attribution?: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  suffix?: string;
  cdn?: boolean;
  /** [minX, minY, maxX, maxY] — MapLibre skips tile requests outside these bounds. */
  bounds?: [number, number, number, number];
}
export function getRasterStyle({
  name,
  layers,
  tiles,
  attribution = '',
  tileSize = 256,
  minZoom = 0,
  maxZoom = 22,
  suffix = 'wd-',
  cdn = false,
  bounds,
}: getRasterStyleArgs): StyleSpecification {
  layers = layers === undefined ? [name] : typeof layers === 'string' ? [layers] : layers;
  const style: StyleSpecification = {
    version: 8,
    name: name,
    sources: {},
    //glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    //sprite: { id: 'default', url: 'http://localhost:9000/huts/sprite' },
    layers: [],
  };
  for (const layerName of layers) {
    style.layers.push({
      id: `${suffix}${layerName}`,
      type: 'raster',
      source: `${suffix}${layerName}`,
      minzoom: minZoom,
      maxzoom: maxZoom,
    });
    style.sources[`${suffix}${layerName}`] = {
      type: 'raster',
      tiles: tiles.map(
        v =>
          (cdn
            ? 'https://res.cloudinary.com/' +
              process.env.WODORE_CLOUDINARY_ENV +
              '/image/fetch/f_auto/q_auto/'
            : '') + v.replace('<NAME>', layerName)
      ),
      tileSize: tileSize,
      attribution: attribution,
      ...(bounds ? { bounds } : {}),
    };
  }

  return style;
}

interface getCompositeRasterStyleArgs {
  name: string;
  /**
   * Sub-styles to merge, e.g. built with getRasterStyle().
   * Array order = paint order: the FIRST style renders at the BOTTOM
   * (use it for the world fallback), later styles cover it where they
   * have data (national maps with source `bounds`).
   */
  styles: StyleSpecification[];
  /** Single glyphs URL for the merged style (defaults to the first sub-style that has one). */
  glyphs?: string;
}

/**
 * Merge multiple raster styles into one basemap style.
 * Source and layer IDs are namespaced with the sub-style's `name` to
 * avoid collisions; per-source attribution is preserved so the combined
 * attribution shown by MapLibre stays license-correct.
 */
export function getCompositeRasterStyle({
  name,
  styles,
  glyphs,
}: getCompositeRasterStyleArgs): StyleSpecification {
  const seen = new Set<string>();
  const sources: StyleSpecification['sources'] = {};
  const layers: StyleSpecification['layers'] = [];

  for (const style of styles) {
    const ns = style.name ?? `style${layers.length}`;
    const idMap = new Map<string, string>();
    for (const [srcId, src] of Object.entries(style.sources ?? {})) {
      const newId = `${ns}:${srcId}`;
      if (!seen.has(newId)) {
        seen.add(newId);
        sources[newId] = src;
        idMap.set(srcId, newId);
      }
    }
    for (const layer of style.layers ?? []) {
      const srcId = 'source' in layer ? layer.source : undefined;
      const mapped = srcId !== undefined ? idMap.get(srcId) : undefined;
      layers.push(
        mapped !== undefined
          ? ({ ...layer, id: `${ns}:${layer.id}`, source: mapped } as typeof layer)
          : layer
      );
    }
  }

  return {
    version: 8,
    name: name,
    glyphs: glyphs ?? styles.find(s => s.glyphs)?.glyphs,
    sources: sources,
    layers: layers,
  };
}

/**
 * Clone a style, raising every layer's minzoom so the style (and its
 * sources — MapLibre stops fetching when no layer is visible at the
 * current zoom) only renders from the given zoom level upwards.
 */
export function withLayerMinZoom(style: StyleSpecification, minZoom: number): StyleSpecification {
  return {
    ...style,
    layers: (style.layers ?? []).map(layer => ({
      ...layer,
      minzoom: Math.max(layer.minzoom ?? 0, minZoom),
    })),
  };
}

interface getSwisstopoOverlayArgs {
  name: string;
  layers?: string | Array<string>;
  label: string;
  icon?: string;
  onLayer?: LayerNames;
  active?: boolean;
  show?: boolean;
  attribution?: string;
  tileMatrixSet?: number;
  format?: 'png' | 'jpeg';
  visibility?: 'visible' | 'none';
  opacity?: OpacitySpecification;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
}

export function getSwisstopoOverlay({
  name,
  layers,
  label,
  icon = 'fa-solid fa-notdef',
  format = 'png',
  active = false,
  show = true,
  onLayer = 'ways',
  tileMatrixSet = 3857,
  attribution = '',
  //visibility = 'none',
  opacity = 0.7,
  minZoom = 0,
  maxZoom = 22,
  tileSize = 256,
}: getSwisstopoOverlayArgs): OverlaySwitchItem {
  const style = getRasterStyle({
    name: name,
    layers: layers,
    attribution: attribution,
    tiles: [
      `https://wmts0.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts1.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts2.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts3.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts4.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts5.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts6.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts7.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts8.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      `https://wmts9.geo.admin.ch/1.0.0/<NAME>/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
    ],
    minZoom: minZoom,
    maxZoom: maxZoom,
    tileSize: tileSize,
  });
  return {
    name: style.name as string,
    label: label,
    show: show,
    active: active,
    onLayer: onLayer,
    icon: icon,
    opacity: opacity,
    style: style,
  };
}

//return getRaster({
//  name: name,
//  label: label,
//  icon: icon,
//  active: active,
//  show: show,
//  onLayer: onLayer,
//  visibility: visibility,
//  opacity: opacity,
//  tiles: [
//    `https://wmts0.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts1.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts2.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts3.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts4.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts5.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts6.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts7.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts8.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//    `https://wmts9.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
//  ],
//});
