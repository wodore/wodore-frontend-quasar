## Context

The mobile place detail page uses `pure-web-bottom-sheet` with `nested-scroll` and `expand-to-scroll` attributes for vertical scrolling. Inside the bottom sheet, two Swiper instances render horizontal sliders:

1. **WdAccommodationAvailabilities** — availability stripe with virtual slides (365+ days)
2. **WdWeatherForecast** — 18-day weather forecast

Both Swipers use `FreeMode` + `Mousewheel` + `Scrollbar` modules. By default, Swiper enables `simulateTouch: true`, which uses JavaScript `touchmove` event listeners to simulate drag behavior. On touch devices, this intercepts the touch sequence — Swiper calls `preventDefault()` on touch events, which prevents the browser's native vertical scroll from propagating to the bottom sheet.

The desktop view is unaffected because it uses Quasar's `q-scroll-area` in a drawer, which handles scroll events differently.

A similar issue was previously observed with the weather forecast Swiper. The commit `ac59d0d` ("Improve swiper for weather and availabities") adjusted parameters but did not address the core touch conflict.

## Goals / Non-Goals

**Goals:**

- Allow vertical touch scrolling in the mobile bottom sheet to work alongside horizontal Swiper sliders
- Preserve horizontal swipe/drag functionality in Swiper on mobile
- Minimize changes to Swiper configuration

**Non-Goals:**

- Changing the bottom sheet library or its configuration
- Redesigning the availability or weather components
- Affecting desktop behavior

## Decisions

### Decision 1: Use `touchMoveStopPropagation: false` and `touchStartPreventDefault: false`

**Rationale**: Swiper's default behavior captures touch events and calls `stopPropagation()` on `touchmove`, preventing the parent scroll container from receiving vertical scroll events. Setting `touchMoveStopPropagation: false` allows the vertical component of touch gestures to propagate to the bottom sheet. Setting `touchStartPreventDefault: false` ensures the initial touch event isn't swallowed.

**Alternative considered**: `cssMode: true` — This uses native CSS scroll for the Swiper. However, `cssMode` is incompatible with several Swiper modules and behaviors:

- Does not work with `Virtual` module (used by availability stripe for 365+ slides)
- Changes scrollbar behavior
- Does not support `FreeMode` momentum parameters
- Would require significant rework for availability component

**Alternative considered**: `simulateTouch: false` — This disables Swiper's JS touch handling entirely. However, this breaks horizontal swiping on touch devices because Swiper then relies on native horizontal scroll, which may conflict with the bottom sheet's vertical scroll snap behavior.

### Decision 2: Apply to both Swiper instances

Both `WdAccommodationAvailabilities.vue` and `WdWeatherForecast.vue` should receive the same fix, since either one appearing in the viewport can block touch scrolling.

## Risks / Trade-offs

- **Risk**: Setting `touchMoveStopPropagation: false` may cause slight horizontal jitter when the user intends a purely vertical scroll, as Swiper still processes the horizontal component of the gesture. This is mitigated by `FreeMode` which doesn't snap slides.
- **Trade-off**: Using `touchMoveStopPropagation: false` is a lighter fix than `cssMode` and preserves all existing Swiper features (Virtual slides, FreeMode parameters, Scrollbar).
- **Testing needed**: Verify on iOS Safari and Android Chrome, as touch event handling varies between browsers.
