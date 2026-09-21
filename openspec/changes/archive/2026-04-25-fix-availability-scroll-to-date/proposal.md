## Why

The "slide to" selected date (or today) for the availability stripe does not work correctly in `WdAccommodationAvailabilities.vue`. When the component mounts or when `selectedDate` changes, the Swiper's `slideTo` call often fails to position at the correct day. The root cause is a **timing race condition**: the `watch` on `startDate` fires immediately (`{ immediate: true }`) before the Swiper instance is ready, and the `watchEffect` initialization also tries to call `slideTo` before `onSwiper` has fired.

## What Changes

- Fix the initialization scroll logic in `WdAccommodationAvailabilities.vue` so that Swiper reliably scrolls to the selected date (or today) on mount
- Fix the `watch(startDate)` to handle the case where `swiperInstance` is not yet available when it fires immediately
- Ensure the `onSwiper` callback triggers the initial scroll if it wasn't done yet
- Ensure scroll-to-date works on slug change and selected date change

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

_(none)_

## Impact

- **Affected files**: `src/components/huts/WdAccommodationAvailabilities.vue` — changes to the watch, watchEffect, and onSwiper callback
- **No API changes** — purely a frontend UI bug fix
- **No breaking changes** — same props, events, and visual behavior expected
