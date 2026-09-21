## Why

Touch scrolling does not work on the place detail page in mobile view. The page scrolls fine with a mouse wheel, but touch/drag scrolling is broken. The root cause is Swiper instances (weather forecast and availability stripe) intercepting touch events via JavaScript (`simulateTouch: true` by default), which prevents vertical touch scroll propagation through the `pure-web-bottom-sheet` container. A similar issue was previously observed with the weather forecast Swiper.

## What Changes

- Configure Swiper in `WdAccommodationAvailabilities.vue` and `WdWeatherForecast.vue` to not interfere with vertical touch scrolling inside the mobile bottom sheet
- Either disable `simulateTouch` (relying on native touch for horizontal swiper swipe), use `cssMode: true` (native CSS scroll-based swiper), or configure `touchMoveStopPropagation: false` / `touchStartPreventDefault: false` to allow vertical scroll events to pass through

## Capabilities

### New Capabilities

- `swiper-touch-coexistence`: Ensures Swiper horizontal sliders coexist with vertical touch scrolling in the mobile bottom sheet without blocking scroll events

### Modified Capabilities

_(none)_

## Impact

- `src/components/huts/WdAccommodationAvailabilities.vue` — Swiper configuration
- `src/components/content/place/WdWeatherForecast.vue` — Swiper configuration
- Mobile UX: Users can vertically scroll the place detail page while Swiper sliders still support horizontal swipe
- Desktop UX: Unchanged (drawer uses `q-scroll-area`, not affected)
