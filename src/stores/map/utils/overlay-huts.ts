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
import { getEnv } from '@services/runtimeEnv';
//const { hutTypesRecords } = storeToRefs(useHutTypesStore());
//import { Platform } from 'quasar';
//import { useStorage } from '@vueuse/core';
//import { OpenAPI } from '../../../clients/wodore_v1';

const mapRef = useMap();

// Tile server (Martin). Defaults to the public staging server so builds
// without WODORE_TILE_SERVER_URL (e.g. PR previews) still work; local dev
// overrides it via .env, CI via the GitHub repository variable.
const TILE_SERVER_URL = getEnv('WODORE_TILE_SERVER_URL') || 'https://tiles.stg.wodore.com';
//let imageSwitchZoom = 11;
//if (Platform.is.mobile) {
//  imageSwitchZoom = 9;
//}
// HUTS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
const hutsLayerLayout: SymbolLayerSpecification['layout'] = {
  'text-field': ['case', ['>', ['get', 'type_standard_order'], 25], ['get', 'name'], ''],
  // Legible floor (the old 7px was sub-legible), capped like the basemap's
  // own labels. Design review + wd-outdoor-base-mtk's wd-park-label.
  'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8.5, 10, 11, 14, 13.5, 17, 15],
  // The brand label font and the basemap's place/peak label voice; Noto
  // Sans Bold stays as the non-latin fallback (same glyph server).
  'text-font': ['Barlow Semi Condensed SemiBold', 'Noto Sans Bold'],
  'text-anchor': 'bottom',
  'icon-allow-overlap': true,
  'text-allow-overlap': false,
  'symbol-sort-key': ['get', 'type_standard_order'],
  'icon-overlap': 'always',
  'text-overlap': 'never',
  'text-optional': true,
  // Zoom ladder: primitive (far out, tiny) → mono SDF (zoomed in, colored).
  // Below z9 the primitive sprite (small colored shape) reads better than
  // a glyph at ~5px; from z9 up the SDF mono glyph with runtime tinting
  // and a white halo border is the workhorse. Sizes tuned to the original
  // feel: small and semi-transparent when zoomed out, growing to full.
  'icon-image': [
    'step',
    ['zoom'],
    // z < 9: primitive (small colored shape on white ring)
    [
      'coalesce',
      ['image', ['concat', 'wd:primitive/', ['get', 'type_standard_identifier']]],
      ['image', 'wd:primitive/accommodation.unknown'],
      // Fallback to mono if primitive isn't served yet
      ['image', ['concat', 'wd-sdf/mono/', ['get', 'type_standard_identifier']]],
      ['image', 'wd-sdf/mono/accommodation.unknown'],
    ],
    9,
    // z >= 9: mono SDF (runtime-tinted glyph with white halo border)
    [
      'coalesce',
      ['image', ['concat', 'wd-sdf/mono/', ['get', 'type_standard_identifier']]],
      ['image', 'wd-sdf/mono/accommodation.unknown'],
      ['image', ['concat', 'wd:primitive/', ['get', 'type_standard_identifier']]],
      ['image', 'wd:primitive/accommodation.unknown'],
    ],
  ],
  // 48px art. Far out: small (0.1–0.3 like the original). Zoomed in:
  // the glyph fills the space (0.5–1.25).
  'icon-size': [
    'interpolate',
    ['linear'],
    ['zoom'],
    7,
    0.1,
    9,
    0.3,
    11,
    0.55,
    13,
    0.75,
    16,
    1.0,
    20,
    1.25,
  ],
  visibility: 'visible',
};

const hutsLayerPaint: SymbolLayerSpecification['paint'] = {
  // SDF runtime tinting: type color from the tiles, white border around it
  'icon-color': ['coalesce', ['get', 'type_standard_color'], '#718096'],
  'icon-halo-color': '#ffffff',
  'icon-halo-width': 2,
  'icon-halo-blur': 0.15,
  // Semi-transparent when zoomed out (like the original 0.7–0.85),
  // full opacity when zoomed in
  'icon-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 0.8, 13, 0.9, 16, 1],
  'text-opacity': ['step', ['zoom'], 0, 7, 1],
  // Forest-deep (#224E3B) marks hut names as the product's own objects —
  // same treatment as the basemap style's wd-park-label; AA on light
  // imagery. Halo = the style's standard pale green-white, 1.2 (the old
  // 2px pure-white outline was the heaviest in the whole style).
  'text-color': '#224E3B',
  'text-halo-width': 1.2,
  'text-halo-color': 'rgba(242, 247, 244, 0.9)',
  'text-translate': [
    'interpolate',
    ['linear'],
    ['zoom'],
    7,
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
    '#2673bf',
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
    '#25BF5E', // positive-500 - free state
    'low',
    '#F6AD4B', // amber-300 - low occupancy
    'medium',
    '#EA9A37', // amber-400 - medium occupancy
    'free_unknown',
    '#7FAB88', // muted green - free beds, count unknown
    'high',
    '#C3731F', // amber-600 - high occupancy
    'full',
    '#961A17', // negative-700 - full occupancy
    // Unknown / missing status renders NO background at all — an availability
    // the source does not report must not be visualized (not even gray).
    'rgba(0,0,0,0)',
  ];
}
const hutsOccupationLayerPaint = {
  'circle-color': getAvailColors(0),
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 9, 10, 20, 60],
  'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 8, 0.6, 9, 0.5, 11, 0],
} as CircleLayerSpecification['paint'];

