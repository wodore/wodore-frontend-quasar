<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { clientWodore, schemasWodore } from '@clients/index';
import { useI18n } from 'vue-i18n';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
import { useRouter, useRoute } from 'vue-router';

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

// Search state
const searchText = ref('');
const searchResults = ref<schemasWodore['HutSearchResultSchema'][]>([]);
const loading = ref(false);
const selectedHut = ref<schemasWodore['HutSearchResultSchema'] | null>(null);
const mobileSearchExpanded = ref(false);

// Debounce timer
let searchTimer: NodeJS.Timeout | null = null;

// Filter function for lazy loading
async function filterFn(val: string, update: (callback: () => void) => void) {
  // Clear previous timer
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  if (val.length < 2) {
    update(() => {
      searchResults.value = [];
    });
    return;
  }

  // Set loading state
  loading.value = true;

  // Debounce search
  searchTimer = setTimeout(async () => {
    try {
      const { data, error } = await clientWodore.GET('/v1/huts/search', {
        params: {
          query: {
            q: val,
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
        update(() => {
          searchResults.value = [];
        });
      } else {
        update(() => {
          searchResults.value = data || [];
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
      update(() => {
        searchResults.value = [];
      });
    } finally {
      loading.value = false;
    }
  }, 300); // 300ms debounce
}

// Handle hut selection
function onHutSelect(hut: schemasWodore['HutSearchResultSchema'] | null) {
  if (!hut || !hut.location) {
    return;
  }

  // Clear input immediately to prevent hut from showing in field
  selectedHut.value = null;
  searchText.value = '';

  // Close mobile search
  if (isMobile.value) {
    mobileSearchExpanded.value = false;
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

  // Navigate to hut details (same route name as map click)
  router.push({
    name: 'map-hut',
    params: { slug: hut.slug },
    query: route.query,
    hash: route.hash,
  });
}

// Toggle mobile search
function toggleMobileSearch() {
  mobileSearchExpanded.value = !mobileSearchExpanded.value;
  if (!mobileSearchExpanded.value) {
    searchText.value = '';
    searchResults.value = [];
  }
}

// Handle keyboard events
function onKeyDown(event: KeyboardEvent) {
  // Select first result on Enter when there are results
  if (event.key === 'Enter' && searchResults.value.length > 0) {
    event.preventDefault();
    selectedHut.value = searchResults.value[0];
    onHutSelect(searchResults.value[0]);
  }
  // Let Tab key work naturally for navigation through results
}

// Get hut type icon URL
function getHutTypeIcon(hut: schemasWodore['HutSearchResultSchema']): string | undefined {
  if (!hut.hut_type || typeof hut.hut_type !== 'object') {
    return undefined;
  }

  const hutType = hut.hut_type as Record<string, unknown>;

  // Check for open.symbol (nested structure)
  if (hutType.open && typeof hutType.open === 'object') {
    const open = hutType.open as Record<string, unknown>;
    if (typeof open.symbol === 'string') {
      return open.symbol;
    }
  }

  // Fallback to direct symbol field
  if (typeof hutType.symbol === 'string') {
    return hutType.symbol;
  }

  return undefined;
}
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}
</style>

<style lang="scss">
.hut-search-mobile-overlay {
  .q-menu {
    top: 56px !important;
    /* Position below the overlay bar */
    left: 8px !important;
    max-width: calc(100vw - 16px) !important;
  }
}
</style>

<template>
  <!-- MOBILE: Search icon button or full-width overlay -->
  <div v-if="isMobile">
    <!-- Collapsed: Just the search icon -->
    <q-btn v-if="!mobileSearchExpanded" flat round dense class="text-icon" @click="toggleMobileSearch">
      <q-icon>
        <IconEvaSearchOutline />
      </q-icon>
    </q-btn>

    <!-- Expanded: Full-width search overlay -->
    <div v-else style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 6000;
        background-color: rgb(var(--q-primary-8));
        backdrop-filter: blur(10px);
        padding: 8px;
        display: flex;
        gap: 8px;
        align-items: center;
      ">
      <q-select v-model="selectedHut" use-input input-debounce="0" :options="searchResults" option-label="name" dense
        dark standout autofocus class="toolbar-font hut-search-menu hut-search-mobile-overlay" style="flex: 1"
        placeholder="Hütte suchen..." :loading="loading" @filter="filterFn" @update:model-value="onHutSelect"
        @keydown="onKeyDown" clearable popup-content-class="bg-dark-500" behavior="menu">
        <template v-slot:prepend>
          <q-icon class="text-icon" size="sm">
            <IconEvaSearchOutline />
          </q-icon>
        </template>

        <template v-slot:no-option>
          <q-item v-if="searchText.length >= 2">
            <q-item-section class="text-grey">
              Keine Hütten gefunden
            </q-item-section>
          </q-item>
        </template>

        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps" class="hut-search-item">
            <q-item-section avatar>
              <q-avatar v-if="getHutTypeIcon(scope.opt)" size="32px">
                <img :src="getHutTypeIcon(scope.opt)" />
              </q-avatar>
              <q-avatar v-else color="primary" text-color="white" size="32px">
                <q-icon name="home" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ scope.opt.name }}</q-item-label>
              <q-item-label caption v-if="scope.opt.elevation">
                {{ scope.opt.elevation }}m
              </q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>

      <q-btn flat round dense class="text-icon" @click="toggleMobileSearch">
        <q-icon>
          <IconEvaCloseOutline />
        </q-icon>
      </q-btn>
    </div>
  </div>

  <!-- DESKTOP: Inline search -->
  <div v-else class="q-ml-md q-mr-md" style="max-width: 250px; max-height: 40px">
    <q-select v-model="selectedHut" use-input input-debounce="0" :options="searchResults" option-label="name" dense dark
      standout class="toolbar-font hut-search-menu" placeholder="Hütte suchen..." :loading="loading" @filter="filterFn"
      @update:model-value="onHutSelect" @keydown="onKeyDown" clearable popup-content-class="bg-dark-500">
      <template v-slot:prepend>
        <q-icon class="text-icon" size="sm">
          <IconEvaSearchOutline />
        </q-icon>
      </template>

      <template v-slot:no-option>
        <q-item v-if="searchText.length >= 2">
          <q-item-section class="text-grey">
            Keine Hütten gefunden
          </q-item-section>
        </q-item>
      </template>

      <template v-slot:option="scope">
        <q-item v-bind="scope.itemProps" class="hut-search-item">
          <q-item-section avatar>
            <q-avatar v-if="getHutTypeIcon(scope.opt)" size="32px">
              <img :src="getHutTypeIcon(scope.opt)" />
            </q-avatar>
            <q-avatar v-else color="primary" text-color="white" size="32px">
              <q-icon name="home" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ scope.opt.name }}</q-item-label>
            <q-item-label caption v-if="scope.opt.elevation">
              {{ scope.opt.elevation }}m
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
  </div>
</template>
