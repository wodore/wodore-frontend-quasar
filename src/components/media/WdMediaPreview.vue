<script setup lang="ts">
import { ref, computed, watchEffect, type Component } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useQuasar } from 'quasar';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { EffectFade, Keyboard, Thumbs } from 'swiper/modules';
import type { HutImage } from '@composables/useHutImages';
import WdMediaDialog from './WdMediaDialog.vue';
import WdNoImage from './WdNoImage.vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';
import IconOpenInNew from '~icons/material-symbols/open-in-new.svg';
import IconAndroid from '~icons/material-symbols/android.svg';
import IconApple from '~icons/bxl/apple';
import IconLanguage from '~icons/material-symbols/public.svg';
import IconUpload from '~icons/material-symbols/upload.svg';
import IconHiking from '~icons/material-symbols/hiking.svg';

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
});

const emit = defineEmits<{
  (e: 'image-click', image: HutImage, index: number): void;
  (e: 'add-image-click'): void;
}>();

const $q = useQuasar();
const dialogOpen = ref(false);
const contributionDialogOpen = ref(false);
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

// Handle add image click
const handleAddImageClick = () => {
  emit('add-image-click');
  contributionDialogOpen.value = true;
};

// Open external contribution platforms
const openMapComplete = () => {
  if (props.osmId) {
    window.open(`https://mapcomplete.org/images.html#osmId=${props.osmId}`, '_blank');
  }
};

const openPanoramax = () => {
  window.open('https://panoramax.openstreetmap.fr/', '_blank');
};

const openPanoramaxAndroid = () => {
  window.open('https://play.google.com/store/apps/details?id=app.panoramax', '_blank');
};

const openPanoramaxIOS = () => {
  window.open('https://apps.apple.com/us/app/panoramax-photo/id6677045203', '_blank');
};

const openWikimediaCommons = () => {
  window.open('https://commons.wikimedia.org/wiki/Special:UploadWizard', '_blank');
};

