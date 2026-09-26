import { getCurrentInstance, onUnmounted, ref, type Ref } from 'vue';
import { getRetryDelayMs } from '@composables/useMediaPreload';

/** Max retries for a visible <img> before it is dropped from view (4 attempts total). */
export const MAX_IMAGE_RETRIES = 3;

/** Slot keys keep retry counters per element (main slide vs thumb load the same image id). */
export type ImageRetrySlot = string;

export function useImageRetry(): {
  failedImageIds: Ref<Set<string>>;
  /** Call from <img> @load: cancels any pending retry for this image. */
  markLoaded: (imageId: string, slot: ImageRetrySlot) => void;
  /**
   * Call from <img> @error. Re-assigns the same src after the fixed backoff
   * schedule (1s/3s/7s, MAX_IMAGE_RETRIES retries). Returns true once the
   * image is permanently failed (no cache-busting: imagor caches successes).
   */
  handleError: (imageId: string, slot: ImageRetrySlot, event: Event) => boolean;
} {
  const failedImageIds = ref<Set<string>>(new Set());
  const retryAttempts = new Map<string, number>();
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const key = (imageId: string, slot: ImageRetrySlot) => `${imageId}:${slot}`;

  const clearTimer = (imageId: string, slot: ImageRetrySlot) => {
    const timer = retryTimers.get(key(imageId, slot));
    if (timer !== undefined) {
      clearTimeout(timer);
      retryTimers.delete(key(imageId, slot));
    }
  };

  const markLoaded = (imageId: string, slot: ImageRetrySlot) => {
    retryAttempts.delete(key(imageId, slot));
    clearTimer(imageId, slot);
  };

  const handleError = (imageId: string, slot: ImageRetrySlot, event: Event): boolean => {
    const el = event.target as HTMLImageElement | null;
    const attempt = retryAttempts.get(key(imageId, slot)) ?? 0;

    if (attempt >= MAX_IMAGE_RETRIES || !el) {
      retryAttempts.delete(key(imageId, slot));
      clearTimer(imageId, slot);
      failedImageIds.value.add(imageId);
      return true;
    }

    retryAttempts.set(key(imageId, slot), attempt + 1);
    clearTimer(imageId, slot);
    const timer = setTimeout(() => {
      retryTimers.delete(key(imageId, slot));
      // Re-assigning src (same value) restarts the load (setAttribute:
      // eslint's no-self-assign fires on `el.src = el.src`); no cache-buster —
      // imagor caches successes and busting would defeat that.
      el.setAttribute('src', el.getAttribute('src') ?? el.src);
    }, getRetryDelayMs(attempt));
    retryTimers.set(key(imageId, slot), timer);
    return false;
  };

  // Guard against leaks when used outside a component (tests)
  if (getCurrentInstance()) {
    onUnmounted(() => {
      retryTimers.forEach(timer => clearTimeout(timer));
      retryTimers.clear();
    });
  }

  return { failedImageIds, markLoaded, handleError };
}

/** Exclude permanently failed images from a rendered list. */
export function filterOutFailed<T extends { id: string }>(
  images: T[],
  failedIds: ReadonlySet<string>
): T[] {
  return images.filter(image => !failedIds.has(image.id));
}
