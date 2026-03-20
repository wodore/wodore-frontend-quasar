# Code Review: Bottom Sheet Refactoring Proposal

## Executive Summary

The proposed refactoring to replace custom drag-to-expand mobile footer with `pure-web-bottom-sheet` library has merit but requires careful architectural decisions and risk mitigation strategies.

## ✅ Strengths of the Proposal

1. **Performance Improvement**: Moving from JavaScript-based touch handling to CSS scroll-snap runs on the compositor thread, providing smoother 60fps animations
2. **Reduced Complexity**: Eliminates manual touch-pan calculations and height management code
3. **Better UX**: Native scroll mechanics feel more natural and responsive to users
4. **Accessibility**: Built on dialog/popover API with proper keyboard support

## 🚨 Critical Issues & Red Flags

### 1. Library Maturity Risk 🔴

- **24 GitHub stars, 1 maintainer** - This is a HIGH RISK dependency
- No evidence of production usage at scale
- Single point of failure if maintainer abandons project
- Limited community support for issues

**Mitigation Strategy:**

```typescript
// Create an abstraction layer to minimize coupling
interface BottomSheetProvider {
  open(): void;
  close(): void;
  setSnapPoints(points: number[]): void;
  onStateChange(callback: (state: SheetState) => void): void;
}

// Implement adapter pattern
class PureWebBottomSheetAdapter implements BottomSheetProvider {
  // Implementation details
}

// This allows easy replacement if library becomes unmaintained
```

### 2. Quasar Component Conflict 🟡

The current implementation violates several Quasar best practices:

**Current Issues:**

- WdHutView contains a full `q-layout` which is inappropriate for embedded content
- Using `q-scroll-area` conflicts with native scroll requirements
- Nested layouts cause unexpected behavior

**Resolution:** Extract content into a presentation component

### 3. Route-Based State Management Complexity 🟡

The library uses `v-model` while your app uses route-based state. This requires synchronization.

## 📐 Architectural Recommendations

### Option C: Component Composition Strategy (RECOMMENDED)

Extract content into smaller, focused components and compose differently for each context:

```vue
<!-- WdHutContent.vue - Pure presentation component -->
<script setup lang="ts">
import type { HutSchemaDetails } from '@clients/index';

interface Props {
  hut: HutSchemaDetails;
  scrollable?: boolean; // For native vs q-scroll-area
}

const props = withDefaults(defineProps<Props>(), {
  scrollable: false,
});
</script>

<template>
  <div :class="{ 'overflow-auto': scrollable }">
    <!-- Content without layout wrapper -->
    <WdHutHeader :hut="hut" />
    <div class="q-px-md">
      <WdHutDetails :hut="hut" />
      <WdHutImageGallery :hut="hut" />
      <!-- etc -->
    </div>
  </div>
</template>
```

```vue
<!-- WdHutViewDesktop.vue - Desktop wrapper -->
<script setup lang="ts">
const props = defineProps<{ slug: string }>();
const { hut } = useHut(props.slug);
</script>

<template>
  <q-layout view="lhh LpR lff">
    <q-header><!-- Desktop header --></q-header>
    <q-page-container>
      <q-scroll-area>
        <WdHutContent :hut="hut" />
      </q-scroll-area>
    </q-page-container>
  </q-layout>
</template>
```

```vue
<!-- WdHutViewMobile.vue - Mobile wrapper -->
<script setup lang="ts">
const props = defineProps<{ slug: string }>();
const { hut } = useHut(props.slug);
</script>

<template>
  <!-- No layout, just content for bottom sheet -->
  <WdHutContent :hut="hut" scrollable />
</template>
```

### Route Integration Pattern

```typescript
// composables/useBottomSheet.ts
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

export function useBottomSheet() {
  const route = useRoute();
  const router = useRouter();
  const sheetOpen = ref(false);

  // Sync route state to sheet state
  watch(
    () => route.meta.content,
    isContent => {
      sheetOpen.value = Boolean(isContent);
    }
  );

  // Sync sheet state to route state
  watch(sheetOpen, open => {
    if (!open && route.meta.content) {
      router.push({ name: 'map' });
    }
  });

  return { sheetOpen };
}
```

