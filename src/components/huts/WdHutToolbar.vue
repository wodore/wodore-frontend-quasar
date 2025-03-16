<script setup lang="ts">
import { ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import { schemasWodore } from '@clients/index';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
let mapRef: MapInstance | undefined;
if (process.env.CLIENT) {
  import('@indoorequal/vue-maplibre-gl').then((pkg) => {
    mapRef = pkg.useMap();
  });
} else {
  mapRef = undefined;
}
// if (process.env.CLIENT) {
// }
import { useAuthStore } from '@stores/auth-store';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
const authStore = useAuthStore();

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | undefined;
}

const props = defineProps<Props>();
// TODO: get this info from the API
const reviewInfos: Record<string, Array<string>> = {
  new: ['warning-200', 'ungeprüft'],
  done: ['positive-800', 'ok'],
  review: ['warning-500', 'validieren'],
  work: ['secondary-800', 'überarbeiten'],
  reject: ['negative-300', 'ungültig'],
};

function getReviewInfo(
  status: string | null | undefined,
  index: number,
  _default = 'work',
): string {
  if (props !== undefined) {
    if (
      props.hut?.type_open?.slug == 'unknown' ||
      props.hut?.capacity_open == undefined ||
      props.hut?.open_monthly?.month_01 == undefined ||
      props.hut?.elevation == undefined
    ) {
      status = 'work';
    }
  }
  if (status !== undefined && status != null && status in reviewInfos) {
    return reviewInfos[status][index];
  } else {
    return reviewInfos[_default][index];
  }
}

function getReviewColor(status: string | null | undefined): string {
  return getReviewInfo(status, 0);
}
function getReviewText(status: string | null | undefined): string {
  return getReviewInfo(status, 1);
}
const $q = useQuasar();

const watchHut = ref(false);
//function toggleHutWatch() {
//  watchHut.value = !watchHut.value;
//}
const starHut = ref(false);
function toggleHutStar() {
  starHut.value = !starHut.value;
}
function flyTo() {
  if (mapRef?.map !== undefined && props.hut !== undefined) {
    const loc = props.hut.location;
    if (loc !== undefined && loc !== null) {
      const zoom = mapRef?.map.getZoom();
      mapRef?.map.flyTo({
        //p e ?
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
  if (mapRef?.map !== undefined && props.hut !== undefined) {
    const loc = props.hut.location;
    if (loc !== undefined && loc !== null) {
      const center = mapRef?.map.getCenter();
      const zoom = mapRef?.map.getZoom();
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

    <q-badge
      outline
      v-if="hut"
      class="q-mr-xs"
      :color="getReviewColor(hut.review_status)"
      >{{ getReviewText(hut.review_status) }}
    </q-badge>

    <!-- @click="toggleHutWatch" -->
    <WdToolbarButton
      size="md"
      :color="watchHut ? 'accent' : 'primary-900'"
      :icon="watchHut ? 'wd-eye' : 'wd-eye-outline'"
      style="opacity: 0.5; cursor: not-allowed"
    />

    <WdToolbarButton size="md" class="text-primary-900" icon="wd-more-vertical">
      <q-menu class="bg-primary-100 q-menu--quasar" v-model="menuOpen">
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
            v-if="mapRef?.map && hut?.location"
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
            v-close-popup
            v-if="authStore.hasRole('editor')"
          >
            {{ $t('edit') }}
          </WdToolbarExtraButton>
        </q-list>
      </q-menu>
    </WdToolbarButton>
  </q-toolbar>
</template>
