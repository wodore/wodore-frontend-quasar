<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  watchEffect,
  onMounted,
  inject,
  type Component,
  type Ref,
} from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import {
  EffectFade,
  FreeMode,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
  Scrollbar,
  Thumbs,
} from 'swiper/modules';
import type { HutImage } from '@composables/useHutImages';
import { useDeviceDetection } from '@composables/useDeviceDetection';
import { useMediaPreload } from '@composables/useMediaPreload';
import { useImageRetry, filterOutFailed } from '@composables/useImageRetry';
import { orientationUrls, thumbhashStyleForSize, variantUrl } from '@/utils/imageVariants';
import WdMediaDialog from './WdMediaDialog.vue';
import WdNoImage from './WdNoImage.vue';
import IconAddPhoto from '~icons/material-symbols/add-a-photo.svg';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/keyboard';
import 'swiper/css/pagination';
import 'swiper/css/thumbs';
import 'swiper/css/effect-fade';
import 'swiper/css/free-mode';
import 'swiper/css/scrollbar';

interface Props {
  images: HutImage[];
  loading?: boolean;
  addImageUrl?: string;
  emptyStateMessage?: string;
  emptyStateIcon?: Component;
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
  // Use reduced height for no-image state
  reducedHeightNoImage?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  addImageUrl: undefined,
  emptyStateMessage: 'No images available',
  emptyStateIcon: undefined,
  maxThumbnailCount: 5,
  thumbnailSize: 40,
  showAttribution: true,
  osmId: null,
  osmFeature: null,
  osmIdOnly: null,
  refugesId: null,
  mapcompleteTheme: null,
  mapcompleteUserlayout: null,
  hutLat: null,
  hutLon: null,
  reducedHeightNoImage: false,
});

const emit = defineEmits<{
  (e: 'image-click', image: HutImage, index: number): void;
  (e: 'add-image-click'): void;
}>();

const router = useRouter();
const $q = useQuasar();

// Open dialog with specific image using Quasar Dialog plugin
const openDialog = (originalIndex: number) => {
  currentSlide.value = originalIndex;
  emit('image-click', props.images[originalIndex], originalIndex);

  // Use Quasar's Dialog plugin for proper back button handling
  $q.dialog({
    component: WdMediaDialog,
    componentProps: {
      images: props.images,
      initialSlide: originalIndex,
    },
  }).onDismiss(() => {
    // Dialog closed (back button, ESC, backdrop click, etc.)
    dialogOpen.value = false;
  });

  dialogOpen.value = true;
};

// const isMobilePlatform = computed(() => {
//   // Mobile platform (iOS, Android, etc.)
//   // Available for future use
//   return $q.platform.is.mobile;
// });

// const hasHdpi = computed(() => {
//   // High DPI display (Retina, etc.)
//   // Available for future use
//   return window.devicePixelRatio && window.devicePixelRatio >= 1.5;
// });

// Desktop content panel minimized? While the WdContentPanel card is
// minimized it renders the MOBILE gallery stripe regardless of viewport;
// maximized shows the desktop gallery (owner 2026-10).
const panelMinimized = inject<Ref<boolean> | null>('wdContentPanelMinimized', null);
const forceMobileGallery = computed(() => panelMinimized?.value === true);

const isDesktopWidth = computed(() => {
  // Desktop breakpoint (width >= 1024px) — suppressed while the content
  // panel is minimized (mobile stripe gallery instead)
  return !forceMobileGallery.value && $q.screen.width >= 1024;
});

// Check if mobile view: the mobile stripe renders below md (770px) —
// that covers real phones AND narrow desktop windows where the app
// already switches to the bottom sheet (owner 2026-10: key off WIDTH,
// not the xs/platform check) — plus inside a minimized content panel.
const isMobile = computed(() => $q.screen.lt.md || forceMobileGallery.value);

// Show thumbnails: desktop width AND has multiple images
const showThumbnails = computed(() => {
  return isDesktopWidth.value && visibleImages.value.length > 1;
});

