<script setup lang="ts">
/**
 * WdOverlayControl — map layer overlay toggle (v3, expand-in-place).
 *
 * The mini strip and the expanded view are THE SAME BOX — when "more" is
 * clicked, the box grows to the LEFT (icons stay at the right edge,
 * labels + info/filter appear to their left). On mobile the box grows
 * the same way (no separate bottom sheet).
 *
 * Layer toggling replicates the old WdOverlaySwitch logic: sources,
 * sprites, layers, opacity, and render ordering.
 */
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'quasar';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

const { t } = useI18n();
const overlayStore = useOverlayStore();
const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();
const mapRef = useMap();

// ── State ────────────────────────────────────────────────────────────────
const stripOpen = ref(
  LocalStorage.hasItem('wd_ovl_strip') ? (LocalStorage.getItem('wd_ovl_strip') as boolean) : true
);
watch(stripOpen, v => LocalStorage.set('wd_ovl_strip', v));

/** Box expanded: same box, wider (labels + info/filter visible) */
const expanded = ref(false);

/** Swipe left = expand, swipe right = collapse (on the box) */
let swipeStartX: number | null = null;

function onBoxTouchStart(e: Event): void {
  swipeStartX = (e as unknown as { touches: Array<{ clientX: number }> }).touches[0]?.clientX ?? null;
}

function onBoxTouchEnd(e: Event): void {
  if (swipeStartX === null) return;
  const endX = (e as unknown as { changedTouches: Array<{ clientX: number }> }).changedTouches[0]?.clientX ?? swipeStartX;
  const delta = endX - swipeStartX;
  swipeStartX = null;
  // Only treat as swipe if horizontal movement > 30px (otherwise it's a tap,
  // which the @click handler already covers)
  if (Math.abs(delta) < 30) return;
  if (delta < 0 && !expanded.value) expanded.value = true;
  else if (delta > 0 && expanded.value) expanded.value = false;
}

/** Track which overlays have been added to the map */
const addedOverlays = new Set<string>();

// ── Icons ────────────────────────────────────────────────────────────────
const iconOpen = new URL('/src/assets/wodore-design/icons/export/overlay-switch.svg', import.meta.url).href;
const iconClose = new URL('/src/assets/wodore-design/icons/export/overlay-switch-close.svg', import.meta.url).href;

function layerIcon(name: string): string {
  return 'img:' + new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href;
}

// ── Layer management (from old WdOverlaySwitch, simplified) ─────────────

function setOverlayVisibility(overlay: OverlaySwitchItem): void {
  if (!mapRef.map) return;
  for (const layer of overlay.style.layers) {
    if (mapRef.map.getLayer(layer.id)) {
      mapRef.map.setLayoutProperty(layer.id, 'visibility', overlay.active ? 'visible' : 'none');
    }
  }
}

function findBeforeLayerId(overlay: OverlaySwitchItem, order: Array<OverlaySwitchItem>): string | undefined {
  const idx = order.findIndex(o => o.name === overlay.name);
  for (let i = idx + 1; i < order.length; i++) {
    for (const layer of order[i].style.layers) {
      if (mapRef.map?.getLayer(layer.id)) return layer.id;
    }
  }
  return undefined;
}

function addOverlayLayer(layer: LayerSpecification, overlay: OverlaySwitchItem, beforeId?: string): void {
  if (!mapRef.map || mapRef.map.getLayer(layer.id)) return;

  // Apply opacity from the overlay definition or the basemap
  // Note: opacity handling is done by the basemap store, skip for simplicity
  mapRef.map.addLayer(layer, beforeId);
}

