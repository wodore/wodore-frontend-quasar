import { ref, type Ref } from 'vue';
import type { HutImage } from './useHutImages';
import type { ImageSizeVariants } from 'src/types/geo';

/**
 * Retry schedule for transient upstream failures (imagor cache misses can
 * surface as 429/5xx when the upstream source rate-limits): retry seconds
 * later with increasing waits.
 */
export const RETRY_DELAYS_MS = [1000, 3000, 7000] as const;

/** Delay before retry attempt `attemptNumber` (0-based); clamps to the last entry. */
export function getRetryDelayMs(attemptNumber: number): number {
  return RETRY_DELAYS_MS[Math.min(attemptNumber, RETRY_DELAYS_MS.length - 1)];
}

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

  // Preload single image with retry logic for rate limiting
  // Fixed backoff schedule (1s/3s/7s, max 3 retries). Note: Retry-After is
  // NOT honored - new Image() cannot read response headers (cross-origin).
  const preloadImage = (imageUrl: string, options: { maxRetries?: number } = {}): void => {
    if (!imageUrl || preloadedUrls.value.has(imageUrl)) return;

    const { maxRetries = 3 } = options;

    const attemptLoad = (attemptNumber: number) => {
      const img = new window.Image();

      img.onload = () => {
        preloadedUrls.value.add(imageUrl);
      };

      img.onerror = () => {
        // Check if we should retry
        if (attemptNumber < maxRetries) {
          // Fixed schedule: 1s, 3s, 7s (see RETRY_DELAYS_MS)
          const delay = getRetryDelayMs(attemptNumber);
          setTimeout(() => attemptLoad(attemptNumber + 1), delay);
        }
        // If max retries reached, silently fail - the browser will handle it naturally
      };

      // Load directly - the onerror handler above implements the retry
      // logic with the fixed schedule (no HEAD preflight: it doubled
      // every image request against the imagor rate limiter).
      img.src = imageUrl;
    };

    attemptLoad(0);
  };

  // Preload current, next, and previous images
  // With loop mode, preload more aggressively to prevent partially loaded images
  // Runs asynchronously in background with retry logic for rate limiting
  const preloadAdjacentImages = () => {
    const currentIndex = currentSlide.value;
    const imageCount = images.value.length;

    // For loop mode, preload a wider range to ensure all visible slides are ready
    // This prevents half-loaded images when navigating
    const indicesToPreload = [
      currentIndex, // Current
      (currentIndex + 1) % imageCount, // Next
      (currentIndex + 2) % imageCount, // Next+1 (for smoother navigation)
      (currentIndex - 1 + imageCount) % imageCount, // Previous
      (currentIndex - 2 + imageCount) % imageCount, // Previous-1
    ];

    indicesToPreload.forEach((index, i) => {
      const image = images.value[index];
      if (image) {
        const galleryImageUrl = getGalleryImageUrl(image);
        // Stagger requests slightly to avoid hitting rate limits (5 images / 3 concurrent)
        // Reduced spread since we have retry logic: 0ms, 50ms, 100ms, 150ms, 200ms
        const delay = i * 50;
        setTimeout(() => {
          preloadImage(galleryImageUrl, { maxRetries: 3 });
        }, delay);
      }
    });
  };

  // Preload thumbnail images (up to 8, primarily for mobile)
  // Uses retry logic and staggering to avoid rate limits
  // Returns array of promises for monitoring completion
  const preloadThumbnailImages = (count: number = 8): Promise<void>[] => {
    const thumbsToPreload = Math.min(images.value.length, count);
    const promises: Promise<void>[] = [];

    // Stagger thumbnail requests with reduced spread (50ms apart)
    // Since we have retry logic, we can start faster
    for (let i = 0; i < thumbsToPreload; i++) {
      const image = images.value[i];
      if (image) {
        const thumbUrl = getThumbnailUrl(image);

        // Create a promise that resolves when thumbnail is loaded
        const loadPromise = new Promise<void>(resolve => {
          // Delay: 0ms, 50ms, 100ms, 150ms, 200ms...
          const delay = i * 50;

          setTimeout(() => {
            // Use fetch-based approach to detect errors and retry
            const attemptLoad = (attemptNumber: number): void => {
              const img = new window.Image();

              img.onload = () => {
                preloadedUrls.value.add(thumbUrl);
                resolve();
              };

              img.onerror = () => {
                if (attemptNumber < 3) {
                  // Fixed retry schedule: 1s, 3s, 7s (see RETRY_DELAYS_MS)
                  const retryDelay = getRetryDelayMs(attemptNumber);
                  setTimeout(() => attemptLoad(attemptNumber + 1), retryDelay);
                } else {
                  // Resolve anyway - thumbnail will show broken or browser will retry
                  resolve();
                }
              };

              // Load directly - the onerror handler above implements the
              // retry logic (no HEAD preflight, see preloadImage).
              img.src = thumbUrl;
            };

            attemptLoad(0);
          }, delay);
        });

        promises.push(loadPromise);
      }
    }

    return promises;
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
