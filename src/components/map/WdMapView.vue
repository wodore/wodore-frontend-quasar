<script setup lang="ts">
import { ref, inject, watchEffect } from 'vue';
import { useRouter, useRoute } from 'vue-router';
//import {
//  hutsLayerLayout,
//  hutsLayerPaint,
//  hutsOccupationLayerPaint,
//} from '../../stores/map/styles.ts.old';
import { useQuasar } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';
//import { useHutsStore } from '@stores/huts-store';
//import { Todo, Meta } from './models';
import {
  LngLatLike,
  MapGeoJSONFeature,
  MapLayerEventType,
  //GeoJSONSourceSpecification,
} from 'maplibre-gl';
// https://indoorequal.github.io/vue-maplibre-gl/
import {
  MglMap,
  //MglGeoJsonSource,
  //MglCustomControl,
  MglNavigationControl,
  MglScaleControl,
  //MglSymbolLayer,
  //MglCircleLayer,
  MglEvent,
  //MglStyleSwitchControl,
  MglGeolocateControl,
  MglAttributionControl,
} from '@indoorequal/vue-maplibre-gl';

// import MglStyleSwitchControl from './styleSwitch.control';
const $q = useQuasar();
const router = useRouter();
const route = useRoute();
const basemapStore = useBasemapStore();
//const hutStore = useHutsStore();

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
  watchEffect(() => {
    top.value = `${$layout.header.offset}px`;
    right.value = `${$layout.right.offset}px`;
    if (
      process.env.CLIENT &&
      $layout.footer.offset < window.innerHeight - 250
    ) {
      bottom.value = `${$layout.footer.offset}px`;
    }
    left.value = `${$layout.left.offset}px`;
    console.debug(
      'Layout offsets changed: (top, right, bottom, left): ',
      top.value,
      right.value,
      bottom.value,
      left.value,
    );
  });
}

//const hutjson = ref(
//  `${process.env.API_HOST}/${process.env.API_VERSION}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
//);

function onMapLoad(e: MglEvent<'load'>) {
  console.debug(`Maplibre version ${e.map.version} loaded`);
  e.map.scrollZoom.setWheelZoomRate(0.003);
  onMapStyledata(e as unknown as MglEvent<'styledata'>);
  e.map.on('mouseenter', 'wd-huts', onLayerEnter);
  e.map.on('mouseleave', 'wd-huts', onLayerLeave);
  e.map.on('click', 'wd-huts', onHutLayerClick);
}

const selectedHutFeature = ref<undefined | MapGeoJSONFeature>(undefined);

function onHutLayerClick(e: MapLayerEventType['click']) {
  console.debug('Hut layer clicked.');
  if (e.target.getZoom() > minHutClickZoom) {
    let feature = e.features?.[0];
    console.debug(
      '  Selected huts:',
      e.features?.map((v) => v.properties.slug),
    );
    if (feature) {
      if (selectedHutFeature.value !== undefined) {
        e.target.setFeatureState(
          { source: 'wd-huts', id: selectedHutFeature.value.id },
          { selected: false },
        );
      }
      // TODO: add to route watch
      if (selectedHutFeature.value?.id != feature.id) {
        e.target.setFeatureState(
          { source: 'wd-huts', id: feature.id },
          { selected: true },
        );
        // @ts-expect-error unexpected deep
        selectedHutFeature.value = <MapGeoJSONFeature>(feature as unknown);
      } else {
        selectedHutFeature.value = undefined;
      }

      const slug = feature.properties.slug;
      if (route.params.slug == slug) {
        router.push({ name: 'map', hash: route.hash, query: route.query });
      } else {
        router.push({
          name: 'map-hut',
          params: { slug: slug },
          hash: route.hash,
          query: route.query,
        });
      }
    }
  }
}

