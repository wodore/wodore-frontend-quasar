<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useOverlayStore } from '@stores/map/overlay-store';
import WdOverlayConfigFilter from './WdOverlayConfigFilter.vue';
import WdOverlayConfigPanels from './WdOverlayConfigPanels.vue';

interface Props {
  overlayName: string;
  modelValue?: boolean;
  initialTab?: string;
  showAsPage?: boolean; // New prop: render as page instead of dialog
  title?: string; // Title for page mode (passed from WdMapMenu)
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  showAsPage: false,
  title: undefined,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const $q = useQuasar();
const configStore = useOverlayConfigStore();
const overlayStore = useOverlayStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
});

const overlay = computed(() => {
  // Use type assertion to avoid deep type instantiation with Pinia reactive types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlays = overlayStore.overlays as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return overlays.find((o: any) => o.name === props.overlayName);
});

const overlayConfig = computed(() => overlay.value?.config);
const hasFilters = computed(() => (overlayConfig.value?.filters?.length ?? 0) > 0);
const hasSettings = computed(() => (overlayConfig.value?.settings?.length ?? 0) > 0);
const hasLegend = computed(() => overlayConfig.value?.legend !== undefined);

const hasActiveFilters = computed(() => {
  if (!overlayConfig.value?.filters || overlayConfig.value.filters.length === 0) {
    return false;
  }

  for (const filter of overlayConfig.value.filters) {
    const value = configStore.getFilterValue(props.overlayName, filter.id);

    if (Array.isArray(value)) {
      // @ts-expect-error - filter.options types are inferred correctly at runtime
      const allOptions = filter.options?.map(opt => opt.value) || [];
      // Empty array means all selected (default), full array also means all selected
      if (!value || value.length === 0 || value.length === allOptions.length) {
        continue;
      }
      console.debug(
        '[WdOverlayConfig] Active filter detected:',
        filter.id,
        value.length,
        'of',
        allOptions.length
      );
      return true;
    }

    if (value !== filter.defaultValue) {
      console.debug('[WdOverlayConfig] Active filter detected:', filter.id, value);
      return true;
    }
  }

  return false;
});

// Determine initial tab based on prop or default logic
function getInitialTab(): string {
  if (props.initialTab) {
    // Use provided initial tab if valid
    if (props.initialTab === 'filter' && hasFilters.value) return 'filter';
    if (props.initialTab === 'legend' && hasLegend.value) return 'legend';
    if (props.initialTab === 'settings' && hasSettings.value) return 'settings';
  }
  // Default: filter if available, otherwise legend, otherwise settings
  if (hasFilters.value) return 'filter';
  if (hasLegend.value) return 'legend';
  if (hasSettings.value) return 'settings';
  return 'legend'; // Fallback
}

const activeTab = ref(getInitialTab());

// Watch for initialTab changes and update activeTab
watch(
  () => props.initialTab,
  () => {
    activeTab.value = getInitialTab();
  }
);

// Get display name for overlay
const overlayLabel = computed(() => {
  return overlay.value?.label || props.overlayName;
});

function getTabLabel(tab: string): string {
  const tabLabels: Record<string, string> = {
    filter: 'Filter',
    legend: 'Info',
    settings: 'Einstellungen',
  };
  return tabLabels[tab] || tab;
}

function resetDefaults() {
  configStore.resetOverlayPreferences(props.overlayName);
  $q.notify({
    type: 'positive',
    message: 'Einstellungen zurückgesetzt',
    position: 'bottom',
    timeout: 1500,
  });
}
</script>

