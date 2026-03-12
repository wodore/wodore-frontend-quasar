# Media Viewer Design Specification

## Overview

The media viewer provides a rich, interactive experience for browsing images from various sources (huts, locations, etc.). It features a main image with thumbnail previews, proper attribution, and a full-screen carousel viewer.

## Architecture

The media viewer system is **generic and reusable** across different image sources. It consists of three main components:

1. **WdMediaPreview** - Generic preview component (displays images inline)
2. **WdMediaDialog** - Generic dialog wrapper (opens full-screen viewer)
3. **WdMediaGallery** - Generic full-screen gallery (Swiper-based)

Plus a **thin hut-specific wrapper**: 4. **WdHutImageGallery** - Hut-specific wrapper that uses the generic components

### Component Hierarchy

```
WdHutImageGallery (hut-specific wrapper)
└── WdMediaPreview (generic)
    ├── WdMediaDialog (generic)
    │   └── WdMediaGallery (generic)
    └── Inline thumbnail preview with Swiper
```

## Components

### 1. WdMediaPreview (Generic)

The main preview component that displays images in a compact, engaging format. This is a **generic, reusable component** that can work with any image collection.

**Location:** `src/components/media/WdMediaPreview.vue`

#### Props

```typescript
interface Props {
  images: HutImage[]; // Array of images to display
  loading?: boolean; // Loading state
  addImageUrl?: string; // URL for "add image" button
  emptyStateMessage?: string; // Custom empty state message
  emptyStateIcon?: string; // Custom empty state icon
  maxThumbnailCount?: number; // Max thumbnails to show (default: 4)
  thumbnailSize?: number; // Thumbnail size in px (default: 60)
  showAttribution?: boolean; // Show attribution badge (default: true)
}
```

#### Events

```typescript
emit: {
  (e: 'image-click', image: HutImage, index: number): void;
  (e: 'add-image-click'): void;
}
```

#### Features

- Swiper.js-based main image display with fade transitions
- Thumbnail strip overlay (bottom-right corner)
- Inline thumbnail swiper with synchronization
- Attribution badge (top-right, stationary)
- Provider icons on thumbnails
- "More images" indicator when > maxThumbnailCount
- Loading states with spinner (500ms delay)
- Empty state with customizable message and optional "add image" button

#### Usage Example

```vue
<template>
  <WdMediaPreview
    :images="myImages"
    :loading="isLoading"
    add-image-url="https://example.com/add"
    empty-state-message="No photos yet"
    :max-thumbnail-count="4"
    @image-click="handleImageClick"
  />
</template>
```

### 2. WdMediaDialog (Generic)

Full-screen image viewer wrapper component that opens a Quasar dialog containing the gallery.

**Location:** `src/components/media/WdMediaDialog.vue`

#### Props

```typescript
interface Props {
  images: HutImage[];
  initialSlide?: number;
}
```

#### Events

```typescript
emit: {
  (e: 'close'): void;
}
```

#### Features

- Maximized Quasar dialog (100vh height)
- Black background
- Backdrop click to close
- ESC key support
- Delegates to WdMediaGallery for actual functionality

### 3. WdMediaGallery (Generic)

Full-screen image viewer with Swiper.js-based carousel navigation. This is a **generic, reusable component** that can display any collection of images.

**Location:** `src/components/media/WdMediaGallery.vue`

#### Technology Stack

- **Swiper.js v12.1.2**: MIT-licensed touch slider
- **Vue 3 Integration**: Official Swiper Vue components
- **Modules Used**:
  - `Keyboard`: Keyboard navigation (arrow keys, ESC)
  - `Navigation`: Arrow button navigation
  - `Thumbs`: Thumbnail gallery synchronization

#### Props

```typescript
interface Props {
  images: HutImage[];
  initialSlide?: number;
}
```

#### Features

- Full viewport height (100vh)
- Black background
- Smooth Swiper slide transitions
- Touch gestures (swipe left/right)
- Keyboard navigation (arrow keys, ESC)
- Navigation arrows (left/right buttons)
- Thumbnail strip at bottom (120px height)
- Download original button
- Close button
- Attribution display (top-left)
- Responsive margins on large screens (≥1200px)

#### Image Sizing Strategy

**Main Gallery Images:**

