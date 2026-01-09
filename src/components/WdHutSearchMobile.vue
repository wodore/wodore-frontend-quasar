<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { schemasWodore } from '@clients/index';
import WdHutSearchInput from './WdHutSearchInput.vue';

// Props
interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  select: [hut: schemasWodore['HutSearchResultSchema']];
  search: [text: string];
}>();

// State
const searchInputRef = ref<InstanceType<typeof WdHutSearchInput> | null>(null);

// Computed for v-model
const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// Watch for overlay open/close
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Focus input when overlay opens
    setTimeout(() => {
      searchInputRef.value?.focus();
    }, 150);
  } else {
    // Clear search when overlay closes
    searchInputRef.value?.clear();
  }
});

// Toggle overlay
function toggleOverlay() {
  emit('update:modelValue', !props.modelValue);
}

// Close overlay
function closeOverlay() {
  emit('update:modelValue', false);
}

// Handle hut selection
function onHutSelect(hut: schemasWodore['HutSearchResultSchema']) {
  emit('select', hut);
  closeOverlay();
}

// Handle search
function onSearch(text: string) {
  emit('search', text);
}

// Handle results update
function setResults(results: schemasWodore['HutSearchResultSchema'][], isLoading: boolean) {
  searchInputRef.value?.setResults(results, isLoading);
}

// Expose methods for parent
defineExpose({
  setResults,
});
</script>

<template>
  <div>
    <!-- Search icon button (collapsed state) -->
    <q-btn v-if="!modelValue" flat round dense class="text-icon" @click="toggleOverlay">
      <q-icon>
        <IconEvaSearchOutline />
      </q-icon>
    </q-btn>

    <!-- Mobile search dialog -->
    <q-dialog v-model="showDialog" position="top" seamless @click="closeOverlay">
      <!-- Full-width search toolbar -->
      <q-toolbar class="bg-white" @click.stop style="box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2)">
        <!-- Search icon (left side) -->
        <q-icon class="text-primary" size="sm">
          <IconEvaSearchOutline />
        </q-icon>

        <!-- Search input -->
        <div style="flex: 1" class="q-ml-sm">
          <WdHutSearchInput ref="searchInputRef" :dark="false" autofocus placeholder="Hütte suchen..."
            @select="onHutSelect" @search="onSearch" @close="closeOverlay" />
        </div>

        <!-- Close button -->
        <q-btn flat round dense class="text-primary" @click="closeOverlay">
          <q-icon>
            <IconEvaCloseOutline />
          </q-icon>
        </q-btn>
      </q-toolbar>
    </q-dialog>
  </div>
</template>
