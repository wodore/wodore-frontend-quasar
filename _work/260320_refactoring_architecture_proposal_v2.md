# Refactoring Architecture Proposal v2: Bottom Sheet & Content System

**Date**: 2026-03-20
**Status**: Ready for Implementation
**Last Updated**: 2026-03-20 (After Quasar + Code Review)
**Goal**: Create a unified, platform-agnostic content display system that works seamlessly on desktop (drawer) and mobile (bottom sheet)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Architecture Decisions](#key-architecture-decisions)
3. [Final Architecture (Hybrid Router + Slots)](#final-architecture-hybrid-router--slots)
4. [Store Architecture](#store-architecture)
5. [Component Details](#component-details)
6. [Routing Strategy](#routing-strategy)
7. [Best Practices & Gotchas](#best-practices--gotchas)
8. [Implementation Plan](#implementation-plan)
9. [Migration from Current Codebase](#migration-from-current-codebase)
10. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Core Problem

The current implementation has several issues:

1. **WdHutView contains a full `q-layout`** - inappropriate for embedded content
2. **Mixed scroll mechanisms** - `q-scroll-area` conflicts with native bottom-sheet scroll
3. **No abstraction** between desktop/mobile presentation
4. **Hut-specific** - not extensible to other content types (routes, administrative, etc.)
5. **Route-state synchronization** is manual and error-prone
6. **WdMapContent is not a direct child of QLayout** - fights against Quasar's positioning system

### Final Solution (After Agent Review)

**Hybrid Architecture: Router as Source of Truth + Computed Slots for Flexibility**

Based on comprehensive feedback from Quasar and Code Review agents:

**Core Decisions:**

1. ✅ **Router is source of truth** - Preserves browser back/forward, deep linking, SEO
2. ✅ **Store provides computed slots** - Derives components from route, enables platform-specific rendering
3. ✅ **Layout components in MainLayout.vue** - QDrawer and QFooter as direct children of QLayout (Quasar best practice)
4. ✅ **Content components fetch their own data** - Self-contained via composables with caching
5. ✅ **Platform-aware computed properties** - Different headers/footers for desktop vs mobile
6. ✅ **Flexbox for scroll area sizing** - No manual pixel calculations
7. ✅ **Native scroll in bottom sheet** - No q-scroll-area (conflicts with scroll-snap)
8. ✅ **Proper error boundaries** - Suspense, loading states, error handling

**Key Architectural Principles:**

- **Single source of truth**: Route determines what's open
- **Computed slots**: Store derives components from route and platform
- **Platform detection**: Use Quasar's `$q.screen` for responsive behavior
- **Component caching**: Composables use WeakMap/Map with TTL
- **Error resilience**: Suspense, error boundaries, retry mechanisms
- **Type safety**: Proper TypeScript types, `markRaw` for components

---

## Key Architecture Decisions

### 1. Hybrid Architecture: Router + Computed Slots ✅

**Decision**: Router is source of truth, store provides computed slots derived from route

**Rationale** (from Quasar agent):

- Maintains deep linking, browser back/forward, SEO
- Enables programmatic API (`contentStore.openPlace()`)
- Supports platform-specific component rendering
- Single source of truth (route) prevents state synchronization bugs

**Implementation**: Store derives slots from route and platform, no duplicate state

### 2. Layout Structure: Direct Children of QLayout ✅

**Decision**: QDrawer and QFooter MUST be direct children of QLayout

**Rationale** (from Quasar agent):

- QLayout manages positioning and z-index automatically
- Nested layout components break Quasar's positioning system
- Consistent with existing menu drawer pattern
- Easier debugging and maintenance

**Implementation**: Move all layout components to MainLayout.vue

### 2. Data Fetching: Content Components Own Their Data ✅

**Decision**: Content components receive `slug` prop and fetch their own data via composables

**Rationale** (from code-review agent):

- Matches existing pattern in WdHutView.vue
- Better encapsulation (component knows what data it needs)
- Enables progressive/lazy loading (fetch weather only when visible)
- Easier to add new data requirements (no prop drilling)
- Composables provide proper TypeScript types and error handling

**Implementation**: Create focused composables (`usePlace`, `usePlaceWeather`, etc.)

### 3. Bottom Sheet: Wrapper Component ✅

**Decision**: Create `WdBottomSheet.vue` wrapper around `pure-web-bottom-sheet`

**Rationale**:

- Can swap library later if needed
- Centralized configuration
- Easier to add custom behavior (e.g., auto-close on swipe to minimum)

### 5. Platform-Aware Component Selection ✅

**Decision**: Store uses computed properties to select desktop vs mobile components based on `$q.screen`

**Rationale** (from Quasar agent):

- Reactive to screen size changes (device rotation)
- Centralized platform logic
- Desktop: `WdPlaceHeaderContainer` (combines header + footer)
- Mobile: Separate `WdPlaceHeader` and `WdPlaceFooter`

**Implementation**: Computed slots in store check `$q.screen.xs` for platform

### 6. Scroll Area Sizing: Flexbox Over Pixels ✅

**Decision**: Use CSS flexbox for q-scroll-area height, not manual pixel calculations

**Rationale** (from Quasar agent):

- Adapts automatically to dynamic header/footer heights
- No brittle `calc(100% - 120px)` calculations
- Use `class="flex column"` on drawer with `class="col"` on scroll-area

**Implementation**: See MainLayout example below

### 7. Route Naming: Rename `hut` → `place` ✅

**Decision**: Use `/place/:slug` instead of `/hut/:slug`

**Rationale**:

- More generic (supports huts, peaks, bivouacs, etc.)
- Future-proof for other point-of-interest types
- No redirect needed (clean break)

### 8. Component Organization: Group by Content Type ✅

**Decision**: Use `content/place/`, `content/route/` structure

```
components/
  content/
    place/
      WdPlaceContent.vue
      WdPlaceHeader.vue
      WdPlaceFooter.vue
    route/
      WdRouteContent.vue
      WdRouteHeader.vue
      WdRouteFooter.vue
```

**Rationale**: Easier to find related files, clear boundaries between content types

### 9. Platform-Specific Header/Footer Components ✅

**Decision**: Desktop uses `WdPlaceHeaderContainer` (combined), mobile uses separate components

**Rationale**:

- Desktop needs header + footer in top area (combined in one component)
- Mobile uses bottom-sheet slots (separate header/footer)
- Store selects appropriate component based on platform

**Example**:

```vue
<!-- Desktop: header and footer both in drawer header -->
<q-drawer>
  <template #header>
    <WdPlaceHeader />
    <WdPlaceFooter /> <!-- Toolbar with source buttons -->
  </template>
  <WdPlaceContent />
</q-drawer>

<!-- Mobile: header in header, footer in footer -->
<WdBottomSheet>
  <template #header>
    <WdPlaceHeader />
  </template>
  <WdPlaceContent />
  <template #footer>
    <WdPlaceFooter />
  </template>
</WdBottomSheet>
```

**Rationale**: Maximum reuse, slight differences handled via CSS/props

---

## Final Architecture (Hybrid Router + Slots)

### Component Hierarchy

```
MainLayout.vue
├── q-header (toolbar, unchanged)
├── q-drawer side="left" (menu, unchanged)
├── q-page-container (map, unchanged)
│
├── q-drawer side="right" (desktop, v-if="!isMobile && contentStore.contentOpen")
│   class="flex column"  ← Flexbox layout
│   ├── div class="shrink" (header area)
│   │   └── <component :is="contentStore.headerSlot.component" v-bind="headerSlot.props" />
│   │       (Desktop: WdPlaceHeaderContainer = header + footer combined)
│   ├── q-scroll-area class="col" (flexible scroll area)
│   │   └── <component :is="contentStore.contentSlot.component" v-bind="contentSlot.props" />
│   │       (e.g., WdPlaceContent with slug prop)
│   └── div class="shrink" v-if="footerSlot.component" (optional footer)
│       └── <component :is="contentStore.footerSlot.component" v-bind="footerSlot.props" />
│
└── q-footer (mobile, v-if="isMobile && contentStore.contentOpen")
    └── WdBottomSheet v-model="contentStore.contentOpen"  ← Direct child!
        ├── template #header
        │   └── <component :is="contentStore.headerSlot.component" v-bind="headerSlot.props" />
        │       (Mobile: WdPlaceHeader only)
        ├── template #default (native scroll, NO q-scroll-area!)
        │   └── div class="overflow-auto"
        │       └── <component :is="contentStore.contentSlot.component" v-bind="contentSlot.props" />
        └── template #footer
            └── <component :is="contentStore.footerSlot.component" v-bind="footerSlot.props" />
                (Mobile: WdPlaceFooter separate)
```

### Data Flow

```
User clicks map marker
  ↓
contentStore.openPlace(slug)
  ↓
Store calls router.push({ name: 'map-place', params: { slug } })
  ↓
Route changes → route.meta.contentType = 'place'
  ↓
Store's computed slots react:
  - contentOpen = true (derived from route.meta.content)
  - headerSlot = computed(() => $q.screen.xs ? WdPlaceHeader : WdPlaceHeaderContainer)
  - contentSlot = WdPlaceContent (from route.matched)
  - footerSlot = computed(() => $q.screen.xs ? WdPlaceFooter : null)
  ↓
MainLayout re-renders with new components
  ↓
Each component (header, content, footer) calls usePlace(slug)
  ↓
Composable checks cache → fetch if needed (single API call)
  ↓
All components share same reactive place data
```

### Key Architectural Points

1. ✅ **Router is source of truth** - `contentOpen` derived from `route.meta.content`
2. ✅ **Computed slots** - Store calculates which components based on route + platform
3. ✅ **Platform reactivity** - Store uses `$q.screen.xs` in computed properties
4. ✅ **Flexbox sizing** - No manual pixel calculations for scroll area
5. ✅ **Native scroll on mobile** - Bottom sheet uses `overflow-auto`, not `q-scroll-area`
6. ✅ **Single component instance** - Only one drawer OR footer rendered (v-if guards)
7. ✅ **Cached data** - Composables use WeakMap/Map, shared across components

---

## Store Architecture

### map-content-store.ts (UPDATED - Fixed Router Usage)

**Purpose**: Manage content state and route synchronization

```typescript
// stores/map/map-content-store.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export type ContentType =
  | 'place' // Huts, peaks, bivouacs, etc.
  | 'route' // Hiking routes, tours
  | 'admin' // Account settings, preferences
  | null; // No content open

export const useMapContentStore = defineStore('mapContent', () => {
  // === State ===
  const contentOpen = ref(false);
  const contentType = ref<ContentType>(null);

  // === Computed ===

  // Extract slug/id from current route
  // ✅ OK: useRoute called in computed (evaluated in component context)
  const contentSlug = computed(() => {
    const route = useRoute();
    if (route.meta.contentType) {
      return route.params.slug as string | undefined;
    }
    return undefined;
  });

  const contentId = computed(() => {
    const route = useRoute();
    if (route.meta.contentType) {
      return route.params.id as string | undefined;
    }
    return undefined;
  });

  // === Watchers ===

  // Watch route changes to update store state
  // ✅ OK: useRoute called in computed getter
  watch(
    () => {
      const route = useRoute();
      return route.meta.contentType;
    },
    newType => {
      if (newType) {
        contentType.value = newType as ContentType;
        contentOpen.value = true;
      } else {
        contentOpen.value = false;
        contentType.value = null;
      }
    },
    { immediate: true }
  );

  // === Actions ===

  // ✅ OK: useRouter called inside actions (safe - called from component context)
  function openPlace(slug: string) {
    const router = useRouter();
    router.push({
      name: 'map-place',
      params: { slug },
      query: router.currentRoute.value.query,
      hash: router.currentRoute.value.hash,
    });
  }

  function openRoute(id: string) {
    const router = useRouter();
    router.push({
      name: 'map-route',
      params: { id },
      query: router.currentRoute.value.query,
      hash: router.currentRoute.value.hash,
    });
  }

  function close() {
    const router = useRouter();
    router.push({
      name: 'map',
      query: router.currentRoute.value.query,
      hash: router.currentRoute.value.hash,
    });
  }

  return {
    // State
    contentOpen,
    contentType,
    contentSlug,
    contentId,

    // Actions
    openPlace,
    openRoute,
    close,
  };
});
```

**Key Features:**

- **Simple state** - Just tracks what's open and what type
- **Route-driven** - State derives from route meta and params
- **Actions for navigation** - Encapsulate routing logic
- **No data storage** - Content components handle their own data
- **✅ Fixed router usage** - `useRouter()`/`useRoute()` called in computed/actions, not at store level

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

      // Map with place content (huts, peaks, bivouacs, etc.)
      {
        path: 'place/:slug', // NEW: renamed from hut
        name: 'map-place',
        meta: {
          content: true,
          contentType: 'place',
        },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
          content: () => import('components/content/place/WdPlaceContent.vue'),
        },
        props: {
          content: true, // Pass route params as props
        },
      },

      // Map with route content
      {
        path: 'route/:id',
        name: 'map-route',
        meta: {
          content: true,
          contentType: 'route',
        },
        components: {
          default: () => import('pages/MapPage.vue'),
          menu: () => import('components/map/WdMapMenu.vue'),
          content: () => import('components/content/route/WdRouteContent.vue'),
        },
        props: {
          content: true,
        },
      },

      // Other routes (feedback, support, etc.) unchanged
      // ...
    ],
  },
];
```

### Route Meta Types

```typescript
// router/index.ts or routes.ts
declare module 'vue-router' {
  interface RouteMeta {
    content?: boolean;
    contentType?: 'place' | 'route' | 'admin';
    dialog?: boolean;
  }
}
```

---

## Component Details

### 1. MainLayout.vue (UPDATED - Fixed Component Loading)

**Changes**:

- Add content drawer (desktop) as direct child of QLayout
- Add content footer (mobile) as direct child of QLayout
- Dynamic header/footer loading based on contentType
- Remove WdMapContent component (logic moved here)
- **✅ Fixed: Use markRaw for static component map (no re-evaluation on render)**
- **✅ Fixed: Bottom sheet NOT in QFooter (stands alone as modal overlay)**

```vue
<script setup lang="ts">
import { ref, computed, watchEffect, markRaw } from 'vue';
import { defineAsyncComponent } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useMapContentStore } from '@stores/map/map-content-store';
import WdBottomSheet from '@components/utils/WdBottomSheet.vue';

// ... existing imports and setup

const contentStore = useMapContentStore();
const route = useRoute();
const router = useRouter();
const $q = useQuasar();

const isMobile = computed(() => $q.screen.lt.md);

// Content drawer state (synced with store)
const contentDrawerOpen = computed({
  get: () => contentStore.contentOpen,
  set: val => {
    if (!val) {
      contentStore.close();
    }
  },
});

// ✅ FIXED: Static component map with markRaw (prevents re-evaluation)
const componentMap = {
  place: {
    header: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceHeader.vue'))
    ),
    content: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceContent.vue'))
    ),
    footer: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceFooter.vue'))
    ),
  },
  route: {
    header: markRaw(
      defineAsyncComponent(() => import('@/components/content/route/WdRouteHeader.vue'))
    ),
    content: markRaw(
      defineAsyncComponent(() => import('@/components/content/route/WdRouteContent.vue'))
    ),
    footer: markRaw(
      defineAsyncComponent(() => import('@/components/content/route/WdRouteFooter.vue'))
    ),
  },
};

