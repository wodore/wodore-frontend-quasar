<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useQuasar } from 'quasar';
import type { HutImage } from '@composables/useHutImages';
import WdImageCarousel from './WdImageCarousel.vue';

interface Props {
  images: HutImage[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const $q = useQuasar();
const carouselOpen = ref(false);
const currentSlide = ref(0);
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

// Open carousel with specific image
const openCarousel = (index: number) => {
  currentSlide.value = index;
  carouselOpen.value = true;
};

// Show thumbnail in preview instead of opening gallery
const showInPreview = (image: HutImage) => {
  const index = props.images.findIndex(img => img.id === image.id);
  if (index !== -1) {
    previewImageIndex.value = index;
  }
};

// Current preview image index (for displaying clicked thumbnail)
const previewImageIndex = ref(0);

// Get current preview image
const currentPreviewImage = computed(() => {
  return props.images[previewImageIndex.value] || null;
});

// Thumbnail images (skip the first one, limit to 3)
const thumbnailImages = computed(() => {
  // Show up to 3 thumbnails after the current preview image
  const thumbs = [];
  for (let i = 1; i <= 3; i++) {
    const index = (previewImageIndex.value + i) % props.images.length;
    if (index !== previewImageIndex.value) {
      thumbs.push(props.images[index]);
    }
  }
  return thumbs;
});

// Count of remaining images not shown in thumbnails
const remainingImagesCount = computed(() => {
  return Math.max(0, props.images.length - 1 - 3);
});

// Get image URL for display
const getMainImageUrl = () => {
  if (!currentPreviewImage.value?.urls?.landscape) return null;
  // Use landscape medium for main image
  return (
    currentPreviewImage.value.urls.landscape.medium ||
    currentPreviewImage.value.urls.landscape.preview
  );
};

const getMainImagePlaceholder = () => {
  if (!currentPreviewImage.value?.urls?.landscape) return null;
  return (
    currentPreviewImage.value.urls.landscape.placeholder ||
    currentPreviewImage.value.urls.landscape.thumb
  );
};

const getThumbnailUrl = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return image.urls.square.thumb || image.urls.square.preview || '';
};

const getThumbnailPlaceholder = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return image.urls.square.placeholder || image.urls.square.thumb || '';
};

// Get provider icon for any image
const getProviderIcon = (image: HutImage) => {
  return image?.provider?.icon || undefined;
};

// Check if we have images
const hasImages = computed(() => props.images.length > 0);
const hasThumbnails = computed(() => thumbnailImages.value.length > 0);

// Get short attribution for main image
const getMainImageAttribution = () => {
  if (!currentPreviewImage.value?.attribution) return '';
  // Prefer short attribution, fall back to full
  return (
    currentPreviewImage.value.attribution.short || currentPreviewImage.value.attribution.full || ''
  );
};

