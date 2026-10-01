## 1. Fix initial scroll timing

- [x] 1.1 Move initial `slideTo` call from `watchEffect` nextTick into the `onSwiper` callback — call `swiper.slideTo(selectedSlideIndex.value, 0)` when Swiper becomes ready
- [x] 1.2 Remove the `nextTick(() => { swiperInstance.value?.slideTo(...) })` from the `watchEffect` initialization block
- [x] 1.3 Remove `{ immediate: true }` from the `watch(startDate)` — initial scroll is now handled by `onSwiper`, watch only handles subsequent changes

## 2. Verify and clean up

- [x] 2.1 Run `yarn lint` and `npx vue-tsc --noEmit` to verify no errors
