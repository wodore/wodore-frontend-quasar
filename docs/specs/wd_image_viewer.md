# Image Viewer Design Specification

## Overview

The image viewer provides a rich, interactive experience for browsing hut and nearby location images. It features a main image with thumbnail previews, proper attribution, and a full-screen carousel viewer.

## Components

### 1. WdHutImageGallery

The main gallery component that displays images in a compact, engaging format.

**Location:** `src/components/huts/WdHutImageGallery.vue`

#### Layout Structure

```
┌─────────────────────────────────────┐
│ ┌───────────────────────────────┐   │
│ │  License Badge (CC-BY 4.0)    │   │
│ │                               │   │
│ │                               │   │
│ │       Main Image              │   │
│ │                               │   │
│ │                               │   │
│ │                   ┌───┐┌───┐  │   │
│ │                   │ 1 ││ 2 │  │   │
│ │                   └───┘└───┘  │   │
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### Main Image Display

- **Position:** Prominent, centered display
- **Aspect Ratio:** Landscape orientation
- **Size:**
  - Desktop: Maximum width, responsive height
  - Mobile: 300px max width, flexible minimum
  - Border radius: 25px for rounded corners
- **Interactivity:** Clickable to open full-screen viewer
- **Shadow:** 8px shadow on desktop for depth

#### License Badge

- **Position:** Top-left corner (absolute positioning)
- **Content:** License name only (e.g., "CC-BY 4.0", "Public Domain")
- **Style:**
  - Semi-transparent background (rgba(0, 0, 0, 0.6))
  - White text
  - Small font size (0.75rem)
  - Padding: 4px 8px
  - Border radius: 4px
  - Subtle, non-intrusive design

#### Thumbnail Previews

- **Position:** Bottom-right corner
- **Quantity:** Maximum 4 thumbnails (images 2-4 from collection)
- **Size:** 60px × 60px
- **Style:**
  - Square aspect ratio
  - Border radius: 8px
  - Border: 2px solid rgba(255, 255, 255, 0.8)
  - No background overlay
- **Hover Effect:**
  - Semi-transparent overlay (rgba(0, 0, 0, 0.3))
  - Fullscreen icon appears in center
  - Smooth opacity transition (0.2s)
- **Interactivity:** Click to open full-screen viewer at that image

#### "More Images" Indicator

- **Display:** When total images > 4
- **Appearance:**
  - Same size as thumbnails (60px × 60px)
  - Semi-transparent black background (rgba(0, 0, 0, 0.6))
  - White text showing count (e.g., "+5")
  - Border: 2px solid rgba(255, 255, 255, 0.8)
  - Centered text
- **Behavior:** Opens full-screen viewer

#### Loading States

- **Initial Loading:** Shows spinner after 500ms delay
- **Progressive Loading:** Images appear as they load
- **Placeholder Images:** Low-res placeholders displayed while loading

#### Empty State

- **Icon:** Photo add icon (grey)
- **Message:** "No images available"
- **Action:** Button to add images via GitHub issue

### 2. WdImageCarousel

Full-screen image viewer wrapper component that opens a Quasar dialog containing the Swiper gallery.

**Location:** `src/components/huts/WdImageCarousel.vue`

#### Display

- **Mode:** Maximized Quasar dialog (100vh height)
- **Background:** Black
- **Content:** Delegates to WdSwiperGallery component

### 3. WdSwiperGallery

Full-screen image viewer with Swiper.js-based carousel navigation.

**Location:** `src/components/huts/WdSwiperGallery.vue`

#### Technology Stack

- **Swiper.js v12.1.2**: MIT-licensed touch slider with modern features
- **Vue 3 Integration**: Official Swiper Vue components
- **Modules Used**:
  - `Keyboard`: Keyboard navigation support (arrow keys, ESC)
  - `Navigation`: Arrow button navigation
  - `Thumbs`: Thumbnail gallery synchronization

#### Display

- **Mode:** Full viewport height (100vh)
- **Background:** Black
- **Animation:** Smooth Swiper slide transitions
- **Navigation:**
  - Touch gestures (swipe left/right)
  - Keyboard navigation (arrow keys, ESC)
  - Navigation arrows (left/right buttons)
  - Thumbnail strip at bottom
  - Bidirectional synchronization between main gallery and thumbnails

#### Main Gallery

- **Height:** Flexible (fills available space above thumbnails)
- **Max Width:** 2200px (centered)
- **Image Sizing:**
  - Screens < 1200px: Use medium size (800px)
  - Screens ≥ 1200px: Use large size (1600px)
  - HiDPI devices (pixelRatio ≥ 1.5): Use @2x variants
  - Orientation based on `preferred_mode` (landscape/square/portrait)
- **Object Fit:** Contain (full image visible, no cropping)
- **Placeholder:** Low-res blur hash while loading

#### Thumbnail Strip

- **Position:** Bottom of viewport
- **Height:** 120px (including padding)
- **Background:** Semi-transparent black (rgba(0, 0, 0, 0.9))
- **Visibility:** Only shown when there are 2+ images
- **Thumbnails:**
  - Size: 80px × 80px
  - Shape: Square (using `urls.square.thumb` - 100px variant)
  - Spacing: 8px gap between thumbnails
  - Border radius: 8px
  - Opacity states:
    - Inactive: 40% opacity
    - Visible: 70% opacity
    - Active: 100% opacity with blue border (#1976d2)
  - Free scrolling with touch gestures
  - Auto-synchronization with main gallery

#### Image Sizing Strategy

The gallery uses an intelligent image sizing strategy to balance quality and performance:

**Main Gallery Images:**

- **Size Selection Logic:**
  - Medium screens (≤1600px wide or ≤1200px tall): Uses `medium` (800px)
  - Large screens (>1600px wide or >1200px tall): Uses `large` (1600px)
  - **Minimum size is always medium** - no preview size used for main images
- **HiDPI/Retina Support:**
  - Devices with `devicePixelRatio ≥ 1.5` automatically use @2x variants
  - Example: On a 2x display, medium becomes `medium@2x` (1600px instead of 800px)
  - Large becomes `large@2x` (3200px on 2x displays)
- **Orientation:** Based on `image.preferred_mode` (landscape/square/portrait)
- **Fallback Chain:** If chosen size doesn't exist → medium → preview → thumb
- **No Placeholders:** Placeholder images not used, images load directly

**Thumbnail Images:**

- **Size:** Always uses `urls.square.thumb` (100px square images)
- **HiDPI Support:** Devices with `devicePixelRatio ≥ 1.5` use `thumb@2x` (200px)
- **Purpose:** Small file size (~8KB vs ~2MB for large images)
- **No Placeholders:** Placeholder images not used for thumbnails

**Preloading Strategy:**

- **Current Implementation:** Swiper.js handles lazy loading automatically
- **What Gets Loaded:** Only visible and near-visible slides are loaded
- **Thumbs:** All thumbnail images load immediately (small size, ~8KB each)
- **Main Images:** Loaded on-demand as user navigates
- **Performance:** ~94% bandwidth reduction compared to loading all large images upfront

#### Close Button

- **Position:** Top-right corner (16px from edges)
- **Style:** Flat, round, dense Quasar button
- **Icon:** Close icon
- **Tooltip:** "Close"
- **Action:** Emits 'close' event to parent

#### Download Button

- **Position:** Top-right corner (16px from right, 70px from top)
- **Style:** Flat, round, dense Quasar button
- **Icon:** Download icon
- **Tooltip:** "Download original"
- **Action:** Opens original image URL in new tab (`urls.original.raw`)

#### License Badge

- **Position:** Top-left corner (16px from edges)
- **Content:** License slug only (e.g., "CC-BY 4.0", "PD")
- **Style:**
  - Quasar badge component
  - White background, black text
  - Small font size (0.875rem)
  - Medium weight (500)
  - 90% opacity
- **Updates Dynamically:** Changes with active slide

#### Attribution Display

- **Position:** Bottom overlay (above thumbnails)
- **Style:**
  - Gradient background (black → transparent)
  - White text
  - Right-aligned
  - Small font size (0.875rem)
  - Padding: 32px top, 16px bottom/sides
  - Full HTML rendering (links, formatting)
  - Pointer events disabled (non-interactive)
- **Content:** Complete attribution line with author, license, and source
- **Updates Dynamically:** Changes with active slide

#### Responsive Behavior

- **Small Screens (< 1200px):**
  - Uses medium image size
  - Full-width layout
  - Touch-optimized thumbnail spacing

- **Large Screens (≥ 1200px):**
  - Uses large image size
  - Max-width 2200px with centering
  - More generous spacing

#### Keyboard Support

- **Left/Right Arrows**: Navigate to previous/next slide
- **ESC**: Close gallery (emits close event)
- Native Swiper keyboard module integration

#### Touch Support

- **Swipe Left/Right**: Navigate between slides
- **Swipe on Thumbnails**: Scroll thumbnail strip
- Native Swiper touch handling

#### HiDPI/Retina Support

- **Detection**: `window.devicePixelRatio >= 1.5`
- **Action**: Automatically uses @2x image variants
- **Benefit**: Crisp display on high-DPI screens

#### Empty State

- **Display:** Centered message when no images (handled by parent component)
- **Icon:** Image not supported icon (4rem)
- **Message:** "No images available"

## Data Structures

### HutImage Interface

```typescript
interface HutImage {
  id: string; // {provider}_{source_id}
  provider: string; // Image provider
  provider_info: {
    name: string;
    slug: string;
    website: string | null;
    icon: string | null;
  };
  source_id: string;
  source_url: string;
  image_type: string;
  captured_at: string | null;
  distance_m: number;
  license_slug: string; // e.g., "CC-BY 4.0", "PD"
  attribution: string; // Full HTML attribution
  author: string | null;
  urls: ImageUrls; // Multiple size variants
  width: number | null;
  height: number | null;
  preferred_mode: string;
  focal: FocalPoint | null;
  crop: CropArea | null;
  place: ImagePlace | null;
  score: number;
}
```

### ImageUrls Interface

```typescript
interface ImageUrls {
  square: ImageSizeVariants; // For thumbnails
  landscape: ImageSizeVariants; // For main display
  portrait: ImageSizeVariants; // For mobile/portrait
}