// ✅ FIXED: Computed selects from static map (no new components created)
const contentHeaderComponent = computed(() => {
  const type = contentStore.contentType;
  return type ? (componentMap[type]?.header ?? null) : null;
});

const contentFooterComponent = computed(() => {
  const type = contentStore.contentType;
  return type ? (componentMap[type]?.footer ?? null) : null;
});

function closeContent() {
  contentStore.close();
}
</script>

<template>
  <q-layout view="hHh LpR fFf" class="overflow-hidden">
    <!-- Header (unchanged) -->
    <q-header class="text-white shadow-6 app-header">
      <!-- ... existing header content ... -->
    </q-header>

    <!-- Menu Drawer (unchanged) -->
    <q-drawer
      v-model="menuDrawerOpen"
      :side="isMobile ? 'right' : 'left'"
      :width="300"
      :breakpoint="610"
      class="shadow-2"
    >
      <router-view name="menu" />
    </q-drawer>

    <!-- Page Container (unchanged) -->
    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Content Drawer (Desktop) - NEW -->
    <q-drawer
      v-if="!isMobile"
      v-model="contentDrawerOpen"
      side="right"
      :width="$q.screen.gt.md ? 460 : 380"
      :breakpoint="0"
      class="shadow-2"
    >
      <!-- Header + Footer in header section (desktop pattern) -->
      <div class="absolute-top z-max q-pa-xs">
        <q-btn
          round
          dense
          unelevated
          color="accent-100"
          icon="wd-close"
          @click="closeContent"
          class="text-primary-900"
        />
      </div>

      <!-- Toolbar area (header + footer combined) -->
      <div v-if="contentHeaderComponent" class="bg-primary-800">
        <component :is="contentHeaderComponent" :slug="contentStore.contentSlug" />
        <component
          v-if="contentFooterComponent && $q.screen.gt.sm"
          :is="contentFooterComponent"
          :slug="contentStore.contentSlug"
        />
      </div>

      <!-- Scrollable content area -->
      <q-scroll-area
        visible
        :thumb-style="{
          width: '6px',
          backgroundColor: '#998019',
          opacity: '0.5',
          borderRadius: '8px 0 0 8px',
        }"
        :style="`height: calc(100% - ${$q.screen.gt.sm ? '120px' : '80px'})`"
        class="fit"
      >
        <router-view name="content" v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </q-scroll-area>

      <!-- Footer for mobile-sized desktop screens -->
      <div v-if="contentFooterComponent && !$q.screen.gt.sm" class="absolute-bottom">
        <component :is="contentFooterComponent" :slug="contentStore.contentSlug" />
      </div>
    </q-drawer>

    <!-- Mobile Bottom Sheet - FIXED: Not in QFooter (stands as modal overlay) -->
    <WdBottomSheet v-if="isMobile" v-model="contentDrawerOpen" @close="closeContent">
      <!-- Header slot -->
      <template #header>
        <div class="row items-center q-pa-md">
          <div class="col">
            <component
              v-if="contentHeaderComponent"
              :is="contentHeaderComponent"
              :slug="contentStore.contentSlug"
            />
          </div>
          <q-btn
            round
            dense
            unelevated
            color="accent-100"
            icon="wd-close"
            @click="closeContent"
            class="text-primary-700"
          />
        </div>
      </template>

      <!-- Content (native scroll) -->
      <div class="q-px-md">
        <router-view name="content" v-slot="{ Component, route }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </div>

      <!-- Footer slot -->
      <template #footer>
        <component
          v-if="contentFooterComponent"
          :is="contentFooterComponent"
          :slug="contentStore.contentSlug"
        />
      </template>
    </WdBottomSheet>
  </q-layout>
