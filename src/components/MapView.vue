<script setup lang="ts">
import { ref, inject, watchEffect } from 'vue';
//import { Todo, Meta } from './models';
import { SymbolLayerSpecification } from 'maplibre-gl';
import {
  MglMap,
  //MglGeoJsonSource,
  MglNavigationControl,
  MglScaleControl,
  //MglSymbolLayer,
  MglEvent,
  StyleSwitchItem,
  MglStyleSwitchControl,
} from 'vue-maplibre-gl';

const $layout2 = inject('layout');

type layoutType = {
  header: { size: number; offset: number; space: boolean };
  right: { size: number; offset: number; space: boolean };
  footer: { size: number; offset: number; space: boolean };
  left: { size: number; offset: number; space: boolean };
};
const $layout = inject<layoutType>('_q_l_');

const top = ref('0');
const right = ref('0');
const bottom = ref('0');
const left = ref('0');
if ($layout === undefined) {
  console.error('MapView needs to be child of QLayout');
} else {
  //const top = computed(() => $layout.header.offset);
  //const right = computed(() => $layout.right.offset);
  //const bottom = computed(() => $layout.footer.offset);
  //const left = computed(() => $layout.left.offset);
  watchEffect(() => {
    top.value = `${$layout.header.offset}px`;
    right.value = `${$layout.right.offset}px`;
    bottom.value = `${$layout.footer.offset}px`;
    left.value = `${$layout.left.offset}px`;
    console.log('layout', $layout);
    console.log('layout2', $layout2);
    if ($layout) {
      console.log('layout top: ', top.value);
      console.log('layout right: ', right.value);
      console.log('layout bottom: ', bottom.value);
      console.log('layout left: ', left.value);
    }
  });
}

const hutjson = ref(
  'https://api.wodore.com/v1/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true',
);

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
//const SPRITE_BASE_URL = OpenApi.BASE

function onMapLoad(e: MglEvent) {
  console.debug(`Maplibre version ${e.map.version} loaded`);
  e.map.scrollZoom.setWheelZoomRate(0.003);
  onMapStyledata(e);
}
const SPRITE_BASE_URL = 'https://api.wodore.com';
const _spriteUrl = SPRITE_BASE_URL + '/static/huts/sprite';
function onMapStyledata(e: MglEvent) {
  console.debug('Style data changed');
  const _wodoreSprite = e.map.getSprite();
  console.debug("Check sprite 'wodore' in ", _wodoreSprite);
  let _spriteAdded = false;
  for (const sprite of _wodoreSprite) {
    if (sprite.id == 'wodore') {
      _spriteAdded = true;
    }
  }
  if (!_spriteAdded) {
    console.debug(`Add sprite 'wodore' from '${_spriteUrl}'`);
    e.map.addSprite('wodore', _spriteUrl);
  }
}

//@import '~maplibre-gl/dist/maplibre-gl.css';
//@import '~vue-maplibre-gl/dist/vue-maplibre-gl.css';
</script>
<style lang="scss">
@import 'maplibre-gl/dist/maplibre-gl.css';
@import 'vue-maplibre-gl/dist/vue-maplibre-gl.css';

.maplibregl-control-container {
  // from https://github.com/quasarframework/quasar/blob/dev/ui/src/components/layout/QLayout.sass .q-body--layout-animate .q-page-sticky
  //@extend .q-body--layout-animate, .q-page-sticky; // not found
  position: fixed;
  top: v-bind(top);
  left: v-bind(left);
  bottom: v-bind(bottom);
  right: v-bind(right);
  pointer-events: none;
  transition:
    transform $drawer-duration $drawer-transistion,
    left $drawer-duration $drawer-transistion,
    right $drawer-duration $drawer-transistion,
    top $drawer-duration $drawer-transistion,
    bottom $drawer-duration $drawer-transistion !important;
}
//.maplibregl-ctrl-top-left {
//  pointer-events: all;
//}
</style>
<template>
  <!-- <q-page-sticky position="top-left" :offset="[18, 18]" style="z-index: 5">
    <q-btn round color="accent" icon="arrow_back" class="rotate-45" />
  </q-page-sticky> -->
  <MglMap
    language="de"
    @map:styledata="onMapStyledata"
    @map:load="onMapLoad"
    hash="p"
    :zoom="7.5"
    :center="[8.22, 46.7]"
    :map-style="mapStyles[0].style"
    style="position: fixed; right: 0px; top: 0; bottom: 0; left: 0"
  >
    <!-- <MglAttributionControl /> -->
    <MglGeolocationControl />
    <MglNavigationControl />
    <MglScaleControl />
    <MglStyleSwitchControl
      :map-styles="mapStyles"
      :map-style="mapStyles[0]"
      position="top-left"
    />
    <MglGeoJsonSource source-id="huts" :data="hutjson">
      <MglSymbolLayer
        :layout="hutsLayerLayout"
        :paint="hutsLayerPaint"
        layer-id="huts"
      ></MglSymbolLayer>
    </MglGeoJsonSource>
  </MglMap>
</template>
