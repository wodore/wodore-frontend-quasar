import { StyleSpecification } from 'maplibre-gl';

import {
  OverlaySwitchItem,
  LayerNames,
  OpacitySpecification,
} from './interfaces';

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
}: getRasterStyleArgs): StyleSpecification {
  layers =
    layers === undefined
      ? [name]
      : typeof layers === 'string'
        ? [layers]
        : layers;
  const style: StyleSpecification = {
    version: 8,
    name: name,
    sources: {},
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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
        (v) =>
          (cdn
            ? 'https://res.cloudinary.com/' +
              process.env.CLOUDINARY_ENV +
              '/image/fetch/f_auto/q_auto/'
            : '') + v.replace('<NAME>', layerName),
      ),
      tileSize: tileSize,
      attribution: attribution,
    };
  }

  console.debug(`Add style spec ${name}`, layers, style);
  return style;
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