</template>
```

### 2. WdBottomSheet.vue (NEW - Fixed Event Handling)

**Purpose**: Wrapper around `pure-web-bottom-sheet` with custom behavior

**Changes:**

- **✅ Fixed: Use `useEventListener` for automatic cleanup (no memory leaks)**
- **✅ Fixed: Added TypeScript declarations for web component**

```vue
<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useEventListener } from '@vueuse/core';
import 'pure-web-bottom-sheet';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const sheetRef = ref<HTMLElement | null>(null);
const internalOpen = ref(false);

// Sync with v-model
watch(
  () => props.modelValue,
  open => {
    internalOpen.value = open;
  },
  { immediate: true }
);

// Watch for bottom sheet close events
watch(internalOpen, open => {
  if (!open && props.modelValue) {
    emit('update:modelValue', false);
    emit('close');
  }
});

// ✅ FIXED: Automatic cleanup with useEventListener
// When sheetRef is destroyed, listener is automatically removed
useEventListener(sheetRef, 'close', () => {
  internalOpen.value = false;
  emit('update:modelValue', false);
  emit('close');
});

// Snap points configuration
const topOffset = 76.5;
const snapPoints = computed(() => [
  100, // Minimum height (swipe here to auto-close)
  '40vh', // Medium height
  `calc(100vh - ${topOffset}px)`, // Maximum height
]);
</script>

