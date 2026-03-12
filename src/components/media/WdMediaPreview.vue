<script setup lang="ts">
import { ref, computed, watchEffect, type Component } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { EffectFade, Keyboard, Thumbs } from 'swiper/modules';
import type { HutImage } from '@composables/useHutImages';
import WdMediaDialog from './WdMediaDialog.vue';
import WdNoImage from './WdNoImage.vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/keyboard';
import 'swiper/css/thumbs';

interface Props {
  images: HutImage[];
  loading?: boolean;
  addImageUrl?: string;
  emptyStateMessage?: string;
  emptyStateIcon?: string | Component | Record<string, unknown> | undefined;
  maxThumbnailCount?: number;
  thumbnailSize?: number;
  showAttribution?: boolean;
  osmId?: string | null;
  osmFeature?: string | null;
  osmIdOnly?: string | null;
  refugesId?: string | null;
  mapcompleteTheme?: string | null;
  mapcompleteUserlayout?: string | null;
  // Hut coordinates for precise location linking
  hutLat?: number | null;
  hutLon?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  addImageUrl: undefined,
  emptyStateMessage: 'No images available',
  emptyStateIcon: undefined,
  maxThumbnailCount: 5,
  thumbnailSize: 50,
  showAttribution: true,
  osmId: null,
  osmFeature: null,
  osmIdOnly: null,
  refugesId: null,
  mapcompleteTheme: null,
  mapcompleteUserlayout: null,
  hutLat: null,
  hutLon: null,
});

const emit = defineEmits<{
  (e: 'image-click', image: HutImage, index: number): void;
  (e: 'add-image-click'): void;
}>();

const $q = useQuasar();
const router = useRouter();
const dialogOpen = ref(false);
const currentSlide = ref(0);
const swiperRef = ref<SwiperType | null>(null);
const thumbsSwiperRef = ref<SwiperType | null>(null);
const showSpinner = ref(false);

// Show spinner after 500ms of loading
const { start: startSpinnerTimeout, stop: stopSpinnerTimeout } = useTimeoutFn(() => {
  if (props.loading) {
    showSpinner.value = true;
  }
}, 500);

watchEffect(() => {
  if (props.loading) {
    startSpinnerTimeout();
  } else {
    stopSpinnerTimeout();
    showSpinner.value = false;
  }
});

// Set swiper instance
const onSwiper = (swiper: SwiperType) => {
  swiperRef.value = swiper;
};

// Set thumbs swiper instance
const onThumbsSwiper = (swiper: SwiperType) => {
  thumbsSwiperRef.value = swiper;
};

// Handle slide change
const onSlideChange = (swiper: SwiperType) => {
  currentSlide.value = swiper.activeIndex;
};

// Open dialog with specific image
const openDialog = (index: number) => {
  currentSlide.value = index;
  dialogOpen.value = true;
  emit('image-click', props.images[index], index);
};

// Handle image click
const handleImageClick = () => {
  openDialog(currentSlide.value);
};

// Get current image
const currentImage = computed(() => {
  return props.images[currentSlide.value] || null;
});

// Get image URL for display
const getMainImageUrl = (image: HutImage) => {
  if (!image?.urls?.landscape) return '';
  // Use preview size for swiper (smaller, faster)
  return image.urls.landscape.preview || image.urls.landscape.thumb || '';
};

const getThumbnailUrl = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return image.urls.square.thumb || image.urls.square.preview || '';
};

// Get provider icon for any image
const getProviderIcon = (image: HutImage) => {
  return image?.provider?.icon || undefined;
};

// Check if we have images
const hasImages = computed(() => props.images.length > 0);

// Get short attribution for current image
const getCurrentImageAttribution = () => {
  if (!currentImage.value?.attribution || !props.showAttribution) return '';
  return currentImage.value.attribution.short || currentImage.value.attribution.full || '';
};

