import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useEventListener } from '@vueuse/core';
import { LocalStorage } from 'quasar';

/**
 * Synced Properties Store
 *
 * Purpose: User data that improves experience across devices
 * Storage: localStorage with real-time cross-tab sync
 * Sync Strategy: Real-time sync (when server is available)
 *
 * These properties are:
 * - User-specific (personal data)
 * - Valuable to sync across devices (search history, favorites)
 * - Enhance UX (recent searches, visited places)
 * - Sync to server when available
 *
 * Cross-Tab Behavior:
 * - YES: Search history, visited places, favorites sync across tabs
 * - Uses storage event listener for cross-tab sync
 * - All tabs see the same data in real-time
 */

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
  location?: [number, number]; // [lat, lng]
}

/**
 * Visited place entry
 */
export interface VisitedPlace {
  id: string;
  name: string;
  timestamp: number;
  location: [number, number]; // [lat, lng]
}

/**
 * Favorite entry
 */
export interface Favorite {
  id: string;
  type: 'hut' | 'route' | 'place';
  timestamp: number;
}

/**
 * Synced properties interface
 */
export interface SyncedProperties {
  searchHistory: SearchHistoryEntry[];
  visitedPlaces: VisitedPlace[];
  favorites: Favorite[];
}

/**
 * Default values
 */
const defaultSyncedProperties: SyncedProperties = {
  searchHistory: [],
  visitedPlaces: [],
  favorites: [],
};

/**
 * Maximum sizes for arrays
 */
const MAX_SEARCH_HISTORY = 50;
const MAX_VISITED_PLACES = 50;
const MAX_FAVORITES = 500;

