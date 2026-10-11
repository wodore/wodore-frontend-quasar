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
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { MAP_MIN_ZOOM } from '@stores/map/utils/map-constants';

const mapRef = useMap();

/** Map zoom range — floor keeps the globe comfortably in view (see
 *  MAP_MIN_ZOOM); no app-level max: sources overzoom past their own
 *  tile max up to MapLibre's z22. */
const MIN_ZOOM = MAP_MIN_ZOOM;
const MAX_ZOOM = 22;
/** px of drag per full zoom level — lower = more aggressive */
const PX_PER_LEVEL = 32;
/** zoom step of the +/− buttons and of a tap on a track half */
const STEP = 0.75;
/** px of pointer travel that turns a press into a drag (below = tap) */
const MOVE_THRESHOLD = 5;

const zoom = ref(10);
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragStartZoom = 0;
/** step direction of the button the press landed on (0 = none/track) */
let downStep = 0;
/** the press travelled — it is a drag, never a tap */
let didDrag = false;

/** Thumb travel 12%..88% — never fully up or down; TOP = max zoom */
const thumbPos = computed(() => {
  const t = Math.min(1, Math.max(0, (zoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
  return 88 - t * 76;
});

function clamp(v: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
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
    mapRef.map.zoomTo(next, { duration: 0 });
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

function stepZoom(delta: number): void {
  if (!mapRef.map) return;
  const next = clamp(zoom.value + delta);
  zoom.value = next;
  mapRef.map.zoomTo(next, {
    // snappy step; no camera travel for reduced-motion users
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150,
  });
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
    :aria-label="'Zoom'"
    :aria-valuemin="MIN_ZOOM"
    :aria-valuemax="MAX_ZOOM"
    :aria-valuenow="Math.round(zoom * 10) / 10"
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
        aria-label="Zoom in"
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
        aria-label="Zoom out"
        @click="onStepClick($event, -STEP)"
      >
        <q-icon name="wd-minus" size="14px" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ══════════════════════════════════════════════════════════════════════
// WdZoomSlider — Mapy-inspired peek slider, Alpine Instrument styling.
// Visibility is gated by body classes (global rules in
// map-controls/_zoom-slider.scss); the slide/fade lives there too.
// ══════════════════════════════════════════════════════════════════════

.wd-zoom {
  position: fixed;
  right: 0;
  top: 50%;
  z-index: 2010;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  // Touch zone: 44px grab width PLUS the right display-cutout inset. On
  // notched devices in landscape the outermost strip is owned by the OS
  // (edge swipe / cutout) — touches there die before they reach us. The
  // padding lifts the pill out of the dead strip (same convention as the
  // topbar's right offset); with inset 0 (portrait) border-box keeps the
  // resting position pixel-identical.
  width: calc(44px + env(safe-area-inset-right, 0px));
  min-height: 120px; // vertical grab zone (kept compact — drags now catch
  // reliably via the gesture pipeline, not via a bigger target)
  padding-right: env(safe-area-inset-right, 0px);
  background: transparent;
  cursor: grab;
  touch-action: none; // we own the gesture
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  // The tuck/fade (translateX + opacity) lives on the __pill, NOT here:
  // this 44px hit band must stay at its resting position and hit-testable
  // from the first frame of the enter animation — otherwise drags and taps
  // during the 300ms slide-in land on empty map. Only the display flip
  // remains on the band; allow-discrete holds the band rendered until the
  // pill's exit fade has finished (enter from display:none flips at start).
  // Engines without @starting-style/allow-discrete just toggle instantly.
  transform: translateY(-50%);
  transition: display 200ms allow-discrete;

  &--dragging {
    cursor: grabbing;
  }

  *:focus {
    outline: none;
  }
}

// slim translucent visual pill docked to the edge
.wd-zoom__pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 18px;
  padding: 3px 0;
  border: 1px solid var(--wd-ctl-border);
  border-right: none; // flush to the screen edge
  border-radius: 999px 0 0 999px;
  background: color-mix(in srgb, var(--wd-ctl-bg) 68%, transparent);
  color: var(--wd-ctl-ink);

  // Hidden state + exit motion (200ms) — the pill tucks past the edge and
  // fades while the band's allow-discrete display flip keeps it rendered.
  // Travel = the old band's 44px crossing (100% + 26px, plus the inset so
  // it clears the screen edge in landscape too): the visible slide stays
  // the LAST ~18px of a 44px journey, i.e. the same ~120ms glide the band
  // produced before the hit-band/pill split — not a slowed full-300ms 18px
  // creep. Enter motion (300ms focus-mode curve) and its @starting-style
  // live in the global _zoom-slider.scss, keyed off the same body classes
  // as the band's display flip.
  opacity: 0;
  transform: translateX(calc(100% + 26px + env(safe-area-inset-right, 0px)));
  transition:
    opacity 200ms cubic-bezier(0.2, 0, 0, 1),
    transform 200ms cubic-bezier(0.2, 0, 0, 1);
}

// Dark: mint ridge (the elevation kill strips shadows)
body.body--dark .wd-zoom__pill {
  border-color: rgba(169, 240, 210, 0.28);
}

.wd-zoom__step {
  display: grid;
  place-items: center;
  position: relative; // anchors the ::before hit expander
  width: 30px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  flex: none;
  transition: color 0.12s ease;

  // Hit expander: presses must land on a full 44×44px target flush to the
  // (safe-area) edge, even though the visible glyph stays 30px wide inside
  // the 18px pill — without it the on-screen target is only ~24×26px, the
  // single biggest "missed tap" of this control. Pseudo-elements are never
  // event targets; the browser reports the button itself, so the band's
  // closest('[data-zoom-step]') still resolves.
  &::before {
    content: '';
    position: absolute;
    top: -9px;
    bottom: -9px;
    left: -20px; // 24px glyph inset + 20 = reaches the band's left edge
    right: -6px; // cancels the glyph's 6px overhang past the pill's edge
  }

  // No bg/hover/active chrome — fg feedback only, desktop only
  @media (min-width: #{$breakpoint-sm + 1}) {
    &:hover {
      color: var(--wd-ctl-ink);
    }
  }
}

.wd-zoom__track {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 36px;
  margin: 2px 0;
  pointer-events: none; // the pill handles the drag
}

.wd-zoom__thumb {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 10px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: var(--wd-ctl-ink); // neutral ink — gold is reserved for selection
  opacity: 0.78;
  box-shadow: 0 0 0 2px var(--wd-ctl-bg);
}
</style>
