<script setup lang="ts">
import { ref, inject, watchEffect } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { hutsLayerLayout, hutsLayerPaint } from '../../stores/map/styles';
import { useQuasar } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';
//import { Todo, Meta } from './models';
import {
  LngLatLike,
  MapLayerEventType,
  GeoJSONSourceSpecification,
} from 'maplibre-gl';
// https://indoorequal.github.io/vue-maplibre-gl/
import {
  MglMap,
  //MglGeoJsonSource,
  //MglCustomControl,
  MglNavigationControl,
  MglScaleControl,
  //MglSymbolLayer,
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

const hutjson = ref(
  `${process.env.API_HOST}/${process.env.API_VERSION}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
);

function onMapLoad(e: MglEvent) {
  console.debug(`Maplibre version ${e.map.version} loaded`);
  e.map.scrollZoom.setWheelZoomRate(0.003);
  onMapStyledata(e);
}

function onHutLayerClick(e: MapLayerEventType['click']) {
  console.debug('Hut layer clicked.');
  if (e.target.getZoom() > minHutClickZoom) {
    let feature = e.features?.[0];
    console.debug(
      '  Selected huts:',
      e.features?.map((v) => v.properties.slug),
    );
    if (feature) {
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
function onMapStyledata(e: MglEvent) {
  console.debug('Style data changed', e);
  console.debug('Huts layer:', e.map.getLayer('wd-huts'));
  if (e.map.getSource('wd-huts') === undefined) {
    const hutSource: GeoJSONSourceSpecification = {
      data: hutjson.value,
      buffer: 512,
      tolerance: 0.7,
      promoteId: 'slug',
      type: 'geojson',
    };
    e.map.addSource('wd-huts', hutSource);
  }
  if (e.map.getLayer('wd-huts') === undefined) {
    e.map.addLayer(
      {
        layout: hutsLayerLayout,
        paint: hutsLayerPaint,
        id: 'wd-huts',
        type: 'symbol',
        source: 'wd-huts',
      },
      basemapStore.getBasemap()?.layers.ways.before,
    );
    e.map.on('mouseenter', 'wd-huts', onLayerEnter);
    e.map.on('mouseleave', 'wd-huts', onLayerLeave);
    e.map.on('click', 'wd-huts', onHutLayerClick);
  }
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
const mapCenter: LngLatLike = [8.22, 46.7];
const mapZoom: number = 7.5;
</script>
<style lang="scss">
@import 'maplibre-gl/dist/maplibre-gl.css';
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

.maplibregl-map {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
}
//.maplibregl-ctrl-top-left {
//  pointer-events: all;
//}
</style>
<template>
  <MglMap
    @map:load="onMapLoad"
    @map:styledata="onMapStyledata"
    hash="p"
    :map-style="basemapStore.getBasemap()?.style"
    :zoom="mapZoom"
    :bearing-snap="30"
    :center="mapCenter"
    :attribution-control="false"
  >
    <!-- <MglStyleSwitchControl :map-styles="basemapStore.basemaps" /> -->
    <!-- <MglCustomControl position="top-right" class=""> -->
    <WdBasemapSwitch
      :position="$q.platform.is.mobile ? 'bottom-right' : 'top-left'"
      :direction="$q.platform.is.mobile ? 'left' : 'right'"
      :offset="[
        $q.platform.is.mobile ? 12 : 18,
        $q.platform.is.mobile ? 20 : 24,
      ]"
    />
    <WdOverlaySwitch
      position="top-left"
      direction="down"
      :offset="[
        $q.platform.is.mobile ? 12 : 18,
        $q.platform.is.mobile ? 12 : 80,
      ]"
    />
    <!-- </MglCustomControl> -->
    <MglGeolocateControl />
    <MglNavigationControl v-if="$q.platform.is.desktop" />
    <MglScaleControl />
    <MglAttributionControl position="bottom-right" />
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
</template>
