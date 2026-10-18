/**
 * Overlay Configuration Store
 *
 * Manages user preferences for overlay filters and settings.
 * Handles fetching categories from backend and applying filters to map.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { storageGet, storageSet } from '@services/storage';
import { useDebounceFn } from '@vueuse/core';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';

import { useOverlayStore } from '@stores/map/overlay-store';
import { useMapCatalogStore } from '@stores/map/map-catalog-store';
import { currentLocale } from '@services/locale';
import type {
  OverlayPreferences,
  CategoryItem,
  CategoryConfig,
  CategoryConfigObject,
  FilterDefinition,
  FilterOption,
  OverlayConfig,
  OverlayValue,
} from '@stores/map/overlay-configs/types';
import { isOverlayValue } from '@stores/map/overlay-configs/types';
import { clientWodore } from '@clients/index';

const PREFERENCES_KEY = 'overlayPreferences';

export const useOverlayConfigStore = defineStore('overlayConfig', () => {
  // Get overlay store for accessing overlay definitions
  const overlayStore = useOverlayStore();

  // State
  // =====

  const preferences = ref<OverlayPreferences>(storageGet(PREFERENCES_KEY) || {});

  // Generic category cache: Map<categorySlug, CategoryItem[]>
  const categoryCache = ref<Map<string, CategoryItem[]>>(new Map());
  const categoriesLoading = ref(false);
  const categoriesError = ref<string | null>(null);

  // Computed
  // ========

  const hasCategories = computed(() => categoryCache.value.size > 0);

  /**
   * Get overlay config by overlay name from the unified overlay store
   */
  function getOverlayConfig(overlayName: string): OverlayConfig | undefined {
    // Break the type inference chain (OverlaySwitchItem -> maplibre style
    // specs triggers TS2589 through the store ref) — same pattern as
    // getOverlaysInRenderOrder in WdOverlayControl.
    // SAFETY: the overlay store's real shape is
    // { overlays: OverlaySwitchItem[] }; this narrowing cast only reads
    // name/config off each item — fields every factory guarantees.
    const overlays = (
      overlayStore as unknown as {
        overlays: Array<{ name: string; config?: OverlayConfig }>;
      }
    ).overlays;
    const overlay = overlays.find(o => o.name === overlayName);
    return overlay?.config;
  }

  // Generic Category Fetching
  // ==========================

  /**
   * Resolve category source to CategoryItem array
   * Supports:
   * - string: Fetch from backend API (e.g., 'accommodation')
   * - CategoryItem[]: Use directly
   * - CategoryConfigObject: Fetch with custom config
   */
  async function resolveCategories(categorySource: CategoryConfig): Promise<CategoryItem[]> {
    // Case 1: Direct data array
    if (Array.isArray(categorySource)) {
      console.debug(
        `[OverlayConfigStore] Using ${categorySource.length} directly provided categories`
      );
      return categorySource;
    }

    // Case 2: String shorthand (fetch from backend)
    if (typeof categorySource === 'string') {
      return fetchCategoriesFromBackend({
        slug: categorySource,
      });
    }

    // Case 3: Full config object
    return fetchCategoriesFromBackend(categorySource);
  }

  /**
   * Fetch categories from backend API
   */
  async function fetchCategoriesFromBackend(config: CategoryConfigObject): Promise<CategoryItem[]> {
    const cacheKey = config.slug;

    // Check cache
    if (categoryCache.value.has(cacheKey)) {
      console.debug(`[OverlayConfigStore] Using cached categories for '${cacheKey}'`);
      return categoryCache.value.get(cacheKey)!;
    }

    categoriesLoading.value = true;
    categoriesError.value = null;

    try {
      const endpoint = config.apiEndpoint || '/v1/categories/list/{parent_slug}';

      console.debug(`[OverlayConfigStore] Fetching categories for '${cacheKey}' from ${endpoint}`);

      const { data, error } = await clientWodore.GET(
        endpoint as '/v1/categories/list/{parent_slug}',
        {
          params: {
            path: { parent_slug: config.slug },
            query: {
              lang: currentLocale(),
              is_active: true,
              media_mode: 'absolute',
            },
          },
        }
      );

      if (error) {
        console.error(`[OverlayConfigStore] Error fetching categories for '${cacheKey}':`, error);
        categoriesError.value = `Failed to fetch categories for ${cacheKey}`;
        return [];
      }

      if (data) {
        const categories = data as CategoryItem[];
        categoryCache.value.set(cacheKey, categories);
        console.debug(
          `[OverlayConfigStore] Fetched ${categories.length} categories for '${cacheKey}'`
        );
        console.debug(`[OverlayConfigStore] First category:`, categories[0]);
        return categories;
      }

      return [];
    } catch (err) {
      console.error(`[OverlayConfigStore] Exception fetching categories for '${cacheKey}':`, err);
      categoriesError.value = `Failed to fetch categories for ${cacheKey}`;
      return [];
    } finally {
      categoriesLoading.value = false;
    }
  }

  /**
   * Populate filter options from category API
   */
  async function populateFilterFromCategory(overlayName: string, filterId: string) {
    const config = getOverlayConfig(overlayName);
    const filter = config?.filters?.find((f: FilterDefinition) => f.id === filterId);

    if (!filter?.category) {
      console.debug(
        `[OverlayConfigStore] Filter '${filterId}' has no category config, skipping population`
      );
      return;
    }

    const categoryDesc =
      typeof filter.category === 'string'
        ? filter.category
        : Array.isArray(filter.category)
          ? `${filter.category.length} items`
          : filter.category.slug;
    console.debug(
      `[OverlayConfigStore] Populating filter '${filterId}' from category '${categoryDesc}'`
    );

    // Resolve categories (fetch from backend or use direct data)
    const categories = await resolveCategories(filter.category);

    if (categories.length === 0) {
      console.warn(`[OverlayConfigStore] No categories fetched for filter '${filterId}'`);
      return;
    }

    // Map to filter options using configured fields
    const labelField =
      typeof filter.category === 'object' && !Array.isArray(filter.category)
        ? filter.category.labelField || 'name'
        : 'name';
    const valueField =
      typeof filter.category === 'object' && !Array.isArray(filter.category)
        ? filter.category.valueField || 'identifier'
        : 'identifier';

    filter.options = categories.map(
      (category): FilterOption => ({
        // SAFETY: categories come from the category API whose items carry
        // dynamic value/label fields (valueField/labelField config); the
        // double cast bridges the loosely typed record to FilterOption.
        value:
          ((category as unknown as Record<string, unknown>)[valueField] as string) || category.slug,
        // SAFETY: same dynamic labelField access as the value mapping above
        label:
          ((category as unknown as Record<string, unknown>)[labelField] as string) || category.slug,
        icon: category.symbol_color || category.symbol_primitive || undefined,
        description: category.description || undefined,
        iconColor: category.symbol_color || undefined,
        iconPrimitive: category.symbol_primitive || undefined,
        color: category.color || undefined,
      })
    );

    console.debug(
      `[OverlayConfigStore] Populated ${filter.options.length} options for filter '${filterId}'`
    );
    console.debug(`[OverlayConfigStore] First option:`, filter.options[0]);
  }

  /**
   * Populate legend section from category API
   */
  async function populateLegendFromCategory(overlayName: string, sectionIndex: number) {
    const config = getOverlayConfig(overlayName);
    const section = config?.legend?.sections?.[sectionIndex];

    if (!section?.category) {
      console.debug(
        `[OverlayConfigStore] Legend section ${sectionIndex} has no category config, skipping population`
      );
      return;
    }

    const categoryDesc =
      typeof section.category === 'string'
        ? section.category
        : Array.isArray(section.category)
          ? `${section.category.length} items`
          : section.category.slug;
    console.debug(
      `[OverlayConfigStore] Populating legend section '${section.title}' from category '${categoryDesc}'`
    );

    // Resolve categories (fetch from backend or use direct data)
    const categories = await resolveCategories(section.category);

    if (categories.length === 0) {
      console.warn(
        `[OverlayConfigStore] No categories fetched for legend section '${section.title}'`
      );
      return;
    }

    // Map to legend items
    const labelField =
      typeof section.category === 'object' && !Array.isArray(section.category)
        ? section.category.labelField || 'name'
        : 'name';

    section.items = categories.map(category => ({
      // SAFETY: categories come from the category API with dynamic label
      // fields (labelField config); cast bridges the loosely typed record.
      label:
        ((category as unknown as Record<string, unknown>)[labelField] as string) || category.slug,
      description: category.description || undefined,
      icon: category.symbol_color || category.symbol_primitive || category.symbol_mono || undefined,
      color: category.color || undefined,
      dash: category.dash || undefined,
      metadata: {
        iconColor: category.symbol_color,
        iconPrimitive: category.symbol_primitive,
        iconMono: category.symbol_mono,
        type: section.type,
      },
    }));

    console.debug(
      `[OverlayConfigStore] Populated ${section.items.length} legend items for '${section.title}'`
    );
  }

  /**
   * Initialize all category-based configurations for an overlay
   */
  async function initializeOverlayCategories(overlayName: string) {
    const config = getOverlayConfig(overlayName);

    if (!config) {
      console.debug(`[OverlayConfigStore] No config found for overlay '${overlayName}'`);
      return;
    }

    console.debug(`[OverlayConfigStore] Initializing categories for overlay '${overlayName}'`);

    // Populate filters
    if (config.filters) {
      for (const filter of config.filters) {
        if (filter.category) {
          await populateFilterFromCategory(overlayName, filter.id);
        }
      }
    }

    // Populate legend sections
    if (config.legend?.sections) {
      for (let i = 0; i < config.legend.sections.length; i++) {
        if (config.legend.sections[i].category) {
          await populateLegendFromCategory(overlayName, i);
        }
      }
    }

    console.debug(
      `[OverlayConfigStore] Finished initializing categories for overlay '${overlayName}'`
    );
  }

  // Filter Management
  // =================

  function getFilterValue(overlayName: string, filterId: string): OverlayValue | undefined {
    const config = getOverlayConfig(overlayName);
    const filterDef = config?.filters?.find((f: FilterDefinition) => f.id === filterId);

    let raw: unknown = preferences.value[overlayName]?.filters?.[filterId];
    if (raw === undefined) {
      const def = filterDef?.defaultValue;
      // A multi-select `[]` default is the legacy "everything selected /
      // no filter" convention (backend seed) — surfaced as undefined so a
      // genuine empty selection (Deselect all) stays distinguishable from
      // the no-preference default.
      raw = Array.isArray(def) && def.length === 0 ? undefined : def;
    }
    return isOverlayValue(raw) ? raw : undefined;
  }

  /**
   * Whether a filter's current value differs from its "no filter" state.
   * Shared by the config dialog's tab badge and the overlay control's row
   * indicator — ONE definition (the former per-component copies had
   * drifted, and both mis-reported the no-preference default as active).
   *
   * Multi-select: undefined (no preference, or the seed's [] default) and
   * a FULL selection mean no filter. An EMPTY selection hides the layer
   * (Deselect all) and counts as active, as does any subset.
   */
  function isFilterActive(value: OverlayValue | undefined, filter: FilterDefinition): boolean {
    if (value === undefined) return false;
    if (Array.isArray(value)) {
      const allValues = filter.options?.map(option => option.value) ?? [];
      return value.length !== allValues.length;
    }
    return value !== filter.defaultValue;
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
    storageSet(PREFERENCES_KEY, preferences.value);

    console.debug(
      `[OverlayConfigStore] Filter '${filterId}' set to:`,
      value,
      `for overlay '${overlayName}'`
    );

    // Apply filter with debounce
    debouncedApplyFilter(overlayName, filterId, value);
  }

  // Generic Filter Application
  // ===========================

  const debouncedApplyFilter = useDebounceFn(
    (overlayName: string, filterId: string, value: unknown) => {
      applyFilter(overlayName, filterId, value);
    },
    150
  );

  /**
   * Generic filter application based on filter configuration
   */
  function applyFilter(overlayName: string, filterId: string, value: unknown) {
    console.debug(
      `[OverlayConfigStore] Applying filter '${filterId}' for overlay '${overlayName}':`,
      value
    );

    const config = getOverlayConfig(overlayName);
    const filter = config?.filters?.find((f: FilterDefinition) => f.id === filterId);

    if (!filter) {
      console.warn(`[OverlayConfigStore] Filter '${filterId}' not found in config`);
      return;
    }

    if (!filter.mapLayers || !filter.mapProperty) {
      console.warn(
        `[OverlayConfigStore] Filter '${filterId}' has no map configuration (mapLayers/mapProperty), skipping application`
      );
      return;
    }

    const mapRef = useMap();

    if (!mapRef.map) {
      console.warn('[OverlayConfigStore] Map not available, cannot apply filter');
      return;
    }

    // Build filter expression based on filter type
    let filterExpr: ExpressionSpecification | null = null;

    if (filter.type === 'multi-select' && Array.isArray(value)) {
      // Full selection = no filter (explicit Select all).
      if (value.length === filter.options?.length) {
        filterExpr = null;
      } else {
        // Subset — or an EMPTY selection (Deselect all): `in` over an
        // empty haystack matches nothing, hiding the layers until
        // types are picked again.
        filterExpr = [
          'in',
          ['get', filter.mapProperty],
          ['literal', value as string[]],
        ] as ExpressionSpecification;
      }
    } else if (filter.type === 'single-select' && typeof value === 'string') {
      filterExpr = ['==', ['get', filter.mapProperty], value as string] as ExpressionSpecification;
    } else if (filter.type === 'range') {
      // TODO: Implement range filters
      console.warn(`[OverlayConfigStore] Range filter not yet implemented for '${filterId}'`);
    }

    // Apply filter to all configured layers
    for (const layerId of filter.mapLayers) {
      const layer = mapRef.map.getLayer(layerId);
      if (layer) {
        mapRef.map.setFilter(layerId, filterExpr);
        console.debug(
          `[OverlayConfigStore] Applied filter to layer '${layerId}'`,
          filterExpr ? `with ${Array.isArray(value) ? value.length : 1} value(s)` : '(show all)'
        );
      }
    }
  }

  /**
   * Reapply all saved filters (e.g., after page reload or basemap switch)
   */
  function reapplyAllFilters() {
    console.debug('[OverlayConfigStore] Reapplying all filters');

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

  function getSettingValue(overlayName: string, settingId: string): OverlayValue | undefined {
    const config = getOverlayConfig(overlayName);
    const settingDef = config?.settings?.find(s => s.id === settingId);

    const raw = preferences.value[overlayName]?.settings?.[settingId] ?? settingDef?.defaultValue;
    return isOverlayValue(raw) ? raw : undefined;
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
    storageSet(PREFERENCES_KEY, preferences.value);

    console.debug(
      `[OverlayConfigStore] Setting '${settingId}' set to:`,
      value,
      `for overlay '${overlayName}'`
    );

    // Apply setting (Phase 4+)
    // applySetting(overlayName, settingId, value);
  }

  function reapplyAllSettings() {
    console.debug('[OverlayConfigStore] Reapplying all settings');

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
      storageSet(PREFERENCES_KEY, preferences.value);
    }

    // Map-catalog parameters (settings tab) reset with the same action.
    useMapCatalogStore().resetLayerParameters(overlayName);

    // Reapply default filters/settings
    reapplyAllFilters();
    reapplyAllSettings();
  }

  function resetAllPreferences() {
    console.debug('[OverlayConfigStore] Resetting all overlay preferences');

    preferences.value = {};
    storageSet(PREFERENCES_KEY, preferences.value);

    // Reapply defaults
    reapplyAllFilters();
    reapplyAllSettings();
  }

  // Initialization
  // ==============

  // Initialize categories for all overlays on store creation
  async function initializeAllOverlays() {
    for (const overlay of overlayStore.overlays) {
      if (overlay.config) {
        await initializeOverlayCategories(overlay.name);
      }
    }
  }

  // Auto-initialize on store creation
  initializeAllOverlays();

  // Catalog swaps replace the overlay items AFTER this store's
  // creation-time init: the backend map catalog loads asynchronously
  // (map-catalog-store) and re-applies items progressively, so at store
  // creation `overlays` is typically still empty and the loop above
  // populated nothing. The swapped-in configs start with empty filter
  // options — without repopulating on every swap, category-driven
  // filters (e.g. the accommodation types) and legends stay empty.
  // Progressive emits bump the epoch once per settled style — debounce
  // to repopulate once per burst instead of per emit.
  const debouncedInitializeAllOverlays = useDebounceFn(async () => {
    await initializeAllOverlays();
    // Options (re)populated — re-evaluate saved filters now that the
    // option count is known: the epoch-driven reapply in WdOverlayControl
    // ran BEFORE these options loaded, so a persisted full selection
    // could not collapse to the null fast-path yet (and a persisted
    // subset stays correct — the in-expression is value-driven).
    reapplyAllFilters();
  }, 250);

  watch(
    () => overlayStore.overlaysEpoch,
    () => {
      console.debug('[OverlayConfigStore] Overlay catalog swapped — repopulating categories');
      debouncedInitializeAllOverlays();
    }
  );

  // Refetch localized categories when the UI language changes. The map
  // catalog store rebuilds the overlays itself (fresh localized catalog);
  // this watcher only clears the category cache and repopulates all
  // overlay filters/legends against the new configs.
  watch(currentLocale, () => {
    console.debug('[OverlayConfigStore] Locale changed — clearing category cache');
    categoryCache.value.clear();
    void initializeAllOverlays();
  });

  return {
    // State
    preferences,
    categoryCache,
    categoriesLoading,
    categoriesError,

    // Computed
    hasCategories,

    // Categories
    resolveCategories,
    initializeOverlayCategories,

    // Filters
    getFilterValue,
    isFilterActive,
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
