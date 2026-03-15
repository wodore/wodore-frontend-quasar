import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';

/**
 * User Settings Store
 *
 * Purpose: User preferences and customization choices
 * Storage: localStorage with debounced sync preparation
 * Sync Strategy: Debounced sync (500ms) - sync on change
 *
 * These settings represent user preferences that:
 * - Are app-independent (work on mobile and desktop)
 * - Should sync across devices in the future
 * - Control what features are available (overlays, basemaps, etc.)
 */

/**
 * Type-safe user settings interface
 * Hierarchical structure with namespaces
 */
export interface UserSettings {
  ui: {
    availableOverlays: string[];
    preferredBasemaps: string[];
    theme: 'light' | 'dark' | 'auto';
    language: string;
    units: 'metric' | 'imperial';
  };
  map: {
    defaultZoom: number;
    minZoom: number;
    maxZoom: number;
  };
}

/**
 * Default settings with proper typing
 */
const defaultSettings: UserSettings = {
  ui: {
    availableOverlays: [
      'huts',
      'hiking',
      'mtb',
      'cycling',
      'skitouren',
      'snowshoes',
      'skislopes',
      'public_transport_stops',
      'hillslope',
      'protected_nature',
      'sheepdogs',
    ],
    preferredBasemaps: ['ch-swisstopo-light', 'ch-swisstopo-full', 'Satellite Hybrid'],
    theme: 'auto',
    language: 'de',
    units: 'metric',
  },
  map: {
    defaultZoom: 8,
    minZoom: 6,
    maxZoom: 18,
  },
};

/**
 * Sync strategy for each setting section
 */
type SyncStrategy = 'local-only' | 'server-sync' | 'deferred-sync';

const syncStrategies: Record<keyof UserSettings, SyncStrategy> = {
  ui: 'server-sync', // Sync UI preferences
  map: 'deferred-sync', // Occasionally sync map preferences
};

