# Refactoring Architecture Proposal: Bottom Sheet & Content System

**Date**: 2026-03-20  
**Status**: Draft for Discussion  
**Goal**: Create a unified, platform-agnostic content display system that works seamlessly on desktop (drawer) and mobile (bottom sheet)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Component Hierarchy](#component-hierarchy)
5. [Store Architecture](#store-architecture)
6. [Routing Strategy](#routing-strategy)
7. [Implementation Plan](#implementation-plan)
8. [Open Questions](#open-questions)

---

## Executive Summary

### Core Problem

The current implementation has several issues:

1. **WdHutView contains a full `q-layout`** - inappropriate for embedded content
2. **Mixed scroll mechanisms** - `q-scroll-area` conflicts with native bottom-sheet scroll
3. **No abstraction** between desktop/mobile presentation
4. **Hut-specific** - not extensible to other content types (routes, administrative, etc.)
5. **Route-state synchronization** is manual and error-prone

### Proposed Solution

Create a **three-layer architecture**:

1. **Content Layer** - Pure presentation components (WdPlaceContent, WdRouteContent, etc.)
2. **Container Layer** - Platform-specific wrappers (WdContentDesktop, WdContentMobile)
3. **Orchestration Layer** - Store + composables to manage routing, state, and navigation

This allows:

- Same content component for desktop and mobile
- Different headers/footers per platform
- Different scroll mechanisms (q-scroll-area vs native)
- Extensibility to multiple content types (places, routes, administrative, etc.)
- Centralized route-state management

---

## Current Architecture Analysis

### Current Component Tree

```
MainLayout.vue
├── q-header (toolbar with search, user, etc.)
├── q-drawer (menu, side=left/right based on mobile)
│   └── router-view name="menu" → WdMapMenu.vue
├── q-page-container
│   └── router-view → MapPage.vue → WdMapView.vue (the map)
├── q-dialog (for feedback, support, etc.)
│   └── router-view name="dialog"
└── WdMapContent.vue (footer or drawer for content)
    └── router-view name="content" → WdHutView.vue
```

### Current Routing

```typescript
// routes.ts
{
  path: 'hut/:slug',
  name: 'map-hut',
  meta: { content: true },
  components: {
    default: MapPage,          // The map
    menu: WdMapMenu,            // Left/right drawer menu
    content: WdHutView,         // Content in WdMapContent
  },
  props: { content: true }
}
```

### Current Issues

1. **WdHutView.vue structure**:

   ```vue
   <q-layout view="lhh LpR lff" container>
     <q-header>...</q-header>
     <q-page-container>
       <q-scroll-area>
         <q-page>
           <!-- Actual content -->
         </q-page>
       </q-scroll-area>
     </q-page-container>
     <q-footer>...</q-footer>
   </q-layout>
   ```

   **Problem**: Full layout inside content makes it inflexible:
   - Cannot use native scroll for bottom sheet
   - Headers/footers are locked in
   - No way to adapt presentation per platform

2. **WdMapContent.vue**:
   - Manual touch-pan height calculation
   - Duplicated logic for drawer vs footer
   - Hard to maintain
   - Route synchronization is manual

3. **No content type abstraction**:
   - Everything is "hut-specific"
   - No way to show routes, administrative content, etc.

---

## Proposed Architecture

### Three-Layer System

```
┌─────────────────────────────────────────────────────────┐
│         ORCHESTRATION LAYER (Store + Router)            │
│  - map-content-store.ts (content state, type, route)    │
│  - useMapContent() composable (route sync, navigation)  │
│  - Route definitions with meta.contentType              │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│           CONTAINER LAYER (Platform Wrappers)           │
│  Desktop: WdContentDesktop.vue (drawer + scroll-area)   │
│  Mobile:  WdContentMobile.vue (bottom-sheet)            │
└─────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│           CONTENT LAYER (Pure Presentation)             │
│  - WdPlaceContent.vue (huts, peaks, etc.)               │
│  - WdRouteContent.vue (hiking routes)                   │
│  - WdAdminContent.vue (settings, account, etc.)         │
│  - Each receives data via props, no layout/scroll       │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Content components are pure presentation**:
   - No `q-layout`, no `q-scroll-area`
   - Just content markup
   - Accept props: `{ data, scrollable: boolean }`

2. **Container components handle platform concerns**:
   - Desktop: `q-drawer` + `q-scroll-area` + custom header/footer
   - Mobile: bottom-sheet + native scroll + custom header/footer
   - Load appropriate content component via `<component :is="...">`

3. **Store manages all state**:
   - What content is open?
   - What type of content? (place, route, admin, etc.)
   - Route synchronization
   - Navigation history

---

## Component Hierarchy

### New Component Structure

```
MainLayout.vue
├── q-header (unchanged)
├── q-drawer (menu, unchanged)
├── q-page-container
│   └── router-view → MapPage.vue → WdMapView.vue
├── q-dialog (unchanged)
└── WdMapContentContainer.vue (NEW: smart container)
    ├── WdContentDesktop.vue (desktop wrapper, v-if="!isMobile")
    │   ├── q-drawer (side=right)
    │   │   ├── WdPlaceHeader.vue (close button, title)
    │   │   ├── q-scroll-area
    │   │   │   └── <component :is="contentComponent" v-bind="contentProps" />
    │   │   └── WdPlaceFooter.vue (source buttons, etc.)
    │   └── OR: Different header/footer for other content types
    └── WdContentMobile.vue (mobile wrapper, v-if="isMobile")
        └── <bottom-sheet v-model="isOpen">
            ├── WdPlaceHeader.vue (drag handle, close button)
            ├── <component :is="contentComponent" v-bind="contentProps" scrollable />
            └── WdPlaceFooter.vue
```

### Component Details

#### 1. WdMapContentContainer.vue (Smart Container)

**Purpose**: Determine which platform wrapper to use

```vue
<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed } from 'vue';
import { useMapContentStore } from '@stores/map/map-content-store';
import WdContentDesktop from './WdContentDesktop.vue';
import WdContentMobile from './WdContentMobile.vue';

const $q = useQuasar();
const contentStore = useMapContentStore();

const isMobile = computed(() => $q.screen.lt.md);
const isOpen = computed(() => contentStore.isOpen);
</script>

<template>
  <WdContentDesktop v-if="!isMobile && isOpen" />
  <WdContentMobile v-else-if="isMobile && isOpen" />
</template>
```

#### 2. WdContentDesktop.vue (Desktop Wrapper)

**Purpose**: Desktop-specific presentation (drawer, scroll-area, headers/footers)

```vue
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useMapContentStore } from '@stores/map/map-content-store';
import { useRouter } from 'vue-router';

const contentStore = useMapContentStore();
const router = useRouter();

// Dynamic component loading based on content type
const contentComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceContent.vue'));
    case 'route':
      return defineAsyncComponent(() => import('@/components/content/WdRouteContent.vue'));
    case 'admin':
      return defineAsyncComponent(() => import('@/components/content/WdAdminContent.vue'));
    default:
      return null;
  }
});