function getHutsOccupationDayLayout(day: number) {
  return {
    visibility: 'visible',
    'text-field': [
      'case',
      ['<', day, ['length', ['get', 'data']]],
      [
        'case',
        // Unknown day: a single "?" — the source reports free=0/total=0
        // with no real counts, so "0\n0" would be misleading.
        ['==', ['get', 'occupancy_status', ['at', day, ['get', 'data']]], 'unknown'],
        '?',
        [
          'concat',
          // free is null if the source does not publish the count (free_unknown)
          [
            'case',
            ['==', ['get', 'free', ['at', day, ['get', 'data']]], null],
            '?',
            ['to-string', ['get', 'free', ['at', day, ['get', 'data']]]],
          ],
          '\n',
          [
            'case',
            ['==', ['get', 'total', ['at', day, ['get', 'data']]], null],
            '?',
            ['to-string', ['get', 'total', ['at', day, ['get', 'data']]]],
          ],
        ],
      ],
      '',
    ],
    'text-size': ['interpolate', ['linear'], ['zoom'], 12, 7, 14, 10],
    // Match the wd-outdoor-base-mtk basemap typography: Barlow Semi
    // Condensed SemiBold is the style's place-label voice, Noto Sans Bold
    // is its non-latin fallback. Served by the same Martin glyph endpoint.
    'text-font': ['Barlow Semi Condensed SemiBold', 'Noto Sans Bold'],
    'icon-allow-overlap': true,
    'text-allow-overlap': true,
    'icon-image': [
      'coalesce',
      [
        'image',
        [
          'concat',
          'wd:color/availability.',
          [
            'case',
            ['<', day, ['length', ['get', 'data']]],
            ['get', 'occupancy_status', ['at', day, ['get', 'data']]],
            'unknown',
          ],
        ],
      ],
      ['image', 'wd:color/availability.unknown'],
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
    // Text color intentionally left at the maplibre default (black) — the
    // status colors live in the dots, not the label text.
    // The wd-outdoor-base-mtk style's standard pale halo — keeps the
    // numbers readable where dots overlap terrain labels.
    'text-halo-color': 'rgba(242, 247, 244, 0.9)',
    'text-halo-width': 0.8,
    //'text-opacity': ['step', ['zoom'], 0, 12, 0.6],
    'text-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10, 0.4, 12, 0.6],
    'icon-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.8, 9, 1, 11, 1, 13, 0.7],
    //'icon-opacity': ['step', ['zoom'], 0, 8, 1],
  };
}
function hutsOccpationDetailLayer(day: number) {
  return {
    id: `wd-huts-occupation-day${day}`,
    type: 'symbol',
    source: 'wd-bookings',
    // Unknown days keep rendering here — the small gray availability dot
    // ("wd:color/availability.unknown") and the "?" free/total label stay
    // visible. Only the big background circle ("wd-huts-occupation" below)
    // is suppressed for unknown/missing status via its transparent fallback.
    minzoom: 6,
    layout: getHutsOccupationDayLayout(day),
    paint: getHutsOccupationDayPaint(day),
  } as SymbolLayerSpecification;
}

export const hutsStyle: StyleSpecification = {
  version: 8,
  sources: {
    'wd-huts': {
      type: 'vector',
      url: `${TILE_SERVER_URL}/huts`,
      promoteId: 'slug',
    },
    'wd-bookings': {
      type: 'geojson',
      data: bookingsGeojson.value as GeoJSON.GeoJSON,
      promoteId: 'hut_id',
    },
  },
  sprite: [
    { id: 'wd', url: `${TILE_SERVER_URL}/sprite/accommodation,availability` },
    // SDF variant (Martin /sdf_sprite): mono silhouettes, runtime-tinted via
    // icon-color + icon-halo-* (see hutsLayerPaint). Per-icon `sdf: true` is
    // delivered by Martin's sprite index.
    { id: 'wd-sdf', url: `${TILE_SERVER_URL}/sdf_sprite/accommodation` },
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
