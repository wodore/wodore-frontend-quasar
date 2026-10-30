<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { clientWodore, schemasWodore } from '@clients/index';
import { useI18n } from 'vue-i18n';
import { isCrawlerUA } from '@services/crawler-ua';
import { MapInstance } from '@indoorequal/vue-maplibre-gl/dist/lib/lib/mapRegistry';
import { useRouter, useRoute } from 'vue-router';
import { useDebounceFn, useIntersectionObserver } from '@vueuse/core';
import { useLatestRequest } from '@composables/useLatestRequest';
import WdSearchResultEntry from './WdSearchResultEntry.vue';

const { locale, t } = useI18n();
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
// Crawler gate (SEO, follow-up to PR #347): free for humans (the
// vendor chunk loads via WdMapView on this page anyway) but would drag
// 327 kB gz of map library into every crawler render — crawlers never
// search-and-fly, so skip it.
if (process.env.CLIENT && !isCrawlerUA()) {
  import('@indoorequal/vue-maplibre-gl').then(pkg => {
    mapRef = pkg.useMap();
  });
}

// State
const searchText = ref('');
const lastSearchText = ref('');
const searchResults = ref<schemasWodore['GeoPlaceSearchSchema'][]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const selectedIndex = ref(-1);
// Backend offset of the next page — tracked independently of
// searchResults.length (dedupe can shrink appends; an all-dupes page
// would otherwise re-fetch the same offset forever) and reset with each
// new term.
let nextOffset = 0;
// Proximity bias pinned when a term's first page fires — appends reuse
// it so pagination walks one stable ranking (the map center may move
// while the user previews results).
let activeBias: { lat?: number; lon?: number } = {};

// Search request shape (backend PR #456/#464): sparse fieldsets skip the
// categories/parties/sources fetches per keystroke — `kind` (name +
// symbol since #464) keys the preview icon. Sources dropped per PO:
// hut deep-links fall back to fly-only until a cheap `hut_slug`
// discriminator lands on the backend.
const SEARCH_FIELDS = { places: 'slug,name,location,elevation,kind' };
const SEARCH_LIMIT = 8;
const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

// Search function
const latestSearch = useLatestRequest();

// Proximity bias (optional backend ranking hint): the user's geolocation
// when known (one-shot, cached — permission-gated), else the current map
// center when the map instance is already loaded.
let cachedUserPosition: { lat: number; lon: number } | null = null;
let userPositionRequested = false;

function requestUserPosition(): void {
  if (userPositionRequested || !('geolocation' in navigator)) return;
  userPositionRequested = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      cachedUserPosition = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      };
    },
    () => {
      /* permission denied or unavailable — map center fallback stays */
    },
    { timeout: 5000, maximumAge: 300000 }
  );
}

function mapCenterParams(): { lat?: number; lon?: number } {
  if (cachedUserPosition) {
    return {
      lat: Math.round(cachedUserPosition.lat * 10000) / 10000,
      lon: Math.round(cachedUserPosition.lon * 10000) / 10000,
    };
  }
  requestUserPosition();
  if (!mapRef?.map) return {};
  const center = mapRef.map.getCenter();
  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return {};
  // ~11 m precision is plenty for ranking and keeps the URL compact.
  return {
    lat: Math.round(center.lat * 10000) / 10000,
    lon: Math.round(center.lng * 10000) / 10000,
  };
}

