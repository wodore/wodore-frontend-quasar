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
import { onMounted, ref, watch } from 'vue';
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

// Add all active overlays when the map loads
onMounted(() => {
  mapRef.map?.on('load', () => {
    addedOverlays.clear();
    for (const overlay of overlayStore.overlays) {
      if (overlay.active) {
        addOverlay(overlay);
      }
    }
    configStore.reapplyAllFilters();
  });
});

// ── Actions ──────────────────────────────────────────────────────────────

function openConfig(overlayName: string, tab?: string): void {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  menuStore.openOverlayConfig(overlayName, tab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
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
                class="wd-ovl__row-action"
                :aria-label="`${item.label} info`"
                title="Info"
                @click.stop="openConfig(item.name, 'legend')"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              </button>
              <button
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
.wd-ovl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

// ── Toggle button (48px, bottom of the stack) ───────────────────────────
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
  transition: background-color 0.15s ease;
  flex: none;
  padding: 6px;
  order: 2; // below the box

  &:hover { background: var(--wd-ctl-hover); }
}

.wd-ovl__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl__toggle-icon--open {
  transform: rotate(360deg);
}

// ── THE BOX (mini = 48px wide, expanded = ~280px, SAME box) ────────────
// When expanded, the box covers map area. The container itself is
// transparent to touches (pointer-events: none) so map gestures pass
// through — only the interactive rows and buttons capture events.
.wd-ovl__box--expanded {
  pointer-events: none;

  // re-enable on interactive children
  .wd-ovl__row,
  .wd-ovl__more {
    pointer-events: auto;
  }
}

.wd-ovl__box {
  display: flex;
  flex-direction: column;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  overflow: hidden;
  flex: none;
  order: 1; // above the toggle

  // collapsed: narrow strip (icons only)
  width: 48px;

  // expanded: same box, wider — icons stay at the RIGHT
  &--expanded {
    width: min(280px, 70vw);
  }

  // animate width change
  transition: width 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl__rows {
  display: flex;
  flex-direction: column;
  max-height: calc(100dvh - 320px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

// collapsed: fade hint at bottom
.wd-ovl__rows {
  .wd-ovl__box:not(.wd-ovl__box--expanded) & {
    mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
  }
}

// ── Row: icon at RIGHT, info fills LEFT when expanded ──────────────────
.wd-ovl__row {
  display: flex;
  align-items: center;
  justify-content: flex-end; // icon pushed right
  min-height: 44px;
  cursor: pointer;
  flex: none;
  width: 100%;

  &:hover {
    background: rgba(128, 128, 128, 0.06);
  }
}

// expanded rows: info takes remaining space
.wd-ovl__box--expanded .wd-ovl__row {
  padding: 0 4px;
  gap: 8px;
  justify-content: flex-start; // info on left, icon on right (natural DOM order)
}

// ── Info section (only when expanded) ────────────────────────────────────
.wd-ovl__row-info {
  display: none; // hidden in mini mode

  .wd-ovl__box--expanded & {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
}

.wd-ovl__row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: var(--wd-ctl-ink);
}

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
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;
  flex: none;

  &:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--wd-ctl-ink);
  }
}

// ── Icon button (always at the right edge) ──────────────────────────────
.wd-ovl__icon {
  position: relative;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  flex: none;
  color: var(--wd-ctl-ink);
  transition: box-shadow 0.12s ease, opacity 0.12s ease;
}

.wd-ovl__icon--inactive {
  opacity: 0.65;
}

.wd-ovl__icon--active {
  box-shadow: inset 0 0 0 3px var(--wd-ctl-ring);
  opacity: 1;
}

.wd-ovl__row:hover .wd-ovl__icon {
  opacity: 1;
}

.wd-ovl__mini-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: #2673bf;
  color: #fdfefd;
  display: grid;
  place-items: center;
}

// ── More/close button at bottom of box ──────────────────────────────────
.wd-ovl__more {
  display: grid;
  place-items: center;
  height: 24px;
  border-top: 1px solid var(--wd-ctl-border);
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  flex: none;
  width: 100%;

  &:hover {
    background: rgba(128, 128, 128, 0.08);
    color: var(--wd-ctl-ink);
  }
}

// ── Box collapse animation ───────────────────────────────────────────────
.wd-ovl-strip-enter-active,
.wd-ovl-strip-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.2, 0, 0, 1),
    transform 0.18s cubic-bezier(0.2, 0, 0, 1),
    max-height 0.18s cubic-bezier(0.2, 0, 0, 1);
  max-height: 600px;
}

.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(8px);
  max-height: 0;
}
</style>
