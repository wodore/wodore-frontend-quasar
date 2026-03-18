<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { Keyboard, Mousewheel, Navigation, Thumbs, Zoom, EffectFade } from 'swiper/modules';
import { date } from 'quasar';
import type { HutImage } from 'src/composables/useHutImages';
import { useDeviceDetection } from '@composables/useDeviceDetection';
import { useMediaPreload } from '@composables/useMediaPreload';
import { useI18n } from 'vue-i18n';
import IconCloseOutline from '~icons/eva/close-outline';
import IconDownloadOutline from '~icons/eva/download-outline';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/keyboard';
import 'swiper/css/mousewheel';
import 'swiper/css/zoom';
import 'swiper/css/effect-fade';

interface Props {
  images: HutImage[];
  initialSlide?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialSlide: 0,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const thumbsSwiper = ref<SwiperType | null>(null);
const mainSwiper = ref<SwiperType | null>(null);
const activeSlideIndex = ref(props.initialSlide);
const loadedImages = ref<Set<string>>(new Set());
const isZoomed = ref(false);

// Use shared device detection
const { hasTouch } = useDeviceDetection();

// Use shared media preload composable
const imagesRef = computed(() => props.images);
const activeSlideRef = computed(() => activeSlideIndex.value);
const { getGalleryImageUrl, getPreviewImageUrl, preloadAdjacentImages, preloadThumbnailImages } =
  useMediaPreload(imagesRef, activeSlideRef);

// Track which images have loaded
const isImageLoaded = (imageId: string) => {
  return loadedImages.value.has(imageId);
};

// Mark image as loaded
const onImageLoad = (imageId: string) => {
  loadedImages.value.add(imageId);
};

// Set thumbs swiper
const setThumbsSwiper = (swiper: SwiperType) => {
  thumbsSwiper.value = swiper;
};

// Set main swiper instance
const onSwiper = (swiper: SwiperType) => {
  mainSwiper.value = swiper;
};

// Handle slide change - use realIndex for loop mode
const onSlideChange = (swiper: SwiperType) => {
  activeSlideIndex.value = swiper.realIndex;
};

// Handle zoom change - hide attribution when zoomed
const onZoomChange = (_swiper: SwiperType, scale: number) => {
  isZoomed.value = scale > 1;
};

// Get i18n locale for date formatting
const { locale } = useI18n();

// Format image date for display (localized)
const formatImageDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';

  try {
    const dateObj = new Date(dateString);

    // Check if date is valid
    if (isNaN(dateObj.getTime())) return '';

    const currentLocale = locale.value;

    // Format based on locale
    if (currentLocale === 'de') {
      // German: "15. Januar 2026"
      return date.formatDate(dateObj, 'D. MMMM YYYY');
    } else {
      // English: "January 15, 2026"
      return date.formatDate(dateObj, 'MMMM D, YYYY');
    }
  } catch {
    return '';
  }
};

// Get image URL for display (reusing preload function for consistency)
const getMainImageUrl = (image: HutImage): string => {
  return getGalleryImageUrl(image);
};

// Get current image
const currentImage = computed(() => {
  return props.images[activeSlideIndex.value];
});

// Close gallery - now emits close event for Quasar Dialog plugin
const closeGallery = () => {
  emit('close');
};

// Download original image
const downloadOriginal = () => {
  if (currentImage.value) {
    window.open(currentImage.value.urls.original.raw, '_blank');
  }
};

// Check if we should add margin (large screens)
const shouldAddMargin = computed(() => {
  return window.innerWidth >= 1200;
});

// Show navigation only on non-touch devices with multiple images
const showNavigation = computed(() => {
  return !hasTouch.value && props.images.length > 1;
});

// Handle back button to close gallery
const onBackButton = () => {
  closeGallery();
};

onMounted(() => {
  // Push history state when gallery opens so back button works
  window.history.pushState({ galleryOpen: true }, '');
  window.addEventListener('popstate', onBackButton);

  // Preload thumbnails immediately in background (they're small, fast to load)
  // Don't await - let them load progressively with retry logic
  preloadThumbnailImages();

  // Preload adjacent images in background (don't await to keep gallery snappy)
  // The retry logic in preloadImage will handle rate limiting gracefully
  preloadAdjacentImages();
});

onUnmounted(() => {
  window.removeEventListener('popstate', onBackButton);
});
</script>