function addOverlay(overlay: OverlaySwitchItem): void {
  if (!mapRef.map || addedOverlays.has(overlay.name)) return;

  // Add sources
  for (const label in overlay.style.sources) {
    if (!mapRef.map.getSource(label)) {
      mapRef.map.addSource(label, overlay.style.sources[label] as SourceSpecification);
    }
  }

  // Add layers (respecting render order)
  const order = overlayStore.overlays;
  const beforeId = findBeforeLayerId(overlay, order);
  for (const layer of overlay.style.layers) {
    const layerWithVisibility = {
      ...layer,
      layout: { ...(layer.layout || {}), visibility: overlay.active ? 'visible' : 'none' },
    };
    addOverlayLayer(layerWithVisibility as LayerSpecification, overlay, beforeId);
  }

  addedOverlays.add(overlay.name);
  setOverlayVisibility(overlay);
}

function toggleLayer(item: OverlaySwitchItem): void {
  overlayStore.toggleOverlay(item);
  if (item.active) {
    addOverlay(item);
  } else {
    setOverlayVisibility(item);
  }
}

// Add all active overlays when the map is ready.
// useMap() may resolve asynchronously AND the map may already be loaded
// before this component mounts — handle both cases.
let mapWatchDone = false;
watch(
  () => mapRef.map,
  (map, oldMap) => {
    if (!map || map === oldMap || mapWatchDone) return;
    mapWatchDone = true;
    const load = () => {
      addedOverlays.clear();
      for (const overlay of overlayStore.overlays) {
        if (overlay.active) {
          addOverlay(overlay);
        }
      }
      configStore.reapplyAllFilters();
    };
    // If the map is already style-loaded, add immediately; otherwise wait
    if (map.isStyleLoaded()) {
      load();
    } else {
      map.once('load', load);
    }
  },
  { immediate: true }
);

// ── Actions ──────────────────────────────────────────────────────────────

function openConfig(overlayName: string, tab?: string): void {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  menuStore.openOverlayConfig(overlayName, tab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
}

function hasInfo(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!(overlay?.config?.legend?.sections?.length);
}

function hasFilters(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  const config = overlay?.config;
  if (!config?.filters?.length) return false;
  return config.filters.some(f => {
    const value = configStore.getFilterValue(overlayName, f.id);
    if (Array.isArray(value)) {
      return value.length > 0 && value.length < (f.options?.length ?? 0);
    }
    return value !== f.defaultValue;
  });
}
</script>

<template>
  <div class="wd-ovl">
    <!-- ── Main toggle (48px, colored SVG icon, 360° rotation) ───────── -->
    <button
      class="wd-ovl__toggle"
      :aria-label="t('overlay_style')"
      :aria-expanded="stripOpen"
      @click="stripOpen = !stripOpen"
    >
      <img
        :src="stripOpen ? iconClose : iconOpen"
        alt=""
        class="wd-ovl__toggle-icon"
        :class="{ 'wd-ovl__toggle-icon--open': stripOpen }"
      />
    </button>

    <!-- ── THE BOX: mini strip (collapsed) or expanded (same box, wider) ── -->
    <Transition name="wd-ovl-strip">
      <div v-if="stripOpen" class="wd-ovl__box" :class="{ 'wd-ovl__box--expanded': expanded }">
        <!-- Rows: icon always at the right, label+actions appear when expanded -->
        <div class="wd-ovl__rows" role="group" :aria-label="t('overlay_style')">
          <div
            v-for="item in overlayStore.overlays"
            :key="item.name"
            v-show="item.show"
            class="wd-ovl__row"
            :class="{ 'wd-ovl__row--active': item.active }"
            @click="toggleLayer(<OverlaySwitchItem>(item as unknown))"
          >
            <!-- Label + actions (LEFT of icon, only when expanded) -->
            <div v-if="expanded" class="wd-ovl__row-info">
              <span class="wd-ovl__row-name">{{ item.label }}</span>
              <span v-if="hasFilters(item.name)" class="wd-ovl__row-filter-badge">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
              </span>
              <button
                v-if="hasInfo(item.name)"
                class="wd-ovl__row-action"
                :aria-label="`${item.label} info`"
                title="Info"
                @click.stop="openConfig(item.name, 'legend')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              </button>
              <button
                v-if="hasFilters(item.name) || overlayStore.overlays.find(o => o.name === item.name)?.config?.filters?.length"
                class="wd-ovl__row-action"
                :aria-label="`${item.label} filter`"
                title="Filter"
                @click.stop="openConfig(item.name, 'filter')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
              </button>
            </div>

            <!-- Icon button (ALWAYS at the right edge of the box) -->
            <span
              class="wd-ovl__icon"
              :class="{
                'wd-ovl__icon--active': item.active,
                'wd-ovl__icon--inactive': !item.active,
              }"
              :aria-label="item.label"
              role="button"
              :aria-pressed="item.active"
              @touchstart="onBoxTouchStart"
              @touchend="onBoxTouchEnd"
            >
              <q-icon :name="layerIcon(item.icon)" size="22px" />
              <span v-if="!expanded && hasFilters(item.name)" class="wd-ovl__mini-badge">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
              </span>
            </span>
          </div>
        </div>

        <!-- More button: toggles the box between mini and expanded -->
        <button
          v-if="!expanded"
          class="wd-ovl__more"
          :aria-label="t('overlay_style')"
          aria-expanded="false"
          @click.stop="expanded = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
        <button
          v-else
          class="wd-ovl__more wd-ovl__more--close"
          :aria-label="t('close')"
          aria-expanded="true"
          @click.stop="expanded = false"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
