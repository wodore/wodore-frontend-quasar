<script setup lang="ts">
/**
 * WdZoomSlider — vertical zoom slider docked to the RIGHT edge
 * (Mapy.com-inspired, Wodore styling).
 *
 * - Focus mode: ALWAYS visible (CSS-driven, see _zoom-slider.scss);
 *   mobile otherwise hides it while the overlay strip is open.
 *   Show/hide tucks the handle in/out of the screen edge with a fade
 *   (300ms in, 200ms out, the focus-mode system curve; instant under
 *   prefers-reduced-motion)
 * - Drag up/down to zoom in/out; buttons step ±0.75
 * - Track reads top = max zoom (matches the + button on top):
 *   the thumb travels 12% (max) – 88% (min), never touching the ends
 * - Gesture model (one pipeline on the 44px band): EVERY press starts a
 *   potential drag — including presses on the +/− buttons, which used to
 *   stop-propagate pointerdown and swallowed drag-starts at the button
 *   rows. A press that never travels (>5px) is a tap: on a button it
 *   steps, on the track it steps toward the tapped half. Pointer capture
 *   retargets the browser's click to the band, so the buttons' @click
 *   only serves keyboard activation (event.detail === 0).
 * - The visible pill stays compact; the tuck/fade animation moves the
 *   pill, never the hit band (see _zoom-slider.scss)
 * - Keyboard (WAI-ARIA slider): arrows step ±0.75, PageUp/Down ±3,
 *   Home/End jump to the range ends; focus-visible rings mark the band
 *   and the buttons
 * - Rapid taps chain onto the previous step TARGET so a quick double-tap
 *   always advances a full step (the camera's mid-animation value would
 *   under-step); the chain expires so later taps follow pinch/flyTo again
 * - Aria labels come from the i18n locales (map.zoom / zoomIn / zoomOut)
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { type LngLat, type Map as MlMap } from 'maplibre-gl';
import { MAP_MIN_ZOOM } from '@stores/map/utils/map-constants';

const mapRef = useMap();
const { t } = useI18n();

/** Map zoom range — floor bounds how far the camera zooms out (see
 *  MAP_MIN_ZOOM); no app-level max: sources overzoom past their own
 *  tile max up to MapLibre's z22. */
const MIN_ZOOM = MAP_MIN_ZOOM;
const MAX_ZOOM = 22;
/** px of drag per full zoom level — lower = more aggressive. 48 keeps a
 *  full-band drag (~120px) under ~2.5 levels; 32 (the previous value)
 *  traversed almost 4 and read as hair-trigger. */
const PX_PER_LEVEL = 48;
/** zoom step of the +/− buttons and of a tap on a track half */
const STEP = 0.75;
/** large step of PageUp/PageDown (WAI-ARIA slider large step) */
const PAGE_STEP = 3;
/** px of pointer travel that turns a press into a drag (below = tap) */
const MOVE_THRESHOLD = 5;
/** rapid taps chain onto the previous step target within this window */
const STEP_CHAIN_MS = 600;

const zoom = ref(10);
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragStartZoom = 0;
/** step direction of the button the press landed on (0 = none/track) */
let downStep = 0;
/** the press travelled — it is a drag, never a tap */
let didDrag = false;
/** intended end zoom of the latest step — rapid taps chain from it */
let targetZoom: number | null = null;
/** when the last step was requested (chains within STEP_CHAIN_MS) */
let lastStepAt = 0;