const dialogOpen = ref(false);
const currentSlide = ref(0);
const swiperRef = ref<SwiperType | null>(null);
const thumbsSwiperRef = ref<SwiperType | null>(null);
const showSpinner = ref(false);
const loadedThumbnails = ref<Set<string>>(new Set());
const loadedStripeImages = ref<Set<string>>(new Set());

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

// Set swiper instance; link thumbs live as soon as both exist (see
// linkThumbs)
const onSwiper = (swiper: SwiperType) => {
  swiperRef.value = swiper;
  linkThumbs();
};

// Set thumbs swiper instance
const onThumbsSwiper = (swiper: SwiperType) => {
  thumbsSwiperRef.value = swiper;
  linkThumbs();
};

// Live thumbs linking on the persistent main swiper. The old approach
// re-mounted the main swiper via a :key flip ('solo' → 'with-thumbs') once
// the thumbs instance existed — one extra full Swiper init per maximize,// and combined with the v-if branch swap it produced ~13× the expected
// init count (231 swiper onLoad calls in a 6-open session, perf profile
// 2026-10-21). The branches now stay mounted (v-show) and thumbs link
// through Swiper's API instead: whichever of main/thumbs mounts last
// completes the link — no remount, no stale-instance race.
function linkThumbs(): void {
  const main = swiperRef.value;
  const thumbs = thumbsSwiperRef.value;
  // Link whenever both instances exist — even while hidden (v-show keeps
  // both mounted); visibility is not a precondition, and guarding on it
  // left the pair unlinked when the desktop branch mounted while minimized
  // (nothing re-triggered on the maximize toggle).
  if (!main || !thumbs) return;
  if (main.thumbs?.swiper === thumbs) return; // already linked
  main.thumbs.swiper = thumbs;
  main.thumbs.init();
  main.thumbs.update(true);
}

// Handle slide change
const onSlideChange = (swiper: SwiperType) => {
  currentSlide.value = swiper.activeIndex;
};

// Use shared device detection
const { hasTouch } = useDeviceDetection();

// Show navigation only on non-touch devices with multiple images
const showNavigation = computed(() => {
  return !hasTouch.value && visibleImages.value.length > 1;
});

// Use shared media preload composable
const { preloadImage, preloadThumbnailImages, getGalleryImageUrl } = useMediaPreload(
  computed(() => props.images),
  currentSlide
);

// Retry visible image loads (same schedule as the preloader); images that
// still fail are removed from view entirely (no black/error slides).
const { failedImageIds, markLoaded: retryLoaded, handleError: retryError } = useImageRetry();

// Visible images with their ORIGINAL index (needed for the fullscreen dialog,
// which receives the unfiltered list)
const visibleImagesWithIndex = computed(() =>
  props.images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => !failedImageIds.value.has(image.id))
);
const visibleImages = computed(() => filterOutFailed(props.images, failedImageIds.value));

// Re-link when thumbnails become (re-)enabled — e.g. after the image
// count crosses the >1 threshold or a remount of the thumbs container.
// Declared AFTER visibleImages: evaluating showThumbnails during setup
// must not run before that const initializes (TDZ crash, owner session
// 2026-10).
watch(showThumbnails, () => linkThumbs());

// Preload only the current image for gallery (simplified - no prev/next)
// DEFERRED off the card-open path (perf profile 2026-10-21): this is the
// fullscreen-dialog-sized (md/lg) URL — most opens never open the dialog,
// so prefetching it on every mount wasted ~3× the pixels. It now warms on
// hover intent over the hero and at dialog-open time (handleImageClick).
const preloadCurrentImageForGallery = () => {
  const image = visibleImages.value[currentSlide.value];
  if (image) {
    // Preload exactly the gallery-sized URL the fullscreen gallery will show
    const galleryUrl = getGalleryImageUrl(image);
    if (galleryUrl) {
      preloadImage(galleryUrl);
    }
  }
};

// Preload with timeout - properly managed by useTimeoutFn
const { start: startPreloadAfterSlide } = useTimeoutFn(() => {
  preloadCurrentImageForGallery();
}, 200);

