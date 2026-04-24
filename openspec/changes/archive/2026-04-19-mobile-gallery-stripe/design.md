## Context

`WdMediaPreview.vue` currently uses a single Swiper instance with fade effect on all viewports. On mobile (`$q.screen.xs`), it shows one image at a time with swipe navigation and pagination dots. The desktop view adds a thumbnail overlay row at the bottom.

The app already has a proven horizontal scrolling pattern in `WdWeatherForecast.vue` using Swiper's `FreeMode` + `Scrollbar` + `Mousewheel` modules. The user wants the mobile media preview to use a similar compact stripe approach — showing multiple image thumbnails in a horizontally scrollable row, each tappable to open the full-screen dialog.

The `WdMediaDialog` (Quasar Dialog plugin) already handles full-screen image viewing with all gallery features, so the stripe only needs to trigger it.

## Goals / Non-Goals

**Goals:**

- Replace single-image Swiper on mobile with a horizontally scrollable image stripe
- Stripe shows multiple thumbnails visible at once (like the weather forecast)
- Each thumbnail is tappable → opens `WdMediaDialog` at the correct index
- Stripe is slightly shorter in height than the current 3:2 aspect ratio preview
- Desktop view remains completely unchanged

**Non-Goals:**

- No changes to `WdMediaDialog` (full-screen viewer stays the same)
- No changes to desktop layout or behavior
- No lazy loading / infinite scroll (the image count is typically small, max ~5-20)
- No image ordering or management features

## Decisions

### 1. Use Swiper with FreeMode (same pattern as WdWeatherForecast)

**Decision**: Reuse Swiper with `FreeMode`, `Scrollbar`, and `Mousewheel` modules — the exact same approach as `WdWeatherForecast`.

**Rationale**: The user explicitly asked for scrolling "similar as for the weather forecast." Reusing the same modules and pattern ensures visual and behavioral consistency. The existing Swiper dependency is already loaded.

**Alternative considered**: Native CSS `overflow-x: scroll` — simpler but lacks the polished momentum scrolling, scrollbar behavior, and mousewheel support that Swiper provides.

### 2. Branch mobile vs desktop in WdMediaPreview template

**Decision**: Use `v-if="isMobile"` / `v-else` in the template to render the stripe vs the existing desktop swiper.

**Rationale**: The mobile and desktop behaviors are fundamentally different (stripe vs fade-swiper-with-thumbs). Clean conditional rendering is simpler and more maintainable than trying to share a single Swiper config that handles both.

### 3. Image size and aspect ratio for stripe

**Decision**: Use the actual image at 100px fixed height, preserving the original aspect ratio (landscape or portrait). Use `is_portrait` to select the correct orientation URLs (`urls.landscape` vs `urls.portrait`), and pick the `thumb` or `preview` variant for quality. Landscape images will be wider (~150px+), portrait images will be narrower (~67px). All slides are `slides-per-view="auto"` with `width: auto`.

**Rationale**: Using the actual image rather than a square crop shows the real composition and orientation of each photo. The `is_portrait` flag and `urls.portrait`/`urls.landscape` variants are already available in the `HutImage` type. A 100px height is compact enough for a stripe but large enough to be recognizable.

### 4. Tap to open dialog at correct index

**Decision**: Each stripe thumbnail click opens `WdMediaDialog` with the corresponding image index.

**Rationale**: The dialog already handles all gallery navigation, zoom, etc. The stripe just needs to be a compact entry point.

## Risks / Trade-offs

- **[Less visual impact on mobile]**: Users see small thumbnails instead of a hero image. This is the intended trade-off — compact scannability over visual impact.
- **[Swiper module bundle size]**: Adding FreeMode/Scrollbar/Mousewheel modules to WdMediaPreview. These are already imported by WdWeatherForecast so they're already in the bundle — no net increase.