// Dynamic header/footer based on content type
const headerComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceHeader.vue'));
    // ... other types
  }
});

const footerComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceFooter.vue'));
    // ... other types
  }
});

const contentProps = computed(() => contentStore.contentData);

function onClose() {
  contentStore.close();
  // Store handles route navigation
}
</script>

<template>
  <q-drawer
    :model-value="contentStore.isOpen"
    side="right"
    :width="$q.screen.gt.md ? 460 : 380"
    :breakpoint="0"
    class="shadow-2"
    @update:model-value="onClose"
  >
    <!-- Header (platform-specific, content-type-specific) -->
    <component :is="headerComponent" v-bind="contentProps" @close="onClose" />

    <!-- Content area with scroll -->
    <q-scroll-area class="fit" style="height: calc(100% - 120px)">
      <div class="q-px-md">
        <component :is="contentComponent" v-bind="contentProps" :scrollable="false" />
      </div>
    </q-scroll-area>

    <!-- Footer (platform-specific, content-type-specific) -->
    <component :is="footerComponent" v-bind="contentProps" />
  </q-drawer>
</template>
```

#### 3. WdContentMobile.vue (Mobile Wrapper)

**Purpose**: Mobile-specific presentation (bottom-sheet, native scroll)

```vue
<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useMapContentStore } from '@stores/map/map-content-store';
// Import bottom-sheet adapter (abstraction over pure-web-bottom-sheet)
import { useBottomSheet } from '@/composables/useBottomSheet';

