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
 * - The whole pill is the grab target (44px zone), the visible part
 *   stays compact
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useMap } from '@indoorequal/vue-maplibre-gl';

const mapRef = useMap();

const MIN_ZOOM = 7;
const MAX_ZOOM = 20;
/** px of drag per full zoom level — lower = more aggressive */
const PX_PER_LEVEL = 32;

const zoom = ref(10);
const dragging = ref(false);
let dragStartY = 0;
let dragStartZoom = 0;

/** Thumb travel 12%..88% — never fully up or down; TOP = max zoom */
const thumbPos = computed(() => {
  const t = Math.min(1, Math.max(0, (zoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
  return 88 - t * 76;
});

function clamp(v: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
}

function onPointerDown(e: MouseEvent): void {
  dragging.value = true;
  dragStartY = e.clientY;
  dragStartZoom = zoom.value;
  (e.currentTarget as HTMLElement).setPointerCapture(
    (e as unknown as { pointerId: number }).pointerId
  );
}

function onPointerMove(e: MouseEvent): void {
  if (!dragging.value || !mapRef.map) return;
  const dy = dragStartY - e.clientY; // up = zoom in
  const next = clamp(dragStartZoom + dy / PX_PER_LEVEL);
  if (next !== zoom.value) {
    zoom.value = next;
    mapRef.map.zoomTo(next, { duration: 0 });
  }
}

function onPointerUp(): void {
  dragging.value = false;
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
    @pointercancel="onPointerUp"
  >
    <div class="wd-zoom__pill">
      <button
        class="wd-zoom__step"
        aria-label="Zoom in"
        @click.stop="stepZoom(0.75)"
        @pointerdown.stop
      >
        <q-icon name="wd-plus" size="14px" />
      </button>

      <div class="wd-zoom__track">
        <div class="wd-zoom__thumb" :style="{ top: thumbPos + '%' }" />
      </div>

      <button
        class="wd-zoom__step"
        aria-label="Zoom out"
        @click.stop="stepZoom(-0.75)"
        @pointerdown.stop
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
  width: 44px; // touch zone; the visual pill is slimmer
  min-height: 120px; // vertical grab zone (kept compact)
  padding: 0;
  background: transparent;
  cursor: grab;
  touch-action: none; // we own the gesture
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  // Hidden state doubles as the slide-out target: tucked fully past the
  // right screen edge, faded. The global shown rules settle it back —
  // docked chrome moves along its dock axis (drawer semantics), never
  // floating over the map. Enter (300ms) shares the focus-mode curve of
  // _layout.scss so it reads as one choreography; exit (200ms) is faster.
  // The long travel keeps the edge-crossing visible while the pill fades.
  // allow-discrete keeps display:flex until the fade has finished;
  // engines without @starting-style/allow-discrete just toggle instantly.
  opacity: 0;
  transform: translateY(-50%) translateX(100%);
  transition:
    opacity 200ms cubic-bezier(0.2, 0, 0, 1),
    transform 200ms cubic-bezier(0.2, 0, 0, 1),
    display 200ms allow-discrete;

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
}

// Dark: mint ridge (the elevation kill strips shadows)
body.body--dark .wd-zoom__pill {
  border-color: rgba(169, 240, 210, 0.28);
}

.wd-zoom__step {
  display: grid;
  place-items: center;
  width: 30px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  flex: none;
  transition: color 0.12s ease;

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
