import { computed } from 'vue';

export function useDeviceDetection() {
  // Detect touch capability with SSR safety
  const hasTouch = computed(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  return {
    hasTouch,
  };
}
