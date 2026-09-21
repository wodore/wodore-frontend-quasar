## Context

`WdAccommodationAvailabilities.vue` displays a horizontal availability stripe using Swiper with virtual slides, FreeMode, and Mousewheel modules. The component needs to scroll to a target date (either `selectedDate` from the store or today) on mount, slug change, and when `selectedDate` changes.

### The Bug

There are two scroll initialization paths that race with each other:

**Path 1 — `watchEffect` (initialization):**

```typescript
watchEffect(() => {
  // ... initializes availabilityItems
  nextTick(() => {
    if (swiperInstance.value) {
      swiperInstance.value.slideTo(selectedSlideIndex.value, 0);
    }
  });
});
```

**Path 2 — `watch(startDate, { immediate: true })`:**

```typescript
watch(
  () => startDate.value,
  () => {
    if (!swiperInstance.value || availabilityItems.value.length === 0) return; // ← early return!
    const idx = selectedSlideIndex.value;
    if (idx >= 0) {
      nextTick(() => {
        swiperInstance.value?.slideTo(idx, 300);
      });
    }
  },
  { immediate: true }
);
```

**Path 3 — Swiper `onSwiper` callback:**

```typescript
const onSwiper = (swiper: SwiperType) => {
  swiperInstance.value = swiper;
  activeIndex.value = swiper.activeIndex;
  // No scroll-to-date here!
};
```

**The race condition:**

1. Component mounts → `watchEffect` fires → populates `availabilityItems` → `nextTick` tries `slideTo` but `swiperInstance` is null (Swiper hasn't rendered yet) → **fails silently**
2. Same tick → `watch(startDate, { immediate: true })` fires → checks `swiperInstance.value` → it's null → **early return, does nothing**
3. Swiper initializes → `onSwiper` fires → sets `swiperInstance` → **but nobody triggers the scroll**
4. Result: Swiper stays at slide 0 (or wherever `initial-slide` prop positions it, which may not work correctly with virtual slides)

The `initial-slide` prop should work, but it's set to `selectedSlideIndex` which depends on `availabilityItems` being populated. With `v-if="availabilityItems.length"` on the Swiper, the items are set in `watchEffect` and then the Swiper renders — `selectedSlideIndex` should be correct at that point. However, when `selectedDate` changes _after_ mount, the watch fires correctly but the initial mount case is broken because of the race.

## Goals / Non-Goals

**Goals:**

- Make scroll-to-selected-date (or today) work reliably on mount, slug change, and date change
- Fix the timing race condition between watchEffect, watch, and onSwiper

**Non-Goals:**

- Changing the Swiper configuration or module setup
- Changing the `selectedDate` store format or API
- Modifying visual appearance or layout

## Decisions

### 1. Trigger initial scroll from `onSwiper` callback

**Decision**: Move the initial `slideTo` call into the `onSwiper` callback, so it fires precisely when the Swiper instance is ready. Remove the `nextTick(() => slideTo(...))` from the `watchEffect`.

**Rationale**: `onSwiper` is the guaranteed moment when the Swiper instance is available and its virtual slides are initialized. This eliminates the race condition entirely. The `watch(startDate, { immediate: true })` still handles subsequent date changes after mount.

**Alternative considered**: Add retry with setTimeout — fragile, adds arbitrary delays.

### 2. Keep `watch(startDate)` for subsequent changes but remove `immediate: true`

**Decision**: Remove `{ immediate: true }` from the watch since the initial scroll is now handled by `onSwiper`. This avoids the redundant (and failing) immediate execution.

**Rationale**: The immediate execution was meant to handle the initial scroll, but it can't because `swiperInstance` isn't ready yet. Since `onSwiper` now handles the initial case, the watch only needs to handle subsequent `selectedDate` changes.

**Alternative considered**: Keep `immediate: true` with a guard — works but redundant since `onSwiper` already handles it.

### 3. Keep `initial-slide` prop as fallback

**Decision**: Keep the `:initial-slide="selectedSlideIndex"` prop on the Swiper component as a secondary mechanism. This provides a reasonable starting position even if the `onSwiper` callback has a timing edge case.

**Rationale**: Zero cost, harmless safety net.

## Risks / Trade-offs

- **[Double scroll on mount]** Both `initial-slide` prop and `onSwiper` callback could trigger scrolling. → **Mitigation**: `initial-slide` sets the position without animation (it's a prop, not a method call), and `onSwiper` can use `slideTo(idx, 0)` (no animation) so there's no visual glitch even if both fire.
- **[Swiper not yet rendered in onSwiper]** `onSwiper` fires when the instance is created but virtual slides may not be in DOM yet. → **Mitigation**: Swiper's `slideTo` works with virtual index regardless of DOM state — it's index-based, not DOM-based.