export const useUserSettingsStore = defineStore('userSettings', () => {
  // Load from localStorage first
  const loadSettings = (): UserSettings => {
    try {
      const stored = localStorage.getItem('userSettings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new properties
        return {
          ui: { ...defaultSettings.ui, ...parsed.ui },
          map: { ...defaultSettings.map, ...parsed.map },
        };
      }
    } catch (error) {
      console.error('[user-settings] Failed to load from storage:', error);
    }
    return defaultSettings;
  };

  // Reactive state
  const settings = ref<UserSettings>(loadSettings());

  // Save to localStorage (debounced)
  const saveSettings = useDebounceFn(() => {
    localStorage.setItem('userSettings', JSON.stringify(settings.value));
    console.debug('[user-settings] Saved to localStorage');
  }, 500);

  // Watch for changes and save
  watch(settings, saveSettings, { deep: true });

  // Save immediately on initialization to ensure key exists
  if (!localStorage.getItem('userSettings')) {
    localStorage.setItem('userSettings', JSON.stringify(settings.value));
    console.debug('[user-settings] Initialized with defaults');
  }

  // Track which settings need server sync (prepare for future)
  const pendingSync = ref<Set<keyof UserSettings>>(new Set());

  // Computed properties for convenient access
  const uiSettings = computed(() => settings.value.ui);
  const mapSettings = computed(() => settings.value.map);

  // Available overlays and basemaps
  const availableOverlays = computed(() => settings.value.ui.availableOverlays);
  const preferredBasemaps = computed(() => settings.value.ui.preferredBasemaps);

  // Actions with proper typing
  const updateUISetting = <K extends keyof UserSettings['ui']>(
    key: K,
    value: UserSettings['ui'][K]
  ) => {
    settings.value.ui[key] = value;
    markForSync('ui');
    triggerDebouncedSync();
  };

  const updateMapSetting = <K extends keyof UserSettings['map']>(
    key: K,
    value: UserSettings['map'][K]
  ) => {
    settings.value.map[key] = value;
    markForSync('map');
    triggerDebouncedSync();
  };

  // Overlay management
  const setAvailableOverlays = (overlays: string[]) => {
    settings.value.ui.availableOverlays = overlays;
    markForSync('ui');
    triggerDebouncedSync();
  };

  const addAvailableOverlay = (overlay: string) => {
    if (!settings.value.ui.availableOverlays.includes(overlay)) {
      settings.value.ui.availableOverlays.push(overlay);
      markForSync('ui');
      triggerDebouncedSync();
    }
  };

  const removeAvailableOverlay = (overlay: string) => {
    const index = settings.value.ui.availableOverlays.indexOf(overlay);
    if (index > -1) {
      settings.value.ui.availableOverlays.splice(index, 1);
      markForSync('ui');
      triggerDebouncedSync();
    }
  };

  // Basemap management
  const setPreferredBasemaps = (basemaps: string[]) => {
    settings.value.ui.preferredBasemaps = basemaps;
    markForSync('ui');
    triggerDebouncedSync();
  };

  const addPreferredBasemap = (basemap: string) => {
    if (!settings.value.ui.preferredBasemaps.includes(basemap)) {
      settings.value.ui.preferredBasemaps.push(basemap);
      markForSync('ui');
      triggerDebouncedSync();
    }
  };

  const removePreferredBasemap = (basemap: string) => {
    const index = settings.value.ui.preferredBasemaps.indexOf(basemap);
    if (index > -1) {
      settings.value.ui.preferredBasemaps.splice(index, 1);
      markForSync('ui');
      triggerDebouncedSync();
    }
  };

  // Mark for sync
  const markForSync = (section: keyof UserSettings) => {
    if (syncStrategies[section] !== 'local-only') {
      pendingSync.value.add(section);
    }
  };

  // Debounced sync function (500ms debounce)
  const debouncedSync = useDebounceFn(async () => {
    if (pendingSync.value.size === 0) return;

    // Future: Call API to sync settings
    // await api.syncSettings(
    //   Object.fromEntries(
    //     Array.from(pendingSync.value).map(key => [key, settings.value[key]])
    //   )
    // );

    console.debug('[user-settings] Syncing settings:', Array.from(pendingSync.value));
    pendingSync.value.clear();
  }, 500);

  const triggerDebouncedSync = () => {
    debouncedSync();
  };

  // Manual sync trigger (for logout, etc.)
  const syncPending = async () => {
    await debouncedSync();
  };

  // Reset to defaults
  const resetToDefaults = () => {
    Object.assign(settings.value, defaultSettings);
    pendingSync.value.add('ui');
    pendingSync.value.add('map');
    triggerDebouncedSync();
  };

  // Export settings (for backup)
  const exportSettings = (): string => {
    return JSON.stringify(settings.value, null, 2);
  };

  // Import settings (for restore)
  const importSettings = (json: string): boolean => {
    try {
      const imported = JSON.parse(json);
      // Merge with defaults to ensure all properties exist
      settings.value = {
        ui: { ...defaultSettings.ui, ...imported.ui },
        map: { ...defaultSettings.map, ...imported.map },
      };
      pendingSync.value.add('ui');
      pendingSync.value.add('map');
      triggerDebouncedSync();
      return true;
    } catch (error) {
      console.error('[user-settings] Failed to import settings:', error);
      return false;
    }
  };

  return {
    // State
    settings,
    pendingSync,

    // Computed
    uiSettings,
    mapSettings,
    availableOverlays,
    preferredBasemaps,

    // Actions
    updateUISetting,
    updateMapSetting,
    setAvailableOverlays,
    addAvailableOverlay,
    removeAvailableOverlay,
    setPreferredBasemaps,
    addPreferredBasemap,
    removePreferredBasemap,
    syncPending,
    resetToDefaults,
    exportSettings,
    importSettings,
  };
});
