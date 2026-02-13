<script setup lang="ts">
/**
 * Multi-Select Filter Component
 *
 * Displays a list of checkboxes for multi-select filtering.
 * Includes Select All / Deselect All functionality.
 */

import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { FilterDefinition } from '@stores/map/overlay-configs/types';
import { useMap } from '@indoorequal/vue-maplibre-gl';

interface Props {
  overlayName: string;
  filter: FilterDefinition;
  modelValue: unknown;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:modelValue', value: string[]): void;
}

const emit = defineEmits<Emits>();

const mapRef = useMap();
const currentZoom = ref(10); // Default zoom level

// Update zoom level when map zoom changes
function updateZoom() {
  if (mapRef.map) {
    currentZoom.value = mapRef.map.getZoom();
  }
}

onMounted(() => {
  if (mapRef.map) {
    currentZoom.value = mapRef.map.getZoom();
    mapRef.map.on('zoom', updateZoom);
  }
});

onUnmounted(() => {
  if (mapRef.map) {
    mapRef.map.off('zoom', updateZoom);
  }
});

// Use simple icon at low zoom (< 11), detailed at high zoom (>= 11)
const getDisplayIcon = (option: { iconSimple?: string; iconDetailed?: string }) => {
  if (currentZoom.value >= 11) {
    return option.iconDetailed || option.iconSimple;
  } else {
    return option.iconSimple || option.iconDetailed;
  }
};

const selectedValues = computed<string[]>({
  get: () => {
    const val = props.modelValue as string[] | undefined;
    // If empty or undefined, default to all selected
    if (!val || val.length === 0) {
      return props.filter.options?.map(opt => opt.value as string) || [];
    }
    return val;
  },
  set: newValue => emit('update:modelValue', newValue),
});

const allOptions = computed(() => props.filter.options || []);
const allSelected = computed(() => selectedValues.value.length === allOptions.value.length);

function toggleAll() {
  if (allSelected.value) {
    // Deselect all
    selectedValues.value = [];
  } else {
    // Select all
    selectedValues.value = allOptions.value.map(opt => opt.value as string);
  }
}

function toggleOption(value: string) {
  const index = selectedValues.value.indexOf(value);
  if (index > -1) {
    // Remove from selection
    selectedValues.value = selectedValues.value.filter(v => v !== value);
  } else {
    // Add to selection
    selectedValues.value = [...selectedValues.value, value];
  }
}

function getIconUrl(iconUrl: string | undefined): string | undefined {
  if (!iconUrl) return undefined;

  // If it's already an absolute URL, return as is
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
    return iconUrl;
  }

  // Otherwise, treat as relative path
  return iconUrl;
}
</script>

<template>
  <div class="multiselect-filter">
    <!-- Filter label and Select All toggle -->
    <div class="filter-header">
      <div class="text-subtitle2">{{ filter.label }}</div>
      <q-btn
        flat
        dense
        size="sm"
        :label="allSelected ? 'Alle abwählen' : 'Alle auswählen'"
        color="primary"
        @click="toggleAll"
        class="select-all-btn"
      />
    </div>

    <!-- Selection count -->
    <div class="text-caption text-grey-7 q-mb-sm">
      <span v-if="allSelected">Kein Filter aktiv</span>
      <span v-else>{{ selectedValues.length }} von {{ allOptions.length }} ausgewählt</span>
    </div>

    <!-- Options list -->
    <q-list dense class="options-list">
      <q-item
        v-for="option in allOptions"
        :key="option.value"
        clickable
        class="option-item"
        :class="{ 'option-inactive': !selectedValues.includes(option.value as string) }"
        @click="toggleOption(option.value as string)"
      >
        <q-item-section avatar v-if="option.iconDetailed || option.iconSimple">
          <q-avatar size="32px" square class="icon-container">
            <transition name="fade">
              <img
                :key="getDisplayIcon(option)"
                :src="getIconUrl(getDisplayIcon(option))"
                :alt="option.label"
                class="icon-img"
              />
            </transition>
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label>{{ option.label }}</q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn flat round dense size="sm" icon="wd-info-outline" @click.stop="() => {}">
            <q-tooltip :delay="500" max-width="300px" class="text-body2">
              {{ option.description }}
            </q-tooltip>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped lang="scss">
.multiselect-filter {
  margin-bottom: 16px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.select-all-btn {
  margin-left: auto;
  min-height: 24px;
  padding: 2px 8px;
}

.options-list {
  height: 100%;
  overflow-y: auto;
}

.option-item {
  min-height: 40px;
  padding: 4px 8px;
  transition: opacity 0.2s ease;
}

.option-inactive {
  opacity: 0.5;
}

.option-inactive img {
  filter: grayscale(100%);
}

.icon-container {
  position: relative;
  overflow: hidden;
}

.icon-img {
  display: block;
  width: 100%;
  height: 100%;
}

.fade-enter-active {
  transition: opacity 0.3s ease;
}

.fade-leave-active {
  transition: opacity 0.3s ease;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.fade-enter-from {
  opacity: 0;
}

.fade-leave-to {
  opacity: 0;
}
</style>
