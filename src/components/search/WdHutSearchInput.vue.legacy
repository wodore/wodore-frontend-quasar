<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { schemasWodore } from '@clients/index';
import WdSearchResultEntry from './search/WdSearchResultEntry.vue';

// Props
interface Props {
  dark?: boolean;
  autofocus?: boolean;
  placeholder?: string;
}

withDefaults(defineProps<Props>(), {
  dark: false,
  autofocus: false,
  placeholder: 'Hütte suchen...',
});

// Emits
const emit = defineEmits<{
  select: [hut: schemasWodore['HutSearchResultSchema']];
  search: [text: string];
  close: [];
}>();

// State
const searchText = ref('');
const lastSearchText = ref(''); // Store last search
const searchResults = ref<schemasWodore['HutSearchResultSchema'][]>([]);
const loading = ref(false);
const showResults = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const selectedIndex = ref(-1);

// Expose methods for parent component
defineExpose({
  focus: () => {
    nextTick(() => {
      inputRef.value?.focus();
    });
  },
  clear: () => {
    searchText.value = '';
    lastSearchText.value = '';
    searchResults.value = [];
    showResults.value = false;
    selectedIndex.value = -1;
  },
  setResults: (
    results: schemasWodore['HutSearchResultSchema'][],
    isLoading: boolean,
  ) => {
    loading.value = isLoading;
    // Update results when loading completes
    if (!isLoading) {
      searchResults.value = results;
    }
    // Keep results visible if we have results or if search text is present
    if (
      searchResults.value.length > 0 ||
      searchText.value.length >= 2 ||
      lastSearchText.value.length >= 2
    ) {
      showResults.value = true;
    }
  },
});

// Watch search text and emit to parent
watch(searchText, (newVal) => {
  selectedIndex.value = -1;
  if (newVal.length >= 2) {
    showResults.value = true;
    lastSearchText.value = newVal;
    emit('search', newVal);
  } else if (newVal.length === 0 && lastSearchText.value.length >= 2) {
    // If text cleared but we have previous results, keep them
    showResults.value = true;
  } else {
    showResults.value = false;
    searchResults.value = [];
  }
});

// Handle input focus
function onFocus() {
  if (searchText.value.length >= 2) {
    showResults.value = true;
  } else if (
    searchText.value.length === 0 &&
    lastSearchText.value.length >= 2 &&
    searchResults.value.length > 0
  ) {
    // Show last results if input is empty but we have previous results
    showResults.value = true;
  }
}

// Handle input blur (with delay to allow clicking on results)
let blurTimeout: NodeJS.Timeout | null = null;
function onBlur() {
  blurTimeout = setTimeout(() => {
    showResults.value = false;
    selectedIndex.value = -1;
  }, 200);
}

// Handle result selection
function selectHut(hut: schemasWodore['HutSearchResultSchema']) {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
  }
  emit('select', hut);
  // Clear search text but keep the last search and results
  searchText.value = '';
  showResults.value = false;
  selectedIndex.value = -1;
  // Results are kept in searchResults for next focus
}

// Handle keyboard navigation
function onKeyDown(event: KeyboardEvent) {
  if (!showResults.value || searchResults.value.length === 0) {
    if (event.key === 'Escape') {
      event.preventDefault();
      showResults.value = false;
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
      scrollToSelected();
      break;
    case 'ArrowUp':
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      scrollToSelected();
      break;
    case 'Enter':
      event.preventDefault();
      if (
        selectedIndex.value >= 0 &&
        selectedIndex.value < searchResults.value.length
      ) {
        selectHut(searchResults.value[selectedIndex.value]);
      }
      break;
    case 'Escape':
      event.preventDefault();
      showResults.value = false;
      selectedIndex.value = -1;
      emit('close');
      break;
  }
}

// Scroll selected item into view
function scrollToSelected() {
  if (selectedIndex.value >= 0 && menuRef.value) {
    const items = menuRef.value.querySelectorAll('.hut-search-result-item');
    const item = items[selectedIndex.value];
    if (item) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

// Clear search
function clearSearch() {
  searchText.value = '';
  lastSearchText.value = '';
  searchResults.value = [];
  showResults.value = false;
  selectedIndex.value = -1;
  inputRef.value?.focus();
}
</script>

<style scoped lang="scss">
.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  background: white;
  border-radius: $generic-border-radius;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 9999;
}

.no-results {
  padding: 16px;
  text-align: center;
  color: rgba(0, 0, 0, 0.6);
}
</style>

<template>
  <div style="position: relative; width: 100%">
    <!-- Use q-input with standout -->
    <q-input ref="inputRef" v-model="searchText" dense :dark="dark" standout :placeholder="placeholder"
      :autofocus="autofocus" @focus="onFocus" @blur="onBlur" @keydown="onKeyDown">
      <template v-slot:prepend v-if="dark">
        <q-icon class="text-icon" size="sm">
          <IconEvaSearchOutline />
        </q-icon>
      </template>

      <template v-slot:append>
        <q-spinner v-if="loading" :color="dark ? 'white' : 'primary'" size="16px" />
        <q-icon v-else-if="searchText.length > 0" :class="dark ? 'text-icon' : 'text-primary'" size="sm"
          class="cursor-pointer" @mousedown.prevent="clearSearch">
          <IconEvaCloseOutline />
        </q-icon>
      </template>
    </q-input>

    <!-- Results dropdown -->
    <div v-if="showResults" ref="menuRef" class="search-results">
      <template v-if="searchResults.length > 0">
        <q-list bordered>
          <WdSearchResultEntry v-for="(hut, index) in searchResults" :key="hut.slug" :hut="hut"
            :selected="index === selectedIndex" @select="selectHut" />
        </q-list>
      </template>
      <div v-else-if="searchText.length >= 2 || lastSearchText.length >= 2" class="no-results">
        Keine Hütten gefunden
      </div>
    </div>
  </div>
</template>