- Medium screens (≤1600px wide or ≤1200px tall): Uses `medium` (800px)
- Large screens (>1600px wide or >1200px tall): Uses `large` (1600px)
- HiDPI devices (pixelRatio ≥ 1.5): Uses @2x variants
- Orientation based on `is_portrait` (landscape/square/portrait)
- Minimum size is always medium - no preview size used

**Thumbnail Images:**

- Always uses `urls.square.thumb` (100px square images)
- HiDPI devices use `thumb@2x` (200px)
- Small file size (~8KB vs ~2MB for large images)

**Performance:** ~94% bandwidth reduction compared to loading all originals

### 4. WdHutImageGallery (Hut-Specific Wrapper)

A **thin wrapper** around WdMediaPreview that provides hut-specific functionality.

**Location:** `src/components/huts/WdHutImageGallery.vue`

#### Props

```typescript
interface Props {
  images: HutImage[];
  loading?: boolean;
  hut?: schemasWodore['HutSchemaDetails'];
}
```

#### Features

- Uses generic WdMediaPreview component
- Generates MapComplete URL for adding images
- Provides hut-specific empty state message
- Minimal code - just configuration

## Data Loading

### useMediaImages (Generic Composable)

Generic image loading composable that supports multiple data sources.

**Location:** `src/composables/useMediaImages.ts`

#### Options

```typescript
interface MediaImagesOptions {
  hutSlug?: string; // Load by hut slug (fastest)
  placeName?: string; // Load by place name (TODO: geocoding)
  lat?: number; // Load by coordinates
  lon?: number;
  radius?: number; // Search radius in meters
  limit?: number; // Max results
  progressive?: boolean; // Progressive loading (coords only)
}
```

**Important:** Only ONE source should be provided (hutSlug XOR placeName XOR coordinates)

#### Usage Examples

```typescript
// Load by hut slug
const { images, loading } = useMediaImages({
  hutSlug: 'chalet-du-mont-d-arbois',
  radius: 50,
  limit: 20,
});

// Load by coordinates
const { images, loading } = useMediaImages({
  lat: 46.7,
  lon: 8.22,
  radius: 50,
  limit: 20,
  progressive: true,
});

// Load by place name (not yet implemented)
const { images, loading } = useMediaImages({
  placeName: 'Zermatt',
  radius: 50,
  limit: 20,
});
```

#### Features

- **Priority**: hutSlug > coordinates > placeName
- **Progressive loading** (coordinates only): Fetches Wodore images first, then all sources
- **Automatic deduplication**: Merges results without duplicates
- **Type-safe**: Full TypeScript support

### useHutImages (Hut-Specific Wrapper)

A thin wrapper around useMediaImages for hut-specific loading.

**Location:** `src/composables/useHutImages.ts`

#### Usage

```typescript
const hutSlug = ref('chalet-du-mont-d-arbois');
const { images, loading, error } = useHutImages(hutSlug);
```

#### Features

- Uses `/v1/geo/images/hut/{hut_slug}` endpoint (specialized, faster)
- Simplified API - just pass hutSlug
- Internally uses useMediaImages composable

## Data Structures

### HutImage Interface

```typescript
interface HutImage {
  id: string; // {provider}_{source_id}
  provider: {
    name: string;
    slug: string;
    website: string | null;
    icon: string | null;
  };
  source_id: string;
  attribution: {
    short?: string;
    full?: string;
  };
  license: {
    name: string;
    slug: string;
    url: string | null;
  };
  urls: ImageUrls;
  is_portrait?: boolean;
  captured_at?: string;
  width?: number;
  height?: number;
  distance_m?: number;
  image_type?: string;
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
  'avatar@2x': string;
  thumb: string; // 100px
  'thumb@2x': string; // 200px
  preview: string; // 400px
  'preview@2x': string; // 800px
  placeholder: string; // Tiny blur hash
  'placeholder@2x': string;
  medium: string; // 800px
  'medium@2x': string; // 1600px
  large: string; // 1600px
  'large@2x': string; // 3200px
}
```

## Usage Patterns

### Basic Usage with Hut Images

```vue
<script setup lang="ts">
import { useHutImages } from 'src/composables/useHutImages';
import { WdHutImageGallery } from 'components/huts/WdHutImageGallery.vue';

const hutSlug = ref('chalet-du-mont-d-arbois');
const { images, loading } = useHutImages(hutSlug);
</script>

<template>
  <WdHutImageGallery :images="images" :loading="loading" :hut="hut" />
</template>
```

