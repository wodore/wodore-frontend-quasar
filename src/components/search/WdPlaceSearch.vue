<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { clientWodore, schemasWodore } from '@clients/index';
import { useI18n } from 'vue-i18n';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
import { useRouter, useRoute } from 'vue-router';
import { useDebounceFn, useDraggable } from '@vueuse/core';
import WdSearchResultEntry from './WdSearchResultEntry.vue';

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

// State
const showMenu = ref(false);
const searchText = ref('');
const lastSearchText = ref('');
const searchResults = ref<schemasWodore['HutSearchResultSchema'][]>([]);
const loading = ref(false);
const selectedIndex = ref(-1);
const isSticky = ref(false);

// Search function
async function performSearchInternal(newSearchText: string) {
  if (newSearchText.length < 2) {
    searchResults.value = [];
    return;
  }

  loading.value = true;

  try {
    const { data, error } = await clientWodore.GET('/v1/huts/search', {
      params: {
        query: {
          q: newSearchText,
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

// Handle place selection (full click - closes dialog unless sticky)
function onPlaceSelect(hut: schemasWodore['HutSearchResultSchema'], event?: Event) {
  if (!hut || !hut.location) {
    return;
  }

  // Prevent q-popup-proxy from auto-closing
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

  // Close dialog only if not sticky
  if (!isSticky.value) {
    showMenu.value = false;
  }
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

  // Don't close dialog, don't navigate, don't clear search
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
      showMenu.value = false;
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
      showMenu.value = false;
      selectedIndex.value = -1;
      break;
  }
}

// Input ref for autofocus
const searchInputRef = ref<HTMLInputElement | null>(null);

// Draggable functionality (desktop only)
const dialogCardRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);

// Initialize useDraggable
const { x, y, style: draggableStyle } = useDraggable(dialogCardRef, {
  handle: dragHandleRef,
  initialValue: { x: 0, y: 0 },
});

// When menu opens, focus the input
import { watch, nextTick } from 'vue';
watch(showMenu, (newVal) => {
  if (newVal) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    // Reset sticky and position when dialog closes
    isSticky.value = false;
    x.value = 0;
    y.value = 0;
  }
});

// Toggle sticky mode
function toggleSticky() {
  isSticky.value = !isSticky.value;
}

// Close dialog (only when sticky button shows close icon)
function closeDialog() {
  showMenu.value = false;
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
</style>



<template>
  <div :class="{
    'q-ml-md': !isMobile,
    'q-ml-xs': isMobile,
  }" class="q-mr-md" :style="isMobile
    ? 'max-width: 50px; max-height: 40px'
    : 'max-width: 180px; max-height: 40px'
    ">
    <!-- SEARCH DIALOG -->
    <q-popup-proxy :offset="[10, 1]" no-parent-event anchor="top start" target="#select-place-search-location"
      v-model="showMenu" :breakpoint="0" transition-show="jump-down" transition-hide="jump-up" persistent>
      <div ref="dialogCardRef" :style="!isMobile ? draggableStyle : ''">
        <q-card class="dialog-radius bg-dark-500" style="width: 440px; max-width: 90vw">
          <!-- Sticky/Close toggle button (desktop only) -->
          <div v-if="!isMobile" class="q-ma-xs z-top text-icon row q-gutter-xs"
            style="position: absolute; top: 6px; right: 6px">
            <!-- Drag icon (shown when sticky) -->
            <q-btn v-if="isSticky" dense round flat color="primary-400" ref="dragHandleRef" class="cursor-move">
              <q-icon size="sm">
                <IconEvaMoveOutline />
              </q-icon>
              <q-tooltip :delay="2000">Ziehen um zu verschieben</q-tooltip>
            </q-btn>
            <!-- Lock/Unlock toggle -->
            <q-btn v-if="!isSticky" dense round @click="toggleSticky" color="primary-400">
              <q-icon size="sm">
                <IconEvaUnlockOutline />
              </q-icon>
              <q-tooltip :delay="2000">Dialog anheften</q-tooltip>
            </q-btn>
            <q-btn v-else dense round @click="closeDialog" color="accent-700" icon="wd-close">
              <q-tooltip :delay="2000">Schließen</q-tooltip>
            </q-btn>
          </div>

          <!-- Close button (mobile only) -->
          <div v-else class="q-ma-xs z-top text-icon" style="position: absolute; width: 32px; top: 6px; right: 6px">
            <q-btn dense round v-close-popup color="accent-700" icon="wd-close"></q-btn>
          </div>

          <!-- HEADER with search input -->
          <q-list padding class="bg-dark-700">
            <q-item>
              <q-item-section>
                <q-input ref="searchInputRef" :model-value="searchText" @update:model-value="onSearchInput" dense dark
                  outlined placeholder="Orte suchen..." autofocus @keydown="onKeyDown" class="toolbar-font"
                  style="padding-left: 3px; padding-right: 84px">
                  <template v-slot:append>
                    <q-spinner v-if="loading" color="white" size="16px" />
                    <q-icon v-else-if="searchText.length > 0" class="text-icon cursor-pointer" size="sm"
                      @click="clearSearch">
                      <IconEvaCloseOutline />
                    </q-icon>
                  </template>
                </q-input>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- RESULTS -->
          <q-scroll-area visible :thumb-style="{
            width: '6px',
            backgroundColor: '#998019',
            opacity: '0.5',
            borderRadius: '8px 0 0 8px',
          }" style="height: 400px; max-height: 600px">
            <q-list v-if="searchResults.length > 0" class="bg-dark-500">
              <WdSearchResultEntry v-for="(hut, index) in searchResults" :key="hut.slug" :hut="hut"
                :selected="index === selectedIndex" @select="onPlaceSelect" @preview="onPlacePreview" />
            </q-list>
            <div v-else-if="searchText.length >= 2 || lastSearchText.length >= 2" class="no-results bg-dark-500">
              Keine Orte gefunden
            </div>
            <div v-else class="no-results bg-dark-500" style="
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 300px;
              ">
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
      </div>
    </q-popup-proxy>

    <!-- DESKTOP - readonly input field -->
    <div id="select-place-search-location" style="flex: 1; position: relative">
      <q-input readonly model-value="" dense dark standout placeholder="Orte suchen..." class="toolbar-font"
        @click="showMenu = true">
        <template v-slot:prepend>
          <q-icon @click="showMenu = true" class="text-icon cursor-pointer" size="sm">
            <IconEvaSearchOutline />
          </q-icon>
        </template>
      </q-input>
    </div>
  </div>
</template>
