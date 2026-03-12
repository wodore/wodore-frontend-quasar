<script setup lang="ts">
import { ref, computed } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { Keyboard, Navigation, Thumbs } from 'swiper/modules';
import type { HutImage } from 'src/composables/useHutImages';
import type { ImageSizeVariants } from 'src/types/geo';
import IconCloseOutline from '~icons/eva/close-outline';
import IconDownloadOutline from '~icons/eva/download-outline';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/keyboard';

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

// Set thumbs swiper
const setThumbsSwiper = (swiper: SwiperType) => {
  thumbsSwiper.value = swiper;
};

// Set main swiper instance
const onSwiper = (swiper: SwiperType) => {
  mainSwiper.value = swiper;
};

// Handle slide change
const onSlideChange = (swiper: SwiperType) => {
  activeSlideIndex.value = swiper.activeIndex;
};

// Get optimal image size based on screen size - NEVER upscale
const getOptimalImageSize = (): 'large' | 'medium' => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Calculate max size we need (considering thumbnails and margins)
  const maxHeight = screenHeight - 140; // Leave room for thumbnails
  const maxWidth = screenWidth >= 1200 ? screenWidth - 80 : screenWidth; // Add margin on large screens

  // Always use at least medium, use large if screen is big enough
  if (maxWidth <= 1600 || maxHeight <= 1200) {
    return 'medium';
  }
  return 'large';
};

// Get image URL for main gallery with proper size and orientation
const getMainImageUrl = (image: HutImage): string => {
  if (!image.urls) return '';

  // Use is_portrait to determine orientation, default to landscape
  const orientation = image.is_portrait ? 'portrait' : 'landscape';
  const urls = image.urls[orientation] || image.urls.landscape;

  if (!urls) return '';

  const size = getOptimalImageSize();

  // Use @2x version for HiDPI devices
  const pixelRatio = window.devicePixelRatio || 1;
  if (pixelRatio >= 1.5) {
    const size2x = `${size}@2x` as keyof ImageSizeVariants;
    if (urls[size2x]) {
      return urls[size2x];
    }
  }

  // Fallback to smaller sizes if the chosen size doesn't exist
  if (urls[size]) {
    return urls[size];
  }
  if (urls.medium) {
    return urls.medium;
  }
  return urls.preview || urls.thumb || '';
};

// Get thumbnail URL (small square images) with HiDPI support
const getThumbnailUrl = (image: HutImage) => {
  if (!image.urls?.square) return '';

  const pixelRatio = window.devicePixelRatio || 1;
  // Use @2x for HiDPI devices
  if (pixelRatio >= 1.5 && image.urls.square['thumb@2x']) {
    return image.urls.square['thumb@2x'];
  }
  return image.urls.square.thumb || '';
};

// Get current image
const currentImage = computed(() => {
  return props.images[activeSlideIndex.value];
});

// Close gallery
const closeGallery = () => {
  emit('close');
};

// Download original image
const downloadOriginal = () => {
  if (currentImage.value) {
    window.open(currentImage.value.urls.original.raw, '_blank');
  }
};

// Handle backdrop click - close if clicking outside the image
const onBackdropClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  // Close if clicking directly on the gallery container (backdrop)
  if (target.classList.contains('media-gallery-container')) {
    closeGallery();
  }
};

// Check if we should add margin (large screens)
const shouldAddMargin = computed(() => {
  return window.innerWidth >= 1200;
});

// Build custom attribution parts
const attributionParts = computed(() => {
  if (!currentImage.value?.attribution) return [];

  // Use full attribution for detailed display
  const attr = currentImage.value.attribution;
  if (attr.full) {
    return [attr.full];
  }
  if (attr.short) {
    return [attr.short];
  }

  return [];
});
</script>

<template>
  <div
    class="media-gallery-container"
    :class="{ 'with-margin': shouldAddMargin }"
    @click="onBackdropClick"
  >
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

    <!-- Attribution - top left -->
    <div v-if="attributionParts.length > 0" class="attribution-top-left">
      <span class="attribution-text" v-html="attributionParts.join(' ')" />
    </div>

    <!-- Main Swiper -->
    <swiper
      :modules="[Keyboard, Navigation, Thumbs]"
      :slides-per-view="1"
      :space-between="0"
      :keyboard="{
        enabled: true,
      }"
      :navigation="true"
      :thumbs="{ swiper: thumbsSwiper }"
      :initial-slide="initialSlide"
      class="main-swiper"
      @slide-change="onSlideChange"
      @swiper="onSwiper"
    >
      <swiper-slide v-for="image in images" :key="image.id" class="main-slide">
        <img
          :src="getMainImageUrl(image)"
          :alt="`Image by ${image.attribution?.short || 'unknown'}`"
          class="main-image"
        />
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
          :src="getThumbnailUrl(image)"
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
  max-width: calc(100vw - 80px);
  max-height: calc(100vh - 80px);
  margin: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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

.attribution-top-left {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 1000;
  max-width: calc(100% - 160px);

  .attribution-text {
    color: rgba(255, 255, 255, 0.95);
    font-size: 0.8125rem;
    line-height: 1.4;
    background: rgba(0, 0, 0, 0.3);
    padding: 8px 14px;
    border-radius: 6px;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);

    :deep(a) {
      color: rgba(255, 255, 255, 0.95);
      text-decoration: underline dotted;
      text-decoration-color: rgba(255, 255, 255, 0.5);
      transition: all 0.2s;
    }

    :deep(a:hover) {
      color: #64b5f6;
      text-decoration-color: #64b5f6;
      text-decoration: underline dotted;
    }
  }
}

.main-swiper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  :deep(.swiper-button-next),
  :deep(.swiper-button-prev) {
    color: white;
    opacity: 0.8;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    width: 48px;
    height: 48px;
    border-radius: 50%;

    &:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.6);
      transform: scale(1.05);
    }

    &:active {
      transform: scale(0.95);
    }

    &::after {
      font-size: 22px;
      font-weight: 600;
    }
  }

  :deep(.swiper-button-next) {
    right: 24px;
  }

  :deep(.swiper-button-prev) {
    left: 24px;
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
}

.main-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  max-width: 100%;
  max-height: 100%;
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
