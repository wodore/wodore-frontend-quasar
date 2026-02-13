<script setup lang="ts">
/**
 * Generic Filter Renderer Component
 *
 * Renders the appropriate filter component based on filter type.
 */

import { computed } from 'vue';
import type { FilterDefinition } from '@stores/map/overlay-configs/types';
import WdMultiSelectFilter from './WdMultiSelectFilter.vue';

interface Props {
  overlayName: string;
  filter: FilterDefinition;
  modelValue: unknown;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:modelValue', value: unknown): void;
}

const emit = defineEmits<Emits>();

const value = computed({
  get: () => props.modelValue,
  set: newValue => emit('update:modelValue', newValue),
});
</script>

<template>
  <div class="filter-wrapper">
    <!-- Multi-select filter (checkboxes) -->
    <WdMultiSelectFilter
      v-if="filter.type === 'multi-select'"
      v-model="value"
      :filter="filter"
      :overlay-name="overlayName"
    />

    <!-- Future filter types can be added here -->
    <!-- <WdRangeFilter v-else-if="filter.type === 'range'" ... /> -->
    <!-- <WdToggleFilter v-else-if="filter.type === 'toggle'" ... /> -->

    <!-- Fallback for unknown filter types -->
    <div v-else class="text-caption text-grey-7">Unbekannter Filtertyp: {{ filter.type }}</div>
  </div>
</template>

<style scoped lang="scss">
.filter-wrapper {
  margin-bottom: 16px;
}
</style>
