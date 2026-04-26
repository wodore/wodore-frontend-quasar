## Context

The mobile image gallery in `WdMediaPreview.vue` renders as a horizontal stripe of thumbnails using Swiper. Currently, an "add image" button is rendered as a floating overlay in `WdHutImageGallery.vue` (positioned absolute at top-left), which feels disconnected from the stripe layout.

The `WdNoImage.vue` component already provides a clean visual style for the "no images" state with a gradient background and centered icon. We can reuse this visual language for an inline "add image" slide within the stripe.

**Current mobile stripe**: `[img1] [img2] [img3] ...` with a floating `+` button overlay at top-left.

## Goals / Non-Goals

**Goals:**

- Integrate the "add image" action into the mobile stripe as a slide element
- Reuse `WdNoImage` visual style (gradient background, centered icon) but icon-only (no text)
- Keep the floating overlay button on desktop unchanged
- Only apply the inline add-image slide on mobile (xs breakpoint)

**Non-Goals:**

- Changing desktop gallery behavior
- Changing the dialog/gallery viewing experience
- Adding new props or complex configuration beyond what's needed

## Decisions

### 1. Add-image slide placement in mobile stripe

**Decision**: Insert the "add image" slide at the **3rd position** (index 2) in the mobile stripe Swiper, when >= 2 images exist. Images beyond the 2nd appear after the add-image slide.

**Rationale**: The user explicitly wants it at the 3rd position. This makes the add-image action immediately visible without scrolling when there are 2+ images, encouraging contributions. The slide only appears when images exist (the no-image case already shows `WdNoImage` full-width).

**Alternative considered**: Appending at the end — rejected per user preference for 3rd position.

### 2. Reuse WdNoImage component vs. inline styling

**Decision**: Create the add-image slide directly in `WdMediaPreview.vue` with styling that matches `WdNoImage`'s gradient background and icon appearance, rather than embedding `WdNoImage` inside a Swiper slide.

**Rationale**: `WdNoImage` uses padding-top aspect ratio and absolute positioning which doesn't work well inside a Swiper slide that has a fixed height (85px). A simple div with matching gradient background and centered icon is cleaner. The visual result will be identical.

### 3. Hide the floating overlay button on mobile

**Decision**: In `WdHutImageGallery.vue`, conditionally hide the `contribute-btn-overlay` on mobile (`$q.screen.xs`) since the inline slide replaces its function.

**Rationale**: Having both would be redundant and confusing. The inline slide provides a better mobile UX.

## Risks / Trade-offs

- **Slide width**: The add-image slide needs a fixed width to look good in the stripe. Using the same 85px height with a square or slightly wider aspect ratio should work well.
- **Touch interaction**: The Swiper's free-mode dragging must not interfere with tapping the add-image slide. Using `@click` on the slide (same as image slides) should work since Swiper distinguishes taps from drags.
