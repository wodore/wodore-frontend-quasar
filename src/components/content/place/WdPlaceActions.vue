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

function getReviewText(status: string | null | undefined): string {
  return getReviewInfo(status, 1);
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
          left: $q.screen.xs ? 0 : 400,
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
  /* Tonal footer (design review 2026-10): the deep surface step + ridge
     hairline carry the separation — panel-on-panel shadows are banned by
     the Tonal Layer Rule (the card's one over-map shadow is the only
     sanctioned one). Shares the token with the scrolled header, so chrome
     bars read as one family. */
  background: var(--wd-surface-deep);
  border-top: 1px solid var(--wd-ridge);
  min-height: 48px;
}
</style>

<template>
  <q-toolbar class="footer-toolbar q-pr-sm wd-drawer-actions">
    <!-- Geo location link (mobile only - a geo: URL is not useful on the
         desktop planning context) -->
    <WdToolbarButton
      v-if="$q.screen.xs && place && place.location"
      size="md"
      class="wd-ink-text"
      icon="wd-location-share-outline"
      :href="`geo:${place.location.lat},${place.location.lon}`"
      target="_blank"
    />

    <WdSourceButtons v-if="place" :hut="place" />
    <q-space />

    <!-- Kebab: kept for CURRENT and future overflow items (owner 2026-10:
         "currently we do not have anything there, but might have in
         future") — always rendered; review status and edit are
         editor-gated inside, show-on-map for everyone. Availability
         moved to the header briefing row; the favorite heart is HIDDEN
         until the shortlist ships (owner 2026-10). -->
    <WdToolbarButton size="md" class="wd-ink-text" icon="wd-more-vertical">
      <q-menu
        class="bg-primary-100 q-menu--quasar wd-menu"
        v-model="menuOpen"
        anchor="top right"
        self="bottom right"
      >
        <q-list style="min-width: 100px">
          <WdToolbarExtraButton
            v-if="place && authStore.hasRole('editor')"
            icon="wd-eye-outline"
            :disabled="true"
          >
            {{ getReviewText(place.review_status) }}
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
            v-if="authStore.hasRole('editor')"
            icon="wd-edit-outline"
            :href="place?.edit_link"
            target="_blank"
            v-close-popup
          >
            {{ $t('edit') }}
          </WdToolbarExtraButton>
        </q-list>
      </q-menu>
    </WdToolbarButton>
  </q-toolbar>
</template>