// Get provider icon for current image
const getCurrentImageProviderIcon = () => {
  return currentImage.value?.provider?.icon || undefined;
};

// Handle add image click - navigate to contribute page
const handleAddImageClick = () => {
  emit('add-image-click');

  // Build query parameters
  const query: Record<string, string> = {};

  // Add OSM data if available (with c_ prefix)
  if (props.osmFeature && props.osmIdOnly) {
    query.c_osm_feature = props.osmFeature;
    query.c_osm_id_only = props.osmIdOnly;
    query.c_osm_id = `${props.osmFeature}/${props.osmIdOnly}`;
  } else if (props.osmId) {
    // Fallback to osm_id if no feature/id_only
    query.c_osm_id = props.osmId;
  }

  // Add mapcomplete parameters if available (with c_ prefix)
  if (props.mapcompleteTheme) {
    query.c_mapcomplete_theme = props.mapcompleteTheme;
  }
  if (props.mapcompleteUserlayout) {
    query.c_mapcomplete_userlayout = props.mapcompleteUserlayout;
  }

  // Add refuges ID if available (with c_ prefix)
  if (props.refugesId) {
    query.c_refuges_id = props.refugesId;
  }

  // Use hut coordinates if available (only if both lat and lon are defined and not null/undefined)
  if (props.hutLat != null && props.hutLon != null) {
    query.c_lat = String(props.hutLat);
    query.c_lon = String(props.hutLon);
    query.c_zoom = '15'; // Default zoom for hut location
  }

  router.push({
    name: 'contribute',
    query,
  });
};

// Thumbnail container dimensions
const thumbnailContainerStyle = computed(() => {
  // Square aspect ratio: 1:1
  const thumbnailSize = props.thumbnailSize;
  const spacing = 4;

  return {
    bottom: '6px',
    right: '6px',
    left: '6px',
    width: 'auto',
    height: `${thumbnailSize + spacing}px`,
    borderRadius: '8px',
    overflow: 'hidden',
  };
});
</script>

<template>
  <div
    v-if="loading && !hasImages"
    class="flex flex-center"
    style="min-height: 200px; border-radius: 25px"
  >
    <q-spinner v-if="showSpinner" color="primary" size="3rem" />
  </div>

  <div
    v-else-if="hasImages"
    :class="{
      'q-ma-sm': $q.screen.gt.sm,
      'q-ma-lg': $q.screen.gt.md,
    }"
  >
    <!-- Main image swiper with thumbnails overlay -->
    <div class="media-preview-container">
      <div
        class="media-preview-wrapper"
        style="border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1)"
      >
        <!-- Attribution badge (top-right) - stationary -->
        <div v-if="getCurrentImageAttribution()" class="license-badge-custom stationary">
          <img
            v-if="getCurrentImageProviderIcon()"
            :src="getCurrentImageProviderIcon()"
            class="provider-icon"
            alt="Provider icon"
          />
          <span v-html="getCurrentImageAttribution()" />
        </div>

        <swiper
          :modules="[EffectFade, Keyboard, Thumbs]"
          :slides-per-view="1"
          :space-between="0"
          :effect="'fade'"
          :fade-effect="{ crossFade: true }"
          :keyboard="{ enabled: true }"
          :thumbs="{ swiper: thumbsSwiperRef }"
          :initial-slide="0"
          class="preview-swiper"
          @swiper="onSwiper"
          @slide-change="onSlideChange"
        >
          <swiper-slide v-for="image in images" :key="image.id" class="preview-slide">
            <img
              :src="getMainImageUrl(image)"
              :alt="`Image by ${image.attribution?.short || 'unknown'}`"
              class="preview-image"
              @click="handleImageClick"
            />
          </swiper-slide>
        </swiper>

        <!-- Thumbnail Swiper - overlaid on image (outside main swiper) -->
        <div
          v-if="images.length > 1"
          class="thumbs-swiper-container"
          :style="thumbnailContainerStyle"
        >
          <swiper
            :modules="[Thumbs]"
            :watch-slides-progress="true"
            :slides-per-view="'auto'"
            :space-between="4"
            :resistance-ratio="0"
            class="thumbs-swiper-inline"
            @swiper="onThumbsSwiper"
            :style="{ '--thumbnail-size': `${thumbnailSize}px` }"
          >
            <swiper-slide v-for="image in images" :key="image.id" class="thumb-slide-inline">
              <div class="thumb-content-wrapper">
                <img
                  :src="getThumbnailUrl(image)"
                  class="thumb-image-inline"
                  :alt="`Thumbnail by ${image.attribution?.short || 'unknown'}`"
                />
                <div v-if="getProviderIcon(image)" class="thumb-provider-icon-bg">
                  <img
                    :src="getProviderIcon(image)"
                    class="thumb-provider-icon-small"
                    alt="Provider icon"
                  />
                </div>
              </div>
            </swiper-slide>
          </swiper>
        </div>
      </div>
    </div>

    <!-- Media Dialog -->
    <WdMediaDialog
      v-if="dialogOpen"
      :images="images"
      :initial-slide="currentSlide"
      @close="dialogOpen = false"
    />
  </div>

  <!-- No images state -->
  <WdNoImage
    v-if="!loading && !hasImages"
    :message="emptyStateMessage"
    :icon="emptyStateIcon || IconAddPhoto"
    :on-contribute="handleAddImageClick"
  />
