import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useDebounceFn, useEventListener } from '@vueuse/core';
import { LocalStorage, SessionStorage } from 'quasar';

/**
 * Local Properties Store
 *
 * Purpose: Device-specific, ephemeral app state
 * Storage: Mix of localStorage (persistent) and sessionStorage (session-only)
 * Sync Strategy: Never sync (local-only) - NO cross-tab sync for location
 *
 * These properties are:
 * - Device-specific (different on mobile vs desktop)
 * - Ephemeral (current session state)
 * - Privacy-sensitive (current location, etc.)
 * - Never synced to server
 * - Location does NOT sync across tabs (each tab is independent)
 */

/**
 * Location state (map viewport)
 */
export interface LocationState {
  lat: number;
  lng: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
  timestamp: number;
}

/**
 * Session state (ephemeral, cleared on browser close)
 */
export interface SessionState {
  startTime: number;
  clipboard?: [number, number]; // [lat, lng]
  lastActiveTab: string;
}

/**
 * Local properties interface
 */
export interface LocalProperties {
  location: LocationState;
}

/**
 * Default values
 */
const defaultLocationState: LocationState = {
  lat: 46.8, // Switzerland center
  lng: 8.2,
  zoom: 8,
  bearing: 0,
  pitch: 0,
  timestamp: Date.now(),
};

const defaultSessionState: SessionState = {
  startTime: Date.now(),
  lastActiveTab: 'map',
};

