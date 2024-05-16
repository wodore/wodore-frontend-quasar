import { SymbolLayerSpecification } from 'maplibre-gl';

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