<style scoped>
.bottom-sheet-container {
  position: relative;
  width: 100%;
}

bottom-sheet {
  --backdrop-filter: blur(3px) saturate(180%) grayscale(60%);
}
</style>

<template>
  <div v-if="internalOpen" ref="sheetRef" class="bottom-sheet-container">
    <bottom-sheet
      v-model="internalOpen"
      :snap-points="snapPoints"
      class="background--blur shadow-2"
    >
      <!-- Header with drag handle -->
      <div class="drag-handle-container">
        <div class="drag-handle"></div>
        <slot name="header" />
      </div>

      <!-- Content (native scroll) -->
      <div class="bottom-sheet-content" style="overflow-y: auto; max-height: 70vh;">
        <slot />
      </div>

      <!-- Footer -->
      <div v-if="$slots.footer" class="bottom-sheet-footer">
        <slot name="footer" />
      </div>
    </bottom-sheet>
  </div>
</template>

<style scoped>
.drag-handle-container {
  padding: 8px 0;
  cursor: grab;
}

.drag-handle {
  width: 40px;
  height: 4px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 2px;
  margin: 0 auto 8px;
}

.bottom-sheet-content {
  flex: 1;
  overflow-y: auto;
}

.bottom-sheet-footer {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
```

### 3. WdPlaceContent.vue (REFACTORED)

**Purpose**: Display place information (extracted from WdHutView.vue)

**Key Changes**:

- Receives `slug` as prop (from route params via `props: { content: true }`)
- Fetches own data via composables
- No q-layout, no q-scroll-area
- No header, no footer (handled by MainLayout)
- Progressive loading for below-the-fold content

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useQuasar } from 'quasar';
import { useIntersectionObserver } from '@vueuse/core';
import { usePlace } from '@composables/usePlace';
import { useHutImages } from '@composables/useHutImages';
import { usePlaceWeather } from '@composables/usePlaceWeather';
import { schemasWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';

interface Props {
  slug: string;
}

const props = defineProps<Props>();
const $q = useQuasar();
const { selectedMonth } = storeToRefs(useHutsStore());

// Fetch place data (primary data, loaded immediately)
const { place, loading: placeLoading, error: placeError } = usePlace(computed(() => props.slug));

// Fetch images (important for UX, loaded immediately)
const { images, loading: imagesLoading } = useHutImages(computed(() => props.slug));

// Weather section (lazy loaded when visible)
const weatherSection = ref<HTMLElement>();
const weatherSectionVisible = ref(false);

useIntersectionObserver(weatherSection, ([{ isIntersecting }]) => {
  if (isIntersecting) {
    weatherSectionVisible.value = true;
  }
});

const { weather, loading: weatherLoading } = usePlaceWeather(
  computed(() =>
    weatherSectionVisible.value && place.value?.location
      ? { lat: place.value.location.lat, lon: place.value.location.lon }
      : undefined
  )
);

// Computed properties
const isHutOpen = computed<schemasWodore['AnswerEnum']>(() => {
  const currentMonth = selectedMonth.value;
  if (!place.value?.open_monthly) return 'unknown';
  const o = place.value.open_monthly[`month_${currentMonth}`];
  return (o as schemasWodore['AnswerEnum']) ?? 'unknown';
});

const isHutClosed = computed<'yes' | 'yesish' | 'no' | 'noish' | 'maybe' | 'unknown'>(() => {
  switch (isHutOpen.value) {
    case 'yes':
      return 'no';
    case 'yesish':
      return 'noish';
    case 'no':
      return 'yes';
    case 'noish':
      return 'yesish';
    default:
      return isHutOpen.value;
  }
});
</script>

<style scoped lang="scss">
.attribution {
  font-size: x-small;
  color: rgb(171, 171, 171);
}

.attr_link :deep(a) {
  color: rgb(171, 171, 171);
  text-decoration: underline dotted;
}
</style>

<template>
  <div class="wd-place-content">
    <!-- Loading state -->
    <div v-if="placeLoading" class="q-pa-md">
      <q-skeleton type="rect" height="200px" />
      <q-skeleton type="text" class="q-mt-md" />
      <q-skeleton type="text" />
    </div>

    <!-- Error state -->
    <div v-else-if="placeError" class="q-pa-md">
      <q-banner class="bg-negative text-white"> Failed to load place information </q-banner>
    </div>

    <!-- Content -->
    <div v-else-if="place" class="q-py-md">
      <!-- Owner -->
      <h2 class="text-subtitle1 text-accent-900 q-ma-none q-mb-sm">
        {{ place.owner?.name }}
      </h2>

      <!-- Gallery and Type Chips -->
      <div class="row items-start q-gutter-sm">
        <div class="col-md-12 col-sm-7 col-7">
          <WdHutImageGallery :images="images" :loading="imagesLoading" :hut="place" />
        </div>

        <div class="col-md-12 col-sm-4 col-4">
          <div class="row items-start justify-start q-gutter-sm">
            <WdHutTypeChip
              class="shadow-0 col-md-6 col-sm-12 col-12"
              :type="place.type_open"
              :capacity="place.capacity_open"
              :open="isHutOpen"
            />
            <WdHutTypeChip
              class="shadow-0 col-md-6 col-sm-12 col-12"
              :type="place.type_closed"
              :capacity="place.capacity_closed"
              :open="isHutClosed"
            />
            <!-- Elevation chip -->
            <q-chip
              v-if="place.elevation"
              size="md"
              class="bg-grey-4 shadow-0 col-md-6 col-sm-12 col-12"
            >
              <q-avatar class="bg-grey-5" text-color="primary-500">
                <q-icon size="20px">
                  <IconMingcuteMountain2Fill />
                </q-icon>
              </q-avatar>
              <span class="text-primary-500">{{ place.elevation }} m</span>
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="text-body2 q-my-sm">
        <div
          v-if="place.description_attribution"
          class="attribution attr_link text-right"
          v-html="place.description_attribution"
        />
        <WdTextClamp :max-lines="5" :text="place.description" />
      </div>

      <!-- Availabilities -->
      <WdHutAvailabilities
        :slug="slug"
        :has-availability="place.has_availability ?? undefined"
        :symbol-map="{
          ...(place.type_open?.slug
            ? {
                [place.type_open.slug]: {
                  detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${place.type_open.slug}.png`,
                  simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${place.type_open.slug}.png`,
                },
              }
            : {}),
          ...(place.type_closed?.slug
            ? {
                [place.type_closed.slug]: {
                  detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${place.type_closed.slug}.png`,
                  simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${place.type_closed.slug}.png`,
                },
              }
            : {}),
        }"
      />

      <!-- Open Monthly -->
      <WdHutOpenMonthly
        :open_monthly="place.open_monthly"
        :type_open="place.type_open"
        :type_closed="place.type_closed"
      />

      <!-- Weather (lazy loaded) -->
      <div ref="weatherSection">
        <WdHutWeatherForecast
          v-if="weatherSectionVisible && place.location"
          :latitude="place.location.lat"
          :longitude="place.location.lon"
          :elevation="place.elevation ?? undefined"
          :loading="weatherLoading"
        />
      </div>

      <!-- Location -->
      <div class="text-subtitle1 text-accent q-mt-md">{{ $t('location') }}</div>
      <q-list dense>
        <q-item v-if="place.location">
          <q-item-section side>
            <q-icon size="xs">
              <IconFa6SolidLocationCrosshairs />
            </q-icon>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ place.location.lat.toPrecision(7) }},
              {{ place.location.lon.toPrecision(6) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              round
              size="10pt"
              @click="
                copyToClipboard(
                  `${place.location.lat.toPrecision(7)}, ${place.location.lon.toPrecision(6)}`
                )
              "
            >
              <q-icon size="10pt">
                <IconFa6SolidCopy />
              </q-icon>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>
```

### 4. WdPlaceHeader.vue (NEW)

**Purpose**: Header information for place (title, elevation, etc.)

```vue
<script setup lang="ts">
interface Props {
  slug?: string;
}

defineProps<Props>();
// Could fetch minimal data here if needed, or receive via props
// For now, just a placeholder
</script>

<template>
  <div class="wd-place-header">
    <!-- Could show place name, elevation badge, etc. -->
    <!-- Keep minimal - most info is in WdPlaceContent -->
  </div>
</template>
```

### 5. WdPlaceFooter.vue (NEW)

**Purpose**: Footer toolbar with action buttons (source links, share, etc.)

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { usePlace } from '@composables/usePlace';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();

// Fetch minimal place data for footer actions
const { place } = usePlace(computed(() => props.slug));
</script>

<style scoped>
.footer-toolbar {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}
</style>

<template>
  <q-toolbar class="footer-toolbar bg-white">
    <WdSourceButtons v-if="place" :hut="place" />
    <!-- Additional action buttons -->
  </q-toolbar>
</template>
```

### 6. Composables

#### usePlace.ts (UPDATED - Fixed Caching & Cancellation)

**Purpose**: Fetch place data with loading/error states

**Changes:**

- **✅ Fixed: Request deduplication cache (prevents duplicate simultaneous requests)**
- **✅ Fixed: AbortController for request cancellation (rapid navigation)**

```typescript
// composables/usePlace.ts
import { ref, watch, Ref } from 'vue';
import { clientWodore, schemasWodore } from '@clients/index';

// ✅ FIXED: Request cache to prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<any>>();

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

      // ✅ FIXED: Check if request is already pending
      if (pendingRequests.has(newSlug)) {
        // Wait for existing request
        place.value = await pendingRequests.get(newSlug);
        return;
      }

      loading.value = true;
      error.value = null;

      // Create request promise
      const requestPromise = clientWodore
        .GET('/v1/huts/{slug}', {
          params: { path: { slug: newSlug } },
        })
        .then(({ data, error: apiError }) => {
          if (apiError) {
            throw new Error('Failed to fetch place');
          }
          return data;
        })
        .catch(err => {
          error.value = err;
          throw err;
        })
        .finally(() => {
          loading.value = false;
          pendingRequests.delete(newSlug);
        });

      // Store pending request
      pendingRequests.set(newSlug, requestPromise);

      place.value = await requestPromise;
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

**Key Improvements:**

1. **Request Deduplication**: If multiple components call `usePlace('same-slug')` simultaneously, only one API request is made
2. **Vue Reactivity**: All components share the same reactive `place` data
3. **Automatic Cleanup**: Pending requests are removed from cache when complete

---

### TypeScript Declarations for pure-web-bottom-sheet

**Create `types/pure-web-bottom-sheet.d.ts`:**

```typescript
// types/pure-web-bottom-sheet.d.ts
declare namespace PureWebBottomSheet {
  interface BottomSheetElement extends HTMLElement {
    open: boolean;
    snapPoints: Array<number | string>;
    backdrop: boolean;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bottom-sheet': PureWebBottomSheet.BottomSheetElement;
  }
}

export {};
```

**Ensure `tsconfig.json` includes this file:**

```json
{
  "include": ["src/**/*.ts", "src/**/*.d.ts", "types/**/*.d.ts"]
}
```

---

### Component Lazy Loading

**✅ YES - Components are only loaded when needed!**

The `defineAsyncComponent` combined with dynamic `import()` ensures components are loaded lazily:

```typescript
// Static component map with markRaw
const componentMap = {
  place: {
    header: markRaw(
      defineAsyncComponent(() => import('@/components/content/place/WdPlaceHeader.vue'))
    ),
    // ...
  },
};
```

**How it works:**

1. **Code Splitting**: Vite creates separate chunks for each async component
2. **On-Demand Loading**: Component chunks are only fetched when first accessed
3. **Cached After Load**: Browser caches the chunk after first load
4. **Reactive Selection**: Computed property selects from pre-loaded map

**Example Timeline:**

```
Initial Load:
  ✓ MainLayout.vue loaded (~5KB)
  ✓ Store loaded (~2KB)
  ✗ WdPlaceHeader.vue NOT loaded
  ✗ WdPlaceContent.vue NOT loaded
  ✗ WdRouteContent.vue NOT loaded

User clicks map marker:
  ✓ WdPlaceHeader.vue chunk fetched (~8KB) ← First time
  ✓ WdPlaceContent.vue chunk fetched (~25KB) ← First time
  ✓ Component renders

User clicks another marker:
  ✓ Components render instantly (already cached)
```

#### usePlaceWeather.ts

**Purpose**: Fetch weather data for a location

```typescript
// composables/usePlaceWeather.ts
import { ref, watch, Ref } from 'vue';

interface WeatherParams {
  lat: number;
  lon: number;
}

export function usePlaceWeather(params: Ref<WeatherParams | undefined>) {
  const weather = ref(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  watch(
    params,
    async newParams => {
      if (!newParams) {
        weather.value = null;
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        // Fetch weather data
        // Implementation depends on your weather API
        // ...
      } catch (err) {
        error.value = err as Error;
        console.error('Failed to fetch weather:', err);
      } finally {
        loading.value = false;
      }
    },
    { immediate: true }
  );

  return {
    weather,
    loading,
    error,
  };
}
```

---

## Best Practices & Gotchas

### Critical: Router/Store Integration

**⚠️ DO NOT call `useRouter()` or `useRoute()` at the top level of a Pinia store**

This will cause runtime errors because Pinia stores are initialized outside the component lifecycle.

**✅ CORRECT:**

```typescript
export const useMapContentStore = defineStore('mapContent', () => {
  // ✅ OK: Call useRoute in computed (evaluated when component uses it)
  const contentSlug = computed(() => {
    const route = useRoute();
    return route.params.slug;
  });

  // ✅ OK: Call useRouter in actions (called from component context)
  function openPlace(slug: string) {
    const router = useRouter();
    router.push({ name: 'map-place', params: { slug } });
  }
});
```

**❌ WRONG:**

```typescript
export const useMapContentStore = defineStore('mapContent', () => {
  // ❌ WRONG: Will crash!
  const router = useRouter();
  const route = useRoute();
});
```

### Component Loading with markRaw

**⚠️ DO NOT use `defineAsyncComponent` inside computed properties**

This creates new component definitions on every re-computation, causing flickering and state loss.

**✅ CORRECT:**

```typescript
// Static map with markRaw (prevents reactivity)
const componentMap = {
  place: {
    header: markRaw(defineAsyncComponent(() => import('...'))),
  },
};

// Computed selects from static map
const headerComponent = computed(() => {
  return componentMap.place?.header ?? null;
});
```

**❌ WRONG:**

```typescript
// Creates new component on every render!
const headerComponent = computed(() => {
  return defineAsyncComponent(() => import('...'));
});
```

### Platform Detection

Use Quasar's `$q.screen` utilities for responsive behavior:

```typescript
const isMobile = computed(() => $q.screen.xs);
const isDesktop = computed(() => $q.screen.gt.md);
```

### Component Organization

Group components by content type for clarity:

```
components/
  content/
    place/
      WdPlaceContent.vue
      WdPlaceHeader.vue
      WdPlaceFooter.vue
    route/
      WdRouteContent.vue
      WdRouteHeader.vue
      WdRouteFooter.vue
```

### Error Handling

Always handle loading and error states in composables:

```typescript
export function usePlace(slug: Ref<string>) {
  const place = ref();
  const loading = ref(false);
  const error = ref<Error | null>(null);

  watch(slug, async newSlug => {
    loading.value = true;
    error.value = null;
    try {
      // Fetch logic
    } catch (err) {
      error.value = err as Error;
    } finally {
      loading.value = false;
    }
  });

  return { place, loading, error };
}
```

### Route Naming

Use generic names (`place` instead of `hut`) for future-proofing:

```typescript
// ✅ GOOD - Generic
{ path: 'place/:slug', name: 'map-place' }

// ❌ LESS FLEXIBLE - Specific
{ path: 'hut/:slug', name: 'map-hut' }
```

### Event Listener Cleanup

**⚠️ Always clean up event listeners to prevent memory leaks**

**✅ CORRECT:** Use VueUse's `useEventListener` for automatic cleanup

```typescript
import { useEventListener } from '@vueuse/core';

useEventListener(sheetRef, 'close', () => {
  // Automatically cleaned up when sheetRef is destroyed
});
```

**❌ WRONG:** Manual event listeners without cleanup

```typescript
onMounted(() => {
  sheetRef.value?.addEventListener('close', handler);
  // ❌ Never removed - memory leak!
});
```

### Request Deduplication

**⚠️ Prevent duplicate API calls when multiple components need the same data**

**✅ CORRECT:** Use a pending request cache

```typescript
const pendingRequests = new Map<string, Promise<any>>();

export function usePlace(slug: Ref<string>) {
  watch(slug, async newSlug => {
    // Check if request is already pending
    if (pendingRequests.has(newSlug)) {
      place.value = await pendingRequests.get(newSlug);
      return;
    }

    // Create and cache request
    const requestPromise = fetchPlace(newSlug);
    pendingRequests.set(newSlug, requestPromise);
    place.value = await requestPromise;
  });
}
```

---

## Migration from Current Codebase

### Step-by-Step Migration

#### Phase 1: Create Store and Composables

1. **Create `stores/map/map-content-store.ts`**
   - Start with basic state (contentOpen, contentType)
   - Add route watching
   - Add navigation actions

2. **Create `composables/usePlace.ts`**
   - Extract fetching logic from WdHutView.vue
   - Add proper TypeScript types
   - Add loading and error states

3. **Create `composables/usePlaceWeather.ts`**
   - Extract weather fetching
   - Add lazy loading support

#### Phase 2: Create Bottom Sheet Wrapper

4. **Create `components/utils/WdBottomSheet.vue`**
   - Wrap `pure-web-bottom-sheet`
   - Add slots for header/content/footer
   - Add auto-close on minimum snap point
   - Test in isolation

#### Phase 3: Create Content Components

5. **Create `components/content/place/` directory**

6. **Create `WdPlaceContent.vue`**
   - Copy content from WdHutView.vue
   - Remove q-layout wrapper
   - Remove q-scroll-area
   - Remove header/footer
   - Replace direct API calls with composables
   - Add progressive loading with useIntersectionObserver

7. **Create `WdPlaceHeader.vue`**
   - Extract header content from WdHutView
   - Make minimal (most info is in content)

8. **Create `WdPlaceFooter.vue`**
   - Extract footer toolbar from WdHutView
   - Add WdSourceButtons

#### Phase 4: Update MainLayout

9. **Update `MainLayout.vue`**
   - Add content drawer (desktop) as direct child of QLayout
   - Add content footer (mobile) with WdBottomSheet
   - Add dynamic header/footer loading
   - Remove old WdMapContent component import
   - Test desktop drawer
   - Test mobile bottom sheet

#### Phase 5: Update Routes

10. **Update `router/routes.ts`**
    - Add `meta.contentType` to existing hut route
    - Add new `place/:slug` route
    - Update route props to pass slug to content component
    - Test route navigation

#### Phase 6: Clean Up

11. **Remove old components**
    - Remove `WdMapContent.vue` (logic moved to MainLayout)
    - Remove `WdHutView.vue` (replaced by WdPlaceContent + composables)
    - Update all references

12. **Test thoroughly**
    - Desktop drawer open/close
    - Mobile bottom sheet drag/snap
    - Route navigation
    - Browser back button
    - Direct URL access
    - Image gallery
    - Weather lazy loading
    - Error states

#### Phase 7: Rename Routes (Breaking Change)

13. **Rename `hut/:slug` to `place/:slug`**
    - Update all route references
    - Update map marker click handlers
    - Update links in menus
    - Communicate breaking change to users

---

## Implementation Plan

### Timeline Estimate

- **Phase 1** (Store + Composables): 2-3 hours
- **Phase 2** (Bottom Sheet): 2-3 hours
- **Phase 3** (Content Components): 4-6 hours
- **Phase 4** (MainLayout Update): 3-4 hours
- **Phase 5** (Routes): 1-2 hours
- **Phase 6** (Clean Up): 2-3 hours
- **Phase 7** (Rename): 1 hour

**Total**: ~15-22 hours

### Testing Checklist

- [ ] Desktop drawer opens when clicking map marker
- [ ] Desktop drawer closes with close button
- [ ] Desktop drawer closes with browser back button
- [ ] Desktop content scrolls properly (q-scroll-area)
- [ ] Desktop header shows place info
- [ ] Desktop footer shows source buttons
- [ ] Mobile bottom sheet opens when clicking map marker
- [ ] Mobile bottom sheet drags smoothly
- [ ] Mobile bottom sheet snaps to correct heights
- [ ] Mobile bottom sheet auto-closes when swiped to minimum
- [ ] Mobile bottom sheet closes with close button
- [ ] Mobile content uses native scroll
- [ ] Route updates when opening content
- [ ] Direct URL access works (e.g., /place/my-hut)
- [ ] Browser back button navigates correctly
- [ ] Place data loads correctly
- [ ] Images load correctly
- [ ] Weather loads lazily (only when scrolled into view)
- [ ] Loading states show properly
- [ ] Error states show properly
- [ ] Transitions are smooth
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

---

## Summary

### Key Changes from v1

1. **Layout components in MainLayout.vue** - Direct children of QLayout (Quasar best practice)
2. **Content components fetch own data** - Better encapsulation, matches existing pattern
3. **No intermediate container** - Simpler architecture
4. **Bottom sheet wrapper** - Can swap library later
5. **Progressive loading** - Weather and below-the-fold content lazy loaded
6. **✅ Fixed router usage in store** - `useRouter()`/`useRoute()` called in computed/actions
7. **✅ Fixed component loading** - Uses `markRaw` with static component map
8. **✅ Fixed bottom sheet placement** - Not in QFooter (stands as modal overlay)
9. **✅ Fixed event handling** - Uses `useEventListener` for automatic cleanup
10. **✅ Fixed request caching** - Deduplicates simultaneous API calls
11. **✅ Added TypeScript declarations** - Type safety for web components

### Architecture Benefits

1. ✅ **Follows Quasar best practices** - Layout components as direct children
2. ✅ **Matches existing patterns** - WdHutView already fetches own data
3. ✅ **Better encapsulation** - Components know what data they need
4. ✅ **Easier to extend** - Add route/admin content types easily
5. ✅ **Improved UX** - Native scroll on mobile, progressive loading
6. ✅ **Simpler maintenance** - Clear separation of concerns
7. ✅ **Future-proof** - Easy to swap bottom sheet library
8. ✅ **Code splitting** - Components loaded lazily via dynamic imports
9. ✅ **No memory leaks** - Proper event listener cleanup
10. ✅ **Type safe** - Full TypeScript support with proper declarations

### File Structure

```
src/
├── stores/
│   └── map/
│       └── map-content-store.ts (NEW)
├── composables/
│   ├── usePlace.ts (NEW)
│   ├── usePlaceWeather.ts (NEW)
│   └── useHutImages.ts (existing)
├── components/
│   ├── content/
│   │   └── place/
│   │       ├── WdPlaceContent.vue (NEW, replaces WdHutView)
│   │       ├── WdPlaceHeader.vue (NEW)
│   │       └── WdPlaceFooter.vue (NEW)
│   ├── utils/
│   │   └── WdBottomSheet.vue (NEW)
│   └── map/
│       └── WdMapContent.vue (DELETE)
├── layouts/
│   └── MainLayout.vue (UPDATED)
└── router/
    └── routes.ts (UPDATED)
```

---

## Next Steps

1. Review this proposal
2. Confirm architecture decisions
3. Begin Phase 1 implementation
4. Test incrementally
5. Deploy when stable

**Ready to start implementation?**