## 🔍 Specific Answers to Your Questions

### 1. Component Architecture

**Recommendation: Option C - Component Composition**

- Extract content into `WdHutContent.vue` (no layout, no scroll area)
- Create platform-specific wrappers (`WdHutViewDesktop`, `WdHutViewMobile`)
- Use dynamic component loading in `WdMapContent`

### 2. Routing Integration

```vue
<!-- WdMapContent.vue refactored -->
<script setup lang="ts">
import { useBottomSheet } from '@composables/useBottomSheet';

const { sheetOpen } = useBottomSheet();
</script>

<template>
  <!-- Desktop -->
  <q-drawer v-if="!isMobile" v-model="model">
    <router-view name="content" />
  </q-drawer>

  <!-- Mobile with bottom sheet -->
  <dialog v-if="isMobile" ref="dialogRef">
    <bottom-sheet v-model="sheetOpen">
      <router-view name="content" />
    </bottom-sheet>
  </dialog>
</template>
```

### 3. Scroll Handling Conflict

**Solution: Conditional rendering based on context**

```typescript
// In WdHutContent.vue
const useNativeScroll = inject('useNativeScroll', false);
```

### 4. State Management

Use a Pinia store for complex state coordination:

```typescript
// stores/bottom-sheet-store.ts
export const useBottomSheetStore = defineStore('bottomSheet', () => {
  const snapPosition = ref<'min' | 'max'>('min');
  const isOpen = ref(false);

  // Sync with route
  const route = useRoute();
  watch(
    () => route.meta.content,
    content => {
      isOpen.value = Boolean(content);
    }
  );

  return { snapPosition, isOpen };
});
```

### 5. Code Duplication vs Complexity

**Balance: Shared logic in composables, separate presentation**

- Extract business logic to `useHut()` composable
- Keep presentation components simple
- Use composition over inheritance

### 6. Migration Path

**Recommended: Feature Flag with Incremental Rollout**

```typescript
// config/features.ts
export const features = {
  newBottomSheet: import.meta.env.VITE_FEATURE_NEW_BOTTOM_SHEET === 'true',
};
```

```vue
<!-- WdMapContent.vue -->
<template>
  <component
    :is="features.newBottomSheet ? 'WdMapContentNew' : 'WdMapContentLegacy'"
    v-bind="$props"
  />
</template>
```

## ⚠️ Anti-Patterns to Avoid

### ❌ DON'T: Nested Layouts

```vue
<!-- BAD: Layout inside bottom sheet -->
<bottom-sheet>
  <q-layout><!-- Content --></q-layout>
</bottom-sheet>
```

### ❌ DON'T: Mixed Scroll Mechanisms

```vue
<!-- BAD: q-scroll-area in native scroll context -->
<bottom-sheet>
  <q-scroll-area><!-- Content --></q-scroll-area>
</bottom-sheet>
```

### ❌ DON'T: Direct Library Coupling

```vue
<!-- BAD: Direct usage everywhere -->
<script setup>
import 'pure-web-bottom-sheet'; // Direct import
</script>
```

### ✅ DO: Abstract External Dependencies

```typescript
// GOOD: Abstraction layer
import { BottomSheetProvider } from '@/providers/bottom-sheet';

const sheet = new BottomSheetProvider({
  adapter: 'pure-web', // Can switch implementations
});
```

## 🎯 Implementation Checklist

### Phase 1: Preparation (Low Risk)

- [ ] Extract `WdHutContent` from `WdHutView` (no layout, no scroll)
- [ ] Create `useHut()` composable for data fetching logic
- [ ] Add TypeScript types for bottom sheet integration
- [ ] Set up feature flag infrastructure

### Phase 2: Prototype (Medium Risk)

- [ ] Create `WdMapContentNew` with bottom sheet
- [ ] Implement adapter pattern for library
- [ ] Add route synchronization logic
- [ ] Test with feature flag (limited users)