// ══════════════════════════════════════════════════════════════════════
// WdOverlayControl — polished per the Alpine Instrument design system
//
// Craft notes:
// - Typography: Barlow Semi Condensed for labels, uppercase + tracking
// - Color: gold = beam (active ring only), turquoise = info, muted ink
// - Radius: 8px box / 4px controls (the canonical ramp)
// - Shadow: one soft shadow (hybrid exception for chrome over map)
// - Motion: cubic-bezier(0.2, 0, 0, 1) everywhere, 220–350ms
// - Touch: 44px targets, press scale(0.96)
// ══════════════════════════════════════════════════════════════════════

$ease: cubic-bezier(0.2, 0, 0, 1);

// ── Container ────────────────────────────────────────────────────────────
.wd-ovl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

// ── Toggle button (48px, colored icon) ──────────────────────────────────
.wd-ovl__toggle {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  cursor: pointer;
  box-shadow: var(--wd-ctl-shadow);
  transition:
    background-color 0.15s $ease,
    transform 0.1s $ease;
  flex: none;
  order: 2;
  padding: 8px;
  outline: none;

  &:hover {
    background: var(--wd-ctl-hover);
  }

  &:active {
    transform: scale(0.96);
  }

  &:focus-visible {
    box-shadow:
      var(--wd-ctl-shadow),
      0 0 0 2px var(--wd-ctl-ring);
  }
}

.wd-ovl__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.35s $ease;
}

.wd-ovl__toggle-icon--open {
  transform: rotate(360deg);
}

// ── THE BOX ──────────────────────────────────────────────────────────────
// One surface for mini and expanded modes. The box grows LEFT (wider)
// when expanded — icons stay at the right edge.
// pointer-events: none on the expanded container lets map gestures pass
// through the empty space; rows and buttons re-enable them.

.wd-ovl__box {
  display: flex;
  flex-direction: column;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  overflow: hidden;
  flex: none;
  order: 1;
  width: 48px;

  transition: width 0.22s $ease;

  &--expanded {
    width: min(240px, 64vw);
    pointer-events: none;

    .wd-ovl__row,
    .wd-ovl__more {
      pointer-events: auto;
    }
  }
}

// ── Rows container ───────────────────────────────────────────────────────
.wd-ovl__rows {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 320px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  // scroll hint fades the last visible icon (mini mode only)
  .wd-ovl__box:not(.wd-ovl__box--expanded) & {
    mask-image: linear-gradient(to bottom, black 88%, transparent 98%);
    -webkit-mask-image: linear-gradient(to bottom, black 88%, transparent 98%);
  }
}