const openCampToCamp = () => {
  window.open('https://www.camptocamp.org/', '_blank');
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

  <!-- Contribution Dialog (outside v-if so it's always available) -->
  <q-dialog v-model="contributionDialogOpen">
    <q-card style="min-width: 350px; max-width: 650px; border-radius: 16px">
      <!-- Header Image -->
      <q-img
        src="https://cdn.pixabay.com/photo/2018/11/09/16/20/photographer-3804979_1280.jpg"
        style="height: 160px"
        class="shadow-4 header-image"
      >
        <div class="card-header-bg absolute-bottom"></div>
        <div class="absolute-bottom text-white text-center">
          <div class="text-h4 text-weight-bold" style="text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5)">
            Contribute Images
          </div>
          <div class="text-caption q-mt-sm" style="opacity: 0.95">
            Share your photos with the community
          </div>
        </div>
      </q-img>

      <q-card-section class="q-pt-lg">
        <p class="text-body1 text-grey-8">
          Direct upload is not supported yet. Contribute through these platforms (synced every 14
          days):
        </p>

        <div class="row q-col-gutter-md q-mt-md">
          <!-- MapComplete -->
          <div v-if="osmId" class="col-12 col-sm-6">
            <q-card
              flat
              bordered
              class="platform-card mapcomplete"
              clickable
              @click="openMapComplete"
            >
              <q-card-section class="q-pa-md">
                <div class="row items-center no-wrap">
                  <div class="platform-icon-container">
                    <q-img
                      src="https://upload.wikimedia.org/wikipedia/commons/9/9a/MapComplete.svg"
                      class="platform-icon"
                      no-spinner
                    />
                  </div>
                  <div class="col q-pl-md">
                    <div class="text-h6 text-weight-medium">MapComplete</div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      Add images directly to this location on OpenStreetMap
                    </div>
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right" class="q-px-md q-pb-md">
                <q-btn flat size="sm" label="Open Platform" class="text-primary">
                  <q-iconify :is="IconOpenInNew" size="16px" />
                </q-btn>
              </q-card-actions>
            </q-card>
          </div>

          <!-- Panoramax -->
          <div class="col-12 col-sm-6">
            <q-card flat bordered class="platform-card panoramax">
              <q-card-section class="q-pa-md">
                <div class="row items-start no-wrap">
                  <div class="platform-icon-container">
                    <q-img
                      src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Panoramax.svg"
                      class="platform-icon"
                      no-spinner
                    />
                  </div>
                  <div class="col q-pl-md">
                    <div class="row items-center justify-between q-mb-xs">
                      <div class="text-h6 text-weight-medium">Panoramax</div>
                      <div class="app-store-badges">
                        <q-btn
                          flat
                          dense
                          size="sm"
                          label="Android"
                          @click.stop="openPanoramaxAndroid"
                          class="store-badge android"
                        >
                          <q-iconify :is="IconAndroid" size="14px" />
                        </q-btn>
                        <q-btn
                          flat
                          dense
                          size="sm"
                          label="iOS"
                          @click.stop="openPanoramaxIOS"
                          class="store-badge ios q-ml-xs"
                        >
                          <q-iconify :is="IconApple" size="14px" />
                        </q-btn>
                      </div>
                    </div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      Contribute geolocated photos via mobile app or web
                    </div>
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right" class="q-px-md q-pb-md">
                <q-btn
                  flat
                  size="sm"
                  label="Open Web App"
                  @click.stop="openPanoramax"
                  class="text-primary"
                >
                  <q-iconify :is="IconLanguage" size="16px" />
                </q-btn>
              </q-card-actions>
            </q-card>
          </div>

          <!-- Wikimedia Commons -->
          <div class="col-12 col-sm-6">
            <q-card
              flat
              bordered
              class="platform-card wikimedia"
              clickable
              @click="openWikimediaCommons"
            >
              <q-card-section class="q-pa-md">
                <div class="row items-center no-wrap">
                  <div class="platform-icon-container">
                    <q-img
                      src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Commons-logo.svg"
                      class="platform-icon"
                      no-spinner
                    />
                  </div>
                  <div class="col q-pl-md">
                    <div class="text-h6 text-weight-medium">Wikimedia Commons</div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      Upload free media to the world's largest media library
                    </div>
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right" class="q-px-md q-pb-md">
                <q-btn flat size="sm" label="Upload Now" class="text-primary">
                  <q-iconify :is="IconUpload" size="16px" />
                </q-btn>
              </q-card-actions>
            </q-card>
          </div>

          <!-- CampToCamp -->
          <div class="col-12 col-sm-6">
            <q-card
              flat
              bordered
              class="platform-card camptocamp"
              clickable
              @click="openCampToCamp"
            >
              <q-card-section class="q-pa-md">
                <div class="row items-center no-wrap">
                  <div class="platform-icon-container">
                    <q-img
                      src="https://www.camptocamp.org/img/logo.433ae10f.svg"
                      class="platform-icon"
                      no-spinner
                    />
                  </div>
                  <div class="col q-pl-md">
                    <div class="text-h6 text-weight-medium">Camptocamp</div>
                    <div class="text-caption text-grey-7 q-mt-xs">
                      Outdoor community with hiking and climbing routes
                    </div>
                  </div>
                </div>
              </q-card-section>
              <q-card-actions align="right" class="q-px-md q-pb-md">
                <q-btn flat size="sm" label="Explore" class="text-primary">
                  <q-iconify :is="IconHiking" size="16px" />
                </q-btn>
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-card-section>

      <q-separator />
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup class="q-mr-sm" />
      </q-card-actions>
    </q-card>
  </q-dialog>

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

.card-header {
  filter: blur(15px);
  height: 60px;
}

.card-header__text {
  background: none !important;
  text-shadow: 0px 0px 8px rgb(0, 0, 0);
}

.header-image {
  border-radius: 16px 16px 0 0;
}

.card-header-bg {
  height: 80px;
  background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.6));
  backdrop-filter: blur(2px);
}

.platform-card {
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  height: 100%;
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px) scale(1.01);
    box-shadow: 0 12px 32px rgba(52, 103, 81, 0.15);
    border-color: rgba(52, 103, 81, 0.3);

    .platform-icon-container {
      transform: scale(1.05);
    }
  }

  &.mapcomplete {
    border-left: 3px solid #346751;

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(52, 103, 81, 0.12), rgba(52, 103, 81, 0.05));
    }
  }

  &.panoramax {
    border-left: 3px solid #ff6b35;

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(255, 107, 53, 0.12), rgba(255, 107, 53, 0.05));
    }
  }

  &.wikimedia {
    border-left: 3px solid #333333;

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(51, 51, 51, 0.12), rgba(51, 51, 51, 0.05));
    }
  }

  &.camptocamp {
    border-left: 3px solid #7cb342;

    .platform-icon-container {
      background: linear-gradient(135deg, rgba(124, 179, 66, 0.12), rgba(124, 179, 66, 0.05));
    }
  }
}

.platform-icon-container {
  width: 56px;
  height: 56px;
  min-width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
  padding: 6px;
}

.platform-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-width: 44px;
  max-height: 44px;
}

.app-store-badges {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.store-badge {
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  min-height: 24px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  &.android {
    color: #3ddc84;

    &:hover {
      background: rgba(61, 220, 132, 0.1);
    }
  }

  &.ios {
    color: #000000;

    &:hover {
      background: rgba(0, 0, 0, 0.05);
    }
  }
}
</style>
