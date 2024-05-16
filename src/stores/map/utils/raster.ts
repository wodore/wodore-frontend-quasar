import { StyleSpecification } from 'maplibre-gl';

import {
  OverlaySwitchItem,
  LayerNames,
  OpacitySpecification,
} from './interfaces';

interface getRasterStyleArgs {
  name: string;
  tiles: string[];
  attribution?: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  suffix?: string;
}
export function getRasterStyle({
  name,
  tiles,
  attribution = '',
  tileSize = 256,
  minZoom = 0,
  maxZoom = 22,
  suffix = 'wd-',
}: getRasterStyleArgs): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    name: name,
    sources: {},
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    //sprite: { id: 'default', url: 'http://localhost:9000/huts/sprite' },
    layers: [
      {
        id: `${suffix}${name}`,
        type: 'raster',
        source: `${suffix}${name}`,
        minzoom: minZoom,
        maxzoom: maxZoom,
      },
    ],
  };
  style.sources[`${suffix}${name}`] = {
    type: 'raster',
    tiles: tiles,
    tileSize: tileSize,
    attribution: attribution,
  };
  return style;
}

interface getSwisstopoOverlayArgs {
  name: string;
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
  return {
    name: name,
    label: label,
    show: show,
    active: active,
    onLayer: onLayer,
    icon: icon,
    opacity: opacity,
    style: getRasterStyle({
      name: name,
      attribution: attribution,
      tiles: [
        `https://wmts0.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts1.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts2.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts3.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts4.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts5.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts6.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts7.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts8.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
        `https://wmts9.geo.admin.ch/1.0.0/${name}/default/current/${tileMatrixSet}/{z}/{x}/{y}.${format}`,
      ],
      minZoom: minZoom,
      maxZoom: maxZoom,
      tileSize: tileSize,
    }),
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
