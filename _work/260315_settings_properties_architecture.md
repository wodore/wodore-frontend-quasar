# Settings and Properties Architecture

**Date**: 2025-03-15
**Status**: Implementation
**Related**: User settings, page properties, multi-tab handling

## Overview

Implementation of a three-store architecture for managing user settings and application properties in the Wodore frontend.

## Architecture

### Three-Store System

```
src/stores/
├── user-settings-store.ts        # User preferences & customization
├── local-properties-store.ts      # Device-specific, ephemeral state
├── synced-properties-store.ts     # Cross-device user data
└── map/
    ├── basemap-store.ts          # Existing: Current app basemap state
    └── overlay-store.ts          # Existing: Current app overlay state
```

### Store Responsibilities

#### 1. user-settings-store.ts (Sync-Ready)

**Purpose**: User preferences and customization choices
**Storage**: localStorage with debounced sync preparation
**Sync Strategy**: Debounced sync (sync on change with 500ms debounce)

**Examples**:

- Which overlays are available/hidden
- Preferred basemaps list
- Theme preferences (light/dark/auto)
- Language, units, etc.

**Sync Behavior**:

- Debounced sync (500ms) to prevent excessive writes
- Prepare for server sync (marked for future implementation)
- Changes persisted immediately to localStorage

#### 2. local-properties-store.ts (Local-Only)

**Purpose**: Device-specific, ephemeral app state
**Storage**: Mix of localStorage (persistent) and sessionStorage (session-only)
**Sync Strategy**: Never sync (local-only)

**Examples**:

- Current map viewport (location, zoom, bearing, pitch)
- Current session data (temp state, clipboard)
- Device-specific UI state (open panels, scroll positions)

**Location Tracking**:

- Update every 15 seconds while moving
- Save on page close/hide
- Restore from last known position if no URL hash present

#### 3. synced-properties-store.ts (Server Sync)

**Purpose**: User data that improves experience across devices
**Storage**: localStorage with real-time sync preparation
**Sync Strategy**: Real-time sync (when server is available)

**Examples**:

- **Search history**: Cross-device search suggestions
- **Visited places**: Recently viewed huts/locations
- **Favorites/bookmarks**: Saved huts, routes
- **User annotations**: Notes on places

**Sync Behavior**:

- Prepare for real-time sync (marked for future implementation)
- Changes persisted immediately to localStorage
- Merge strategy: "most recent wins" or "union of both"

## Multi-Tab Behavior

### Current Behavior (localStorage)

- Multiple tabs share localStorage
- `storage` event notifies other tabs of changes
- VueUse's `useStorage()` DOES auto-sync across tabs (via storage event)
- Manual LocalStorage does NOT auto-sync (no storage event reaction)

### Location Multi-Tab Scenario

**Requirement**: NO cross-tab sync for location

- Each tab manages its own location independently
- New tab without hash → reads last saved location (from closed tab)
- Tabs do NOT update each other's location

**Example** (CORRECT behavior):

1. Tab A: Zürich → moves to Geneva (saves after 15s)
2. Tab B: Opens → shows Geneva (last saved from Tab A)
3. Tab B: Moves to Basel (saves after 15s)
4. Tab A: Still showing Geneva (NOT affected by Tab B)
5. Tab B: Still showing Basel (NOT affected by Tab A)

**Implementation**:

- Manual LocalStorage (not useStorage)
- Read from localStorage on initialization
- Write to localStorage with debounce
- Does NOT react to storage events from other tabs

### Search/History Multi-Tab Scenario

**Requirement**: YES cross-tab sync for search/history

- All tabs see the same search history
- All tabs see the same visited places
- Real-time updates across tabs

**Example**:

1. Tab A: Search "Zermatt" → added to history
2. Tab B: Immediately sees "Zermatt" in history (via storage event)
3. Tab B: Search "Geneva" → added to history
4. Tab A: Immediately sees "Geneva" in history (via storage event)

