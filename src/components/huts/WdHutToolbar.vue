<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { schemasWodore } from '@clients/index';
import { useMap } from '@indoorequal/vue-maplibre-gl';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | undefined;
}

const $q = useQuasar();
const mapRef = useMap();
const props = defineProps<Props>();

const watchHut = ref(false);
//function toggleHutWatch() {
//  watchHut.value = !watchHut.value;
//}
const starHut = ref(false);
function toggleHutStar() {
  starHut.value = !starHut.value;
}
function flyTo() {
  if (mapRef.map !== undefined && props.hut !== undefined) {
    const loc = props.hut.location;
    if (loc !== undefined && loc !== null) {
      const zoom = mapRef.map.getZoom();
      mapRef.map.flyTo({
        center: [loc.lon, loc.lat],
        zoom: zoom > 12 ? zoom : 12,
        padding: {
          right: $q.screen.xs ? 0 : 400,
          bottom: $q.screen.xs ? 300 : 0,
        },
        //speed: 0.2,
        //curve: 1,
      });
    }
  }
}

function sameLatLng(
  lat1: number,
  lat2: number,
  lon1: number,
  lon2: number,
  precision = 0.004,
) {
  const same =
    lat1 + precision >= lat2 &&
    lat1 - precision <= lat2 &&
    lon1 + precision >= lon2 &&
    lon1 - precision <= lon2;
  //console.debug(
  //  `The coordinates ${lat1}/${lat2} and ${lon1}/${lon2} are the ${same ? 'same' : 'not the same'} (precision: ${precision}):`,
  //  same,
  //);
  return same;
}
const menuOpen = ref(false);
const flyToDisabled = ref(true);
watch(menuOpen, () => {
  flyToDisabled.value = true;
  if (mapRef.map !== undefined && props.hut !== undefined) {
    const loc = props.hut.location;
    if (loc !== undefined && loc !== null) {
      const center = mapRef.map.getCenter();
      const zoom = mapRef.map.getZoom();
      flyToDisabled.value = sameLatLng(
        loc.lat,
        center.lat,
        loc.lon,
        center.lng,
        0.005 / Math.sqrt(zoom),
      );
    }
  }
});
</script>

<style lang="scss" scoped></style>

<template>
  <q-toolbar>
    <slot></slot>
    <q-space />

    <!-- @click="toggleHutWatch" -->
    <WdToolbarButton
      size="md"
      :color="watchHut ? 'accent' : 'primary-900'"
      :icon="watchHut ? 'wd-eye' : 'wd-eye-outline'"
      style="opacity: 0.5; cursor: not-allowed"
    />

    <WdToolbarButton size="md" class="text-primary-900" icon="wd-more-vertical">
      <q-menu class="bg-primary-100" v-model="menuOpen">
        <q-list style="min-width: 100px">
          <WdToolbarExtraButton
            @click="toggleHutStar"
            :icon="starHut ? 'wd-favorite' : 'wd-favorite-outline'"
            :icon-color="starHut ? 'accent' : 'primary-800'"
            :disabled="true"
          >
            {{ $t('favorite') }}
          </WdToolbarExtraButton>
          <WdToolbarExtraButton
            v-if="mapRef.map && hut?.location"
            icon="wd-location-question"
            @click="flyTo"
            v-close-popup
            :disabled="flyToDisabled"
          >
            {{ $t('show_map') }}
          </WdToolbarExtraButton>
          <WdToolbarExtraButton
            icon="wd-edit-outline"
            :href="hut?.edit_link"
            target="_blank"
          >
            {{ $t('edit') }}
          </WdToolbarExtraButton>
        </q-list>
      </q-menu>
    </WdToolbarButton>
  </q-toolbar>
</template>
