<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { usePlace } from '@composables/usePlace';
import WdSourceButtons from '@components/huts/WdSourceButtons.vue';
import { useAuthStore } from '@stores/auth-store';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';

let mapRef: MapInstance | undefined;
if (process.env.CLIENT) {
  import('@indoorequal/vue-maplibre-gl').then(pkg => {
    mapRef = pkg.useMap();
  });
} else {
  mapRef = undefined;
}

interface Props {
  slug?: string;
}

const props = defineProps<Props>();
const authStore = useAuthStore();
const $q = useQuasar();

// Fetch place data for actions
const { place } = usePlace(computed(() => props.slug));

// Review status info
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
  _default = 'work'
): string {
  if (place.value !== undefined) {
    if (
      place.value?.type_open?.slug == 'unknown' ||
      place.value?.capacity_open == undefined ||
      place.value?.open_monthly?.month_01 == undefined ||
      place.value?.elevation == undefined
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

// Watch and star state
const watchHut = ref(false);
const starHut = ref(false);
function toggleHutStar() {
  starHut.value = !starHut.value;
}

// Fly-to map functionality
function flyTo() {
  if (mapRef?.map !== undefined && place.value !== undefined) {
    const loc = place.value.location;
    if (loc !== undefined && loc !== null) {
      const zoom = mapRef?.map.getZoom();
      mapRef?.map.flyTo({
        center: [loc.lon, loc.lat],
        zoom: zoom > 12 ? zoom : 12,
        padding: {
          right: $q.screen.xs ? 0 : 400,
          bottom: $q.screen.xs ? 300 : 0,
        },
      });
    }
  }
}

function sameLatLng(lat1: number, lat2: number, lon1: number, lon2: number, precision = 0.004) {
  const same =
    lat1 + precision >= lat2 &&
    lat1 - precision <= lat2 &&
    lon1 + precision >= lon2 &&
    lon1 - precision <= lon2;
  return same;
}

const menuOpen = ref(false);
const flyToDisabled = ref(true);
watch(menuOpen, () => {
  flyToDisabled.value = true;
  if (mapRef?.map !== undefined && place.value !== undefined) {
    const loc = place.value.location;
    if (loc !== undefined && loc !== null) {
      const center = mapRef?.map.getCenter();
      const zoom = mapRef?.map.getZoom();
      flyToDisabled.value = sameLatLng(
        loc.lat,
        center.lat,
        loc.lon,
        center.lng,
        0.005 / Math.sqrt(zoom)
      );
    }
  }
});
</script>

<style scoped>
.footer-toolbar {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
}
</style>

<template>
  <q-toolbar class="footer-toolbar bg-white q-pr-sm">
    <WdSourceButtons v-if="place" :hut="place" />
    <q-space />

    <q-badge v-if="place" outline class="q-mr-xs" :color="getReviewColor(place.review_status)">
      {{ getReviewText(place.review_status) }}
    </q-badge>

    <WdToolbarButton
      size="md"
      :color="watchHut ? 'accent' : 'primary-900'"
      :icon="watchHut ? 'wd-eye' : 'wd-eye-outline'"
      style="opacity: 0.5; cursor: not-allowed"
    />

    <WdToolbarButton size="md" class="text-primary-900" icon="wd-more-vertical">
      <q-menu
        class="bg-primary-100 q-menu--quasar"
        v-model="menuOpen"
        anchor="top right"
        self="bottom right"
      >
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
            v-if="mapRef?.map && place?.location"
            icon="wd-location-question"
            @click="flyTo"
            v-close-popup
            :disabled="flyToDisabled"
          >
            {{ $t('show_map') }}
          </WdToolbarExtraButton>
          <WdToolbarExtraButton
            icon="wd-edit-outline"
            :href="place?.edit_link"
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