export const useSyncedPropertiesStore = defineStore('syncedProperties', () => {
  // SSR Guard: Return defaults on server
  if (typeof window === 'undefined') {
    const defaultPropsRef = ref({ ...defaultSyncedProperties });
    return {
      properties: defaultPropsRef,
      pendingSync: ref(new Set()),
      isSyncing: ref(false),
      searchHistory: computed(() => []),
      visitedPlaces: computed(() => []),
      favorites: computed(() => []),
      recentSearches: computed(() => []),
      recentPlaces: computed(() => []),
      addSearchHistory: () => {},
      clearSearchHistory: () => {},
      removeSearchHistory: () => {},
      addVisitedPlace: () => {},
      clearVisitedPlaces: () => {},
      removeVisitedPlace: () => {},
      addFavorite: () => {},
      removeFavorite: () => {},
      isFavorite: () => false,
      getFavoritesByType: () => [],
      clearFavorites: () => {},
      syncPending: async () => {},
      mergeFromServer: () => {},
      clearAll: () => {},
      exportProperties: (): string => '',
      importProperties: () => false,
    };
  }

  // Storage key with namespace
  const STORAGE_KEY = 'wodore:syncedProperties';

  // Load from localStorage first
  const loadProperties = (): SyncedProperties => {
    try {
      const stored = LocalStorage.getItem(STORAGE_KEY) as SyncedProperties | null;
      if (stored) {
        // Quasar already parses JSON
        return {
          searchHistory: stored.searchHistory || [],
          visitedPlaces: stored.visitedPlaces || [],
          favorites: stored.favorites || [],
        };
      }
    } catch {
      // Silent error handling
    }
    return { ...defaultSyncedProperties };
  };

  // Reactive state
  const properties = ref<SyncedProperties>(loadProperties());

  // Save to localStorage immediately (no debounce - want instant sync across tabs)
  const saveProperties = () => {
    LocalStorage.set(STORAGE_KEY, properties.value);
  };

  // Watch for changes and save
  watch(properties, saveProperties, { deep: true });

  // Listen for cross-tab changes (storage event)
  useEventListener(window, 'storage', e => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        properties.value = {
          searchHistory: parsed.searchHistory || [],
          visitedPlaces: parsed.visitedPlaces || [],
          favorites: parsed.favorites || [],
        };
      } catch {
        // Silent error handling
      }
    }
  });

  // Save immediately on initialization to ensure key exists
  if (!LocalStorage.hasItem(STORAGE_KEY)) {
    LocalStorage.set(STORAGE_KEY, properties.value);
  }

  // Track which properties need server sync (prepare for future)
  const pendingSync = ref<Set<keyof SyncedProperties>>(new Set());
  const isSyncing = ref(false);

  // ========================================
  // Computed properties
  // ========================================
  const searchHistory = computed(() => properties.value.searchHistory);
  const visitedPlaces = computed(() => properties.value.visitedPlaces);
  const favorites = computed(() => properties.value.favorites);

  // Recent searches (last 10)
  const recentSearches = computed(() => searchHistory.value.slice(0, 10));

  // Recent places (last 20)
  const recentPlaces = computed(() => visitedPlaces.value.slice(0, 20));

  // ========================================
  // Search history management
  // ========================================

  /**
   * Add search history entry
   */
  const addSearchHistory = (query: string, location?: [number, number]) => {
    // Prevent duplicates within last minute
    const exists = properties.value.searchHistory.some(
      entry => entry.query === query && Date.now() - entry.timestamp < 60000
    );

    if (!exists) {
      properties.value.searchHistory.unshift({
        query,
        timestamp: Date.now(),
        location,
      });

      // Limit history size to max 50
      if (properties.value.searchHistory.length > MAX_SEARCH_HISTORY) {
        properties.value.searchHistory = properties.value.searchHistory.slice(
          0,
          MAX_SEARCH_HISTORY
        );
      }

      markForSync('searchHistory');
    }
  };

  /**
   * Clear search history
   */
  const clearSearchHistory = () => {
    properties.value.searchHistory = [];
    markForSync('searchHistory');
  };

  /**
   * Remove specific search history entry
   */
  const removeSearchHistory = (query: string) => {
    const index = properties.value.searchHistory.findIndex(entry => entry.query === query);
    if (index > -1) {
      properties.value.searchHistory.splice(index, 1);
      markForSync('searchHistory');
    }
  };

  // ========================================
  // Visited places management
  // ========================================

  /**
   * Add or update visited place
   */
  const addVisitedPlace = (place: Omit<VisitedPlace, 'timestamp'>) => {
    const existingIndex = properties.value.visitedPlaces.findIndex(p => p.id === place.id);

    if (existingIndex >= 0) {
      // Update timestamp and move to front
      const [placeEntry] = properties.value.visitedPlaces.splice(existingIndex, 1);
      placeEntry.timestamp = Date.now();
      properties.value.visitedPlaces.unshift(placeEntry);
    } else {
      // Add new entry
      properties.value.visitedPlaces.unshift({
        ...place,
        timestamp: Date.now(),
      });
    }

    // Limit size to max 50
    if (properties.value.visitedPlaces.length > MAX_VISITED_PLACES) {
      properties.value.visitedPlaces = properties.value.visitedPlaces.slice(0, MAX_VISITED_PLACES);
    }

    markForSync('visitedPlaces');
  };

  /**
   * Clear visited places
   */
  const clearVisitedPlaces = () => {
    properties.value.visitedPlaces = [];
    markForSync('visitedPlaces');
  };

  /**
   * Remove specific visited place
   */
  const removeVisitedPlace = (id: string) => {
    const index = properties.value.visitedPlaces.findIndex(p => p.id === id);
    if (index > -1) {
      properties.value.visitedPlaces.splice(index, 1);
      markForSync('visitedPlaces');
    }
  };

  // ========================================
  // Favorites management
  // ========================================

  /**
   * Add favorite
   */
  const addFavorite = (favorite: Omit<Favorite, 'timestamp'>) => {
    const exists = properties.value.favorites.some(
      f => f.id === favorite.id && f.type === favorite.type
    );

    if (!exists) {
      properties.value.favorites.unshift({
        ...favorite,
        timestamp: Date.now(),
      });

      // Limit size
      if (properties.value.favorites.length > MAX_FAVORITES) {
        properties.value.favorites = properties.value.favorites.slice(0, MAX_FAVORITES);
      }

      markForSync('favorites');
    }
  };

  /**
   * Remove favorite
   */
  const removeFavorite = (id: string, type?: Favorite['type']) => {
    const index = properties.value.favorites.findIndex(
      f => f.id === id && (type === undefined || f.type === type)
    );
    if (index > -1) {
      properties.value.favorites.splice(index, 1);
      markForSync('favorites');
    }
  };

  /**
   * Check if item is favorited
   */
  const isFavorite = (id: string, type?: Favorite['type']): boolean => {
    return properties.value.favorites.some(
      f => f.id === id && (type === undefined || f.type === type)
    );
  };

  /**
   * Get favorites by type
   */
  const getFavoritesByType = (type: Favorite['type']): Favorite[] => {
    return properties.value.favorites.filter(f => f.type === type);
  };

  /**
   * Clear all favorites
   */
  const clearFavorites = () => {
    properties.value.favorites = [];
    markForSync('favorites');
  };

  // ========================================
  // Sync management
  // ========================================

  /**
   * Mark property for sync
   */
  const markForSync = (property: keyof SyncedProperties) => {
    pendingSync.value.add(property);
  };

  /**
   * Sync pending changes to server
   * Future: Call API to sync properties
   */
  const syncPending = async () => {
    if (pendingSync.value.size === 0 || isSyncing.value) return;

    isSyncing.value = true;

    try {
      // Future: Call API to sync properties
      // await api.syncSyncedProperties(
      //   Object.fromEntries(
      //     Array.from(pendingSync.value).map(key => [key, properties.value[key]])
      //   )
      // );

      pendingSync.value.clear();
    } catch (error) {
      console.error('[synced-properties] Failed to sync properties:', error);
    } finally {
      isSyncing.value = false;
    }
  };

  /**
   * Merge properties from server
   * Future: Called when receiving data from server
   */
  const mergeFromServer = (serverData: Partial<SyncedProperties>) => {
    if (serverData.searchHistory) {
      // Merge search history (union, keep most recent)
      const merged = [...properties.value.searchHistory, ...serverData.searchHistory];
      const unique = Array.from(new Map(merged.map(item => [item.query, item])).values());
      properties.value.searchHistory = unique
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_SEARCH_HISTORY);
    }

    if (serverData.visitedPlaces) {
      // Merge visited places (by ID, keep most recent)
      const mergedMap = new Map<string, VisitedPlace>([
        ...properties.value.visitedPlaces.map(p => [p.id, p] as [string, VisitedPlace]),
        ...serverData.visitedPlaces.map(p => [p.id, p] as [string, VisitedPlace]),
      ]);
      properties.value.visitedPlaces = Array.from(mergedMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_VISITED_PLACES);
    }

    if (serverData.favorites) {
      // Merge favorites (union)
      const mergedMap = new Map<string, Favorite>([
        ...properties.value.favorites.map(f => [`${f.id}-${f.type}`, f] as [string, Favorite]),
        ...serverData.favorites.map(f => [`${f.id}-${f.type}`, f] as [string, Favorite]),
      ]);
      properties.value.favorites = Array.from(mergedMap.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_FAVORITES);
    }
  };

  // ========================================
  // Reset and clear
  // ========================================

  /**
   * Clear all synced properties
   */
  const clearAll = () => {
    properties.value.searchHistory = [];
    properties.value.visitedPlaces = [];
    properties.value.favorites = [];
    pendingSync.value.add('searchHistory');
    pendingSync.value.add('visitedPlaces');
    pendingSync.value.add('favorites');
  };

  /**
   * Export properties (for backup)
   */
  const exportProperties = (): string => {
    return JSON.stringify(properties.value, null, 2);
  };

  /**
   * Import properties (for restore)
   */
  const importProperties = (json: string): boolean => {
    try {
      const imported = JSON.parse(json);
      properties.value = {
        searchHistory: imported.searchHistory || [],
        visitedPlaces: imported.visitedPlaces || [],
        favorites: imported.favorites || [],
      };
      pendingSync.value.add('searchHistory');
      pendingSync.value.add('visitedPlaces');
      pendingSync.value.add('favorites');
      return true;
    } catch (error) {
      console.error('[synced-properties] Failed to import properties:', error);
      return false;
    }
  };

  return {
    // State
    properties,
    pendingSync,
    isSyncing,

    // Computed
    searchHistory,
    visitedPlaces,
    favorites,
    recentSearches,
    recentPlaces,

    // Search history actions
    addSearchHistory,
    clearSearchHistory,
    removeSearchHistory,

    // Visited places actions
    addVisitedPlace,
    clearVisitedPlaces,
    removeVisitedPlace,

    // Favorites actions
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoritesByType,
    clearFavorites,

    // Sync actions
    syncPending,
    mergeFromServer,

    // Reset
    clearAll,
    exportProperties,
    importProperties,
  };
});
