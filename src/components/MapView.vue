<script setup lang="ts">
import { ref } from 'vue';
//import { Todo, Meta } from './models';
import { SymbolLayerSpecification } from 'maplibre-gl';
import {
  MglMap,
  MglGeoJsonSource,
  MglNavigationControl,
  MglScaleControl,
  MglSymbolLayer,
  MglEvent,
  StyleSwitchItem,
  MglStyleSwitchControl,
} from 'vue-maplibre-gl';

//import MglFrameRateControl from '@/lib/components/controls/frameRate.control';
//import MglFullscreenControl from '@/lib/components/controls/fullscreen.control';
//import MglAttributionControl from 'vue-maplibre-gl/src/lib/components';
//import MglGeolocationControl from 'vue-maplibre-gl';
//import MglCustomControl from '@/lib/components/controls/custom.control';
//import MglButton from '@/lib/components/button.component';
//import MglStyleSwitchControl from 'vue-maplibre-gl';
//import MglMarker from '@/lib/components/marker.component';
//import MglGeoJsonSource from 'vue-maplibre-gl';
//import MglLineLayer from '@/lib/components/layers/line.layer';
//import { FeatureCollection, LineString } from 'geojson';
//import MglVectorSource from 'vue-maplibre-gl';
//import MglCircleLayer from '@/lib/components/layers/circle.layer';
//interface Props {
//  title: string;
//  todos?: Todo[];
//  meta: Meta;
//  active: boolean;
//}

const hutjson = ref(
  'https://api.wodore.com/v1/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true',
);

//const props = withDefaults(defineProps<Props>(), {
//  todos: () => [],
//});

const map = ref(null);

let imageSwitchZoom = 11;
//if (Platform.is.mobile) {
//  imageSwitchZoom = 9;
//}
const hutsLayerLayout = {
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
const hutsLayerPaint = {
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

const mapStyles: Array<StyleSwitchItem> = [
  {
    name: 'swiss-vector',
    label: 'Swisstopo',
    // icon : { path: mdiRoad },
    style:
      'https://api.maptiler.com/maps/ch-swisstopo-lbm-vivid/style.json?key=yYYuZy3hwmMjY087FDvY',
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
const SPRITE_BASE_URL = 'https://api.wodore.com';
//const SPRITE_BASE_URL = OpenApi.BASE
const _spriteUrl = SPRITE_BASE_URL + '/static/huts/sprite';

function onLoad(e: MglEvent) {
  e.map.addSprite('wodore', _spriteUrl);
  //mapVersion.value = e.map.version;
  console.log(e.type, e, e.map.version);
}

//@import '~maplibre-gl/dist/maplibre-gl.css';
//@import '~vue-maplibre-gl/dist/vue-maplibre-gl.css';
</script>
<style lang="scss">
@import 'maplibre-gl/dist/maplibre-gl.css';
@import 'vue-maplibre-gl/dist/vue-maplibre-gl.css';
</style>
<template>
  <!-- <p>{{ title }}</p>
    <ul>
      <li v-for="todo in todos" :key="todo.id" @click="increment">
        {{ todo.id }} - {{ todo.content }}
      </li>
    </ul>
    <p>Count: {{ todoCount }} / {{ meta.totalCount }}</p>
    <p>Active: {{ active ? 'yes' : 'no' }}</p>
    <p>Clicks on todos: {{ clickCount }}</p> -->
  <MglMap
    language="en"
    ref="map"
    @map:styledata="onLoad"
    @map:load="onLoad"
    hash="map"
    :zoom="7.5"
    :center="[8.22, 46.7]"
    :map-style="mapStyles[0].style"
  >
    <!-- <MglAttributionControl /> -->
    <!-- <MglGeolocationControl /> -->
    <MglNavigationControl />
    <MglScaleControl />
    <MglStyleSwitchControl :map-styles="mapStyles" position="top-left" />
    <MglGeoJsonSource source-id="huts" :data="hutjson">
      <MglSymbolLayer
        :layout="hutsLayerLayout"
        :paint="hutsLayerPaint"
        layer-id="huts"
      ></MglSymbolLayer>
      ></MglGeoJsonSource
    >
  </MglMap>
</template>