// Initial preload when component mounts — thumbnails only. The
// gallery-sized (fullscreen) image is warmed on hover/click instead
// (see preloadCurrentImageForGallery).
onMounted(() => {
  preloadThumbnailImages();
});

// Handle image click
const handleImageClick = () => {
  // Warm the fullscreen-sized image right away — a click without a prior
  // hover (touch) still gets an instant dialog (deferred preload policy)
  preloadCurrentImageForGallery();
  // Map rendered (filtered) slide index to the original list index
  const originalIndex =
    visibleImagesWithIndex.value[currentSlide.value]?.index ?? currentSlide.value;
  openDialog(originalIndex);
};

// Track which thumbnails have loaded
const isThumbnailLoaded = (imageId: string) => {
  return loadedThumbnails.value.has(imageId);
};

// Mark thumbnail as loaded
const onThumbnailLoad = (imageId: string) => {
  retryLoaded(imageId, 'thumb');
  loadedThumbnails.value.add(imageId);
};

// Retry thumbnail failures; mark errored only when permanently failed
const onThumbnailError = (imageId: string, event: Event) => {
  if (retryError(imageId, 'thumb', event)) {
    loadedThumbnails.value.add(`${imageId}_error`);
  }
};

// Check if thumbnail failed to load
const isThumbnailError = (imageId: string) => {
  return loadedThumbnails.value.has(`${imageId}_error`);
};

// Stripe image load tracking
const isStripeImageLoaded = (imageId: string) => {
  return loadedStripeImages.value.has(imageId);
};

const onStripeImageLoad = (imageId: string) => {
  retryLoaded(imageId, 'stripe');
  loadedStripeImages.value.add(imageId);
};

// Retry stripe failures; mark errored only when permanently failed
const onStripeImageError = (imageId: string, event: Event) => {
  if (retryError(imageId, 'stripe', event)) {
    loadedStripeImages.value.add(`${imageId}_error`);
  }
};

// Retry main preview slide failures (removal from view happens via filtering)
const onMainImageError = (imageId: string, event: Event) => {
  retryError(imageId, 'main', event);
};

const isStripeImageError = (imageId: string) => {
  return loadedStripeImages.value.has(`${imageId}_error`);
};

// Get current image
const currentImage = computed(() => {
  return visibleImages.value[currentSlide.value] || null;
});

// Get image URL for display
// (the hero container is a fixed 3:2 landscape frame — always landscape
// variants; old `preview` size → sm, retina gets md via variantUrl)
const getMainImageUrl = (image: HutImage) => {
  if (!image?.urls?.landscape) return '';
  return variantUrl(image.urls.landscape, 'sm');
};

// Square thumbnails (old `thumb` → xs, retina gets sm)
const getThumbnailUrl = (image: HutImage) => {
  if (!image.urls?.square) return '';
  return variantUrl(image.urls.square, 'xs');
};

// Get image URL for mobile stripe — uses correct orientation
const getStripeImageUrl = (image: HutImage) => {
  if (!image.urls) return '';
  return variantUrl(orientationUrls(image), 'xs');
};

// ThumbHash placeholders matching each rendering context
const getMainThumbhashStyle = (image: HutImage) => thumbhashStyleForSize(image, 'landscape', 'sm');
const getThumbnailThumbhashStyle = (image: HutImage) =>
  thumbhashStyleForSize(image, 'square', 'xs');
const getStripeThumbhashStyle = (image: HutImage) =>
  thumbhashStyleForSize(image, 'orientation', 'xs');

// Get provider icon for any image
const getProviderIcon = (image: HutImage) => {
  return image?.provider?.icon || undefined;
};

// Get author name for a specific image (for stripe attribution)
const getImageAuthor = (image: HutImage) => {
  if (!props.showAttribution) return '';

  const authorName = image.author?.name;
  const providerName = image.provider?.name;

  if (authorName && authorName !== 'Unknown' && authorName !== 'unknown') {
    return authorName;
  }

  if (providerName) {
    return providerName;
  }

  return '';
};

