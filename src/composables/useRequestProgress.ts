import { ref } from 'vue';

/**
 * Global request progress state shared by the API clients
 * (src/clients/index.ts) and the header progress bar (MainLayout).
 *
 * Replaces Quasar's LoadingBar (QAjaxBar), which is pinned to the
 * viewport top edge — the bar now lives at the bottom of the header
 * toolbar. Mirrors QAjaxBar's debounce so fast responses (< 150 ms)
 * never flash the bar.
 */
const activeCount = ref(0);
const visible = ref(false);
let showTimer: ReturnType<typeof setTimeout> | null = null;

export function requestStart(): void {
  activeCount.value++;
  if (showTimer === null) {
    showTimer = setTimeout(() => {
      showTimer = null;
      if (activeCount.value > 0) {
        visible.value = true;
      }
    }, 150);
  }
}

export function requestStop(): void {
  activeCount.value = Math.max(0, activeCount.value - 1);
  if (activeCount.value === 0) {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    visible.value = false;
  }
}

export function useRequestProgress() {
  return { visible };
}
