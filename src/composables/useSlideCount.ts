import { ref, type Ref } from 'vue';
import { useResizeObserver } from '@vueuse/core';

/**
 * Reactive slide count based on container width.
 * Observes the provided element and computes how many slides fit.
 *
 * @param container - ref to the container element to observe
 * @param slideWidth - width of a single slide in pixels
 * @returns reactive number of slides that fit
 */
export function useSlideCount(container: Ref<HTMLElement | null>, slideWidth: number) {
  const slidesPerView = ref(Math.max(1, Math.floor(380 / slideWidth))); // sensible default

  useResizeObserver(container, ([entry]) => {
    const width = entry.contentRect.width;
    slidesPerView.value = Math.max(1, Math.floor(width / slideWidth));
  });

  return { slidesPerView };
}