// Check if we have images
const hasImages = computed(() => visibleImages.value.length > 0);

// Mobile stripe slides: appends add-image slide at the end when >= 3 images on mobile
type StripeSlide = { type: 'image'; image: HutImage; imageIndex: number } | { type: 'add-image' };

const mobileStripeSlides = computed<StripeSlide[]>(() => {
  if (!isMobile.value || visibleImages.value.length < 3) {
    return visibleImagesWithIndex.value.map(({ image, index }) => ({
      type: 'image' as const,
      image,
      imageIndex: index,
    }));
  }
  const slides: StripeSlide[] = visibleImagesWithIndex.value.map(({ image, index }) => ({
    type: 'image' as const,
    image,
    imageIndex: index,
  }));
  slides.push({ type: 'add-image' });
  return slides;
});

// Get short attribution for current image
//const getCurrentImageAttribution = () => {
//  if (!currentImage.value?.attribution || !props.showAttribution) return '';
//  return currentImage.value.attribution.short || currentImage.value.attribution.full || '';
//};

const getCurrentImageAuthor = () => {
  if (!currentImage.value || !props.showAttribution) return '';

  const authorName = currentImage.value.author?.name;
  const providerName = currentImage.value.provider?.name;

  // Don't show "Unknown" as author
  if (authorName && authorName !== 'Unknown' && authorName !== 'unknown') {
    return authorName;
  }

  if (providerName) {
    return providerName;
  }

  return '';
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

  // Add context reference to show tip banner
  query.c_ref = 'hut';

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
  <!-- Single root: this component used to render a fragment (loading /
     gallery / no-image roots), which silently dropped the class attr
     passed from WdHutImageGallery ("extraneous non-props attributes"
     warning on every remount — owner report 2026-10). One wrapper root
     restores normal attribute inheritance. -->
  <div class="wd-media-preview">
    <div v-if="loading && !hasImages" class="flex flex-center no-image-mobile-wrapper">
      <WdNoImage
        :message="emptyStateMessage"
        :icon="emptyStateIcon ?? IconAddPhoto"
        :on-contribute="handleAddImageClick"
        :reduced-height="reducedHeightNoImage"
        :loading="true"
      />
    </div>

    <div v-else-if="hasImages" class="wd-gallery-variants">
      <!-- Both variants stay MOUNTED and crossfade (owner 2026-10: "better
         morph the gallery change") — the wrapper reserves the height,
         the inactive variant is opacity-0 + visibility-hidden after a
         delay so the swap reads as a morph, not a hard cut. -->
      <div
        class="wd-gallery-variant mobile-stripe-container"
        :class="isMobile ? 'wd-gallery-variant--active' : 'wd-gallery-variant--inactive'"
        :aria-hidden="!isMobile"
      >
        <swiper
          :modules="[FreeMode, Scrollbar, Mousewheel]"
          :slides-per-view="'auto'"
          :space-between="4"
          :free-mode="{
            enabled: true,
            sticky: false,
            momentum: true,
            momentumRatio: 1,
            momentumBounce: false,
            minimumVelocity: 0.3,
          }"
          :scrollbar="{
            draggable: false,
            hide: true,
            snapOnRelease: false,
          }"
          :mousewheel="{
            enabled: true,
            forceToAxis: false,
            releaseOnEdges: false,
            sensitivity: 0.22,
          }"
          :grab-cursor="true"
          class="mobile-stripe-swiper"
        >
          <swiper-slide
            v-for="(slide, index) in mobileStripeSlides"
            :key="slide.type === 'image' ? slide.image.id : `add-image-${index}`"
            class="mobile-stripe-slide"
            @click="slide.type === 'image' ? openDialog(slide.imageIndex) : handleAddImageClick()"
          >
            <!-- Add-image slide -->
            <div v-if="slide.type === 'add-image'" class="stripe-add-image-wrapper">
              <q-iconify :is="IconAddPhoto" size="36px" color="grey-5" class="add-image-icon" />
            </div>
            <!-- Image slide -->
            <div
              v-else
              class="stripe-image-wrapper"
              :class="{ 'stripe-error': isStripeImageError(slide.image.id) }"
              :style="getStripeThumbhashStyle(slide.image)"
            >
              <img
                loading="lazy"
                :src="getStripeImageUrl(slide.image)"
                class="stripe-image"
                :class="{ 'stripe-loaded': isStripeImageLoaded(slide.image.id) }"
                :alt="`Image by ${slide.image.attribution?.short || 'unknown'}`"
                @load="onStripeImageLoad(slide.image.id)"
                @error="onStripeImageError(slide.image.id, $event)"
                v-show="!isStripeImageError(slide.image.id)"
              />
              <div v-if="!isStripeImageLoaded(slide.image.id)" class="stripe-number">
                {{ slide.imageIndex + 1 }}
              </div>
              <!-- Per-image attribution overlay -->
              <div
                v-if="getImageAuthor(slide.image) || getProviderIcon(slide.image)"
                class="stripe-attribution"
              >
                <span v-if="getImageAuthor(slide.image)" class="stripe-author">{{
                  getImageAuthor(slide.image)
                }}</span>
                <img
                  v-if="getProviderIcon(slide.image)"
                  :src="getProviderIcon(slide.image)"
                  class="stripe-provider-icon"
                  alt="Provider icon"
                />
              </div>
            </div>
          </swiper-slide>
        </swiper>
      </div>

      <!-- Desktop: main image swiper with thumbnails overlay -->
      <div
        class="wd-gallery-variant media-preview-container"
        :class="!isMobile ? 'wd-gallery-variant--active' : 'wd-gallery-variant--inactive'"
        :aria-hidden="isMobile"
      >
        <div class="media-preview-wrapper" style="border-radius: 16px; overflow: hidden">
          <!-- Navigation buttons - desktop only, no touch. ALWAYS rendered
             (visibility-hidden when off): the swiper resolves these
             selectors at init/update, and v-if'ing them raced the config
             flip on re-target — el undefined → classList crash (owner
             report 2026-10). -->
          <div class="swiper-button-prev" :class="{ 'nav-off': !showNavigation }"></div>
          <div class="swiper-button-next" :class="{ 'nav-off': !showNavigation }"></div>

          <!-- Attribution badge (top-right) - stationary -->
          <div class="license-badge-custom stationary">
            <span v-if="getCurrentImageAuthor()" v-html="sanitizeHtml(getCurrentImageAuthor())" />
            <img
              v-if="getCurrentImageProviderIcon()"
              :src="getCurrentImageProviderIcon()"
              class="provider-icon"
              alt="Provider icon"
            />
          </div>

          <swiper
            :modules="[EffectFade, Keyboard, Navigation, Pagination, Thumbs]"
            :slides-per-view="1"
            :space-between="0"
            :effect="'fade'"
            :fade-effect="{ crossFade: true }"
            :keyboard="{ enabled: true }"
            :loop="true"
            :speed="600"
            :navigation="
              showNavigation
                ? {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                  }
                : false
            "
            :pagination="!showThumbnails && visibleImages.length > 1"
            :initial-slide="0"
            class="preview-swiper"
            @mouseenter="startPreloadAfterSlide"
            @swiper="onSwiper"
            @slide-change="onSlideChange"
          >
            <swiper-slide
              v-for="image in visibleImages"
              :key="image.id"
              class="preview-slide"
              :style="getMainThumbhashStyle(image)"
            >
              <img
                loading="lazy"
                :src="getMainImageUrl(image)"
                :alt="`Image by ${image.attribution?.short || 'unknown'}`"
                class="preview-image"
                @click="handleImageClick"
                @error="onMainImageError(image.id, $event)"
              />
            </swiper-slide>
          </swiper>

          <!-- Thumbnail Swiper - overlaid on image (outside main swiper).
             v-show: stays initialized across minimize/maximize toggles
             (showThumbnails flips with the branch) — thumbs linking is
             redone live via linkThumbs when it becomes visible again. -->
          <div
            v-show="showThumbnails"
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
              <swiper-slide
                v-for="(item, index) in visibleImagesWithIndex"
                :key="item.image.id"
                class="thumb-slide-inline"
              >
                <div
                  class="thumb-content-wrapper"
                  :class="{ 'thumb-error': isThumbnailError(item.image.id) }"
                  :style="getThumbnailThumbhashStyle(item.image)"
                >
                  <img
                    loading="lazy"
                    :src="getThumbnailUrl(item.image)"
                    class="thumb-image-inline"
                    :class="{ 'thumb-loaded': isThumbnailLoaded(item.image.id) }"
                    :alt="`Thumbnail by ${item.image.attribution?.short || 'unknown'}`"
                    @load="onThumbnailLoad(item.image.id)"
                    @error="onThumbnailError(item.image.id, $event)"
                    v-show="!isThumbnailError(item.image.id)"
                  />
                  <div v-if="!isThumbnailLoaded(item.image.id)" class="thumb-number">
                    {{ index + 1 }}
                  </div>
                  <div v-if="getProviderIcon(item.image)" class="thumb-provider-icon-bg">
                    <img
                      :src="getProviderIcon(item.image)"
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

      <!-- Media Dialog is now invoked via Quasar Dialog plugin -->
    </div>

    <!-- No images state - use slot for customization -->
    <slot name="no-image">
      <div v-if="!loading && !hasImages" class="no-image-mobile-wrapper">
        <WdNoImage
          :message="emptyStateMessage"
          :icon="emptyStateIcon ?? IconAddPhoto"
          :on-contribute="handleAddImageClick"
          :reduced-height="reducedHeightNoImage"
        />
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.wd-media-preview {
  width: 100%;
  // Height-defined chain (fix 2026-10: images vanished): the slot's
  // absolute-inset box sizes `.image-gallery-container`; this root must
  // pass the height down so the crossfade wrapper's 100% + overflow clip
  // don't collapse to 0 and hide the gallery.
  height: 100%;
}

