/**
 * Overlay Configuration Store
 *
 * Manages user preferences for overlay filters and settings.
 * Handles fetching categories from backend and applying filters to map.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { LocalStorage } from 'quasar';
import { useDebounceFn } from '@vueuse/core';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';

import { overlayConfigs, hutsConfig } from '@stores/map/overlay-configs';
import type {
  OverlayPreferences,
  HutCategory,
  AvailabilityCategory,
  FilterDefinition,
  FilterOption,
} from '@stores/map/overlay-configs/types';
import { clientWodore } from '@clients/index';

const PREFERENCES_KEY = 'overlayPreferences';

export const useOverlayConfigStore = defineStore('overlayConfig', () => {
  // State
  // =====

  const preferences = ref<OverlayPreferences>(LocalStorage.getItem(PREFERENCES_KEY) || {});

  const hutCategories = ref<HutCategory[]>([]);
  const availabilityCategories = ref<AvailabilityCategory[]>([]);
  const categoriesLoading = ref(false);
  const categoriesError = ref<string | null>(null);

  // Computed
  // ========

  const hasHutCategories = computed(() => hutCategories.value.length > 0);

  // Categories Fetching
  // ===================

  async function fetchHutCategories() {
    if (hutCategories.value.length > 0) {
      // Already fetched
      return;
    }

    categoriesLoading.value = true;
    categoriesError.value = null;

    try {
      const { data, error } = await clientWodore.GET('/v1/categories/list/{parent_slug}', {
        params: {
          path: { parent_slug: 'accommodation' },
          query: {
            lang: 'de',
            is_active: true,
            media_mode: 'absolute',
          },
        },
      });

      if (error) {
        console.error('[OverlayConfigStore] Error fetching hut categories:', error);
        categoriesError.value = 'Failed to fetch hut categories';
        return;
      }

      if (data) {
        hutCategories.value = data as HutCategory[];
        console.debug(`[OverlayConfigStore] Fetched ${hutCategories.value.length} hut categories`);
        console.debug('[OverlayConfigStore] First category:', hutCategories.value[0]);

        // Populate hut type filter options and legend
        populateHutTypeFilterOptions();

        // Fetch availability categories
        fetchAvailabilityCategories();
      }
    } catch (err) {
      console.error('[OverlayConfigStore] Exception fetching hut categories:', err);
      categoriesError.value = 'Failed to fetch hut categories';
    } finally {
      categoriesLoading.value = false;
    }
  }

  function populateHutTypeFilterOptions() {
    const hutTypesFilter = hutsConfig.filters?.find((f: FilterDefinition) => f.id === 'hutTypes');
    if (!hutTypesFilter) {
      console.warn('[OverlayConfigStore] hutTypes filter not found in hutsConfig');
      return;
    }

    // Map categories to filter options
    hutTypesFilter.options = hutCategories.value.map(
      (category): FilterOption => ({
        value: category.identifier,
        label: category.name || category.slug,
        icon: category.symbol_detailed || category.symbol_simple || undefined,
        description: category.description || undefined,
        iconDetailed: category.symbol_detailed || undefined,
        iconSimple: category.symbol_simple || undefined,
      })
    );

    console.debug(
      `[OverlayConfigStore] Populated ${hutTypesFilter.options.length} options for hutTypes filter`
    );
    console.debug('[OverlayConfigStore] First filter option:', hutTypesFilter.options[0]);
  }

  async function fetchAvailabilityCategories() {
    try {
      const { data, error } = await clientWodore.GET('/v1/categories/list/{parent_slug}', {
        params: {
          path: { parent_slug: 'availability' },
          query: {
            lang: 'de',
            is_active: true,
            media_mode: 'absolute',
          },
        },
      });

      if (error) {
        console.error('[OverlayConfigStore] Error fetching availability categories:', error);
        return;
      }

      if (data) {
        availabilityCategories.value = data as AvailabilityCategory[];
        console.debug(
          `[OverlayConfigStore] Fetched ${availabilityCategories.value.length} availability categories`
        );

        // Populate legend with both sections
        populateHutLegend();
      }
    } catch (err) {
      console.error('[OverlayConfigStore] Exception fetching availability categories:', err);
    }
  }

  function populateHutLegend() {
    if (!hutsConfig.legend) {
      hutsConfig.legend = { sections: [] };
    }

    const sections = [];

    // Hut types section
    sections.push({
      title: 'Hüttentypen',
      description: 'Verschiedene Unterkunftsarten',
      items: hutCategories.value.map(category => ({
        label: category.name || category.slug,
        description: category.description || undefined,
        icon: category.symbol_detailed || category.symbol_simple || undefined,
        metadata: {
          iconDetailed: category.symbol_detailed,
          iconSimple: category.symbol_simple,
        },
      })),
    });

    // Availability section (if loaded)
    if (availabilityCategories.value.length > 0) {
      sections.push({
        title: 'Verfügbarkeit',
        description: 'Belegungsstatus',
        items: availabilityCategories.value.map(category => ({
          label: category.name || category.slug,
          description: category.description || undefined,
          icon: category.symbol_detailed || category.symbol_simple || undefined,
          color: category.color || undefined,
        })),
      });
    }

    hutsConfig.legend.sections = sections;

    console.debug(`[OverlayConfigStore] Populated legend with ${sections.length} sections`);
  }

  // Filter Management
  // =================

  function getFilterValue(overlayName: string, filterId: string): unknown {
    const config = overlayConfigs[overlayName];
    const filterDef = config?.filters?.find((f: FilterDefinition) => f.id === filterId);

    return preferences.value[overlayName]?.filters?.[filterId] ?? filterDef?.defaultValue;
  }

  function setFilterValue(overlayName: string, filterId: string, value: unknown) {
    // Update preferences
    if (!preferences.value[overlayName]) {
      preferences.value[overlayName] = {};
    }
    if (!preferences.value[overlayName].filters) {
      preferences.value[overlayName].filters = {};
    }
    preferences.value[overlayName].filters![filterId] = value;

    // Save to LocalStorage
    LocalStorage.set(PREFERENCES_KEY, preferences.value);

    console.debug(
      `[OverlayConfigStore] Filter '${filterId}' set to:`,
      value,
      `for overlay '${overlayName}'`
    );

    // Apply filter with debounce
    debouncedApplyFilter(overlayName, filterId, value);
  }

  // Filter Application (with debounce)
  // ===================================

  const debouncedApplyFilter = useDebounceFn(
    (overlayName: string, filterId: string, value: unknown) => {
      applyFilter(overlayName, filterId, value);
    },
    150
  );

  function applyFilter(overlayName: string, filterId: string, value: unknown) {
    console.debug(
      `[OverlayConfigStore] Applying filter '${filterId}' for overlay '${overlayName}':`,
      value
    );

    if (overlayName === 'huts' && filterId === 'hutTypes') {
      applyHutTypeFilter(value as string[]);
    }
  }

  function applyHutTypeFilter(selectedIdentifiers: string[]) {
    const mapRef = useMap();

    if (!mapRef.map) {
      console.warn('[OverlayConfigStore] Map not available, cannot apply hut type filter');
      return;
    }

    const hutLayers = [
      'wd-huts',
      'wd-huts-selected',
      'wd-huts-occupation',
      'wd-huts-occupation-day0',
      'wd-huts-occupation-day1',
      'wd-huts-occupation-day2',
      'wd-huts-occupation-day3',
    ];

    // If empty or undefined, default to showing all huts (no filter)
    if (!selectedIdentifiers || selectedIdentifiers.length === 0) {
      // Remove filter to show all huts
      for (const layerId of hutLayers) {
        const layer = mapRef.map.getLayer(layerId);
        if (layer) {
          mapRef.map.setFilter(layerId, null);
          console.debug(`[OverlayConfigStore] Removed filter from layer '${layerId}' (show all)`);
        }
      }
    } else {
      // Show only selected types
      const filter: ExpressionSpecification = [
        'in',
        ['get', 'type_standard_identifier'],
        ['literal', selectedIdentifiers],
      ];

      for (const layerId of hutLayers) {
        const layer = mapRef.map.getLayer(layerId);
        if (layer) {
          mapRef.map.setFilter(layerId, filter);
          console.debug(
            `[OverlayConfigStore] Applied filter to layer '${layerId}' with ${selectedIdentifiers.length} types`
          );
        }
      }
    }
  }

  function reapplyAllFilters() {
    console.debug('[OverlayConfigStore] Reapplying all filters (e.g., after basemap switch)');

    for (const overlayName in preferences.value) {
      const filters = preferences.value[overlayName].filters;
      if (filters) {
        for (const filterId in filters) {
          applyFilter(overlayName, filterId, filters[filterId]);
        }
      }
    }
  }

  // Settings Management (Phase 4+)
  // ===============================

  function getSettingValue(overlayName: string, settingId: string): unknown {
    const config = overlayConfigs[overlayName];
    const settingDef = config?.settings?.find(s => s.id === settingId);

    return preferences.value[overlayName]?.settings?.[settingId] ?? settingDef?.defaultValue;
  }

  function setSettingValue(overlayName: string, settingId: string, value: unknown) {
    // Update preferences
    if (!preferences.value[overlayName]) {
      preferences.value[overlayName] = {};
    }
    if (!preferences.value[overlayName].settings) {
      preferences.value[overlayName].settings = {};
    }
    preferences.value[overlayName].settings![settingId] = value;

    // Save to LocalStorage
    LocalStorage.set(PREFERENCES_KEY, preferences.value);

    console.debug(
      `[OverlayConfigStore] Setting '${settingId}' set to:`,
      value,
      `for overlay '${overlayName}'`
    );

    // Apply setting (Phase 4+)
    // applySetting(overlayName, settingId, value);
  }

  function reapplyAllSettings() {
    console.debug('[OverlayConfigStore] Reapplying all settings (e.g., after basemap switch)');

    // Phase 4+: Implement setting reapplication
    // for (const overlayName in preferences.value) {
    //   const settings = preferences.value[overlayName].settings;
    //   if (settings) {
    //     for (const settingId in settings) {
    //       applySetting(overlayName, settingId, settings[settingId]);
    //     }
    //   }
    // }
  }

  // Reset
  // =====

  function resetOverlayPreferences(overlayName: string) {
    console.debug(`[OverlayConfigStore] Resetting preferences for overlay '${overlayName}'`);

    if (preferences.value[overlayName]) {
      delete preferences.value[overlayName];
      LocalStorage.set(PREFERENCES_KEY, preferences.value);
    }

    // Reapply default filters/settings
    reapplyAllFilters();
    reapplyAllSettings();
  }

  function resetAllPreferences() {
    console.debug('[OverlayConfigStore] Resetting all overlay preferences');

    preferences.value = {};
    LocalStorage.set(PREFERENCES_KEY, preferences.value);

    // Reapply defaults
    reapplyAllFilters();
    reapplyAllSettings();
  }

  // Initialization
  // ==============

  // Fetch hut categories on store initialization
  fetchHutCategories();

  return {
    // State
    preferences,
    hutCategories,
    categoriesLoading,
    categoriesError,

    // Computed
    hasHutCategories,

    // Categories
    fetchHutCategories,

    // Filters
    getFilterValue,
    setFilterValue,
    reapplyAllFilters,

    // Settings
    getSettingValue,
    setSettingValue,
    reapplyAllSettings,

    // Reset
    resetOverlayPreferences,
    resetAllPreferences,
  };
});