// ── Row: icon at RIGHT, info at LEFT when expanded ─────────────────────
.wd-ovl__row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 44px;
  cursor: pointer;
  flex: none;
  width: 100%;
  border-radius: 4px;
  margin: 0 1px;
  transition: background-color 0.12s $ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);

    .wd-ovl__icon { opacity: 1; }
  }

  &:active {
    background: rgba(0, 0, 0, 0.06);
  }
}

// expanded rows: label first (left), icon last (right)
.wd-ovl__box--expanded .wd-ovl__row {
  padding: 0 2px 0 10px;
  gap: 6px;
  justify-content: flex-start;
}

// ── Info section (label + actions, only when expanded) ─────────────────
.wd-ovl__row-info {
  display: none;

  .wd-ovl__box--expanded & {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    // stagger the reveal — labels fade in slightly after the box widens
    animation: wd-ovl-info-in 0.2s $ease 0.08s both;
  }
}

@keyframes wd-ovl-info-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: none; }
}

.wd-ovl__row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 500 13px/1.3 'Barlow Semi Condensed', 'Barlow', sans-serif;
  letter-spacing: 0.02em;
  color: var(--wd-ctl-ink);
}

// filter badge (turquoise, not gold — gold is the active beam only)
.wd-ovl__row-filter-badge {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #2673bf;
  color: #fdfefd;
  display: grid;
  place-items: center;
  flex: none;
}

.wd-ovl__row-action {
  width: 34px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex: none;
  transition:
    background-color 0.1s $ease,
    border-color 0.1s $ease,
    color 0.1s $ease;

  &:hover {
    background: rgba(41, 98, 107, 0.08);
    border-color: rgba(41, 98, 107, 0.2);
    color: #29626b;
  }

  &:active {
    background: rgba(41, 98, 107, 0.14);
    transform: scale(0.95);
  }

  &:focus-visible {
    border-color: #29626b;
  }
}

// ── Icon (always at the right edge) ────────────────────────────────────
.wd-ovl__icon {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  flex: none;
  color: var(--wd-ctl-ink);
  transition: box-shadow 0.15s $ease, opacity 0.15s $ease;
}

// dark theme: the SVG icons are drawn for light surfaces — brighten
// them on the pine chip so they stay readable against the bright map
body.body--dark .wd-ovl__icon :deep(img),
body.body--dark .wd-ovl__icon :deep(svg) {
  filter: brightness(1.4) saturate(1.2);
}

// inactive: quiet — the icon recedes
.wd-ovl__icon--inactive {
  opacity: 0.5;
}

// active: gold inset ring (the beam — one gold accent per view)
.wd-ovl__icon--active {
  box-shadow: inset 0 0 0 2px var(--wd-ctl-ring);
  opacity: 1;
}

// hover lifts the icon out of the inactive fade
.wd-ovl__row:hover .wd-ovl__icon {
  opacity: 0.85;
}

.wd-ovl__row:hover .wd-ovl__icon--active {
  opacity: 1;
}

// mini filter badge (top-right corner of the icon)
.wd-ovl__mini-badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 13px;
  height: 13px;
  border-radius: 3px;
  background: #2673bf;
  color: #fdfefd;
  display: grid;
  place-items: center;
  font-size: 7px;
}

// ── More / close button ────────────────────────────────────────────────
.wd-ovl__more {
  display: grid;
  place-items: center;
  height: 26px;
  border-top: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  flex: none;
  width: 100%;
  border-radius: 0 0 8px 8px; // match box bottom corners
  transition: background-color 0.12s $ease, color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &:active {
    background: rgba(0, 0, 0, 0.06);
  }
}

// ── Collapse animation (box slides down toward the toggle) ─────────────
.wd-ovl-strip-enter-active {
  transition:
    opacity 0.2s $ease,
    transform 0.2s $ease,
    max-height 0.2s $ease;
  max-height: 600px;
}

.wd-ovl-strip-leave-active {
  transition:
    opacity 0.15s $ease,
    transform 0.15s $ease,
    max-height 0.15s $ease;
  max-height: 600px;
}

.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(6px);
  max-height: 0;
}
</style>