// ── Gallery variant crossfade (owner 2026-10: "morph the gallery
//    change"). Both variants stay mounted, absolutely stacked inside the
//    reserved slot; the inactive one fades out and hides AFTER the fade
//    (visibility transition-delay) so minimize/maximize reads as one
//    morph — no hard cut, no remount (Swipers stay alive).
.wd-gallery-variants {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wd-gallery-variant {
  position: absolute;
  inset: 0;
  transition:
    opacity 180ms cubic-bezier(0.2, 0, 0, 1),
    visibility 0s linear 180ms;
}

.wd-gallery-variant--active {
  opacity: 1;
  visibility: visible;
  transition: opacity 180ms cubic-bezier(0.2, 0, 0, 1);
}

.wd-gallery-variant--inactive {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

// Navigation buttons stay in the DOM when off (visibility, not v-if) so
// the swiper's selector resolution can never race their patch order.
.swiper-button-prev.nav-off,
.swiper-button-next.nav-off {
  visibility: hidden;
  pointer-events: none;
}

.media-preview-container {
  // Remove max-width to let Quasar grid control width
  width: 100%;
  // Ensure border-box for consistent sizing across components
  box-sizing: border-box;
}

.media-preview-wrapper {
  position: relative;
  width: 100%;
  // Fixed aspect ratio container to prevent size changes
  padding-top: 66.67%; // 3:2 aspect ratio (landscape)
  background: var(--wd-surface-deep, #f5f5f5); // Placeholder background (theme-aware)
  // Ensure border-box for consistent sizing
  box-sizing: border-box;

  // Navigation buttons - gray arrows with transparency, no background
  :deep(.swiper-button-prev),
  :deep(.swiper-button-next) {
    // Remove background completely
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;

    // Size and positioning
    width: 44px !important;
    height: 44px !important;

    // Arrow color (gray with transparency)
    color: rgba(120, 120, 120, 0.8) !important;

    // Smooth transitions
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

    // Remove border radius since no background
    border-radius: 0 !important;

    // SVG icon sizing (Swiper v12 uses SVG)
    :deep(svg) {
      width: 100% !important;
      height: 100% !important;
      fill: currentColor !important;
    }

    // Hover state - darker gray
    &:hover {
      color: rgba(80, 80, 80, 1) !important;
      transform: scale(1.1) !important;
    }

    // Active state
    &:active {
      transform: scale(0.95) !important;
    }

    // Focus state for accessibility
    &:focus {
      outline: 2px solid rgba(169, 240, 210, 0.8) !important;
      outline-offset: 2px !important;
    }

    // Disabled state
    &.swiper-button-disabled {
      opacity: 0.3 !important;
      cursor: not-allowed !important;
    }
  }

  :deep(.swiper-button-prev) {
    left: 8px !important;
  }

  :deep(.swiper-button-next) {
    right: 8px !important;
  }
}

// Mobile stripe styles
.mobile-stripe-container {
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

// Constrain no-image state to match stripe height on mobile
.no-image-mobile-wrapper {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;

  @media (max-width: 599px) {
    :deep(.no-image-wrapper) {
      padding-top: 0 !important;
      height: 85px;
    }

    :deep(.no-image-content) {
      position: relative;
      padding: 8px 12px;
    }
  }
}

.mobile-stripe-swiper {
  width: 100%;
  padding-bottom: 2px;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.swiper-scrollbar-lock {
    padding-bottom: 0;
    cursor: default;
  }
}

.mobile-stripe-slide {
  width: auto !important;
  height: 85px;
  flex-shrink: 0;
  cursor: pointer;
}

.stripe-image-wrapper {
  position: relative;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: var(--wd-wash, rgba(0, 0, 0, 0.06));
  display: flex;
  align-items: center;
  justify-content: center;

  &.stripe-error {
    background: rgba(255, 0, 0, 0.05);
  }
}

.stripe-add-image-wrapper {
  height: 100%;
  width: 65px;
  border-radius: 8px;
  border: 2px dashed rgba(0, 0, 0, 0.15);
  background: var(--wd-wash, rgba(0, 0, 0, 0.03));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 6px;
  transition: background 0.3s ease;

  &:active {
    background: rgba(0, 0, 0, 0.08);
  }
}

.add-image-icon {
  opacity: 0.5;
  transition: all 0.3s ease;
}

.stripe-image {
  height: 100%;
  width: auto;
  display: block;
  border-radius: 8px;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;

  &.stripe-loaded {
    opacity: 1;
  }
}

.stripe-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.15);
  user-select: none;
  pointer-events: none;

  background: #46543f; /* solid — alpha scrims read as no-bg in the audit */
  color: #fdfefd;
  padding: 2px 7px;
  border-radius: 999px;
}

// Per-image attribution overlay inside stripe slides
.stripe-attribution {
  position: absolute;
  bottom: 3px;
  right: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-radius: 4px;
  padding: 2px 4px;
  pointer-events: none;
}

.stripe-author {
  font-size: 0.5rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70px;
  line-height: 1.2;
}

.stripe-provider-icon {
  width: 10px;
  height: 10px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 1px;
}

// Scrollbar styling (matching WdWeatherForecast)
.mobile-stripe-swiper :deep(.swiper-scrollbar) {
  height: 3px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  bottom: 2px;
}

.mobile-stripe-swiper :deep(.swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 2px;
  min-width: 24px;
}

.mobile-stripe-swiper :deep(.swiper-scrollbar:hover) {
  height: 5px;
}

.mobile-stripe-swiper :deep(.swiper-scrollbar:hover .swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.35);
}

.preview-swiper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;

  :deep(.swiper-wrapper) {
    box-sizing: border-box;
  }

  :deep(.swiper-slide) {
    box-sizing: border-box;
  }
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
    justify-content: flex-start;
  }

  :deep(.swiper-slide) {
    // Square aspect ratio: 1:1
    width: var(--thumbnail-size) !important;
    height: var(--thumbnail-size) !important;
    opacity: 0.5;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
  }

  :deep(.swiper-slide-thumb-active) {
    opacity: 1 !important;
    // Tonal selection (design review 2026-10): ink border, no glow —
    // panel-on-panel shadows and off-palette Material blue are both
    // DESIGN.md violations (Tonal Layer Rule; selection = glacier/ink)
    border: 2px solid var(--wd-ink);
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
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15); // Loading placeholder background (darker)

  &.thumb-error {
    background: rgba(255, 0, 0, 0.1); // Red tint for error
  }
}