### Generic Usage (Any Image Collection)

```vue
<script setup lang="ts">
import { WdMediaPreview } from 'components/media/WdMediaPreview.vue';

const myImages = ref<HutImage[]>([...]);
</script>

<template>
  <WdMediaPreview :images="myImages" empty-state-message="No photos yet" :max-thumbnail-count="6" />
</template>
```

### Generic Usage with useMediaImages

```vue
<script setup lang="ts">
import { useMediaImages } from 'src/composables/useMediaImages';
import { WdMediaPreview } from 'components/media/WdMediaPreview.vue';

const options = ref({
  lat: 46.7,
  lon: 8.22,
  radius: 50,
  limit: 20,
  progressive: true,
});

const { images, loading } = useMediaImages(options);
</script>

<template>
  <WdMediaPreview :images="images" :loading="loading" />
</template>
```

## API Integration

### Hut Images Endpoint

**URL:** `/v1/geo/images/hut/{hut_slug}`

**Query Parameters:**

- `lang` (string): Language code (default: "de")
- `radius` (number): Search radius in meters (default: 50)
- `limit` (number): Maximum results (default: 20)

**Response:** GeoJSON FeatureCollection with image metadata

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

### Generic & Reusable

- **No hardcoded logic**: Components work with any image collection
- **Configurable**: Props control behavior, appearance, and features
- **Composable**: Can be used independently or combined
- **Type-safe**: Full TypeScript support

### Performance

- **Lazy Loading:** Images load on-demand via Swiper
- **Progressive Enhancement:** HiDPI variants for retina displays
- **Debouncing:** 500ms delay before showing loading spinner
- **Image Optimization:** Multiple size variants for responsive display
- **Bandwidth Efficiency:** ~94% reduction vs loading all originals

### Accessibility

- **Keyboard Navigation:** Full support for keyboard users
- **Touch Targets:** Minimum 44px for interactive elements
- **Focus Indicators:** Clear focus states for all controls

### Visual Hierarchy

1. **Main Image:** Largest, most prominent
2. **Thumbnails:** Secondary, smaller but accessible
3. **Attribution:** Subtle, non-intrusive but visible

## Migration from Old Architecture

### Before (Hut-Specific)

```
WdHutImageGallery.vue (263 lines, hut-specific)
├── WdImageCarousel.vue (dialog wrapper)
│   └── WdSwiperGallery.vue (gallery)
└── useHutImages.ts (hut-specific loading)
```

### After (Generic + Hut Wrapper)

```
WdHutImageGallery.vue (30 lines, thin wrapper)
└── WdMediaPreview.vue (generic, reusable)
    ├── WdMediaDialog.vue (generic, renamed)
    │   └── WdMediaGallery.vue (generic, renamed)
    └── useMediaImages.ts (generic loading)
        └── useHutImages.ts (thin wrapper)
```

### Benefits

1. **Reusable**: Can use WdMediaPreview for any image collection
2. **Maintainable**: Generic logic in one place, specific logic in wrappers
3. **Extensible**: Easy to add new image sources (places, users, etc.)
4. **Clean**: Separation of concerns between generic and specific

## Future Enhancements

### Potential Features

- **Image Filters:** Filter by date, provider, or license
- **Sharing:** Share images with attribution
- **Map Integration:** Show image locations on map
- **Upload:** User-contributed images
- **Favorites:** Save preferred images
- **Slideshow Mode:** Auto-advance through images
- **Zoom:** Pinch-to-zoom on mobile

### New Image Sources

The generic architecture makes it easy to add new image sources:

```typescript
// Example: User images
const { images } = useMediaImages({
  userId: 'user123',
  limit: 50,
});

// Example: Place images (after geocoding implementation)
const { images } = useMediaImages({
  placeName: 'Zermatt, Switzerland',
  radius: 100,
  limit: 30,
});
```

## Related Components

- **WdMapView:** Map display with image integration
- **WdHutView:** Hut detail page
- **useMediaImages:** Generic image fetching composable
- **useHutImages:** Hut-specific image fetching composable

## References

- [Quasar Image Component](https://quasar.dev/vue-components/img)
- [Swiper.js Documentation](https://swiperjs.com/)
- [VueUse: Timeout Function](https://vueuse.org/core/useTimeoutFn/)
- [Creative Commons Licenses](https://creativecommons.org/licenses/)