interface ImageSizeVariants {
  avatar: string; // 32px
  thumb: string; // 100px
  preview: string; // 400px
  medium: string; // 800px
  large: string; // 1600px
  placeholder: string; // Tiny blur hash
}
```

## Usage Patterns

### Fetching Nearby Images

Use the `useNearbyImages` composable:

```typescript
import { useNearbyImages } from 'src/composables/useNearbyImages';

const lat = ref(46.7);
const lon = ref(8.22);

const { images, loading, error } = useNearbyImages(lat, lon);
```

#### Progressive Loading Strategy

1. **Fast Initial Load:** Fetches Wodore images only (limit: 20)
2. **Complete Load:** Fetches all sources (Wikipedia, Panoramio, etc.)
3. **Merge:** Combines results without duplicates
4. **Display:** Updates UI progressively as data arrives

### Displaying Images

```vue
<WdHutImageGallery :images="images" :loading="loading" :lat="location.lat" :lon="location.lon" />
```

## API Integration

### Nearby Images Endpoint

**URL:** `/v1/geo/images/nearby`

**Query Parameters:**

- `lat` (number, required): Latitude
- `lon` (number, required): Longitude
- `radius` (number, optional): Search radius in meters (default: 50)
- `precision` (string, optional): "precise" or "approximate" (default: "precise")
- `limit` (number, optional): Maximum results (default: 20)
- `sources` (string, optional): Comma-separated sources or "all" (default: "all")
- `lang` (string, optional): Language code (default: "de")

**Response:** GeoJSON FeatureCollection with image metadata

## Design Principles

### Performance

- **Lazy Loading:** Images load on-demand
- **Progressive Enhancement:** Low-res placeholders first, high-res later
- **Debouncing:** 500ms delay before showing loading spinner
- **Image Optimization:** Multiple size variants for responsive display

### Accessibility

- **Keyboard Navigation:** Full support for keyboard users
- **Screen Readers:** Proper alt text and ARIA labels
- **Touch Targets:** Minimum 44px for interactive elements
- **Focus Indicators:** Clear focus states for all controls

### Visual Hierarchy

1. **Main Image:** Largest, most prominent
2. **Thumbnails:** Secondary, smaller but accessible
3. **Attribution:** Subtle, non-intrusive but visible
4. **License Badge:** Clear, concise label

### Responsive Design

- **Mobile (< 576px):**
  - Single column layout
  - Full-width main image
  - Smaller thumbnails (50px)
  - Touch-optimized interactions

- **Tablet (576px - 1024px):**
  - Balanced layout
  - Medium-sized thumbnails
  - Hybrid touch/mouse interactions

- **Desktop (> 1024px):**
  - Maximum width for main image
  - Larger thumbnails (60px)
  - Hover effects enabled

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- WebGL support for map integration
- CSS Grid and Flexbox
- ES6+ JavaScript features

## Future Enhancements

### Potential Features

- **Image Filters:** Filter by date, provider, or license
- **Download Support:** Allow users to download images
- **Sharing:** Share images with attribution
- **Map Integration:** Show image locations on map
- **Upload:** User-contributed images
- **Favorites:** Save preferred images
- **Slideshow Mode:** Auto-advance through images

### Performance Optimizations

- **Virtual Scrolling:** For large image collections
- **Prefetching:** Preload next/previous images
- **Caching:** Service worker for offline access
- **CDN:** Global content delivery

## Related Components

- **WdMapView:** Map display with image integration
- **WdHutView:** Hut detail page
- **useNearbyImages:** Image fetching composable
- **Image Service:** Image processing and optimization service

## References

- [Quasar Image Component](https://quasar.dev/vue-components/img)
- [Quasar Carousel Component](https://quasar.dev/vue-components/carousel)
- [VueUse: Timeout Function](https://vueuse.org/core/useTimeoutFn/)
- [Creative Commons Licenses](https://creativecommons.org/licenses/)
