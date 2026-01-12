<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { clientWodore, schemasWodore } from '@clients/index';
import { useI18n } from 'vue-i18n';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
import { useRouter, useRoute } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import WdSearchResultEntry from './WdSearchResultEntry.vue';

const { locale } = useI18n();
const $q = useQuasar();
const router = useRouter();
const route = useRoute();

// Props
interface Props {
  mobile?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mobile: false,
});

// Emits
const emit = defineEmits<{
  close: [];
}>();

const isMobile = computed(() => props.mobile);

// Map reference for flying to location
let mapRef: MapInstance | undefined;
if (process.env.CLIENT) {
  import('@indoorequal/vue-maplibre-gl').then((pkg) => {
    mapRef = pkg.useMap();
  });
}

// State
const searchText = ref('');
const lastSearchText = ref('');
const searchResults = ref<schemasWodore['HutSearchResultSchema'][]>([]);
const loading = ref(false);
const selectedIndex = ref(-1);

// Search function
async function performSearchInternal(newSearchText: string) {
  if (newSearchText.length < 2) {
    searchResults.value = [];
    return;
  }

  loading.value = true;

  try {
    //const { data, error } = await clientWodore.GET('/v1/huts/search', {
    const { data, error } = await clientWodore.GET('/v1/geoplaces/search', {
      params: {
        query: {
          q: newSearchText,
          lang: locale.value || 'de',
          offset: 0,
          limit: 14,
          threshold: 0.25,
          //include_hut_type: 'all',
          include_place_type: 'all',
          include_sources: 'slug',
          //include_avatar: true,
        },
      },
    });

    if (error) {
      console.error('Search error:', error);
      searchResults.value = [];
    } else {
      searchResults.value = data || [];
    }
  } catch (err) {
    console.error('Search failed:', err);
    searchResults.value = [];
  } finally {
    loading.value = false;
  }
}

// Debounced search function using VueUse
const performSearch = useDebounceFn(performSearchInternal, 300);

// Handle search input change
function onSearchInput(value: string | number | null) {
  const strValue = String(value || '');
  searchText.value = strValue;
  selectedIndex.value = -1;

  if (strValue.length >= 2) {
    lastSearchText.value = strValue;
    performSearch(strValue);
  } else if (strValue.length === 0 && lastSearchText.value.length >= 2) {
    // Keep previous results when cleared
  } else {
    searchResults.value = [];
  }
}

// Handle place selection
function onPlaceSelect(hut: schemasWodore['HutSearchResultSchema'], event?: Event) {
  if (!hut || !hut.location) {
    return;
  }

  // Prevent auto-closing from event bubbling
  if (event) {
    event.preventDefault();
    event.stopPropagation();
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

  // Clear search but keep results for next time
  searchText.value = '';
  selectedIndex.value = -1;

  // Emit close (parent decides whether to actually close based on sticky mode)
  emit('close');
}

// Handle preview (eye icon click - keeps dialog open)
function onPlacePreview(hut: schemasWodore['HutSearchResultSchema']) {
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

  // Don't close, don't navigate
}

// Clear search
function clearSearch() {
  searchText.value = '';
  lastSearchText.value = '';
  searchResults.value = [];
  selectedIndex.value = -1;
}

// Handle keyboard navigation
function onKeyDown(event: KeyboardEvent) {
  if (searchResults.value.length === 0) {
    if (event.key === 'Escape') {
      event.preventDefault();
      emit('close');
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      break;
    case 'Enter':
      event.preventDefault();
      if (selectedIndex.value >= 0 && selectedIndex.value < searchResults.value.length) {
        onPlaceSelect(searchResults.value[selectedIndex.value]);
      }
      break;
    case 'Escape':
      event.preventDefault();
      emit('close');
      selectedIndex.value = -1;
      break;
  }
}

// Input ref for autofocus - expose for parent
const searchInputRef = ref<HTMLInputElement | null>(null);

// Expose focus method for parent
defineExpose({
  focus: () => {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  },
});
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}

.no-results {
  padding: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
}
</style>

<template>
  <q-card class="dialog-radius bg-dark-500"
    :style="isMobile ? 'width: 100vw; max-width: 100vw; height: 100vh' : 'width: 440px; max-width: 90vw'">
    <!-- HEADER with search input -->
    <div class="bg-dark-700 q-pa-md" style="padding-right: 84px !important">
      <q-input ref="searchInputRef" :model-value="searchText" @update:model-value="onSearchInput" dense dark outlined
        placeholder="Orte suchen..." autofocus @keydown="onKeyDown" class="toolbar-font">
        <template v-slot:append>
          <q-spinner v-if="loading" color="white" size="16px" />
          <q-icon v-else-if="searchText.length > 0" class="text-icon cursor-pointer" size="sm" @click="clearSearch">
            <IconEvaCloseOutline />
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Search Results -->
    <q-scroll-area visible :thumb-style="{
      width: '6px',
      backgroundColor: '#998019',
      opacity: '0.5',
      borderRadius: '8px 0 0 8px',
    }" :style="isMobile ? 'height: calc(100vh - 88px)' : 'height: 400px; max-height: 600px'">
      <q-list v-if="searchResults.length > 0" class="bg-dark-500">
        <WdSearchResultEntry v-for="(hut, index) in searchResults" :key="hut.slug" :hut="hut"
          :selected="index === selectedIndex" @select="onPlaceSelect" @preview="onPlacePreview" />
      </q-list>
      <div v-else-if="searchText.length >= 2 || lastSearchText.length >= 2" class="no-results bg-dark-500">
        Keine Orte gefunden
      </div>
      <div v-else class="no-results bg-dark-500"
        style="display: flex; align-items: center; justify-content: center; min-height: 300px">
        <div class="text-center">
          <q-icon size="xl" color="primary-300">
            <IconEvaSearchOutline />
          </q-icon>
          <div class="text-primary-300 q-mt-md">Suche nach Hütten, Gipfeln und mehr...</div>
        </div>
      </div>
    </q-scroll-area>
  </q-card>
</template>
