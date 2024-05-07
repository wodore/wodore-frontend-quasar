import { SymbolLayerSpecification, StyleSpecification } from 'maplibre-gl';
import { StyleSwitchItem } from 'vue-maplibre-gl';

const imageSwitchZoom = 11;
export const hutsLayerLayout = {
  'text-field': ['get', 'name'],
  'text-size': ['interpolate', ['linear'], ['zoom'], 7, 7, 9, 10, 22, 16],
  //'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
  'text-font': ['Open Sans Semibold'],
  'text-anchor': 'bottom',
  'icon-allow-overlap': true,
  'text-allow-overlap': false,
  'symbol-sort-key': ['get', 'type_id'],
  'icon-overlap': 'always',
  'text-overlap': 'never',
  'text-optional': true,
  'icon-image': [
    'step',
    ['zoom'],
    [
      'coalesce',
      ['image', ['concat', 'wodore:simple/', ['get', 'type_open_slug']]],
      ['image', 'wodore:simple/unknown'],
    ],
    imageSwitchZoom,
    [
      'coalesce',
      ['image', ['concat', 'wodore:detailed/', ['get', 'type_open_slug']]],
      ['image', 'wodore:detailed/unknown'],
    ],
  ],
  //'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.05, 9, 0.1, 20, 1],
  'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 9, 0.3, 20, 2],
  visibility: 'visible',
} as SymbolLayerSpecification['layout'];

export const hutsLayerPaint = {
  'icon-opacity': [
    'interpolate',
    ['linear'],
    ['zoom'],
    7,
    0.7,
    12,
    0.8,
    22,
    0.85,
  ],
  'text-opacity': ['step', ['zoom'], 0, 9, 1],
  'text-halo-width': 2,
  'text-halo-color': '#ffffff',
  'text-translate': [
    'interpolate',
    ['linear'],
    ['zoom'],
    9,
    ['literal', [0, -6]],
    20,
    ['literal', [0, -40]],
  ],
} as SymbolLayerSpecification['paint'];

interface getRasterArgs {
  name: string;
  tiles: string[];
  attribution?: string;
}
function getRaster({
  name,
  tiles,
  attribution,
}: getRasterArgs): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    //sprite: { id: 'default', url: 'http://localhost:9000/huts/sprite' },
    layers: [
      {
        id: `${name}-raster-layer`,
        type: 'raster',
        source: `${name}-raster-tiles`,
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
  style.sources[`${name}-raster-tiles`] = {
    type: 'raster',
    tiles: tiles,
    tileSize: 256,
    attribution: attribution,
  };
  return style;
}

const swissTopoRasterStyle = getRaster({
  name: 'swiss-raster',
  tiles: [
    'https://wmts0.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts1.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts2.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts3.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts4.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts5.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts6.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts7.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts8.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts9.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
  ],
  attribution:
    '<a href="https://www.swisstopo.admin.ch/" target="_blank">&copy; swisstop</a>',
});

export const mapStyles: Array<StyleSwitchItem> = [
  {
    name: 'swiss-vector',
    label: 'Topo Vector',
    // icon : { path: mdiRoad },
    style:
      'https://api.maptiler.com/maps/ch-swisstopo-lbm-vivid/style.json?key=yYYuZy3hwmMjY087FDvY',
  },
  {
    name: 'swiss-raster',
    label: 'Topo Raster',
    // icon : { path: mdiRoad },
    style: swissTopoRasterStyle,
  },
  {
    name: 'satellite',
    label: 'Satellite',
    style:
      'https://api.maptiler.com/maps/hybrid/style.json?key=cQX2iET1gmOW38bedbUh',
  },
  {
    name: 'outdoor-osm',
    label: 'Outdoor OSM',
    style:
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=yYYuZy3hwmMjY087FDvY',
  },
];