const contentStore = useMapContentStore();
const { sheetRef, isOpen, snapPoints } = useBottomSheet();

// Same dynamic component loading as desktop
const contentComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceContent.vue'));
    // ... other types
  }
});

const headerComponent = computed(() => {
  // Could be different from desktop (e.g., include drag handle)
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceHeaderMobile.vue'));
    // ... other types
  }
});

const footerComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return defineAsyncComponent(() => import('@/components/content/WdPlaceFooterMobile.vue'));
    // ... other types
  }
});

const contentProps = computed(() => contentStore.contentData);

// Sync bottom-sheet state with store
function onBottomSheetClose() {
  contentStore.close();
}
</script>

<template>
  <q-footer>
    <!-- Bottom sheet wrapper (abstracted, can swap implementation) -->
    <bottom-sheet
      ref="sheetRef"
      v-model="isOpen"
      :snap-points="snapPoints"
      @close="onBottomSheetClose"
    >
      <!-- Header (mobile-specific: drag handle, etc.) -->
      <component :is="headerComponent" v-bind="contentProps" @close="onBottomSheetClose" />

      <!-- Content (uses native scroll, no q-scroll-area) -->
      <div class="q-px-md" style="overflow-y: auto">
        <component :is="contentComponent" v-bind="contentProps" :scrollable="true" />
      </div>

      <!-- Footer (mobile-specific) -->
      <component :is="footerComponent" v-bind="contentProps" />
    </bottom-sheet>
  </q-footer>
</template>
```

#### 4. WdPlaceContent.vue (Pure Content Component)

**Purpose**: Display place (hut, peak, etc.) information - no layout concerns

```vue
<script setup lang="ts">
import type { HutSchemaDetails } from '@clients/index';

interface Props {
  place: HutSchemaDetails; // Or generic PlaceData type
  scrollable?: boolean; // Hint for styling, not actual scroll handling
}

const props = withDefaults(defineProps<Props>(), {
  scrollable: false,
});

// All business logic via composables
// No fetching here - data comes via props from container
</script>

<template>
  <div>
    <!-- Pure content, no layout/scroll/header/footer -->

    <!-- Owner -->
    <h2 class="text-subtitle1 text-accent-900">
      {{ place.owner?.name }}
    </h2>

    <!-- Gallery -->
    <WdHutImageGallery :images="place.images" :hut="place" />

    <!-- Type chips -->
    <div class="row q-gutter-sm">
      <WdHutTypeChip :type="place.type_open" :capacity="place.capacity_open" />
      <WdHutTypeChip :type="place.type_closed" :capacity="place.capacity_closed" />
      <!-- ... -->
    </div>

    <!-- Description -->
    <WdTextClamp :max-lines="5" :text="place.description" />

    <!-- Availability -->
    <WdHutAvailabilities :slug="place.slug" />

    <!-- Weather -->
    <WdHutWeatherForecast :latitude="place.location.lat" :longitude="place.location.lon" />

    <!-- Location details -->
    <!-- ... -->
  </div>