async function performSearchInternal(newSearchText: string, offset = 0) {
  if (newSearchText.length < MIN_QUERY_LENGTH) {
    searchResults.value = [];
    hasMore.value = false;
    return;
  }

  if (offset === 0) {
    loading.value = true;
    activeBias = mapCenterParams();
  } else {
    loadingMore.value = true;
  }
  const token = latestSearch.next();

  try {
    const { data, error } = await clientWodore.GET('/v1/geo/places/search', {
      params: {
        query: {
          q: newSearchText,
          lang: locale.value || 'de',
          offset,
          limit: SEARCH_LIMIT,
          threshold: 0.25,
          fields: SEARCH_FIELDS,
          ...(offset === 0 ? activeBias : {}),
        },
      },
    });

    // A newer search superseded this one - do not overwrite its results
    if (!latestSearch.isLatest(token)) return;

    if (error) {
      console.error('Search error:', error);
      // A failed append keeps the already-rendered pages; only a failed
      // first page switches to the empty state.
      if (offset === 0) {
        searchResults.value = [];
      }
      hasMore.value = false;
    } else {
      const page = data || [];
      hasMore.value = page.length === SEARCH_LIMIT;
      nextOffset = offset + page.length;
      if (offset === 0) {
        searchResults.value = page;
      } else {
        // 'Show more' append: dedupe by slug — result sets can shift
        // between requests, an overlapping entry would key-collide in
        // the transition-group.
        const seen = new Set(searchResults.value.map(place => place.slug));
        searchResults.value.push(...page.filter(place => !seen.has(place.slug)));
      }
    }
  } catch (err) {
    if (!latestSearch.isLatest(token)) return;
    console.error('Search failed:', err);
    if (offset === 0) {
      searchResults.value = [];
    }
    hasMore.value = false;
  } finally {
    if (latestSearch.isLatest(token)) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

// Debounced search function using VueUse
const performSearch = useDebounceFn(performSearchInternal, SEARCH_DEBOUNCE_MS);

// 'Show more' pagination: a sentinel at the end of the result list loads
// the next page (offset += limit). Paused while a page is in flight —
// resume re-observes and re-fires when the sentinel stays visible, so a
// short viewport keeps filling until the sentinel is pushed out of view.
const loadMoreSentinel = ref<HTMLElement | null>(null);
const { pause: pauseLoadMore, resume: resumeLoadMore } = useIntersectionObserver(
  loadMoreSentinel,
  ([entry]) => {
    if (
      !entry?.isIntersecting ||
      loading.value ||
      loadingMore.value ||
      !hasMore.value ||
      lastSearchText.value.length < MIN_QUERY_LENGTH
    ) {
      return;
    }
    pauseLoadMore();
    void performSearchInternal(lastSearchText.value, nextOffset).finally(() => resumeLoadMore());
  }
);

// Handle search input change
function onSearchInput(value: string | number | null) {
  const strValue = String(value || '');
  searchText.value = strValue;
  selectedIndex.value = -1;

  if (strValue.length >= MIN_QUERY_LENGTH) {
    lastSearchText.value = strValue;
    performSearch(strValue);
  } else if (strValue.length === 0 && lastSearchText.value.length >= MIN_QUERY_LENGTH) {
    // Keep previous results when cleared
  } else {
    searchResults.value = [];
  }
}

// Handle place selection
function onPlaceSelect(place: schemasWodore['GeoPlaceSearchSchema'], event?: Event) {
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
        | schemasWodore['OrganizationSourceIdDetailSchema']
    ) => {
      // Handle both string and object types for source
      const sourceValue = typeof source.source === 'string' ? source.source : source.source.slug;
      return sourceValue === 'wodore';
    }
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
  hasMore.value = false;
  nextOffset = 0;
  activeBias = {};
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

// Handle swipe-down to close (only when enabled)
function handleSwipeDown() {
  if (props.swipeToClose) {
    emit('close');
  }
}
</script>

<style scoped>
.toolbar-font {
  .wd-surface {
    background: var(--wd-surface) !important;
  }
  .wd-surface-deep {
    background: var(--wd-surface-deep) !important;
  }
  .wd-info-text {
    color: var(--wd-info) !important;
  }
  font-size: medium;
}

.no-results {
  padding: 16px;
  text-align: center;
  color: var(--wd-ink-soft);
}

/* Remove border-radius on mobile */
.q-card[style*='100vw'] {
  border-radius: 0 !important;
}

/* Search result animations */
.search-result-enter-active,
.search-result-leave-active {
  transition: all 0.3s ease;
}

.search-result-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.search-result-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Ensure smooth layout changes */
.search-result-move {
  transition: transform 0.3s ease;
}
</style>

<template>
  <q-card
    :class="isMobile ? 'wd-search-card' : 'dialog-radius wd-search-card'"
    :style="
      isMobile
        ? 'width: 100vw; max-width: 100vw; height: 100vh; height: 100dvh;'
        : 'width: 440px; max-width: 90vw'
    "
  >
    <!-- HEADER with search input (fixed position on mobile) -->
    <div
      class="wd-surface-deep q-pa-md"
      :style="
        isMobile
          ? 'position: fixed; top: var(--q-safe-area-inset-top, env(safe-area-inset-top, 0px)); left: 0; right: 0; z-index: 100; padding-right: 84px !important'
          : 'padding-right: 84px !important'
      "
    >
      <q-input
        ref="searchInputRef"
        :model-value="searchText"
        @update:model-value="onSearchInput"
        dense
        :placeholder="t('search_ui.placeholder')"
        autofocus
        @keydown="onKeyDown"
        class="toolbar-font wd-search-field"
      >
        <template v-slot:append>
          <q-spinner v-if="loading" class="wd-info-text" size="16px" />
          <q-icon
            v-else-if="searchText.length > 0"
            class="wd-info-text cursor-pointer"
            size="26px"
            @click="clearSearch"
          >
            <IconEvaCloseOutline />
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Search Results -->
    <q-scroll-area
      visible
      :thumb-style="{
        width: '6px',
        backgroundColor: '#998019',
        opacity: '0.5',
        borderRadius: '8px 0 0 8px',
      }"
      :style="
        isMobile
          ? 'position: fixed; top: calc(88px + var(--q-safe-area-inset-top, env(safe-area-inset-top, 0px))); left: 0; right: 0; bottom: 0; height: auto;'
          : 'height: auto; max-height: 600px'
      "
    >
      <q-list v-if="searchResults.length > 0" class="wd-surface" :class="{ 'q-mt-sm': !isMobile }">
        <transition-group name="search-result" tag="div">
          <WdSearchResultEntry
            v-for="(place, index) in searchResults"
            :key="place.slug"
            :place="place"
            :selected="index === selectedIndex"
            @select="onPlaceSelect"
            @preview="onPlacePreview"
          />
        </transition-group>
        <!-- 'Show more' sentinel: loads the next page when scrolled into view -->
        <div
          v-if="hasMore && searchResults.length > 0"
          ref="loadMoreSentinel"
          class="row justify-center q-py-md"
        >
          <q-spinner v-if="loadingMore" class="wd-info-text" size="18px" />
        </div>
      </q-list>
      <div
        v-else-if="searchText.length >= 2 || lastSearchText.length >= 2"
        class="no-results wd-surface"
      >
        {{ t('search_ui.no_places') }}
      </div>
      <div
        v-else
        class="no-results wd-surface"
        style="display: flex; align-items: center; justify-content: center; min-height: 300px"
        v-touch-swipe.down="isMobile && props.swipeToClose ? handleSwipeDown : undefined"
      >
        <div class="text-center">
          <q-icon size="xl" class="wd-info-text">
            <IconEvaSearchOutline />
          </q-icon>
          <div class="wd-ink-soft-text q-mt-md">{{ t('search_ui.placeholder_hint') }}</div>
        </div>
      </div>
    </q-scroll-area>
  </q-card>
</template>
