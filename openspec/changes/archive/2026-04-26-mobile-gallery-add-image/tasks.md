## 1. Mobile Stripe Add-Image Slide

- [x] 1.1 In `WdMediaPreview.vue`, create a computed property for the mobile stripe slides that inserts an add-image marker at index 2 (3rd position) when `isMobile` and `images.length >= 2`, with remaining images after it
- [x] 1.2 Style the add-image slide with gradient background matching `WdNoImage` (`linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)`), centered `IconAddPhoto` icon, and same 85px height + border-radius as image slides
- [x] 1.3 Wire the slide's click handler to `handleAddImageClick` (same as current contribute flow)

## 2. Hide Floating Overlay on Mobile

- [x] 2.1 In `WdHutImageGallery.vue`, add a condition to hide the `contribute-btn-overlay` on mobile (`$q.screen.xs`) when images exist
- [x] 2.2 Verify desktop overlay button still renders and functions correctly

## 3. Verification

- [x] 3.1 Run `yarn lint` and `npx vue-tsc --noEmit` to verify no lint/type errors
- [x] 3.2 Verify the add-image slide does not appear in the desktop gallery view