</template>
```

**Key points**:

- No `q-layout`, `q-scroll-area`, headers, or footers
- Receives all data via props
- Uses composables for business logic (if any)
- Can conditionally style based on `scrollable` prop if needed

#### 5. WdPlaceHeader.vue / WdPlaceHeaderMobile.vue

**Purpose**: Platform-specific headers

```vue
<!-- WdPlaceHeader.vue (Desktop) -->
<script setup lang="ts">
interface Props {
  place: HutSchemaDetails;
}
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="q-pa-md bg-primary-800 text-white">
    <div class="row items-center">
      <div class="col">
        <div class="text-h6">{{ place.name }}</div>
        <div class="text-caption">{{ place.elevation }}m</div>
      </div>
      <q-btn round dense flat icon="wd-close" @click="emit('close')" />
    </div>
  </div>
</template>
```

```vue
<!-- WdPlaceHeaderMobile.vue (Mobile) -->
<template>
  <div class="q-pa-md">
    <!-- Drag handle for bottom sheet -->
    <div class="drag-handle"></div>

    <div class="row items-center">
      <div class="col">
        <div class="text-h6">{{ place.name }}</div>
      </div>
      <q-btn round dense unelevated color="accent-100" icon="wd-close" @click="emit('close')" />
    </div>
  </div>
</template>
```

#### 6. WdPlaceFooter.vue / WdPlaceFooterMobile.vue

**Purpose**: Platform-specific footers (source buttons, actions, etc.)

```vue
<script setup lang="ts">
interface Props {
  place: HutSchemaDetails;
}
</script>

<template>
  <q-toolbar class="bg-white border-top">
    <WdSourceButtons :hut="place" />
    <!-- Other actions -->
  </q-toolbar>
</template>
```

---

## Store Architecture

### New Store: `map-content-store.ts`

**Purpose**: Centralize all content state and route synchronization

```typescript
// stores/map/map-content-store.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type ContentType =
  | 'place' // Huts, peaks, bivouacs, etc.
  | 'route' // Hiking routes, tours
  | 'admin' // Account settings, preferences, etc.
  | null; // No content open

export interface ContentData {
  slug?: string;
  id?: string;
  // Additional data specific to content type
  [key: string]: unknown;
}

export const useMapContentStore = defineStore('mapContent', () => {
  // === State ===
  const isOpen = ref(false);
  const contentType = ref<ContentType>(null);
  const contentData = ref<ContentData>({});

  // Navigation history for back button
  const history = ref<Array<{ type: ContentType; data: ContentData }>>([]);

  // === Computed ===
  const canGoBack = computed(() => history.value.length > 0);

  // === Router Integration ===
  const router = useRouter();
  const route = useRoute();

  // Watch route changes to update store
  watch(
    () => route.meta.contentType,
    newType => {
      if (newType) {
        // Route changed, update store
        const type = newType as ContentType;
        const data = extractContentDataFromRoute(route);

        setContent(type, data);
        isOpen.value = true;
      } else {
        // No content in route
        isOpen.value = false;
      }
    },
    { immediate: true }
  );

  // === Actions ===

  function setContent(type: ContentType, data: ContentData = {}) {
    // Save current state to history if not null
    if (contentType.value !== null) {
      history.value.push({
        type: contentType.value,
        data: { ...contentData.value },
      });
    }

    contentType.value = type;
    contentData.value = data;
    isOpen.value = true;

    console.debug('[MapContentStore] Set content:', type, data);
  }

  function openPlace(slug: string) {
    setContent('place', { slug });

    // Update route
    router.push({
      name: 'map-place',
      params: { slug },
      query: route.query,
      hash: route.hash,
    });
  }

  function openRoute(id: string) {
    setContent('route', { id });

    router.push({
      name: 'map-route',
      params: { id },
      query: route.query,
      hash: route.hash,
    });
  }

  function close() {
    isOpen.value = false;
    contentType.value = null;
    contentData.value = {};
    history.value = [];

    // Navigate to map
    router.push({
      name: 'map',
      query: route.query,
      hash: route.hash,
    });
  }

  function goBack() {
    if (history.value.length > 0) {
      const previous = history.value.pop()!;
      contentType.value = previous.type;
      contentData.value = previous.data;

      // Update route accordingly
      updateRouteFromContent(previous.type, previous.data);
    } else {
      close();
    }
  }

  // === Helper Functions ===

  function extractContentDataFromRoute(route: any): ContentData {
    // Extract relevant data from route params
    return {
      slug: route.params.slug,
      id: route.params.id,
      // ... other route params
    };
  }

  function updateRouteFromContent(type: ContentType, data: ContentData) {
    if (type === 'place' && data.slug) {
      router.push({
        name: 'map-place',
        params: { slug: data.slug },
        query: route.query,
        hash: route.hash,
      });
    } else if (type === 'route' && data.id) {
      router.push({
        name: 'map-route',
        params: { id: data.id },
        query: route.query,
        hash: route.hash,
      });
    }
    // ... other types
  }

  return {
    // State
    isOpen,
    contentType,
    contentData,

    // Computed
    canGoBack,

    // Actions
    setContent,
    openPlace,
    openRoute,
    close,
    goBack,
  };
});
```

### Store Usage Examples

```typescript
// In a component that needs to open place content (e.g., map marker click)
import { useMapContentStore } from '@stores/map/map-content-store';

