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

// Main image (first one or placeholder)
const mainImage = computed(() => {
  return props.images.length > 0 ? props.images[0] : null;
});

// Thumbnail images (skip the first one, limit to 3)
const thumbnailImages = computed(() => {
  return props.images.slice(1, 4);
});

// Get image URL for display
const getMainImageUrl = () => {
  if (!mainImage.value?.urls?.landscape) return null;
  // Use landscape medium for main image
  return mainImage.value.urls.landscape.medium || mainImage.value.urls.landscape.preview;
};

const getMainImagePlaceholder = () => {
  if (!mainImage.value?.urls?.landscape) return null;
  return mainImage.value.urls.landscape.placeholder || mainImage.value.urls.landscape.thumb;
};

const getThumbnailUrl = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return image.urls.square.thumb || image.urls.square.preview || '';
};

const getThumbnailPlaceholder = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return image.urls.square.placeholder || image.urls.square.thumb || '';
};

// Get license for main image (short form)
const getMainImageLicense = () => {
  if (!mainImage.value?.license) return '';
  // Use license name from new API structure
  return mainImage.value.license.name || mainImage.value.license.slug || '';
};

// Check if we have images
const hasImages = computed(() => props.images.length > 0);
const hasThumbnails = computed(() => thumbnailImages.value.length > 0);
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
    <div class="relative-position" style="border-radius: 25px; overflow: hidden">
      <!-- Main image -->
      <a class="cursor-pointer" @click="openCarousel(0)">
        <q-img
          :src="getMainImageUrl()!"
          :placeholder-src="getMainImagePlaceholder()!"
          class="hut-image"
          :class="{ 'shadow-8': $q.screen.gt.sm }"
          style="border-radius: 25px"
        >
          <!-- License badge (top-left) -->
          <div v-if="getMainImageLicense()" class="absolute-top-left license-badge">
            {{ getMainImageLicense() }}
          </div>

          <!-- Thumbnail overlays -->
          <div
            v-if="hasThumbnails"
            class="absolute-bottom-right row q-gutter-xs"
            style="bottom: 8px; right: 8px"
          >
            <div
              v-for="(thumb, index) in thumbnailImages"
              :key="thumb.id"
              class="cursor-pointer thumbnail-container"
              @click.stop="openCarousel(index + 1)"
            >
              <q-img
                :src="getThumbnailUrl(thumb)"
                :placeholder-src="getThumbnailPlaceholder(thumb)"
                class="thumbnail"
                :style="{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: 'none',
                }"
              >
                <div class="thumbnail-overlay">
                  <q-icon name="fullscreen" size="sm" color="white" />
                </div>
              </q-img>
            </div>
            <!-- Show more indicator -->
            <div
              v-if="images.length > 4"
              class="thumbnail-more flex flex-center"
              style="
                width: 60px;
                height: 60px;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.6);
                color: white;
                font-size: 0.8rem;
                border: 2px solid rgba(255, 255, 255, 0.8);
              "
              @click.stop="openCarousel(0)"
            >
              +{{ images.length - 4 }}
            </div>
          </div>
        </q-img>
      </a>
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
  border-radius: 25px !important;
  max-width: 300px;
  min-width: 200px;
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
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
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

.license-badge {
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  margin: 8px;
  pointer-events: none;
}
</style>
