<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { clientWodore, schemasWodore } from '@clients/index';
import { useI18n } from 'vue-i18n';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
import { useRouter, useRoute } from 'vue-router';
import WdHutSearchInput from './WdHutSearchInput.vue';
import WdHutSearchMobile from './WdHutSearchMobile.vue';

const { locale } = useI18n();
const $q = useQuasar();
const router = useRouter();
const route = useRoute();

const isMobile = computed(() => {
  return $q.screen.xs;
});

// Map reference for flying to location
let mapRef: MapInstance | undefined;
if (process.env.CLIENT) {
  import('@indoorequal/vue-maplibre-gl').then((pkg) => {
    mapRef = pkg.useMap();
  });
}

// Component refs
const desktopSearchRef = ref<InstanceType<typeof WdHutSearchInput> | null>(
  null,
);
const mobileSearchRef = ref<InstanceType<typeof WdHutSearchMobile> | null>(
  null,
);

// State
const mobileSearchExpanded = ref(false);
const loading = ref(false);

// Debounce timer
let searchTimer: NodeJS.Timeout | null = null;

// Search function
async function performSearch(searchText: string) {
  // Clear previous timer
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  if (searchText.length < 2) {
    if (isMobile.value) {
      mobileSearchRef.value?.setResults([], false);
    } else {
      desktopSearchRef.value?.setResults([], false);
    }
    return;
  }

  // Debounce search
  searchTimer = setTimeout(async () => {
    // Set loading state just before API call
    loading.value = true;
    if (isMobile.value) {
      mobileSearchRef.value?.setResults([], true);
    } else {
      desktopSearchRef.value?.setResults([], true);
    }
    try {
      const { data, error } = await clientWodore.GET('/v1/huts/search', {
        params: {
          query: {
            q: searchText,
            lang: locale.value || 'de',
            offset: 0,
            limit: 8,
            threshold: 0.13,
            include_hut_type: 'all',
            include_sources: 'no',
            include_avatar: true,
          },
        },
      });

      if (error) {
        console.error('Search error:', error);
        if (isMobile.value) {
          mobileSearchRef.value?.setResults([], false);
        } else {
          desktopSearchRef.value?.setResults([], false);
        }
      } else {
        if (isMobile.value) {
          mobileSearchRef.value?.setResults(data || [], false);
        } else {
          desktopSearchRef.value?.setResults(data || [], false);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      if (isMobile.value) {
        mobileSearchRef.value?.setResults([], false);
      } else {
        desktopSearchRef.value?.setResults([], false);
      }
    } finally {
      loading.value = false;
    }
  }, 300); // 300ms debounce
}

// Handle hut selection
function onHutSelect(hut: schemasWodore['HutSearchResultSchema']) {
  if (!hut || !hut.location) {
    return;
  }

  // Fly to location on map
  if (mapRef?.map) {
    const zoom = mapRef.map.getZoom();
    mapRef.map.flyTo({
      center: [hut.location.lon, hut.location.lat],
      zoom: zoom > 12 ? zoom : 12,
      padding: {
        right: $q.screen.xs ? 0 : 400,
      },
    });
  }

  // Navigate to hut details
  router.push({
    name: 'map-hut',
    params: { slug: hut.slug },
    query: route.query,
    hash: route.hash,
  });
}
</script>

<style scoped>
.desktop-search-wrapper {
  max-width: 250px;
  max-height: 40px;
}
</style>

<template>
  <!-- MOBILE: Search overlay component -->
  <WdHutSearchMobile v-if="isMobile" ref="mobileSearchRef" v-model="mobileSearchExpanded" @search="performSearch"
    @select="onHutSelect" />

  <!-- DESKTOP: Inline search -->
  <div v-else class="q-ml-md q-mr-md desktop-search-wrapper">
    <WdHutSearchInput ref="desktopSearchRef" dark placeholder="Hütte suchen..." @search="performSearch"
      @select="onHutSelect" />
  </div>
</template>