const contentStore = useMapContentStore();

function onMarkerClick(slug: string) {
  contentStore.openPlace(slug);
  // Store handles both state update AND route navigation
}
```

```typescript
// In WdContentDesktop/Mobile to get current content
const contentStore = useMapContentStore();

const contentComponent = computed(() => {
  switch (contentStore.contentType) {
    case 'place':
      return WdPlaceContent;
    case 'route':
      return WdRouteContent;
    // ...
  }
});
```

---

## Routing Strategy

### Updated Routes

```typescript
// router/routes.ts
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      // Map with no content
      {
        path: '',
        name: 'map',
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
        },
      },

      // Map with place content (huts, peaks, etc.)
      {
        path: 'place/:slug', // Renamed from 'hut/:slug'
        name: 'map-place',
        meta: {
          content: true,
          contentType: 'place', // NEW
        },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
        },
        props: {
          default: false,
          menu: false,
        },
      },

      // Map with route content
      {
        path: 'route/:id',
        name: 'map-route',
        meta: {
          content: true,
          contentType: 'route', // NEW
        },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
        },
      },

      // Map with administrative content
      {
        path: 'admin/:section',
        name: 'map-admin',
        meta: {
          content: true,
          contentType: 'admin', // NEW
        },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
        },
      },

      // Legacy redirect
      {
        path: 'hut/:slug',
        redirect: to => ({
          name: 'map-place',
          params: to.params,
          query: to.query,
          hash: to.hash,
        }),
      },

      // ... other routes (feedback, support, etc.)
    ],
  },
];
```

### Route Meta

```typescript
// Route meta type definition
declare module 'vue-router' {
  interface RouteMeta {
    content?: boolean; // Is this a content route?
    contentType?: ContentType; // What type of content?
    dialog?: boolean; // Is this a dialog route?
  }
}
```

---

## Composables

### useMapContent() - Route Sync & Navigation

**Purpose**: Provide helpers for opening/closing content with route sync

```typescript
// composables/useMapContent.ts
import { computed } from 'vue';
import { useMapContentStore } from '@stores/map/map-content-store';
import { useRoute } from 'vue-router';

export function useMapContent() {
  const contentStore = useMapContentStore();
  const route = useRoute();

  const isOpen = computed(() => contentStore.isOpen);
  const contentType = computed(() => contentStore.contentType);
  const contentData = computed(() => contentStore.contentData);

  function openPlace(slug: string) {
    contentStore.openPlace(slug);
  }

  function openRoute(id: string) {
    contentStore.openRoute(id);
  }

  function close() {
    contentStore.close();
  }

  function goBack() {
    contentStore.goBack();
  }

  return {
    isOpen,
    contentType,
    contentData,
    openPlace,
    openRoute,
    close,
    goBack,
  };
}
```

### useBottomSheet() - Bottom Sheet Abstraction

**Purpose**: Abstract bottom-sheet library (can swap implementation)

```typescript
// composables/useBottomSheet.ts
import { ref, watch, nextTick } from 'vue';
import { useMapContentStore } from '@stores/map/map-content-store';