.thumb-image-inline {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  background: transparent;
  object-fit: cover;
  opacity: 0; // Start hidden
  transition: opacity 0.3s ease;

  &.thumb-loaded {
    opacity: 1; // Fade in when loaded
  }
}

.thumb-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 20px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3); // Subtle, lighter than background
  user-select: none;
  pointer-events: none;
  z-index: 1; // Above provider icon

  background: #46543f; /* solid — alpha scrims read as no-bg in the audit */
  color: #fdfefd;
  padding: 2px 7px;
  border-radius: 999px;
}

.thumb-error-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(255, 100, 100, 0.6); // Red tint for error
  opacity: 0.8;
  z-index: 2; // Above everything
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
  // Remove max-width to let Quasar grid control width
  width: 100%;
  display: block;
}

.license-badge-custom {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  color: white;
  font-size: 0.75rem;
  padding: 5px 8px;
  border-radius: 4px;
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
  max-width: 300px;

  &.stationary {
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 100;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  :deep(a) {
    color: rgba(255, 255, 255, 0.95);
    text-decoration: underline dotted;
    text-decoration-color: rgba(255, 255, 255, 0.5);
    transition: all 0.2s;
  }

  :deep(a:hover) {
    color: #ffffff;
    text-decoration-color: currentColor;
    text-decoration: underline dotted;
  }

  @media (max-width: 599px) {
    font-size: 0.6rem;
    padding: 3px 5px;
    gap: 4px;
    top: 4px;
    right: 4px;
  }
}

.provider-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 2px;

  @media (max-width: 599px) {
    width: 12px;
    height: 12px;
  }
}