const minHutClickZoom = 8;
// Change the cursor to a pointer
function onLayerEnter(e: MapLayerEventType['mouseenter']) {
  if (e.target.getZoom() > minHutClickZoom) {
    e.target.getCanvas().style.cursor = 'pointer';
  }
}

// Change it back to a pointer when it leaves.
function onLayerLeave(e: MapLayerEventType['mouseleave']) {
  if (e.target.getZoom() > minHutClickZoom) {
    e.target.getCanvas().style.cursor = '';
  }
}
const SPRITE_BASE_URL = process.env.API_HOST;
const _spriteUrl = SPRITE_BASE_URL + '/static/huts/sprite';
function onMapStyledata(e: MglEvent<'styledata'>) {
  //$q.loadingBar.start();
  console.debug('Style data changed event', e);
  const _wodoreSprite = e.map.getSprite();
  //console.debug("Check sprite 'wodore' in ", _wodoreSprite);
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
//function onMapRender(e: MglEvent<'render'>) {
//  $q.loadingBar.stop();
//}

const mapCenter: LngLatLike = [8.22, 46.7];
const mapZoom: number = 7.5;
</script>
<style lang="scss">
//@import 'vue-maplibre-gl/dist/vue-maplibre-gl.css';

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
  <!-- @map:render="onMapRender" -->
  <q-no-ssr>
    <MglMap
      @map:load="onMapLoad"
      @map:styledata="onMapStyledata"
      hash="p"
      :map-style="basemapStore.getBasemap()?.style"
      :zoom="mapZoom"
      :bearing-snap="15"
      :center="mapCenter"
      :attribution-control="false"
      :min-zoom="7"
      :max-zoom="20"
      :max-bounds="[3.6, 43, 18.7, 49.7]"
    >
      <!-- <MglStyleSwitchControl :map-styles="basemapStore.basemaps" /> -->
      <!-- <MglCustomControl position="top-right" class=""> -->
      <WdBasemapSwitch
        :position="$q.platform.is.mobile ? 'bottom-right' : 'top-left'"
        :direction="$q.platform.is.mobile ? 'left' : 'right'"
        :offset="[
          $q.platform.is.mobile ? 14 : 14,
          $q.platform.is.mobile ? 20 : 14,
        ]"
      />
      <WdOverlaySwitch
        position="top-left"
        direction="down"
        :offset="[
          $q.platform.is.mobile ? 14 : 14,
          $q.platform.is.mobile ? 14 : 68,
        ]"
      />
      <!-- </MglCustomControl> -->
      <MglGeolocateControl />
      <!-- <MglNavigationControl :show-zoom="$q.platform.is.desktop" /> -->
      <MglNavigationControl :show-zoom="false" />
      <MglAttributionControl
        :position="$q.platform.is.mobile ? 'bottom-left' : 'bottom-right'"
      />
      <MglScaleControl />
      <!-- <MglGeoJsonSource
      source-id="wd-bookings"
      :data="hutStore.bookingsGeojson"
      :buffer="512"
      :tolerance="0.7"
      promote-id="slug"
    > -->
      <!-- <MglCircleLayer
        layer-id="wd-bookings-huts"
        :paint="hutsOccupationLayerPaint"
        before="wd-huts"
      ></MglCircleLayer> -->
      <!-- </MglGeoJsonSource> -->
      <!-- <MglGeoJsonSource
      source-id="wd-huts"
      :data="hutjson"
      :buffer="512"
      :tolerance="0.7"
      promote-id="slug"
    > -->
      <!-- <MglSymbolLayer
        @click.prevent="onHutLayerClick"
        @mouseenter="onLayerEnter"
        @mouseleave="onLayerLeave"
        :layout="hutsLayerLayout"
        :paint="hutsLayerPaint"
        layer-id="wd-huts"
        :before="basemapStore.getBasemap()?.layers.ways.before"
      ></MglSymbolLayer> -->
      <!-- </MglGeoJsonSource> -->
    </MglMap>
  </q-no-ssr>
</template>
