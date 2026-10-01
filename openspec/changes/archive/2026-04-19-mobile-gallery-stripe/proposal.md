## Why

The current mobile media preview (`WdMediaPreview`) shows a single full-width image with swipe-to-navigate and pagination dots. This is a heavy, full-screen-like experience that doesn't match the lightweight, scannable style used elsewhere in the app (e.g., weather forecast stripe). A compact horizontal image stripe would feel more native to the mobile layout and let users quickly browse images at a glance.

## What Changes

- Replace the single-image Swiper on mobile (`$q.screen.xs`) with a horizontally scrollable image stripe
- The stripe shows the actual images (not square crops) at 100px height, respecting the original landscape or portrait orientation
- Each image in the stripe is tappable to open the full-screen `WdMediaDialog`
- The stripe height is fixed at 100px — more compact than the current single-image preview
- Desktop behavior remains completely unchanged (single image with fade transition + thumbnail overlay)

## Capabilities

### New Capabilities

- `mobile-image-stripe`: A horizontally scrollable image stripe for mobile viewports that shows actual images (landscape/portrait) at 100px height, with tap-to-open-dialog behavior

### Modified Capabilities

<!-- No existing specs are being modified -->

## Impact

- **Component**: `src/components/media/WdMediaPreview.vue` — major template/logic changes for mobile branch
- **Dependencies**: Swiper modules (`FreeMode`, `Scrollbar`, `Mousewheel`) already used by weather forecast; may need to be added to the media preview imports
- **No API changes**: Uses existing `HutImage` type and thumbnail URLs
- **No routing changes**: Dialog opening logic remains the same