.absolute-bottom-right {
  position: absolute;
}

.thumbs-swiper-container {
  --thumbnail-size: 50px;
  position: absolute;
}

// Custom pagination styling for mobile
.preview-swiper {
  :deep(.swiper-pagination) {
    bottom: 8px !important;
  }

  :deep(.swiper-pagination-bullet) {
    background: rgba(255, 255, 255, 0.5);
    opacity: 1;
    transition: all 0.3s ease;
  }

  :deep(.swiper-pagination-bullet-active) {
    // Neutral solid white over imagery (was off-palette Material blue)
    background: rgba(255, 255, 255, 0.95) !important;
    width: 8px !important;
  }

  // Custom navigation buttons for desktop - gray arrows with transparency, no background
  :deep(.swiper-button-prev),
  :deep(.swiper-button-next) {
    // Remove background completely
    background: transparent !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;

    // Size and positioning
    width: 44px !important;
    height: 44px !important;

    // Arrow color (gray with transparency) - IMPORTANT: override all Quasar inherited colors
    color: rgba(120, 120, 120, 0.8) !important;

    // Smooth transitions
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

    // Remove border radius since no background
    border-radius: 0 !important;

    // SVG icon sizing and color - CRITICAL: Override Quasar SVG styles
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
      outline: 2px solid rgba(169, 240, 210, 0.8) !important;
      outline-offset: 2px !important;
    }

    // Disabled state
    &.swiper-button-disabled {
      opacity: 0.3 !important;
      cursor: not-allowed !important;
    }
  }

  :deep(.swiper-button-prev) {
    left: 8px !important;
  }

  :deep(.swiper-button-next) {
    right: 8px !important;
  }
}
</style>
