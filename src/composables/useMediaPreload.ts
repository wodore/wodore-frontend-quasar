import { ref, type Ref } from 'vue';
import type { HutImage } from './useHutImages';
import type { ImageSizeVariants } from 'src/types/geo';

export function useMediaPreload(images: Ref<HutImage[]>, currentSlide: Ref<number>) {
  const preloadedUrls = ref<Set<string>>(new Set());

  // Get optimal image size based on screen size - NEVER upscale
  const getOptimalImageSize = (): 'large' | 'medium' => {
    if (typeof window === 'undefined') return 'medium';

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
  const getGalleryImageUrl = (image: HutImage): string => {
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
  const getThumbnailUrl = (image: HutImage): string => {
    if (!image.urls?.square) return '';

    const pixelRatio = window.devicePixelRatio || 1;
    // Use @2x for HiDPI devices
    if (pixelRatio >= 1.5 && image.urls.square['thumb@2x']) {
      return image.urls.square['thumb@2x'];
    }
    return image.urls.square.thumb || '';
  };

  // Get preview image URL (same as preview component uses) - already cached
  const getPreviewImageUrl = (image: HutImage): string => {
    if (!image.urls) return '';

    // Use is_portrait to determine orientation, same as preview component
    const orientation = image.is_portrait ? 'portrait' : 'landscape';
    const urls = image.urls[orientation] || image.urls.landscape;

    if (!urls) return '';

    // Return preview size (same as preview component uses)
    return urls.preview || urls.thumb || '';
  };

  // Preload single image
  const preloadImage = (imageUrl: string) => {
    if (!imageUrl || preloadedUrls.value.has(imageUrl)) return;
    const img = new window.Image();
    img.src = imageUrl;
    preloadedUrls.value.add(imageUrl);
  };

  // Preload current, next, and previous images
  const preloadAdjacentImages = () => {
    const currentIndex = currentSlide.value;
    const indicesToPreload = [
      currentIndex, // Current
      (currentIndex + 1) % images.value.length, // Next
      (currentIndex - 1 + images.value.length) % images.value.length, // Previous
    ];

    indicesToPreload.forEach(index => {
      const image = images.value[index];
      if (image) {
        const galleryImageUrl = getGalleryImageUrl(image);
        preloadImage(galleryImageUrl);
      }
    });
  };

  // Preload thumbnail images (up to 8, primarily for mobile)
  const preloadThumbnailImages = (count: number = 8) => {
    const thumbsToPreload = Math.min(images.value.length, count);

    for (let i = 0; i < thumbsToPreload; i++) {
      const image = images.value[i];
      if (image) {
        const thumbUrl = getThumbnailUrl(image);
        preloadImage(thumbUrl);
      }
    }
  };

  return {
    preloadedUrls,
    getOptimalImageSize,
    getGalleryImageUrl,
    getThumbnailUrl,
    getPreviewImageUrl,
    preloadImage,
    preloadAdjacentImages,
    preloadThumbnailImages,
  };
}
