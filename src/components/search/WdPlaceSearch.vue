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
  swipeToClose?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  mobile: false,
  swipeToClose: false,
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
const searchResults = ref<schemasWodore['GeoPlaceSearchSchema'][]>([]);
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
    const { data, error } = await clientWodore.GET('/v1/geo/places/search', {
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
function onPlaceSelect(
  place: schemasWodore['GeoPlaceSearchSchema'],
  event?: Event,
) {
  if (!place || !place.location) {
    return;
  }

  // Prevent auto-closing from event bubbling
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Check if any source is 'wodore' and get source_id
  const wodoreSource = place.sources?.find(
    (
      source:
        | schemasWodore['OrganizationSourceIdSlugSchema']
        | schemasWodore['OrganizationSourceIdDetailSchema'],
    ) => {
      // Handle both string and object types for source
      const sourceValue =
        typeof source.source === 'string' ? source.source : source.source.slug;
      return sourceValue === 'wodore';
    },
  );

  // Fly to location on map
  if (mapRef?.map) {
    const zoom = mapRef.map.getZoom();
    mapRef.map.flyTo({
      center: [place.location.lon, place.location.lat],
      zoom: zoom > 12 ? zoom : 12,
      padding: {
        right: $q.screen.xs ? 0 : 400,
      },
    });
  }

  // If wodore source exists, navigate to hut details with source_id
  if (wodoreSource && wodoreSource.source_id) {
    router.push({
      name: 'map-hut',
      params: { slug: wodoreSource.source_id },
      query: route.query,
      hash: route.hash,
    });
  } else {
    // No wodore source, just fly to location (already done above)
  }

  // Clear search but keep results for next time
  searchText.value = '';
  selectedIndex.value = -1;

  // Emit close (parent decides whether to actually close based on sticky mode)
  emit('close');
}

// Handle preview (eye icon click - keeps dialog open)
function onPlacePreview(place: schemasWodore['GeoPlaceSearchSchema']) {
  if (!place || !place.location) {
    return;
  }

  // Fly to location on map
  if (mapRef?.map) {
    const zoom = mapRef.map.getZoom();
    mapRef.map.flyTo({
      center: [place.location.lon, place.location.lat],
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
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        searchResults.value.length - 1,
      );
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      break;
    case 'Enter':
      event.preventDefault();
      if (
        selectedIndex.value >= 0 &&
        selectedIndex.value < searchResults.value.length
      ) {
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

// Handle swipe-down to close (only when enabled)
function handleSwipeDown() {
  if (props.swipeToClose) {
    emit('close');
  }
}
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

/* Remove border-radius on mobile */
.q-card[style*='100vw'] {
  border-radius: 0 !important;
}

/* Search result animations */
.search-result-enter-active {
  animation: slide-in 3s ease;
}

.search-result-leave-active {
  animation: slide-out 3s ease;
}

.search-result-move {
  transition: transform 3s ease;
}

@keyframes slide-in {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }

  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slide-out {
  0% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0;
    transform: translateX(20px);
  }
}
</style>

<template>
  <q-card :class="isMobile ? 'bg-dark-500' : 'dialog-radius bg-dark-500'" :style="isMobile
    ? 'width: 100vw; max-width: 100vw; height: 100dvh; height: 100vh;'
    : 'width: 440px; max-width: 90vw'
    ">
    <!-- HEADER with search input (fixed position on mobile) -->
    <div class="bg-dark-700 q-pa-md" :style="isMobile
      ? 'position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding-right: 84px !important'
      : 'padding-right: 84px !important'
      ">
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
    }" :style="isMobile
      ? 'position: fixed; top: 88px; left: 0; right: 0; bottom: 0; height: auto;'
      : 'height: 400px; max-height: 600px'
      ">
      <q-list v-if="searchResults.length > 0" class="bg-dark-500" :class="{ 'q-mt-sm': !isMobile }">
        <transition-group appear enter-active-class="animated fadeInLeft" leave-active-class="animated fadeOutRight">
          <WdSearchResultEntry v-for="(place, index) in searchResults" :key="place.id" :hut="place"
            :selected="index === selectedIndex" @select="onPlaceSelect" @preview="onPlacePreview" />
        </transition-group>
      </q-list>
      <div v-else-if="searchText.length >= 2 || lastSearchText.length >= 2" class="no-results bg-dark-500">
        Keine Orte gefunden
      </div>
      <div v-else class="no-results bg-dark-500" style="
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        " v-touch-swipe.down="isMobile && props.swipeToClose ? handleSwipeDown : undefined">
        <div class="text-center">
          <q-icon size="xl" color="primary-300">
            <IconEvaSearchOutline />
          </q-icon>
          <div class="text-primary-300 q-mt-md">
            Suche nach Hütten, Gipfeln und mehr...
          </div>
        </div>
      </div>
    </q-scroll-area>
  </q-card>
</template>