/** Thumb travel 12%..88% — never fully up or down; TOP = max zoom */
const thumbPos = computed(() => {
  const t = Math.min(1, Math.max(0, (zoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
  return 88 - t * 76;
});

function clamp(v: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
}

/** Anchor for every slider zoom: the VISUAL viewport middle, as a
 *  LngLat. NOT the map center — hut flyTos leave camera PADDING
 *  behind (mobile safe-area flights, see WdMapView), and an unanchored
 *  zoomTo pivots on the PADDED center, which sits off the visual
 *  middle: the zoom drifts sideways instead of staying put.
 *  unproject([w/2, h/2]) yields the true screen middle as a LngLat —
 *  the container-pixel pair is accepted as a PointLike, and passing a
 *  LngLat (not a raw pixel Point) is what easeTo's `around` expects. */
function visualCenter(map: MlMap): LngLat {
  const container = map.getContainer();
  return map.unproject([container.clientWidth / 2, container.clientHeight / 2]);
}

function onPointerDown(e: PointerEvent): void {
  // Second finger while already dragging: keep the first gesture's baseline.
  if (dragging.value) return;
  // A press on a +/− button ALSO starts here — the buttons used to
  // stop-propagate pointerdown, which is why grabbing the handle at the
  // button rows never started a drag.
  downStep =
    Number(
      (e.target as HTMLElement | null)?.closest('[data-zoom-step]')?.getAttribute('data-zoom-step')
    ) || 0;
  dragging.value = true;
  didDrag = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  // Baseline on the LIVE camera — grabbing during a flight (flyTo, pinch)
  // must not start from a stale animated zoom value or the first movement
  // reads as a jump and the drag as "not captured".
  dragStartZoom = mapRef.map ? mapRef.map.getZoom() : zoom.value;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // Pointer already inactive — the band-level handlers still work.
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || !mapRef.map) return;
  const dx = e.clientX - dragStartX;
  const dy = dragStartY - e.clientY; // up = zoom in
  if (Math.abs(dy) > MOVE_THRESHOLD || Math.abs(dx) > MOVE_THRESHOLD) didDrag = true;
  const next = clamp(dragStartZoom + dy / PX_PER_LEVEL);
  if (next !== zoom.value) {
    zoom.value = next;
    mapRef.map.zoomTo(next, { duration: 0, around: visualCenter(mapRef.map) });
  }
}

function onPointerUp(e: PointerEvent): void {
  finishDrag(e);
}

function onPointerCancel(): void {
  // Cancelled gestures and lost captures must never tap-step.
  finishDrag();
}

function finishDrag(tap?: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  // A press that never travelled is a TAP, not a drag. Pointer capture
  // retargets the browser's click to the band, so this pipeline replaces
  // the buttons' pointer @click entirely.
  if (tap && !didDrag) {
    if (downStep !== 0) {
      stepZoom(downStep);
    } else if (mapRef.map && tap.currentTarget instanceof HTMLElement) {
      // Tap on the track: step toward the tapped half (top = zoom in,
      // matching the track's top = max zoom reading).
      const rect = tap.currentTarget.getBoundingClientRect();
      stepZoom(tap.clientY < rect.top + rect.height / 2 ? STEP : -STEP);
    }
  }
  downStep = 0;
}

function onStepClick(e: MouseEvent, delta: number): void {
  // Pointer taps are owned by the band's gesture pipeline (capture
  // retargets the click away from the buttons). detail === 0 identifies
  // keyboard activation (Enter/Space), which still must step.
  if (e.detail === 0) stepZoom(delta);
}

function applyZoom(value: number): void {
  if (!mapRef.map) return;
  const next = clamp(value);
  targetZoom = next;
  lastStepAt = Date.now();
  zoom.value = next;
  mapRef.map.zoomTo(next, {
    around: visualCenter(mapRef.map),
    // snappy step; no camera travel for reduced-motion users
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
  });
}

function stepZoom(delta: number): void {
  if (!mapRef.map) return;
  // Chain onto the previous step's TARGET, not the camera's current
  // position: onMapZoom keeps writing mid-animation values into zoom.value
  // during the 150ms zoomTo, so a rapid second tap would under-step.
  const now = Date.now();
  const chain =
    targetZoom !== null && now - lastStepAt <= STEP_CHAIN_MS ? targetZoom : mapRef.map.getZoom();
  applyZoom(chain + delta);
}

/** WAI-ARIA slider keyboard pattern (focused band, and bubbling buttons) */
function onKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      e.preventDefault();
      stepZoom(STEP);
      break;
    case 'ArrowDown':
    case 'ArrowLeft':
      e.preventDefault();
      stepZoom(-STEP);
      break;
    case 'PageUp':
      e.preventDefault();
      stepZoom(PAGE_STEP);
      break;
    case 'PageDown':
      e.preventDefault();
      stepZoom(-PAGE_STEP);
      break;
    case 'Home':
      e.preventDefault();
      applyZoom(MIN_ZOOM);
      break;
    case 'End':
      e.preventDefault();
      applyZoom(MAX_ZOOM);
      break;
  }
}

/** Keep the thumb in sync when zoom changes from elsewhere (pinch etc.) */
function onMapZoom(): void {
  if (!dragging.value && mapRef.map) zoom.value = mapRef.map.getZoom();
}

onMounted(() => {
  if (mapRef.map) {
    zoom.value = mapRef.map.getZoom();
    mapRef.map.on('zoom', onMapZoom);
  }
});

onBeforeUnmount(() => {
  mapRef.map?.off('zoom', onMapZoom);
});
</script>

<template>
  <!-- outer div = 44px touch zone; the inner pill is the slim visual -->
  <div
    class="wd-zoom"
    :class="{ 'wd-zoom--dragging': dragging }"
    role="slider"
    :aria-label="t('map.zoom')"
    :aria-valuemin="MIN_ZOOM"
    :aria-valuemax="MAX_ZOOM"
    :aria-valuenow="Math.round(zoom * 10) / 10"
    :aria-valuetext="Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100) + '%'"
    tabindex="0"
    @keydown="onKeydown"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
  >
    <div class="wd-zoom__pill">
      <button
        class="wd-zoom__step"
        data-zoom-step="0.75"
        :aria-label="t('map.zoomIn')"
        @click="onStepClick($event, STEP)"
      >
        <q-icon name="wd-plus" size="14px" />
      </button>

      <div class="wd-zoom__track">
        <div class="wd-zoom__thumb" :style="{ top: thumbPos + '%' }" />
      </div>

      <button
        class="wd-zoom__step"
        data-zoom-step="-0.75"
        :aria-label="t('map.zoomOut')"
        @click="onStepClick($event, -STEP)"
      >
        <q-icon name="wd-minus" size="14px" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Pill geometry/visuals live in the SHARED partial
// css/map-controls/_zoom-slider-pill.scss — also consumed by the Leaflet
// fallback's slider (one source of truth, compiled per consumer so the
// global first-load CSS stays untouched).
@use '../../../css/map-controls/zoom-slider-pill';

@include zoom-slider-pill.pill;
</style>
