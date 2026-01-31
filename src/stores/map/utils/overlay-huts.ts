import {
  CircleLayerSpecification,
  ExpressionSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  StyleSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { storeToRefs } from 'pinia';
//import { storeToRefs } from 'pinia';
//import { watch } from 'vue';
import { useHutsStore } from '@stores/huts-store';
//import { useHutTypesStore } from '../../huts/hut-types-store';
//import { Map } from 'maplibre-gl';
//import { OverlayItem } from './map-overlay-types';
//import { watchDebounced } from '@vueuse/core';
//import { useQuasar } from 'quasar';
//const { hutsGeojson, bookingsGeojson } = storeToRefs(useHutsStore());
const { bookingsGeojson } = storeToRefs(useHutsStore());
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { watchEffect } from 'vue';
//const { hutTypesRecords } = storeToRefs(useHutTypesStore());
//import { Platform } from 'quasar';
//import { useStorage } from '@vueuse/core';
//import { OpenAPI } from '../../../clients/wodore_v1';

const mapRef = useMap();
//let imageSwitchZoom = 11;
//if (Platform.is.mobile) {
//  imageSwitchZoom = 9;
//}
// HUTS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const imageSwitchZoom = 11;
const hutsLayerLayout: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'name'],
  'text-size': ['interpolate', ['linear'], ['zoom'], 7, 7, 9, 10, 22, 16],
  //'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
  'text-font': ['Open Sans Semibold'],
  'text-anchor': 'bottom',
  'icon-allow-overlap': true,
  'text-allow-overlap': false,
  'symbol-sort-key': ['get', 'type_standard_order'],
  'icon-overlap': 'always',
  'text-overlap': 'never',
  'text-optional': true,
  'icon-image': [
    'step',
    ['zoom'],
    [
      'coalesce',
      ['image', ['concat', 'wd:simple/', ['get', 'type_standard_identifier']]],
      ['image', 'wd:simple/accommodation.unknown'],
    ],
    imageSwitchZoom,
    [
      'coalesce',
      ['image', ['concat', 'wd:detailed/', ['get', 'type_standard_identifier']]],
      ['image', 'wd:detailed/accommodation.unknown'],
    ],
  ],
  //'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.05, 9, 0.1, 20, 1],
  'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 9, 0.3, 20, 2],
  visibility: 'visible',
};

const hutsLayerPaint: SymbolLayerSpecification['paint'] = {
  'icon-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.7, 12, 0.8, 22, 0.85],
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
};

const hutsLayerSelectedPaint: CircleLayerSpecification['paint'] = {
  'circle-blur': 0.7,
  'circle-color': [
    'case',
    ['boolean', ['feature-state', 'color'], false],
    ['feature-state', 'color'],
    '#3366ff',
  ],
  'circle-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.7, 0],
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 10, 15, 40],
};

// BOOKINGS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//const hutsOccupationFilter = ['>', ['length', ['get', 'bookings']], 0];
function getAvailColors(day: number): ExpressionSpecification {
  return [
    'match',
    ['get', 'occupancy_status', ['at', day, ['get', 'data']]],
    'empty',
    '#33FF33', // Neon Green - Empty state
    'low',
    '#99CC33', // Yellow Green - Low occupancy
    'medium',
    '#FFA726', // Orange - Medium occupancy
    'high',
    '#EF6C00', // Dark Orange - High occupancy
    'full',
    '#D32F2F', // Red - Full occupancy
    '#D4D4D4', // Gray - Default state
  ];
}
const hutsOccupationLayerPaint = {
  'circle-color': getAvailColors(0),
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 9, 10, 20, 60],
  'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 10, 0.6, 11, 0.5, 13, 0],
} as CircleLayerSpecification['paint'];

function getHutsOccupationDayLayout(day: number) {
  return {
    visibility: 'visible',
    'text-field': [
      'case',
      ['<', day, ['length', ['get', 'data']]],
      [
        'concat',
        ['get', 'free', ['at', day, ['get', 'data']]],
        '\n',
        ['get', 'total', ['at', day, ['get', 'data']]],
      ],
      '',
    ],
    'text-size': ['interpolate', ['linear'], ['zoom'], 12, 7, 14, 10],
    //'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
    'text-font': ['Open Sans Semibold'],
    'icon-allow-overlap': true,
    'text-allow-overlap': true,
    'icon-image': [
      'coalesce',
      [
        'image',
        [
          'concat',
          'wd:detailed/availability.',
          [
            'case',
            ['<', day, ['length', ['get', 'data']]],
            ['get', 'occupancy_status', ['at', day, ['get', 'data']]],
            'unknown',
          ],
        ],
      ],
      ['image', 'wd:detailed/availability.unknown'],
    ],
    'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 12, 0.3, 15, 0.6],
  };
}
function occTranslate(day: number) {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    //0,
    //['literal', [(day - 1.5) * 2, 0.1]],
    9,
    ['literal', [(day - 1.5) * 7, 11 + Math.abs(day - 1.5) * -2]],
    20,
    ['literal', [(day - 1.5) * 40, 90 + Math.abs(day - 1.5) * -10]],
  ];
}
function getHutsOccupationDayPaint(day: number) {
  return {
    'icon-translate': occTranslate(day),
    'text-translate': occTranslate(day),
    //'text-opacity': ['step', ['zoom'], 0, 12, 0.6],
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 0.4, 14, 0.6],
    'icon-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 10, 0.8, 11, 1, 13, 1, 15, 0.7],
    //'icon-opacity': ['step', ['zoom'], 0, 8, 1],
  };
}
function hutsOccpationDetailLayer(day: number) {
  return {
    id: `wd-huts-occupation-day${day}`,
    type: 'symbol',
    source: 'wd-bookings',
    //filter: hutsOccupationFilter,
    minzoom: 8,
    layout: getHutsOccupationDayLayout(day),
    paint: getHutsOccupationDayPaint(day),
  } as SymbolLayerSpecification;
}

