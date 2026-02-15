<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { overlayConfigs } from '@stores/map/overlay-configs';
import WdOverlayConfigFilter from './WdOverlayConfigFilter.vue';

interface Props {
  overlayName: string;
  modelValue?: boolean;
  initialTab?: string;
  showAsPage?: boolean; // New prop: render as page instead of dialog
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  showAsPage: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const $q = useQuasar();
const configStore = useOverlayConfigStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: val => emit('update:modelValue', val),
});

const overlayConfig = computed(() => overlayConfigs[props.overlayName]);
const hasFilters = computed(() => (overlayConfig.value?.filters?.length ?? 0) > 0);
const hasSettings = computed(() => (overlayConfig.value?.settings?.length ?? 0) > 0);
const hasLegend = computed(() => overlayConfig.value?.legend !== undefined);

// Check for specific legend sections
const hutTypesSection = computed(() =>
  overlayConfig.value?.legend?.sections?.find(s => s.title === 'Hüttentypen')
);
const availabilitySection = computed(() =>
  overlayConfig.value?.legend?.sections?.find(s => s.title === 'Verfügbarkeit')
);
const hasHutTypes = computed(() => hutTypesSection.value !== undefined);
const hasAvailability = computed(() => availabilitySection.value !== undefined);

// Sub-tab for Info section
const infoSubTab = ref('hut-types');