**Implementation**:

- VueUse's `useStorage()` (auto-syncs via storage event)
- All tabs automatically stay in sync
- Merging happens automatically

## URL Hash Location Handling

### Format

```
#p=zoom/lat/lng
Example: #p=13.77/46.13591/6.81813
```

### Logic Flow

1. **On page load**:
   - Check if URL has hash location (`#p=...`)
   - If yes: Use URL location (user intent)
   - If no: Restore from last known position (localStorage)

2. **While navigating**:
   - Debounced save every 15 seconds
   - Save on page close/hide (beforeunload, visibilitychange)

3. **New tab behavior**:
   - No URL hash → restore last position
   - With URL hash → use URL position (don't restore)

## Implementation Details

### Dependencies

- `@vueuse/core` - `useStorage()`, `useDebounceFn()`, `useEventListener()`
- Quasar - `LocalStorage`, `SessionStorage` (already in use)
- Pinia - Store definition (already in use)

### TypeScript Interfaces

```typescript
// User Settings
interface UserSettings {
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

// Local Properties
interface LocalProperties {
  location: {
    lat: number;
    lng: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
    timestamp: number;
  };
  session: {
    startTime: number;
    clipboard?: [number, number];
    lastActiveTab: string;
  };
}

// Synced Properties
interface SyncedProperties {
  searchHistory: Array<{
    query: string;
    timestamp: number;
    location?: [number, number];
  }>;
  visitedPlaces: Array<{
    id: string;
    name: string;
    timestamp: number;
    location: [number, number];
  }>;
  favorites: Array<{
    id: string;
    type: 'hut' | 'route' | 'place';
    timestamp: number;
  }>;
}
```

## Future Enhancements

### Phase 2: Server Sync Implementation

1. **Add sync methods to stores**:
   - `syncToServer()` - Upload changes
   - `mergeFromServer()` - Download and merge
   - Conflict resolution strategies

2. **Sync triggers**:
   - On login/logout
   - Periodic sync (every 5 minutes)
   - On page visibility change (user returns to app)

3. **Merge strategies**:
   - Settings: Server wins (authoritative)
   - Search history: Union with limit (keep most recent 50)
   - Visited places: Merge by ID, keep most recent timestamp

4. **Offline support**:
   - Queue changes when offline
   - Sync when connection restored
   - Handle conflicts with "most recent wins"

### Phase 3: Advanced Features

1. **IndexedDB** for large datasets (search history, visited places)
   - Better performance for large arrays
   - Built-in cross-tab sync
   - Migration from localStorage

2. **Settings export/import** for backup/restore
3. **Settings migration system** for version upgrades
4. **A/B testing** integration (settings variants)

## Testing Considerations

### Multi-Tab Testing

**Location (NO cross-tab sync)**:

- Tab A: Move map to Geneva
- Tab B: Open → should show Geneva (last saved)
- Tab B: Move map to Basel
- Tab A: Should still show Geneva (NOT affected by Tab B)

**Search/History (YES cross-tab sync)**:

- Tab A: Search "Zermatt"
- Tab B: Should immediately see "Zermatt" in history
- Tab B: Search "Geneva"
- Tab A: Should immediately see "Geneva" in history

### URL Hash Testing

- Open with hash: `#p=10/46.5/8.5`
- Open without hash (should restore)
- Navigate with hash (should use hash, not storage)

### Persistence Testing

- Refresh page (should restore)
- Close and reopen (should restore)
- Clear storage (should use defaults)

## Related Files

- `src/stores/user-settings-store.ts`
- `src/stores/local-properties-store.ts`
- `src/stores/synced-properties-store.ts`
- `src/router/routes.ts` (URL hash parsing)
- `src/pages/MapPage.vue` (location tracking integration)

## Open Questions

1. Should we implement leader election now or wait for issues?
2. What's the max size for search history (50, 100, 200)?
3. Should visited places expire after X days?
4. How to handle conflicts when sync is implemented?