export function useBottomSheet() {
  const contentStore = useMapContentStore();
  const sheetRef = ref<HTMLElement | null>(null);
  const isOpen = ref(false);

  // Snap points for bottom sheet (in pixels or percentages)
  const snapPoints = ref([100, 400, '80vh']);

  // Sync with content store
  watch(
    () => contentStore.isOpen,
    open => {
      if (open) {
        nextTick(() => {
          isOpen.value = true;
        });
      } else {
        isOpen.value = false;
      }
    },
    { immediate: true }
  );

  // When bottom sheet closes (user swipe/tap), close content store
  watch(isOpen, open => {
    if (!open && contentStore.isOpen) {
      contentStore.close();
    }
  });

  return {
    sheetRef,
    isOpen,
    snapPoints,
  };
}
```

### usePlace() - Place Data Fetching

**Purpose**: Fetch and manage place data (replaces logic from WdHutView)

```typescript
// composables/usePlace.ts
import { ref, watch } from 'vue';
import { clientWodore, schemasWodore } from '@clients/index';

export function usePlace(slug: Ref<string | undefined>) {
  const place = ref<schemasWodore['HutSchemaDetails'] | undefined>(undefined);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  watch(
    slug,
    async newSlug => {
      if (!newSlug) {
        place.value = undefined;
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        const { data } = await clientWodore.GET('/v1/huts/{slug}', {
          params: { path: { slug: newSlug } },
        });

        if (data) {
          place.value = data as schemasWodore['HutSchemaDetails'];
        }
      } catch (err) {
        error.value = err as Error;
        console.error('Failed to fetch place:', err);
      } finally {
        loading.value = false;
      }
    },
    { immediate: true }
  );

  return {
    place,
    loading,
    error,
  };
}
```

**Usage in WdContentDesktop/Mobile**:

```typescript
// In WdContentDesktop.vue or WdContentMobile.vue
const contentStore = useMapContentStore();

// Fetch place data when slug is available
const placeSlug = computed(() =>
  contentStore.contentType === 'place' ? contentStore.contentData.slug : undefined
);

const { place, loading, error } = usePlace(placeSlug);