</template>

<style lang="scss" scoped>
.media-preview-container {
  max-width: 400px;
  margin: 0 auto;
  width: 100%;
}

.media-preview-wrapper {
  position: relative;
  width: 100%;
  // Fixed aspect ratio container to prevent size changes
  padding-top: 66.67%; // 3:2 aspect ratio (landscape)
  background: #f5f5f5; // Placeholder background
}

.preview-swiper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.preview-slide {
  width: 100% !important;
  height: 100% !important;
}

.preview-image {
  width: 100%;
  height: 100%;
  display: block;
  cursor: pointer;
  object-fit: cover;
}

.thumbs-swiper-inline {
  width: 100%;
  height: 100%;

  :deep(.swiper-wrapper) {
    align-items: center;
    justify-content: flex-end;
  }

  :deep(.swiper-slide) {
    // Square aspect ratio: 1:1
    width: var(--thumbnail-size) !important;
    height: var(--thumbnail-size) !important;
    opacity: 0.5;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
  }

  :deep(.swiper-slide-thumb-active) {
    opacity: 1 !important;
    border: 2px solid #64b5f6;
    box-shadow: 0 4px 12px rgba(100, 181, 246, 0.5);
  }

  :deep(.swiper-slide-visible) {
    opacity: 0.65;
  }

  :deep(.swiper-slide-visible:hover) {
    opacity: 1;
  }
}

.thumb-slide-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 100%;
  height: 100%;
}

.thumb-content-wrapper {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-image-inline {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  background: transparent;
  object-fit: cover;
}

.thumb-provider-icon-bg {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-radius: 50%;
}

.thumb-provider-icon-small {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

.preview-image {
  border-radius: 16px !important;
  max-width: 400px;
  min-width: 200px;
  width: 100%;
  display: block;
}

@media (width <=$breakpoint-xs-max) {
  .preview-image {
    max-width: 300px;
    min-width: 100px;
  }
}

.license-badge-custom {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  color: white;
  font-size: 0.75rem;
  padding: 5px 8px;
  border-radius: 6px;
  pointer-events: none;
  font-weight: 500;
  letter-spacing: 0.25px;
  display: flex;
  align-items: center;
  gap: 6px;
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 10;

  &.stationary {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 100;
  }

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

.provider-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 2px;
}

.absolute-bottom-right {
  position: absolute;
}

.thumbs-swiper-container {
  --thumbnail-size: 50px;
  position: absolute;
}
</style>