export const useLocalPropertiesStore = defineStore('localProperties', () => {
  // ========================================
  // Persistent state (localStorage)
  // NOTE: Using manual LocalStorage instead of useStorage to prevent cross-tab sync
  // Each tab reads localStorage on init, but writes don't trigger updates in other tabs
  // ========================================

  // Reactive state (not synced across tabs)
  const persistentState = ref<LocalProperties>({
    location: { ...defaultLocationState },
  });

  // Load from localStorage on initialization (one-time read)
  const loadFromStorage = (): LocalProperties => {
    try {
      const stored = LocalStorage.getItem('localProperties');
      if (stored) {
        const parsed = JSON.parse(stored as string);
        return {
          location: {
            ...defaultLocationState,
            ...parsed.location,
          },
        };
      }
    } catch (error) {
      console.error('[local-properties] Failed to load from storage:', error);
    }
    return { location: { ...defaultLocationState } };
  };

  // Initialize from storage
  persistentState.value = loadFromStorage();

  // Save to localStorage (debounced to 1 second for live updates)
  const saveToStorage = useDebounceFn(() => {
    LocalStorage.set('localProperties', JSON.stringify(persistentState.value));
    console.debug('[local-properties] Saved to localStorage (no cross-tab sync)');
  }, 1000); // 1 second debounce for live updates

  // Watch for changes and save to localStorage
  watch(
    persistentState,
    () => {
      saveToStorage();
    },
    { deep: true }
  );

  // Save immediately on initialization to ensure key exists
  if (!LocalStorage.hasItem('localProperties')) {
    LocalStorage.set('localProperties', JSON.stringify(persistentState.value));
    console.debug('[local-properties] Initialized with defaults');
  }

  // ========================================
  // Session-only state (sessionStorage)
  // NOTE: SessionStorage is naturally isolated per tab, so useStorage is fine here
  // ========================================
  const sessionState = ref<SessionState>({ ...defaultSessionState });

  // Load session state from sessionStorage
  const loadSessionFromStorage = (): SessionState => {
    try {
      const stored = SessionStorage.getItem('local-properties-session');
      if (stored) {
        return JSON.parse(stored as string);
      }
    } catch (error) {
      console.error('[local-properties] Failed to load session from storage:', error);
    }
    return { ...defaultSessionState };
  };

  // Save session state to sessionStorage
  const saveSessionToStorage = () => {
    SessionStorage.set('local-properties-session', JSON.stringify(sessionState.value));
  };

  // Initialize session state
  sessionState.value = loadSessionFromStorage();

  // Watch for changes and save to sessionStorage
  watch(
    sessionState,
    () => {
      saveSessionToStorage();
    },
    { deep: true }
  );

  // ========================================
  // Computed properties
  // ========================================
  const currentLocation = computed(() => persistentState.value.location);
  const sessionStartTime = computed(() => sessionState.value.startTime);
  const clipboardLocation = computed(() => sessionState.value.clipboard);
  const lastActiveTab = computed(() => sessionState.value.lastActiveTab);

  // ========================================
  // Location management
  // ========================================

  /**
   * Update current location (map viewport)
   * Automatically debounced (15 seconds)
   */
  const updateLocation = (location: Partial<LocationState>) => {
    Object.assign(persistentState.value.location, location, {
      timestamp: Date.now(),
    });
    // Watcher will trigger debounced save automatically
  };

  /**
   * Set complete location state
   * Automatically debounced (15 seconds)
   */
  const setLocation = (location: LocationState) => {
    persistentState.value.location = {
      ...location,
      timestamp: Date.now(),
    };
    // Watcher will trigger debounced save automatically
  };

  /**
   * Get last known location
   */
  const getLastKnownLocation = (): LocationState => {
    return persistentState.value.location;
  };

  /**
   * Check if location is stale (older than specified minutes)
   */
  const isLocationStale = (maxAgeMinutes: number = 60): boolean => {
    const age = Date.now() - persistentState.value.location.timestamp;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    return age > maxAgeMs;
  };

  /**
   * Force immediate save (for page close, etc.)
   * Overrides the debounced save
   */
  const forceSave = () => {
    LocalStorage.set('localProperties', JSON.stringify(persistentState.value));
    console.debug('[local-properties] Location saved (immediate):', persistentState.value.location);
  };

  // ========================================
  // Session management
  // ========================================

  /**
   * Update session state
   */
  const updateSession = (session: Partial<SessionState>) => {
    Object.assign(sessionState.value, session);
  };

  /**
   * Set clipboard location
   */
  const setClipboardLocation = (location: [number, number] | undefined) => {
    sessionState.value.clipboard = location;
  };

  /**
   * Set last active tab
   */
  const setLastActiveTab = (tab: string) => {
    sessionState.value.lastActiveTab = tab;
  };

  // ========================================
  // Page lifecycle handlers
  // ========================================

  /**
   * Handle page close/hide
   * Save location immediately before closing
   */
  const handleBeforeUnload = () => {
    forceSave();
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Page is being hidden (user switched tabs, minimized, etc.)
      forceSave();
    }
  };

  // Register event listeners for page lifecycle
  useEventListener(window, 'beforeunload', handleBeforeUnload);
  useEventListener(document, 'visibilitychange', handleVisibilityChange);

  // ========================================
  // Reset and clear
  // ========================================

  /**
   * Reset location to defaults
   */
  const resetLocation = () => {
    persistentState.value.location = { ...defaultLocationState };
  };

  /**
   * Clear all local properties
   */
  const clearAll = () => {
    persistentState.value.location = { ...defaultLocationState };
    sessionState.value = { ...defaultSessionState };
  };

  // ========================================
  // URL hash parsing
  // ========================================

  /**
   * Parse location from URL hash
   * Format: #p=zoom/lat/lng
   * Example: #p=13.77/46.13591/6.81813
   */
  const parseLocationFromHash = (): LocationState | null => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#p=')) {
      return null;
    }

    try {
      const parts = hash.substring(3).split('/');
      if (parts.length !== 3) {
        return null;
      }

      const zoom = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);

      if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) {
        return null;
      }

      return {
        lat,
        lng,
        zoom,
        bearing: 0,
        pitch: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[local-properties] Failed to parse location from hash:', error);
      return null;
    }
  };

  /**
   * Get initial location for map
   * Priority:
   * 1. URL hash location (if present)
   * 2. Last known location from storage (if not stale)
   * 3. Default location
   */
  const getInitialLocation = (): LocationState => {
    // Check URL hash first
    const hashLocation = parseLocationFromHash();
    if (hashLocation) {
      console.debug('[local-properties] Using location from URL hash:', hashLocation);
      return hashLocation;
    }

    // Check last known location
    const lastLocation = persistentState.value.location;
    if (!isLocationStale(60)) {
      // Location is less than 60 minutes old
      console.debug('[local-properties] Using last known location:', lastLocation);
      return lastLocation;
    }

    // Use default location
    console.debug('[local-properties] Using default location:', defaultLocationState);
    return { ...defaultLocationState };
  };

  return {
    // State
    persistentState,
    sessionState,

    // Computed
    currentLocation,
    sessionStartTime,
    clipboardLocation,
    lastActiveTab,

    // Location actions
    updateLocation,
    setLocation,
    getLastKnownLocation,
    isLocationStale,
    forceSave,
    resetLocation,

    // Session actions
    updateSession,
    setClipboardLocation,
    setLastActiveTab,

    // URL hash
    parseLocationFromHash,
    getInitialLocation,

    // Reset
    clearAll,
  };
});