// Get provider icon for main image
const getMainImageProviderIcon = () => {
  return currentPreviewImage.value?.provider?.icon || undefined;
};
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
    <!-- Main image with thumbnails overlay -->
    <div class="relative-position" style="border-radius: 16px; overflow: hidden">
      <!-- Main image -->
      <div>
        <q-img
          :src="getMainImageUrl()!"
          :placeholder-src="getMainImagePlaceholder()!"
          class="hut-image"
          :class="{ 'shadow-8': $q.screen.gt.sm }"
          style="border-radius: 16px"
          @click="openCarousel(previewImageIndex)"
        >
          <!-- Attribution badge (top-right) with provider icon -->
          <div v-if="getMainImageAttribution()" class="license-badge-custom">
            <img
              v-if="getMainImageProviderIcon()"
              :src="getMainImageProviderIcon()"
              class="provider-icon"
              alt="Provider icon"
            />
            <span v-html="getMainImageAttribution()" />
          </div>

          <!-- Thumbnail overlays -->
          <div
            v-if="hasThumbnails || images.length > 1"
            class="absolute-bottom-right row q-gutter-xs"
            style="bottom: 6px; right: 6px"
          >
            <div
              v-for="thumb in thumbnailImages"
              :key="thumb.id"
              class="cursor-pointer thumbnail-container"
              @click.stop="showInPreview(thumb)"
            >
              <q-img
                :src="getThumbnailUrl(thumb)"
                :placeholder-src="getThumbnailPlaceholder(thumb)"
                class="thumbnail"
                :style="{
                  width: '56px',
                  height: '56px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                }"
              >
                <div class="thumbnail-overlay">
                  <img
                    v-if="getProviderIcon(thumb)"
                    :src="getProviderIcon(thumb)"
                    class="thumbnail-provider-icon"
                    alt="Provider icon"
                  />
                  <q-icon v-else name="fullscreen" size="sm" color="white" />
                </div>
              </q-img>
            </div>
            <!-- Show more indicator - overlays 4th position -->
            <div
              v-if="remainingImagesCount > 0"
              class="cursor-pointer thumbnail-container"
              @click.stop="openCarousel(0)"
            >
              <div
                class="thumbnail-more flex flex-center"
                style="
                  width: 56px;
                  height: 56px;
                  border-radius: 6px;
                  background: rgba(0, 0, 0, 0.25);
                  backdrop-filter: blur(4px);
                  -webkit-backdrop-filter: blur(4px);
                  color: white;
                  font-size: 0.8125rem;
                  font-weight: 600;
                  border: 1px solid rgba(255, 255, 255, 0.4);
                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                "
              >
                +{{ remainingImagesCount }}
              </div>
            </div>
          </div>
        </q-img>
      </div>
    </div>

    <!-- Image Carousel Dialog -->
    <WdImageCarousel
      v-if="carouselOpen"
      :images="images"
      :initial-slide="currentSlide"
      @close="carouselOpen = false"
    />
  </div>

  <!-- No images state -->
  <div
    v-else-if="!loading"
    class="flex flex-center column q-pa-lg bg-grey-2"
    style="border-radius: 25px; min-height: 200px"
  >
    <q-icon name="add_photo_alternate" size="3rem" color="grey-5" />
    <p class="q-mt-md text-grey-7">No images available</p>
    <q-btn
      flat
      color="primary"
      label="Add an image"
      href="https://github.com/wodore/wodore/issues/new"
      target="_blank"
    />
  </div>
</template>

<style lang="scss" scoped>
.hut-image {
  border-radius: 16px !important;
  max-width: 300px;
  min-width: 200px;
}

.hut-image :deep(.q-img__content) {
  background: transparent !important;
}

.hut-image :deep(.q-img__container) {
  background: transparent !important;
}

.hut-image :deep(.q-img__image) {
  background: transparent !important;
}

.hut-image :deep(.q-img) {
  background: transparent !important;
}

@media (width <=$breakpoint-xs-max) {
  .hut-image {
    max-width: 300px;
    min-width: 100px;
  }
}

@media (width >=$breakpoint-sm-max) {
  .hut-image {
    max-width: 100%;
  }
}

.thumbnail-container {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: scale(1.05);
    z-index: 10;
  }
}

.thumbnail-container:hover .thumbnail-overlay {
  opacity: 1;
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 6px;
  opacity: 0;
  transition: all 0.2s ease-in-out;
}

.thumbnail-provider-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 3px;
}

.thumbnail :deep(.q-img) {
  background: transparent !important;
}

.thumbnail :deep(.q-img__container) {
  background: transparent !important;
}

.thumbnail :deep(.q-img__image) {
  background: transparent !important;
  box-shadow: none !important;
}

.thumbnail :deep(.q-img__content) {
  background: transparent !important;
}

.thumbnail :deep(.q-img__loading) {
  background: transparent !important;
}

.thumbnail :deep(.q-img__fill) {
  background: transparent !important;
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

.thumbnail-more {
  &:hover {
    background: rgba(0, 0, 0, 0.5) !important;
    transform: scale(1.05);
  }
}
</style>