<template>
  <!-- DIALOG MODE (default) -->
  <q-dialog
    v-if="!showAsPage"
    v-model="isOpen"
    position="left"
    seamless
    transition-show="slide-right"
    transition-hide="slide-left"
  >
    <q-card class="overlay-config-dialog column">
      <!-- Header toolbar with tabs and close button -->
      <q-toolbar class="bg-grey-3 flex-shrink-0">
        <q-tabs v-model="activeTab" dense compact class="no-padding">
          <q-tab name="legend" v-if="hasLegend" icon="wd-info-outline" />
          <q-tab
            name="filter"
            v-if="hasFilters"
            :icon="hasActiveFilters ? 'wd-filter' : 'wd-filter-outline'"
          />
          <q-tab name="settings" v-if="hasSettings" icon="wd-edit" />
        </q-tabs>
        <q-space />
        <q-btn icon="wd-close" flat round dense v-close-popup />
      </q-toolbar>

      <!-- Title and subtitle section -->
      <div class="q-px-md q-py-xs bg-primary text-white flex-shrink-0">
        <div class="text-overline text-caption text-grey-3">{{ getTabLabel(activeTab) }}</div>
        <div class="text-h6">{{ overlayLabel }}</div>
      </div>

      <q-separator />

      <!-- Scrollable content area -->
      <q-scroll-area
        class="col q-px-md"
        :thumb-style="{
          width: '6px',
          backgroundColor: '#998019',
          opacity: '0.5',
          borderRadius: '8px 0 0 8px',
        }"
      >
        <WdOverlayConfigPanels
          :active-tab="activeTab"
          :overlay-name="overlayName"
          :overlay-config="overlayConfig"
          :has-filters="hasFilters"
          :has-legend="hasLegend"
          :has-settings="hasSettings"
          @reset="resetDefaults"
        >
          <template #filter-content>
            <WdOverlayConfigFilter
              v-for="filter in overlayConfig?.filters"
              :key="filter.id"
              :overlay-name="overlayName"
              :filter="filter"
              :model-value="configStore.getFilterValue(overlayName, filter.id)"
              @update:model-value="configStore.setFilterValue(overlayName, filter.id, $event)"
            />
          </template>
        </WdOverlayConfigPanels>
      </q-scroll-area>

      <div class="q-pa-md">
        <q-separator class="q-mb-md" />
        <div class="row justify-end">
          <q-btn flat label="Zurücksetzen" @click="resetDefaults" size="sm" />
        </div>
      </div>
    </q-card>
  </q-dialog>

  <!-- PAGE MODE (for use in drawer) -->
  <div v-else class="overlay-config-page column">
    <!-- Header toolbar with tabs and close button -->
    <q-toolbar class="bg-grey-3 flex-shrink-0">
      <q-tabs v-model="activeTab" dense compact class="no-padding">
        <q-tab name="legend" v-if="hasLegend" icon="wd-info-outline" />
        <q-tab
          name="filter"
          v-if="hasFilters"
          :icon="hasActiveFilters ? 'wd-filter' : 'wd-filter-outline'"
        />
        <q-tab name="settings" v-if="hasSettings" icon="wd-edit" />
      </q-tabs>
      <q-space />
      <q-btn flat dense round icon="wd-close" @click="emit('close')" />
    </q-toolbar>

    <!-- Title and subtitle section -->
    <div class="q-px-md q-py-xs bg-grey-3 flex-shrink-0">
      <div class="text-overline text-caption text-grey-7">{{ getTabLabel(activeTab) }}</div>
      <div class="text-h6">{{ title || overlayLabel }}</div>
    </div>

    <q-separator />

    <!-- Scrollable content area -->
    <q-scroll-area
      class="col q-px-md"
      :thumb-style="{
        width: '6px',
        backgroundColor: '#998019',
        opacity: '0.5',
        borderRadius: '8px 0 0 8px',
      }"
    >
      <WdOverlayConfigPanels
        :active-tab="activeTab"
        :overlay-name="overlayName"
        :overlay-config="overlayConfig"
        :has-filters="hasFilters"
        :has-legend="hasLegend"
        :has-settings="hasSettings"
        :show-reset-button="true"
        @reset="resetDefaults"
      >
        <template #filter-content>
          <WdOverlayConfigFilter
            v-for="filter in overlayConfig?.filters"
            :key="filter.id"
            :overlay-name="overlayName"
            :filter="filter"
            :model-value="configStore.getFilterValue(overlayName, filter.id)"
            @update:model-value="configStore.setFilterValue(overlayName, filter.id, $event)"
          />
        </template>
      </WdOverlayConfigPanels>
    </q-scroll-area>

    <div class="q-pa-md">
      <q-separator class="q-mb-md" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Main containers - Quasar's column class handles flex
.overlay-config-dialog {
  width: 400px;
  max-width: 90vw;
  height: 100vh;
}

.overlay-config-page {
  height: 100%;
}

// Ensure non-scrollable elements don't grow/shrink
.flex-shrink-0 {
  flex-shrink: 0;
}

// Tab padding adjustments
.no-padding {
  padding: 0;
  margin: 0;

  :deep(.q-tab) {
    padding: 0 8px;
    margin: 0;
  }
}
</style>
