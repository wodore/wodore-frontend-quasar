<script setup lang="ts">
/**
 * Overlay Config Panels Component
 *
 * Shared component for all tab panels (Filter, Legend/Info, Settings).
 * Used in both dialog and drawer modes.
 */

import { ref, computed, watch } from 'vue';
import type { OverlayConfig } from '@stores/map/overlay-configs/types';
import WdLegendSection from './WdLegendSection.vue';
import WdOverlayConfigLinks from './WdOverlayConfigLinks.vue';
import WdOverlayConfigAttribution from './WdOverlayConfigAttribution.vue';

interface Props {
  activeTab: string;
  overlayName: string;
  overlayConfig?: OverlayConfig;
  hasFilters: boolean;
  hasLegend: boolean;
  hasSettings: boolean;
  showResetButton?: boolean; // Show reset button in filter panel
}

const props = withDefaults(defineProps<Props>(), {
  showResetButton: false,
});

const emit = defineEmits<{
  'update:filter': [filterId: string, value: unknown];
  'get:filter': [filterId: string];
  reset: [];
}>();

// Legend sections
const legendSections = computed(() => props.overlayConfig?.legend?.sections || []);
const hasMultipleLegendSections = computed(() => legendSections.value.length > 1);
const legendLinks = computed(() => props.overlayConfig?.legend?.links || []);
const legendAttribution = computed(() => props.overlayConfig?.legend?.attribution || []);

// Sub-tab for Info section (auto-select first section)
const infoSubTab = ref(legendSections.value[0]?.title || '');

// Update infoSubTab when legend sections change
watch(legendSections, newSections => {
  if (newSections.length > 0 && !infoSubTab.value) {
    infoSubTab.value = newSections[0].title;
  }
});

function getFilterValue(filterId: string) {
  emit('get:filter', filterId);
}

function setFilterValue(filterId: string, value: unknown) {
  emit('update:filter', filterId, value);
}

function handleReset() {
  emit('reset');
}
</script>

<template>
  <q-tab-panels :model-value="activeTab" animated class="transparent-panels">
    <!-- Legend/Info Panel -->
    <q-tab-panel name="legend" v-if="hasLegend" class="q-pa-none legend-panel">
      <!-- Sub-tabs for Info section (sticky) - only show if multiple sections -->
      <div v-if="hasMultipleLegendSections" class="sticky-subtabs">
        <q-tabs v-model="infoSubTab" dense no-caps class="text-grey-8" indicator-color="primary">
          <q-tab
            v-for="section in legendSections"
            :key="section.title"
            :name="section.title"
            :label="section.title"
          />
        </q-tabs>
        <q-separator />
      </div>

      <div class="subtab-content bg-transparent">
        <!-- Multiple sections: use tab panels -->
        <q-tab-panels
          v-if="hasMultipleLegendSections"
          v-model="infoSubTab"
          animated
          class="subtab-panels bg-transparent"
        >
          <q-tab-panel
            v-for="section in legendSections"
            :key="section.title"
            :name="section.title"
            class="q-pa-md bg-transparent"
          >
            <WdLegendSection :section="section" />
          </q-tab-panel>
        </q-tab-panels>

        <!-- Single section: render directly -->
        <div v-else class="q-pa-md">
          <WdLegendSection v-if="legendSections[0]" :section="legendSections[0]" />
        </div>
      </div>

      <!-- Links section -->
      <WdOverlayConfigLinks :links="legendLinks" />

      <!-- Attribution section -->
      <WdOverlayConfigAttribution :attribution="legendAttribution" />
    </q-tab-panel>

    <!-- Filter Panel -->
    <q-tab-panel name="filter" v-if="hasFilters" class="bg-transparent">
      <slot
        name="filter-content"
        :get-filter-value="getFilterValue"
        :set-filter-value="setFilterValue"
      >
        <!-- Default filter content if no slot provided -->
      </slot>

      <!-- Reset button (optional) -->
      <template v-if="showResetButton">
        <q-separator class="q-mb-md" />
        <div class="row justify-end">
          <q-btn flat label="Zurücksetzen" @click="handleReset" size="sm" />
        </div>
      </template>
    </q-tab-panel>

    <!-- Settings Panel -->
    <q-tab-panel name="settings" v-if="hasSettings" class="bg-transparent">
      <div class="text-body2 text-grey-7">Einstellungen werden in Phase 4+ implementiert.</div>
    </q-tab-panel>
  </q-tab-panels>
</template>

<style scoped lang="scss">
// Legend panel styles
.legend-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sticky-subtabs {
  position: sticky;
  top: 0;
  background: transparent;
  z-index: 1;
}

.subtab-content {
  flex: 1;
  overflow-y: auto;
}

.subtab-panels {
  height: 100%;
}

// Make tab panels transparent
.transparent-panels {
  background: transparent;

  :deep(.q-tab-panels__content) {
    background: transparent;
  }

  :deep(.q-panel) {
    background: transparent;
  }
}
</style>