### Phase 3: Migration (Higher Risk)

- [ ] Create platform-specific view components
- [ ] Update router configuration
- [ ] Migrate touch handlers to CSS scroll-snap
- [ ] A/B test with subset of users

### Phase 4: Cleanup

- [ ] Remove old touch-pan code
- [ ] Remove legacy components
- [ ] Update documentation
- [ ] Remove feature flag

## 🛡️ Risk Mitigation Strategies

### 1. Library Abandonment Plan

```bash
# Fork the library immediately
git clone https://github.com/viliket/pure-web-bottom-sheet
# Add to your org as backup
```

### 2. Performance Monitoring

```typescript
// Add performance tracking
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    if (entry.name.includes('bottom-sheet')) {
      analytics.track('bottom-sheet-performance', {
        duration: entry.duration,
        type: entry.entryType,
      });
    }
  }
});
```

### 3. Fallback Strategy

```vue
<script setup>
const bottomSheetSupported = CSS.supports('scroll-snap-type', 'y mandatory');

const SheetComponent = bottomSheetSupported
  ? defineAsyncComponent(() => import('./WdBottomSheet.vue'))
  : defineAsyncComponent(() => import('./WdLegacyFooter.vue'));
</script>
```

## 📊 Decision Matrix

| Criteria    | Current Solution          | pure-web-bottom-sheet  | Quasar Bottom Sheet\*    |
| ----------- | ------------------------- | ---------------------- | ------------------------ |
| Performance | ⭐⭐ (JS-based)           | ⭐⭐⭐⭐⭐ (CSS-based) | ⭐⭐⭐ (Hybrid)          |
| Maintenance | ⭐⭐⭐⭐ (Your code)      | ⭐ (1 maintainer)      | ⭐⭐⭐⭐⭐ (Quasar team) |
| Flexibility | ⭐⭐⭐⭐⭐ (Full control) | ⭐⭐⭐ (Limited API)   | ⭐⭐⭐⭐ (Configurable)  |
| Bundle Size | ⭐⭐⭐ (Your code)        | ⭐⭐⭐⭐⭐ (Tiny)      | ⭐⭐⭐ (Part of Quasar)  |
| Risk        | ⭐⭐ (Technical debt)     | ⭐ (Dependency risk)   | ⭐⭐⭐⭐⭐ (Stable)      |

\*Note: Check if Quasar has plans for a bottom sheet component in their roadmap

## 🚀 Final Recommendation

**Proceed with caution using a phased approach:**

1. **Short term**: Implement abstraction layer and extract components
2. **Medium term**: Prototype with feature flag for subset of users
3. **Long term**: Consider building your own if library proves unstable

**Alternative consideration**: Given the risks, investigate if Quasar team has plans for a native bottom sheet component, or consider contributing one based on CSS scroll-snap principles.

## 💡 Additional Suggestions

### Consider VueUse Composables

```typescript
import { useSwipe, useScroll } from '@vueuse/core';

// Could build a lighter-weight solution using VueUse
const { direction, isSwipping } = useSwipe(target);
const { arrivedState } = useScroll(target);
```

### Progressive Enhancement

Start with CSS-only solution for modern browsers:

```css
.bottom-sheet {
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
}

@supports not (scroll-snap-type: y mandatory) {
  /* Fallback to JS solution */
}
```

### Performance Budget

- Current solution: ~15KB JS for touch handling
- pure-web-bottom-sheet: ~5KB (CSS-heavy)
- Acceptable increase: < 10KB total

## 🔬 Testing Strategy

1. **Unit tests**: Component isolation with mocked bottom sheet
2. **Integration tests**: Route synchronization
3. **E2E tests**: Full user flows on mobile devices
4. **Performance tests**: FPS monitoring during drag operations
5. **A/B testing**: Compare user engagement metrics

---

**Conclusion**: The refactoring is worthwhile for performance gains, but the library choice carries significant risk. Implement with strong abstraction boundaries and have a clear exit strategy.