<template>
  <div class="media-gallery-container" :class="{ 'with-margin': shouldAddMargin }">
    <!-- Close button -->
    <q-btn flat round dense class="close-btn" @click="closeGallery">
      <q-iconify :is="IconCloseOutline" size="20px" />
      <q-tooltip>Close</q-tooltip>
    </q-btn>

    <!-- Download button -->
    <q-btn flat round dense class="download-btn" @click="downloadOriginal">
      <q-iconify :is="IconDownloadOutline" size="20px" />
      <q-tooltip>Download original</q-tooltip>
    </q-btn>

    <!-- Main Swiper -->
    <swiper
      :modules="[Keyboard, Mousewheel, Navigation, Thumbs, Zoom, EffectFade]"
      :slides-per-view="1"
      :space-between="0"
      :keyboard="{
        enabled: true,
      }"
      :mousewheel="{
        enabled: true,
        forceToAxis: false,
        sensitivity: 1,
        releaseOnEdges: false,
      }"
      :navigation="showNavigation"
      :thumbs="{ swiper: thumbsSwiper }"
      :initial-slide="initialSlide"
      :loop="true"
      :effect="'fade'"
      :fade-effect="{ crossFade: true }"
      :zoom="{
        maxRatio: 3,
        minRatio: 1,
        toggle: true,
      }"
      class="main-swiper"
      @slide-change="onSlideChange"
      @swiper="onSwiper"
      @zoom-change="onZoomChange"
    >
      <swiper-slide v-for="image in images" :key="image.id" class="main-slide">
        <div class="swiper-zoom-container">
          <!-- Wrapper div that matches image dimensions - creates positioning context -->
          <div class="image-wrapper">
            <img
              :src="getMainImageUrl(image)"
              :alt="`Image by ${image.attribution?.short || 'unknown'}`"
              class="main-image"
              @load="onImageLoad(image.id)"
            />

            <!-- Attribution - positioned relative to image wrapper -->
            <div
              v-if="image.attribution"
              class="image-attribution-overlay"
              :class="{
                'attribution-visible': isImageLoaded(image.id) && !isZoomed,
                'attribution-hidden': isZoomed,
              }"
            >
              <div class="attribution-line">
                <span class="attribution-text">
                  <q-icon name="wd-info-outline" size="16px" class="attribution-icon" />
                  <span v-html="image.attribution.full || image.attribution.short || ''" />
                </span>
                <img
                  v-if="image.provider?.icon"
                  :src="image.provider.icon"
                  class="provider-icon"
                  alt="Provider icon"
                />
              </div>
              <div v-if="image.captured_at" class="attribution-line">
                <q-icon name="wd-calendar" size="16px" class="attribution-icon" />
                <span>{{ formatImageDate(image.captured_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </swiper-slide>
    </swiper>

    <!-- Thumbnail Swiper - using square thumbs (only if more than 1 image) -->
    <swiper
      v-if="images.length > 1"
      :modules="[Thumbs]"
      :watch-slides-progress="true"
      :slides-per-view="'auto'"
      :space-between="8"
      :free-mode="true"
      class="thumb-swiper"
      @swiper="setThumbsSwiper"
    >
      <swiper-slide v-for="image in images" :key="image.id" class="thumb-slide">
        <img
          :src="getPreviewImageUrl(image)"
          :alt="`Thumbnail by ${image.attribution?.short || 'unknown'}`"
          class="thumb-image"
        />
      </swiper-slide>
    </swiper>

    <!-- Attribution overlay - removed (now using top-right attribution) -->
  </div>
</template>

<style lang="scss" scoped>
.media-gallery-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: black;
  transition: all 0.3s ease;
}

.with-margin {
  // Margins removed - always full screen
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  color: white;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(0, 0, 0, 0.6);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.download-btn {
  position: absolute;
  top: 16px;
  right: 70px;
  z-index: 1000;
  color: white;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(0, 0, 0, 0.6);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
}

.main-swiper {
  flex: 1;
  width: 100%;
  min-height: 0; // CRITICAL: Allow flex item to shrink below content size
  display: flex;
  align-items: center;
  justify-content: center;

  // Navigation buttons - gray arrows with transparency, no background
  :deep(.swiper-button-next),
  :deep(.swiper-button-prev) {
    // Remove background completely
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;

    // Size and positioning
    width: 44px !important;
    height: 44px !important;

    // Arrow color (gray with transparency) - IMPORTANT: override all inherited colors
    color: rgba(120, 120, 120, 0.8) !important;

    // Smooth transitions
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

    // Remove border radius since no background
    border-radius: 0 !important;

    // SVG icon sizing and color - CRITICAL: Override any framework SVG styles
    :deep(svg) {
      width: 100% !important;
      height: 100% !important;
      fill: rgba(120, 120, 120, 0.8) !important;
      color: rgba(120, 120, 120, 0.8) !important;
    }

    // Force SVG path colors - this is what actually gets colored
    :deep(svg path) {
      fill: rgba(120, 120, 120, 0.8) !important;
      stroke: rgba(120, 120, 120, 0.8) !important;
    }

    // Hover state - darker gray
    &:hover {
      color: rgba(80, 80, 80, 1) !important;

      :deep(svg) {
        fill: rgba(80, 80, 80, 1) !important;
        color: rgba(80, 80, 80, 1) !important;
      }

      :deep(svg path) {
        fill: rgba(80, 80, 80, 1) !important;
        stroke: rgba(80, 80, 80, 1) !important;
      }

      transform: scale(1.1) !important;
    }

    // Active state
    &:active {
      transform: scale(0.95) !important;
    }

    // Focus state for accessibility
    &:focus {
      outline: 2px solid rgba(100, 181, 246, 0.6) !important;
      outline-offset: 2px !important;
    }

    // Disabled state
    &.swiper-button-disabled {
      opacity: 0.3 !important;
      cursor: not-allowed !important;
    }
  }

  :deep(.swiper-button-next) {
    right: 24px !important;
  }

  :deep(.swiper-button-prev) {
    left: 24px !important;
  }

  &:hover {
    :deep(.swiper-button-next),
    :deep(.swiper-button-prev) {
      opacity: 1;
    }
  }
}

.main-slide {
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  overflow: hidden;
  height: 100%;
  width: 100%;
  min-height: 0; // Allow slide to shrink
}

.main-slide :deep(.swiper-zoom-container) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0; // Allow zoom container to shrink
}

// Image wrapper - creates positioning context that matches actual image dimensions
.image-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%; // Constrain to parent height
  padding-bottom: 40px; // Reserve space for attribution
  box-sizing: border-box; // Include padding in max-height calculation
}

.main-image {
  display: block;
  max-width: 100%;
  max-height: calc(100% - 40px); // Subtract attribution space from image height
  object-fit: contain;
  width: auto;
  height: auto;
}

// Attribution overlay positioned relative to actual image content
.image-attribution-overlay {
  position: absolute;
  bottom: 12px; // Position inside the reserved padding space
  left: 8px; // Positioned on the left side
  z-index: 10;
  max-width: calc(100% - 16px);
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start; // Align entire block to the left
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.8125rem;
  line-height: 1.4;
  pointer-events: auto; // Allow clicking on links
  transition: opacity 0.5s ease; // Default: fade in slowly (500ms)
  padding: 6px 8px; // Add padding for better visibility
  background: rgba(0, 0, 0, 0.3); // Subtle background for readability
  border-radius: 4px;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0; // Start hidden
  text-align: left; // Left-align all text

  &.attribution-visible {
    opacity: 1; // Fade in when loaded (500ms)
  }

  &.attribution-hidden {
    transition: opacity 0.15s ease; // Fade out quickly (150ms)
    opacity: 0;
  }

  .attribution-line {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-start; // Left-align each line
    text-align: left;

    .attribution-text {
      display: flex;
      align-items: center;
      gap: 6px;
      justify-content: flex-start; // Left-align attribution text
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .attribution-icon {
      flex-shrink: 0;
      opacity: 0.9;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  :deep(a) {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: underline dotted;
    text-decoration-color: rgba(255, 255, 255, 0.4);
    transition: all 0.2s;
  }

  :deep(a:hover) {
    color: #64b5f6;
    text-decoration-color: #64b5f6;
    text-decoration: underline dotted;
  }

  .provider-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
    filter: brightness(1.1) contrast(1.1);
  }

  // Mobile - smaller font
  @media (max-width: 768px) {
    font-size: 0.75rem;
    padding: 4px 6px;
    gap: 3px;

    .attribution-line {
      gap: 4px;

      .attribution-icon {
        font-size: 14px;
      }
    }

    .provider-icon {
      width: 18px;
      height: 18px;
    }
  }
}

.thumb-swiper {
  height: 120px;
  width: 100%;
  background: rgba(0, 0, 0, 0.6);
  padding: 16px 24px;
  box-sizing: border-box;
  flex-shrink: 0;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  :deep(.swiper-wrapper) {
    align-items: center;
  }

  :deep(.swiper-slide) {
    width: 72px !important;
    height: 72px !important;
    opacity: 0.7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  :deep(.swiper-slide-thumb-active) {
    opacity: 1;
    border: 2px solid #64b5f6;
    transform: scale(1.08);
    box-shadow: 0 4px 16px rgba(100, 181, 246, 0.4);
  }

  :deep(.swiper-slide-visible) {
    opacity: 0.85;
  }

  :deep(.swiper-slide-visible:hover) {
    opacity: 1;
    transform: scale(1.02);
  }
}

.thumb-slide {
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-image {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
}
</style>
