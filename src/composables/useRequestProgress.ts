import { ref } from 'vue';

/**
 * Global request progress state shared by the API clients
 * (src/clients/index.ts) and the header progress bar (MainLayout).
 *
 * Replaces Quasar's LoadingBar (QAjaxBar), which is pinned to the
 * viewport top edge — the bar now rides the bottom edge of the floating
 * topbar pill (MainLayout), clipped by its stadium border. Mirrors
 * QAjaxBar's debounce so fast responses (< 150 ms) never flash the bar.
 *
 * Second input (perf/map-boot, owner 2026-10-31): the progressive map
 * reveal drops the splash as soon as the BASEMAP has painted, while
 * overlay layers may still be mounting/loading underneath. The bar
 * stays on for that window (`setMapBootPending`) — "map is here" (the
 * reveal) and "everything is ready" (the old gate) are separate
 * milestones now, and the bar bridges them. The shared 150 ms debounce
 * applies too: a boot where the overlays land within 150 ms of the
 * reveal never flashes the bar at all.
 */
const activeCount = ref(0);
/** True while the map is revealed but its layers are not fully ready. */
const mapBootPending = ref(false);
const visible = ref(false);
let showTimer: ReturnType<typeof setTimeout> | null = null;

function evaluate(): void {
  const busy = activeCount.value > 0 || mapBootPending.value;
  if (busy) {
    if (showTimer === null && !visible.value) {
      showTimer = setTimeout(() => {
        showTimer = null;
        if (activeCount.value > 0 || mapBootPending.value) {
          visible.value = true;
        }
      }, 150);
    }
  } else if (showTimer !== null || visible.value) {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    visible.value = false;
  }
}

export function requestStart(): void {
  activeCount.value++;
  evaluate();
}

export function requestStop(): void {
  activeCount.value = Math.max(0, activeCount.value - 1);
  evaluate();
}

/** Hold the topbar bar while the revealed map finishes loading its
 *  layers; `false` releases it (idempotent). */
export function setMapBootPending(pending: boolean): void {
  if (mapBootPending.value === pending) return;
  mapBootPending.value = pending;
  evaluate();
}

export function useRequestProgress() {
  return { visible };
}