// Pass to content component
const contentProps = computed(() => ({
  place: place.value,
  loading: loading.value,
  error: error.value,
}));
```

---

## Implementation Plan

### Phase 1: Preparation (Low Risk)

**Goal**: Extract content, create abstractions, no UI changes yet

1. **Create store structure**:
   - [ ] Create `stores/map/map-content-store.ts`
   - [ ] Add `ContentType` type definitions
   - [ ] Implement basic state management (no route sync yet)

2. **Create composables**:
   - [ ] Create `composables/useMapContent.ts`
   - [ ] Create `composables/usePlace.ts` (extract from WdHutView)
   - [ ] Create `composables/useBottomSheet.ts` (abstraction)

3. **Extract content components**:
   - [ ] Create `components/content/WdPlaceContent.vue` (extract from WdHutView, remove layout/scroll/header/footer)
   - [ ] Create `components/content/WdPlaceHeader.vue`
   - [ ] Create `components/content/WdPlaceFooter.vue`
   - [ ] Test in isolation

4. **Update routes**:
   - [ ] Add `meta.contentType` to existing routes
   - [ ] Add route type definitions
   - [ ] Create redirect from `hut/:slug` to `place/:slug`

### Phase 2: Desktop Implementation (Medium Risk)

**Goal**: Implement new desktop container, test with existing mobile footer

5. **Create desktop container**:
   - [ ] Create `components/map/WdContentDesktop.vue`
   - [ ] Implement dynamic component loading
   - [ ] Integrate with `map-content-store`
   - [ ] Add to `WdMapContentContainer.vue`

6. **Test desktop**:
   - [ ] Verify drawer behavior
   - [ ] Verify route synchronization
   - [ ] Verify scroll behavior
   - [ ] Verify close/navigation

### Phase 3: Mobile Implementation (Higher Risk)

**Goal**: Replace custom touch-pan with bottom-sheet library

7. **Bottom sheet abstraction**:
   - [ ] Research/fork `pure-web-bottom-sheet` library
   - [ ] Create adapter component `components/utils/WdBottomSheet.vue`
   - [ ] Implement `useBottomSheet()` composable

8. **Create mobile container**:
   - [ ] Create `components/map/WdContentMobile.vue`
   - [ ] Integrate bottom-sheet
   - [ ] Create mobile-specific headers/footers
   - [ ] Test native scroll behavior

9. **Integration**:
   - [ ] Add to `WdMapContentContainer.vue`
   - [ ] Test route synchronization
   - [ ] Test open/close transitions
   - [ ] Test drag/snap behavior

### Phase 4: Feature Expansion (Future)

**Goal**: Add support for other content types

10. **Route content**:
    - [ ] Create `WdRouteContent.vue`
    - [ ] Add routes to router
    - [ ] Update store for route type

11. **Admin content**:
    - [ ] Create `WdAdminContent.vue`
    - [ ] Add routes to router
    - [ ] Update store for admin type

### Phase 5: Cleanup

**Goal**: Remove legacy code, optimize

12. **Remove old code**:
    - [ ] Remove `WdHutView.vue` (replaced by WdPlaceContent + containers)
    - [ ] Remove custom touch-pan logic from `WdMapContent.vue`
    - [ ] Update all references

13. **Optimize**:
    - [ ] Add lazy loading
    - [ ] Add transitions
    - [ ] Performance testing
    - [ ] Accessibility audit

---

## Open Questions

### Technical Questions

1. **Bottom Sheet Library**:
   - Should we fork `pure-web-bottom-sheet` immediately to mitigate maintenance risk?
   - What's our fallback if the library has issues? (Progressive enhancement to old touch-pan?)
   - Do we need A/B testing for rollout?

2. **Scroll Handling**:
   - How do we handle edge cases where content is shorter than viewport?
   - Should mobile always use native scroll, or conditionally based on content height?
   - What about nested scrollable areas (e.g., image gallery)?

3. **Route Naming**:
   - Should we rename `hut/:slug` to `place/:slug` now, or wait?
   - What about existing bookmarks/links? (Redirect should handle this)
   - Do we need both `hut` and `place` routes during transition?

4. **Content Data Fetching**:
   - Where should data fetching happen?
     - **Option A**: In composables (`usePlace()`), containers pass data to content
     - **Option B**: In content components themselves
     - **Recommendation**: Option A (containers fetch, content receives props)

5. **State Persistence**:
   - Should we persist content state to localStorage?
   - Should opening a place/route be added to browser history? (Currently yes via route)
   - How to handle browser back button with bottom sheet?

### UX Questions

6. **Mobile Bottom Sheet Behavior**:
   - What should happen when user swipes down to minimum snap point?
     - **Option A**: Close content, navigate to map
     - **Option B**: Stay at minimum height, require explicit close
     - **Recommendation**: Discuss with users/testing

7. **Header/Footer Differences**:
   - Should mobile headers have drag handles always visible?
   - Should footers be sticky or scroll with content?
   - Desktop vs mobile: different actions? (e.g., mobile shows fewer buttons)

8. **Loading States**:
   - How to show loading when fetching place data?
   - Skeleton loader in content area?
   - Loading overlay?

9. **Error States**:
   - What if place data fails to fetch?
   - Show error in content area or close drawer/sheet?

### Architecture Questions

10. **Content Type Extensibility**:
    - How do we handle content types that don't fit the pattern?
    - What about overlays (e.g., "settings", "filters")?
    - Should those use the same system or separate dialogs?

11. **Navigation History**:
    - Should store track navigation history internally, or rely on browser history?
    - Currently: browser history via routes
    - Alternative: internal stack for "back" within bottom sheet
    - **Recommendation**: Browser history for now (simpler)

12. **Component Organization**:
    - Should we group by content type or by function?
      ```
      components/
        content/
          place/
            WdPlaceContent.vue
            WdPlaceHeader.vue
            WdPlaceFooter.vue
            WdPlaceHeaderMobile.vue
            WdPlaceFooterMobile.vue
          route/
            WdRouteContent.vue
            ...
      ```
    - Or:
      ```
      components/
        content/
          WdPlaceContent.vue
          WdRouteContent.vue
        headers/
          WdPlaceHeader.vue
          WdPlaceHeaderMobile.vue
        footers/
          WdPlaceFooter.vue
      ```
    - **Recommendation**: Group by content type (easier to find related files)

13. **Feature Flags**:
    - Should we implement feature flags for gradual rollout?
    - Example: `VITE_FEATURE_NEW_BOTTOM_SHEET=true`
    - Allows A/B testing and quick rollback

### Testing Questions

14. **Testing Strategy**:
    - Unit tests: What to test?
      - Store logic (content type switching, route sync)
      - Composables (usePlace, useMapContent, useBottomSheet)
      - Pure content components (WdPlaceContent)
    - Integration tests: What to test?
      - Full flow: click marker → open content → close
      - Route changes → content updates
      - Browser back button → content closes
    - E2E tests: What to test?
      - Mobile: bottom sheet drag/snap
      - Desktop: drawer open/close
      - Different content types

15. **Performance Testing**:
    - How to measure scroll performance (60fps target)?
    - Load testing with large content (many images, etc.)
    - Memory leaks from dynamic component loading?

---

## Next Steps

### Before Implementation

1. **Clarify open questions** (review with team)
2. **Decide on bottom-sheet library** (fork or use directly?)
3. **Agree on component organization** (group by content type?)
4. **Define testing strategy**

### Implementation Approach

**Recommendation**: **Incremental, feature-flagged rollout**

1. Start with Phase 1 (preparation) - low risk, no UI changes
2. Implement Phase 2 (desktop) - test thoroughly
3. Implement Phase 3 (mobile) behind feature flag
4. A/B test with subset of users
5. Gradual rollout based on feedback
6. Phase 4 (expansion) and Phase 5 (cleanup) after stable

### Risk Mitigation

- **Fork bottom-sheet library** immediately (backup plan)
- **Feature flags** for new implementation
- **Parallel implementation** (keep old code until new is stable)
- **Comprehensive testing** before rollout
- **Performance monitoring** in production

---

## Summary

This refactoring proposal creates a **three-layer architecture** (content, container, orchestration) that:

1. **Separates concerns**: Content components are pure presentation, containers handle platform specifics, store manages state
2. **Enables extensibility**: Easy to add new content types (routes, admin, etc.)
3. **Improves maintainability**: Clear boundaries, composables for reusable logic
4. **Enhances UX**: Native scroll on mobile, consistent behavior across platforms
5. **Simplifies routing**: Centralized state management with automatic route sync

**Key components**:

- **Store**: `map-content-store.ts` (state, route sync)
- **Containers**: `WdContentDesktop.vue`, `WdContentMobile.vue` (platform wrappers)
- **Content**: `WdPlaceContent.vue`, `WdRouteContent.vue`, etc. (pure presentation)
- **Composables**: `useMapContent()`, `usePlace()`, `useBottomSheet()` (reusable logic)

**Implementation**: Phased approach with feature flags, incremental rollout, and comprehensive testing.

---

## Questions for Discussion

Please review and provide feedback on:

1. **Store architecture**: Does the `map-content-store` approach make sense?
2. **Component separation**: Is the three-layer split (content/container/orchestration) clear?
3. **Route naming**: Should we rename `hut` to `place` now or gradually?
4. **Bottom sheet**: Fork library immediately or wait?
5. **Content data fetching**: Containers fetch and pass props, or content fetches directly?
6. **Mobile UX**: What should happen when bottom sheet is swiped to minimum?
7. **Any other concerns or suggestions?**