export const hutsStyle: StyleSpecification = {
  version: 8,
  sources: {
    'wd-huts': {
      type: 'vector',
      url: `${process.env.WODORE_TILE_SERVER_URL || 'http://localhost:8075'}/huts`,
      promoteId: 'slug',
    },
    'wd-bookings': {
      type: 'geojson',
      data: bookingsGeojson.value as GeoJSON.GeoJSON,
      promoteId: 'hut_id',
    },
  },
  sprite: [
    { id: 'wd', url: `${process.env.WODORE_TILE_SERVER_URL}/sprite/accommodation,availability` },
  ],
  layers: [
    hutsOccpationDetailLayer(0),
    hutsOccpationDetailLayer(1),
    hutsOccpationDetailLayer(2),
    hutsOccpationDetailLayer(3),
    {
      id: 'wd-huts-occupation',
      type: 'circle',
      source: 'wd-bookings',
      maxzoom: 13,
      //filter: hutsOccupationFilter,
      layout: {
        visibility: 'visible',
      },
      paint: hutsOccupationLayerPaint,
    },
    {
      id: 'wd-huts-selected',
      type: 'circle',
      source: 'wd-huts',
      'source-layer': 'huts',
      layout: { visibility: 'visible' },
      paint: hutsLayerSelectedPaint,
    },
    {
      id: 'wd-huts',
      type: 'symbol',
      source: 'wd-huts',
      'source-layer': 'huts',
      layout: hutsLayerLayout,
      paint: hutsLayerPaint,
    },
  ],
};
watchEffect(() => {
  console.debug('Booking geojson updated');
  const source = hutsStyle.sources['wd-bookings'] as GeoJSONSourceSpecification;
  source.data = bookingsGeojson.value as GeoJSON.GeoJSON;

  // Check if map is available and style is loaded before trying to access sources
  if (!mapRef.map || !mapRef.map.isStyleLoaded()) {
    console.debug('Map or style not yet loaded, skipping booking data update');
    return;
  }

  const mapSource = mapRef.map.getSource('wd-bookings') as GeoJSONSource | undefined;
  // Source may not exist if basemap was just changed
  if (mapSource && bookingsGeojson.value !== undefined) {
    mapSource.setData(bookingsGeojson.value as GeoJSON.GeoJSON);
  }
});
//console.log('Hut type keys: ', Object.keys(hutTypesRecords.value));
//export function hutsRegisterMap(map: Map) {
//  watchDebounced(
//    hutsGeojson,
//    (value) => {
//      console.debug('"hutsGeojson" updated');
//      hutsStyle.sources['wd-huts'].data = value;
//      const mapSource = map.getSource('wd-huts');
//      if (mapSource) {
//        mapSource.setData(value);
//      }
//    },
//    { immediate: true, deep: true, debounce: 50, maxWait: 300 },
//  );
//  watchDebounced(
//    hutTypesRecords,
//    (value) => {
//      const hutTypeList = Object.entries(value);
//      const hutTypeFiltered = Object.keys(
//        Object.fromEntries(hutTypeList.filter((val) => val[1].filter_on)),
//      );
//      const newFilter = [
//        'match',
//        ['get', 'type_open_slug'],
//        hutTypeFiltered,
//        true,
//        false,
//      ];
//      console.debug('new filter: ', newFilter);
//      if (map) {
//        map.setFilter('huts-symbol-layer', newFilter);
//        map.setFilter('huts-symbol-selected', newFilter);
//        // TODO: occupation
//        //map.setFilter("huts-occupation-bg-layer", newFilter);
//        //map.setFilter("huts-occupation-day0-layer", newFilter);
//      }
//    },
//    { immediate: true, deep: true, debounce: 50, maxWait: 300 },
//  );
//  watchDebounced(
//    bookingsGeojson,
//    (value) => {
//      console.debug('"bookingGeojson" updated');
//      hutsStyle.sources['bookings'].data = value;
//      const mapSource = map.getSource('bookings');
//      if (mapSource) {
//        console.debug('map source "bookings" updated', value);
//        mapSource.setData(value);
//      }
//    },
//    { immediate: true, deep: true, debounce: 50, maxWait: 300 },
//  );
//}
//
//export function hutsLayerUpdate(map: Map, mapOverlays: OverlayItem[]) {
//  const _wodoreSprite = map.getSprite();
//  console.debug("Check sprite 'wodore'", _wodoreSprite);
//  let _spriteAdded = false;
//  for (const sprite of _wodoreSprite) {
//    if (sprite.id == 'wodore') {
//      _spriteAdded = true;
//    }
//  }
//  if (!_spriteAdded) {
//    console.debug("Add sprite 'wodore'");
//    const SPRITE_BASE_URL = 'https://api.wodore.com';
//    //const SPRITE_BASE_URL = OpenApi.BASE
//    const _spriteUrl = SPRITE_BASE_URL + '/static/huts/sprite';
//    map.addSprite('wodore', _spriteUrl);
//  }
//}
