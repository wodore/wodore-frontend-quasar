<script setup lang="ts">
/**
 * WdZoomSlider — vertical zoom slider docked to the LEFT edge
 * (Mapy.com-inspired, Wodore styling).
 *
 * - Visible ONLY in focus mode on mobile (CSS-driven)
 * - Drag up/down to zoom in/out; chevrons step ±0.5
 * - The thumb never reaches the track ends (12%–88% travel)
 * - The whole pill is the grab target (44px zone), the visible part
 *   stays compact
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useMap } from '@indoorequal/vue-maplibre-gl';

const mapRef = useMap();

const MIN_ZOOM = 7;
const MAX_ZOOM = 20;
/** px of drag per full zoom level */
const PX_PER_LEVEL = 44;

const zoom = ref(10);
const dragging = ref(false);
let dragStartY = 0;
let dragStartZoom = 0;

/** Thumb travel 12%..88% — never fully up or down */
const thumbPos = computed(() => {
  const t = Math.min(1, Math.max(0, (zoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)));
  return 12 + t * 76;
});

function clamp(v: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
}

function onPointerDown(e: MouseEvent): void {
  dragging.value = true;
  dragStartY = e.clientY;
  dragStartZoom = zoom.value;
  (e.currentTarget as HTMLElement).setPointerCapture((e as unknown as { pointerId: number }).pointerId);
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
  mapRef.map.zoomTo(next, { duration: 200 });
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
      @click.stop="stepZoom(0.5)"
      @pointerdown.stop
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <path d="M6 14l6-6 6 6" />
      </svg>
    </button>

    <div class="wd-zoom__track">
      <div class="wd-zoom__thumb" :style="{ top: thumbPos + '%' }" />
    </div>

    <button
      class="wd-zoom__step"
      aria-label="Zoom out"
      @click.stop="stepZoom(-0.5)"
      @pointerdown.stop
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <path d="M6 10l6 6 6-6" />
      </svg>
    </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// ══════════════════════════════════════════════════════════════════════
// WdZoomSlider — Mapy-inspired peek slider, Alpine Instrument styling.
// Hidden unless focus mode on mobile (global rules in app.scss).
// ══════════════════════════════════════════════════════════════════════

.wd-zoom {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2010;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  width: 48px; // touch zone = mini-button width; the visual pill is slimmer
  min-height: 264px; // touch zone ≥ 2x the visual pill height
  padding: 0;
  background: transparent;
  cursor: grab;
  touch-action: none; // we own the gesture
  user-select: none;
  -webkit-tap-highlight-color: transparent;

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
  width: 20px;
  padding: 4px 0;
  border: 1px solid var(--wd-ctl-border);
  border-right: none; // flush to the screen edge
  border-radius: 999px 0 0 999px;
  background: color-mix(in srgb, var(--wd-ctl-bg) 82%, transparent);
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
  transition: background-color 0.12s ease, color 0.12s ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }
}

.wd-zoom__track {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 56px;
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
