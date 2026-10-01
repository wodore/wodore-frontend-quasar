## Why

The current "add image" button on mobile is a floating circular overlay positioned at the top-left of the gallery stripe. It feels disconnected from the gallery and doesn't visually integrate with the horizontal image stripe. On mobile, the stripe already shows image thumbnails side-by-side — placing the add-image action as a stripe slide would feel much more natural and discoverable.

## What Changes

- Add a new "add image" slide at the **3rd position** in the mobile stripe gallery in `WdMediaPreview.vue`, when >= 2 images exist. Any images beyond the 2nd are shifted after the add-image slide
- The add-image slide uses the same visual style as `WdNoImage` (subtle background gradient, centered add-photo icon) but without text — icon only
- Hide the current floating `contribute-btn-overlay` on mobile in `WdHutImageGallery.vue` (desktop keeps it as-is)
- The add-image slide triggers the same contribute navigation as the current overlay button
- Mobile-only change; desktop gallery remains unchanged

## Capabilities

### New Capabilities

- `mobile-stripe-add-slide`: An "add image" slide embedded within the mobile stripe gallery, styled consistently with the WdNoImage component but icon-only

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- `src/components/media/WdMediaPreview.vue` — Add a new swiper slide at the end of the mobile stripe, plus styling
- `src/components/media/WdNoImage.vue` — Possibly add a `hideText` prop to reuse the component's visual style for the inline slide
- `src/components/huts/WdHutImageGallery.vue` — Conditionally hide the floating contribute button on mobile
- No API or dependency changes