const hasActiveFilters = computed(() => {
  if (!overlayConfig.value?.filters || overlayConfig.value.filters.length === 0) {
    return false;
  }

  for (const filter of overlayConfig.value.filters) {
    const value = configStore.getFilterValue(props.overlayName, filter.id);

    if (Array.isArray(value)) {
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
  const labelMap: Record<string, string> = {
    huts: 'Hütten',
    'transport-stops': 'Haltestellen',
    hiking: 'Wanderwege',
    mtb: 'Mountainbike',
    cycling: 'Fahrrad',
  };
  return labelMap[props.overlayName] || props.overlayName;
});

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
    <q-card style="width: 400px; max-width: 90vw; height: 100vh" class="flex-column">
      <div class="q-pa-md">
        <div class="row items-center q-mb-md">
          <div class="text-h6">{{ overlayLabel }}</div>
          <q-space />
          <q-btn icon="wd-close" flat round dense v-close-popup />
        </div>

        <q-tabs v-model="activeTab" class="text-primary" dense inline-label>
          <q-tab
            name="filter"
            label="Filter"
            v-if="hasFilters"
            :icon="hasActiveFilters ? 'wd-filter' : 'wd-filter-outline'"
          />
          <q-tab name="legend" label="Info" v-if="hasLegend" icon="wd-info-outline" />
          <q-tab name="settings" label="Einstellungen" v-if="hasSettings" icon="wd-edit" />
        </q-tabs>
      </div>

      <div class="col q-px-md" style="overflow: hidden">
        <q-tab-panels v-model="activeTab" animated class="fit-height bg-transparent">
          <q-tab-panel name="filter" v-if="hasFilters" class="bg-transparent">
            <WdOverlayConfigFilter
              v-for="filter in overlayConfig.filters"
              :key="filter.id"
              :overlay-name="overlayName"
              :filter="filter"
              :model-value="configStore.getFilterValue(overlayName, filter.id)"
              @update:model-value="configStore.setFilterValue(overlayName, filter.id, $event)"
            />
          </q-tab-panel>

          <q-tab-panel name="legend" v-if="hasLegend" class="q-pa-none legend-panel">
            <!-- Sub-tabs for Info section (sticky) -->
            <div class="sticky-subtabs">
              <q-tabs
                v-model="infoSubTab"
                dense
                no-caps
                class="text-grey-8"
                indicator-color="primary"
              >
                <q-tab name="hut-types" label="Hüttentypen" v-if="hasHutTypes" />
                <q-tab name="availability" label="Verfügbarkeit" v-if="hasAvailability" />
              </q-tabs>
              <q-separator />
            </div>

            <div class="subtab-content bg-transparent">
              <q-tab-panels v-model="infoSubTab" animated class="subtab-panels bg-transparent">
                <q-tab-panel name="hut-types" v-if="hasHutTypes" class="q-pa-none bg-transparent">
                  <div v-if="hutTypesSection">
                    <div
                      v-if="hutTypesSection.description"
                      class="text-caption text-grey-7 q-pa-md q-pb-sm"
                    >
                      {{ hutTypesSection.description }}
                    </div>

                    <q-list class="bg-transparent">
                      <q-item
                        v-for="(item, idx) in hutTypesSection.items"
                        :key="idx"
                        class="legend-item"
                      >
                        <!-- Show both symbols as avatars (for hut types) -->
                        <q-item-section avatar v-if="item.metadata?.iconDetailed">
                          <q-avatar size="38px" square>
                            <img
                              :src="item.metadata.iconDetailed"
                              :alt="item.label + ' (detailliert)'"
                            />
                          </q-avatar>
                        </q-item-section>

                        <q-item-section avatar v-if="item.metadata?.iconSimple">
                          <q-avatar size="28px" square>
                            <img :src="item.metadata.iconSimple" :alt="item.label + ' (einfach)'" />
                          </q-avatar>
                        </q-item-section>

                        <q-item-section>
                          <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
                          <q-item-label
                            caption
                            v-if="item.description"
                            class="text-caption q-mt-xs"
                          >
                            {{ item.description }}
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-tab-panel>

                <q-tab-panel
                  name="availability"
                  v-if="hasAvailability"
                  class="q-pa-none bg-transparent"
                >
                  <div v-if="availabilitySection">
                    <div
                      v-if="availabilitySection.description"
                      class="text-caption text-grey-7 q-pa-md q-pb-sm"
                    >
                      {{ availabilitySection.description }}
                    </div>

                    <q-list class="bg-transparent">
                      <q-item
                        v-for="(item, idx) in availabilitySection.items"
                        :key="idx"
                        class="legend-item"
                      >
                        <!-- Show single icon (for availability) -->
                        <q-item-section avatar v-if="item.icon">
                          <q-avatar size="38px" square>
                            <img :src="item.icon" :alt="item.label" />
                          </q-avatar>
                        </q-item-section>

                        <!-- Show color swatch (for availability) -->
                        <q-item-section avatar v-if="item.color">
                          <div
                            :style="{
                              width: '32px',
                              height: '32px',
                              backgroundColor: item.color,
                              borderRadius: '50%',
                            }"
                          />
                        </q-item-section>

                        <q-item-section>
                          <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
                          <q-item-label
                            caption
                            v-if="item.description"
                            class="text-caption q-mt-xs"
                          >
                            {{ item.description }}
                          </q-item-label>
                        </q-item-section>
                      </q-item>
                    </q-list>
                  </div>
                </q-tab-panel>
              </q-tab-panels>
            </div>
          </q-tab-panel>

          <q-tab-panel name="settings" v-if="hasSettings" class="bg-transparent">
            <div class="text-body2 text-grey-7">
              Einstellungen werden in Phase 4+ implementiert.
            </div>
            <!-- Phase 4+: <WdOverlayConfigSettings :overlay-name="overlayName" /> -->
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <div class="q-pa-md">
        <q-separator class="q-mb-md" />
        <div class="row justify-end">
          <q-btn flat label="Zurücksetzen" @click="resetDefaults" size="sm" />
        </div>
      </div>
    </q-card>
  </q-dialog>

  <!-- PAGE MODE (for use in drawer) -->
  <div v-else class="overlay-config-page flex-column" style="height: 100%">
    <div class="q-pa-md">
      <q-tabs v-model="activeTab" class="text-primary" dense inline-label>
        <q-tab
          name="filter"
          label="Filter"
          v-if="hasFilters"
          :icon="hasActiveFilters ? 'wd-filter' : 'wd-filter-outline'"
        />
        <q-tab name="legend" label="Info" v-if="hasLegend" icon="wd-info-outline" />
        <q-tab name="settings" label="Einstellungen" v-if="hasSettings" icon="wd-edit" />
      </q-tabs>
    </div>

    <div class="col q-px-md" style="overflow: hidden">
      <q-tab-panels v-model="activeTab" animated class="fit-height bg-transparent">
        <q-tab-panel name="filter" v-if="hasFilters" class="bg-transparent">
          <WdOverlayConfigFilter
            v-for="filter in overlayConfig.filters"
            :key="filter.id"
            :overlay-name="overlayName"
            :filter="filter"
            :model-value="configStore.getFilterValue(overlayName, filter.id)"
            @update:model-value="configStore.setFilterValue(overlayName, filter.id, $event)"
          />
        </q-tab-panel>

        <q-tab-panel name="legend" v-if="hasLegend" class="q-pa-none legend-panel">
          <!-- Sub-tabs for Info section (sticky) -->
          <div class="sticky-subtabs">
            <q-tabs
              v-model="infoSubTab"
              dense
              no-caps
              class="text-grey-8"
              indicator-color="primary"
            >
              <q-tab name="hut-types" label="Hüttentypen" v-if="hasHutTypes" />
              <q-tab name="availability" label="Verfügbarkeit" v-if="hasAvailability" />
            </q-tabs>
            <q-separator />
          </div>

          <div class="subtab-content bg-transparent">
            <q-tab-panels v-model="infoSubTab" animated class="subtab-panels bg-transparent">
              <q-tab-panel name="hut-types" v-if="hasHutTypes" class="q-pa-none bg-transparent">
                <div v-if="hutTypesSection">
                  <div
                    v-if="hutTypesSection.description"
                    class="text-caption text-grey-7 q-pa-md q-pb-sm"
                  >
                    {{ hutTypesSection.description }}
                  </div>

                  <q-list class="bg-transparent">
                    <q-item
                      v-for="(item, idx) in hutTypesSection.items"
                      :key="idx"
                      class="legend-item"
                    >
                      <q-item-section avatar v-if="item.metadata?.iconDetailed">
                        <q-avatar size="38px" square>
                          <img
                            :src="item.metadata.iconDetailed"
                            :alt="item.label + ' (detailliert)'"
                          />
                        </q-avatar>
                      </q-item-section>

                      <q-item-section avatar v-if="item.metadata?.iconSimple">
                        <q-avatar size="28px" square>
                          <img :src="item.metadata.iconSimple" :alt="item.label + ' (einfach)'" />
                        </q-avatar>
                      </q-item-section>

                      <q-item-section>
                        <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
                        <q-item-label caption v-if="item.description" class="text-caption q-mt-xs">
                          {{ item.description }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-tab-panel>

              <q-tab-panel
                name="availability"
                v-if="hasAvailability"
                class="q-pa-none bg-transparent"
              >
                <div v-if="availabilitySection">
                  <div
                    v-if="availabilitySection.description"
                    class="text-caption text-grey-7 q-pa-md q-pb-sm"
                  >
                    {{ availabilitySection.description }}
                  </div>

                  <q-list class="bg-transparent">
                    <q-item
                      v-for="(item, idx) in availabilitySection.items"
                      :key="idx"
                      class="legend-item"
                    >
                      <q-item-section avatar v-if="item.icon">
                        <q-avatar size="38px" square>
                          <img :src="item.icon" :alt="item.label" />
                        </q-avatar>
                      </q-item-section>

                      <q-item-section avatar v-if="item.color">
                        <div
                          :style="{
                            width: '32px',
                            height: '32px',
                            backgroundColor: item.color,
                            borderRadius: '50%',
                          }"
                        />
                      </q-item-section>

                      <q-item-section>
                        <q-item-label class="text-weight-medium">{{ item.label }}</q-item-label>
                        <q-item-label caption v-if="item.description" class="text-caption q-mt-xs">
                          {{ item.description }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </q-tab-panel>

        <q-tab-panel name="settings" v-if="hasSettings">
          <div class="text-body2 text-grey-7">Einstellungen werden in Phase 4+ implementiert.</div>
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <div class="q-pa-md">
      <q-separator class="q-mb-md" />
      <div class="row justify-end">
        <q-btn flat label="Zurücksetzen" @click="resetDefaults" size="sm" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.flex-column {
  display: flex;
  flex-direction: column;
}

.fit-height {
  height: 100%;
}

.q-tab-panel {
  height: 100%;
  padding: 0;
}

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

.legend-item {
  padding: 12px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.legend-item:last-child {
  border-bottom: none;
}
</style>
