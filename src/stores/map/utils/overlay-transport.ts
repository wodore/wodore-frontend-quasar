import {
  CircleLayerSpecification,
  ExpressionSpecification,
  StyleSpecification,
} from 'maplibre-gl';
//import { storeToRefs } from 'pinia';
//import { useStopsStore } from '../../transport/stops-store';
//import { watch } from 'vue';
//import { useHutsStore } from '../../huts/huts-store';
//import { Map } from 'maplibre-gl';
//import { OverlayItem } from './map-overlay-types';
//import { watchDebounced } from '@vueuse/core';
//import { useQuasar } from 'quasar';
//import { OverlaySwitchItem } from './interfaces';
//const { transportStopsGeojson } = storeToRefs(useStopsStore());

function matchType(
  train: number | string,
  bus: number | string,
  other: number | string,
): ExpressionSpecification {
  return [
    'case',
    ['in', 'train', ['get', 'types']],
    train,
    ['in', 'bus', ['get', 'types']],
    bus,
    other,
  ];
}
function getRadius(): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    7,
    matchType(3, 2, 1),
    9,
    matchType(4, 3, 3),
    16,
    matchType(9, 8, 8),
  ];
}
const transportStopsLayerPaint: CircleLayerSpecification['paint'] = {
  'circle-color': matchType('#C60018', '#2d327d', '#0079C7'), //getAvailColors(0),
  'circle-stroke-color': '#F6F6F6',
  'circle-stroke-width': [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    0,
    12,
    1,
    16,
    2,
  ],
  //'circle-opacity': 0.6,
  'circle-radius': getRadius(),
  'circle-opacity': [
    'interpolate',
    ['linear'],
    ['zoom'],
    6,
    0,
    7,
    0.3,
    10,
    0.6,
    14,
    1,
  ],
};

export const transportStyle: StyleSpecification = {
  version: 8,
  sources: {
    'transport-stops': {
      type: 'geojson',
      data: 'https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson',
      //data: transportStopsGeojson.value,
      promoteId: 'id',
    },
  },
  layers: [
    {
      id: 'transport-stops',
      type: 'circle',
      source: 'transport-stops',
      //filter: hutsOccupationFilter,
      layout: { visibility: 'none' },
      paint: transportStopsLayerPaint,
    },
  ],
};

//export function transportStopsRegisterMap(
//  map: Map,
//  mapOverlays: OverlaySwitchItem[],
//) {
//  watchDebounced(
//    transportStopsGeojson,
//    (value) => {
//      console.debug('"transportStopsGeojson" updated', value);
//      transportStyle.sources['transport-stops'].data = value;
//      //map.setLayoutProperty('transport-layer', 'visibility', 'visible');
//      const mapSource = map.getSource('transport-stops');
//      console.debug('  ... map source', mapSource);
//      if (mapSource) {
//        console.debug('  ... set data', value);
//        mapSource.setData(value);
//      }
//      //}
//    },
//    { immediate: true, deep: false, debounce: 50, maxWait: 300 },
//  );
//}
//
