<script setup lang="ts">
/**
 * WdOverlayControl — map layer overlay toggle (v4, expand-in-place).
 *
 * The mini strip and the expanded view are THE SAME BOX — when "more" is
 * clicked, the box grows to the LEFT (icons stay at the right edge,
 * labels + info/filter appear to their left).
 *
 * Layer management replicates the old WdOverlaySwitch logic EXACTLY:
 * sources, sprites, layers with zoom-interpolated opacity, render
 * ordering, and re-adding all active overlays on every style load
 * (basemap switches create a new style → layers must be re-added).
 */
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'quasar';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { AllPaintProperties } from '@maplibre/maplibre-gl-style-spec';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { OpacitySpecification, OverlaySwitchItem } from '@stores/map/utils/interfaces';
import type { LayerSpecification, PropertyValueSpecification, Map } from 'maplibre-gl';

const { t } = useI18n();
const overlayStore = useOverlayStore();
const basemapStore = useBasemapStore();
const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();
const mapRef = useMap();

// ── UI state ──────────────────────────────────────────────────────────────
const stripOpen = ref(
  LocalStorage.hasItem('wd_ovl_strip') ? (LocalStorage.getItem('wd_ovl_strip') as boolean) : true
);
watch(stripOpen, v => LocalStorage.set('wd_ovl_strip', v));

/** Box expanded: same box, wider (labels + info/filter visible) */
const expanded = ref(false);

/** Scroll fades: hide when the respective edge is reached */
const scrollAtTop = ref(true);
const scrollAtBottom = ref(false);

function onRowsScroll(e: Event): void {
  const el = e.target as HTMLElement;
  scrollAtTop.value = el.scrollTop <= 2;
  scrollAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
  // custom overlay thumb (native scrollbar removed — it squeezed the
  // 48px mini box and cut the chips on desktop)
  const ratio = el.clientHeight / el.scrollHeight;
  thumbH.value = Math.max(24, Math.round(ratio * el.clientHeight));
  const maxTop = el.clientHeight - thumbH.value;
  thumbTop.value = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * maxTop);
}

const thumbTop = ref(0);
const thumbH = ref(0);

/** Thumb position relative to the BOX (rows may sit below the toolbar) */
const thumbAbsTop = computed(() => {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  const offset = rows ? rows.offsetTop : 0;
  return offset + thumbTop.value;
});

/** Initial thumb measurement (before any scroll) */
function measureThumb(): void {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  if (!rows || rows.scrollHeight <= rows.clientHeight) {
    thumbH.value = 0;
    return;
  }
  const ratio = rows.clientHeight / rows.scrollHeight;
  thumbH.value = Math.max(24, Math.round(ratio * rows.clientHeight));
  const maxTop = rows.clientHeight - thumbH.value;
  thumbTop.value = Math.round((rows.scrollTop / (rows.scrollHeight - rows.clientHeight)) * maxTop);
  scrollAtTop.value = rows.scrollTop <= 2;
  scrollAtBottom.value = rows.scrollTop + rows.clientHeight >= rows.scrollHeight - 2;
}

onMounted(() => {
  // measure once the list rendered; re-measure when it resizes
  setTimeout(measureThumb, 400);
  rowsResizeObserve();
});

function rowsResizeObserve(): void {
  const rows = document.querySelector('.wd-ovl__rows') as HTMLElement | null;
  if (!rows) return;
  const RO = (window as unknown as { ResizeObserver?: new (cb: () => void) => { observe: (el: HTMLElement) => void } }).ResizeObserver;
  if (!RO) return;
  new RO(() => measureThumb()).observe(rows);
}

// ── 2. Pan-to-scroll (mouse): drag scrolls, small moves still click ──
const panned = ref(false);
let panStartY = 0;
let panStartScroll = 0;
let panActive = false;

function onRowsPointerDown(e: MouseEvent): void {
  // mouse only — touch uses native scroll (touch-action: pan-y)
  if ((e as unknown as { pointerType?: string }).pointerType === 'touch') return;
  panActive = true;
  panned.value = false;
  panStartY = e.clientY;
  panStartScroll = (e.currentTarget as HTMLElement).scrollTop;
}

function onRowsPointerMove(e: MouseEvent): void {
  if (!panActive) return;
  const dy = e.clientY - panStartY;
  if (!panned.value && Math.abs(dy) > 4) panned.value = true; // it's a pan
  if (panned.value) {
    (e.currentTarget as HTMLElement).scrollTop = panStartScroll - dy;
  }
}

function onRowsPointerUp(): void {
  panActive = false;
  // keep panned=true through the click that follows the pointerup,
  // then reset so stray clicks (without a preceding pan) pass
  window.setTimeout(() => {
    panned.value = false;
  }, 50);
}

/** Rows click guard: a pan must not toggle the layer */
function onRowClick(item: OverlaySwitchItem): void {
  if (panned.value) return;
  toggleLayer(item);
}

/** Swipe left = expand, swipe right = collapse (on rows and toggle) */
let swipeStartX: number | null = null;
function onSwipeStart(e: Event): void {
  swipeStartX = (e as unknown as { touches: Array<{ clientX: number }> }).touches[0]?.clientX ?? null;
}
function onSwipeEnd(e: Event): void {
  if (swipeStartX === null) return;
  const endX = (e as unknown as { changedTouches: Array<{ clientX: number }> }).changedTouches[0]?.clientX ?? swipeStartX;
  const delta = endX - swipeStartX;
  swipeStartX = null;
  if (Math.abs(delta) < 30) return;
  if (delta < 0) expanded.value = true;
  else if (delta > 0) expanded.value = false;
}

/** Click outside the control collapses the expanded box */
function onDocClick(ev: Event): void {
  const target = ev.target as HTMLElement;
  if (!target.closest('.wd-ovl')) {
    expanded.value = false;
  }
}

watch(expanded, v => {
  if (v) document.addEventListener('click', onDocClick, { capture: true });
  else document.removeEventListener('click', onDocClick, { capture: true });
});

onBeforeUnmount(() => document.removeEventListener('click', onDocClick, { capture: true }));

// ── Icons ─────────────────────────────────────────────────────────────────
const iconOpen = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch.svg',
  import.meta.url
).href;
const iconClose = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch-close.svg',
  import.meta.url
).href;

function layerIcon(name: string): string {
  return (
    'img:' + new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href
  );
}

// ── Layer management (ported 1:1 from the old WdOverlaySwitch) ────────────

function setOverlayVisibility(overlay: OverlaySwitchItem): boolean {
  if (mapRef.map === undefined) return false;
  for (const layer of overlay.style.layers) {
    if (mapRef.map.getLayer(layer.id)) {
      mapRef.map.setLayoutProperty(layer.id, 'visibility', overlay.active ? 'visible' : 'none');
    }
  }
  return true;
}

interface AddOverlayLayerArgs {
  layer: LayerSpecification;
  onLayer?: OverlaySwitchItem['onLayer'];
  defaultOpacity?: OpacitySpecification;
  beforeId?: string | undefined;
}

function addOverlayLayer({ layer, onLayer, defaultOpacity, beforeId }: AddOverlayLayerArgs): void {
  const basemap = basemapStore.getBasemap();
  const basemapOpacity =
    basemap && onLayer !== undefined ? basemap.layers[onLayer]?.opacity : undefined;
  let autoOpacity = false;
  if (defaultOpacity === undefined || defaultOpacity === true) {
    autoOpacity = true;
    defaultOpacity = ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 0.6, 22, 0.5];
  }
  if (mapRef.map?.getLayer(layer.id) === undefined) {
    let opacity: PropertyValueSpecification<number> | undefined =
      defaultOpacity !== false ? defaultOpacity : undefined;
    let _beforeId = beforeId;
    if (_beforeId === undefined && onLayer) {
      _beforeId = basemap?.layers[onLayer]?.before;
    }
    if (basemapOpacity !== undefined) {
      opacity = basemapOpacity;
    }
    const _source = 'source' in layer ? layer.source : undefined;
    if ((_source && mapRef.map?.getSource(_source)) || _source === undefined) {
      mapRef.map?.addLayer(layer, _beforeId);
      const opacityPropertiesByType: Record<string, string[]> = {
        background: ['background-opacity'],
        fill: ['fill-opacity'],
        'fill-extrusion': ['fill-extrusion-opacity'],
        line: ['line-opacity'],
        circle: ['circle-opacity'],
        raster: ['raster-opacity'],
        heatmap: ['heatmap-opacity'],
        hillshade: ['hillshade-opacity'],
        symbol: ['icon-opacity', 'text-opacity'],
      };
      const opacityProperties = opacityPropertiesByType[layer.type] ?? [];
      if (layer.paint !== undefined && opacityProperties.some(p => p in layer.paint!)) {
        defaultOpacity = false;
      }
      if (defaultOpacity === false) {
        opacity = undefined;
      } else if (autoOpacity === false) {
        opacity = defaultOpacity;
      }
      if (opacity !== undefined && opacityProperties.length > 0) {
        for (const property of opacityProperties) {
          mapRef.map?.setPaintProperty(layer.id, property as keyof AllPaintProperties, opacity);
        }
      }
    } else {
      console.error(
        `[addOverlayLayer] Source '${_source}' not added, tried to add layer '${layer.id}'.`
      );
    }
  }
}

const addedOverlays = new Set<string>();

function getOverlaysInRenderOrder(): Array<OverlaySwitchItem> {
  // Break type inference chain to avoid "excessively deep" TypeScript error
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allOverlays = (overlayStore as any).overlays as Array<OverlaySwitchItem>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const backOverlays = allOverlays.slice().filter(v => v.onLayer === 'background');
  const frontOverlays = allOverlays.slice().filter(v => v.onLayer === 'ways');
  return frontOverlays.concat(backOverlays).reverse();
}

function findBeforeLayerId(
  overlay: OverlaySwitchItem,
  overlaysOrder: Array<OverlaySwitchItem>
): string | undefined {
  const overlayIndex = overlaysOrder.findIndex(item => item.name === overlay.name);
  if (overlayIndex === -1) return undefined;
  for (let i = overlayIndex + 1; i < overlaysOrder.length; i += 1) {
    const candidate = overlaysOrder[i];
    if (candidate.onLayer !== overlay.onLayer) continue;
    for (const layer of candidate.style.layers) {
      if (mapRef.map?.getLayer(layer.id)) return layer.id;
    }
  }
  return undefined;
}

function addOverlay(overlay: OverlaySwitchItem, overlaysOrder: Array<OverlaySwitchItem>): void {
  if (addedOverlays.has(overlay.name)) return;
  for (const label in overlay.style.sources) {
    if (mapRef.map?.getSource(label) === undefined) {
      mapRef.map?.addSource(label, overlay.style.sources[label]);
    }
  }
  // Add sprites if defined (loads e.g. wd:detailed/* hut symbols)
  const spriteData = overlay.style.sprite;
  if (spriteData) {
    const existingSprites = mapRef.map?.getSprite() || [];
    if (Array.isArray(spriteData)) {
      for (const sprite of spriteData) {
        const alreadyAdded = existingSprites.some(e => e.id === sprite.id);
        if (!alreadyAdded) mapRef.map?.addSprite(sprite.id, sprite.url);
      }
    } else if (typeof spriteData === 'object') {
      for (const [spriteId, spriteUrl] of Object.entries(spriteData)) {
        const alreadyAdded = existingSprites.some(e => e.id === spriteId);
        if (!alreadyAdded) mapRef.map?.addSprite(spriteId, spriteUrl as string);
      }
    }
  }
  const beforeId = findBeforeLayerId(overlay, overlaysOrder);
  for (const layer of overlay.style.layers) {
    const layerWithVisibility = {
      ...layer,
      layout: { ...(layer.layout || {}), visibility: overlay.active ? 'visible' : 'none' },
    };
    addOverlayLayer({
      layer: layerWithVisibility as LayerSpecification,
      defaultOpacity: overlay.opacity as OpacitySpecification,
      onLayer: overlay.onLayer,
      beforeId,
    });
  }
  setOverlayVisibility(overlay);
  addedOverlays.add(overlay.name);
}

function addOverlays(): void {
  addedOverlays.clear();
  const overlaysOrder = getOverlaysInRenderOrder();
  for (const overlay of overlaysOrder) {
    if (overlay.active) addOverlay(overlay, overlaysOrder);
  }
  configStore.reapplyAllFilters();
}

function toggleLayer(item: OverlaySwitchItem): void {
  overlayStore.toggleOverlay(item);
  if (item.active) {
    addOverlay(item, getOverlaysInRenderOrder());
  }
  setOverlayVisibility(item);
}

// Map lifecycle: re-add overlays on EVERY style load (basemap switches
// create a new style → sources/layers are wiped). The old switch used
// map.on('load') the same way.
let mapLoadBound = false;
function bindMap(map: Map): void {
  if (mapLoadBound) return;
  mapLoadBound = true;
  if (map.isStyleLoaded()) addOverlays();
  map.on('load', addOverlays);
}

watch(
  () => mapRef.map,
  map => {
    if (map) bindMap(map);
  },
  { immediate: true }
);

// ── Actions ───────────────────────────────────────────────────────────────

function openConfig(overlayName: string, tab?: string): void {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  menuStore.openOverlayConfig(overlayName, tab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
}

function hasInfo(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!(overlay?.config?.legend?.sections?.length);
}

function hasFilterConfig(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  return !!(overlay?.config?.filters?.length);
}

function hasActiveFilters(overlayName: string): boolean {
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

onMounted(() => {
  // Desktop: ensure wheel scrolling works over the rows container
  // (the map canvas would otherwise capture the wheel event)
  document.querySelectorAll('.wd-ovl__rows').forEach(() => {
    /* handled via CSS touch-action + overflow; nothing needed here */
  });
});

onBeforeUnmount(() => {
  swipeStartX = null;
});
</script>

<template>
  <div class="wd-ovl">
    <!-- ── THE BOX: mini strip (collapsed) or expanded (same box, wider) ── -->
    <Transition name="wd-ovl-strip">
      <div v-if="stripOpen" class="wd-ovl__box" :class="{ 'wd-ovl__box--expanded': expanded }">
        <!-- Top toolbar: EXTENDED only. The box grows UP by this height
             (max-height compensates) so the icon rows NEVER move. -->
        <div v-if="expanded" class="wd-ovl__toolbar">
          <span class="wd-ovl__toolbar-title">{{ t('overlay_style') }}</span>
          <div class="wd-ovl__toolbar-actions">
            <!-- Future: group edit and other layer actions -->
            <button class="wd-ovl__toolbar-btn" disabled aria-label="Reserved">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Scroll fade: top -->
        <div class="wd-ovl__fade wd-ovl__fade--top" :class="{ 'wd-ovl__fade--hidden': scrollAtTop }" />

        <!-- Scroll fade: bottom (subtle hint directly above the more button) -->
        <div class="wd-ovl__fade wd-ovl__fade--bottom" :class="{ 'wd-ovl__fade--hidden': scrollAtBottom }" />

        <!-- Rows: icon always at the right, label+actions appear when expanded -->
        <div
          class="wd-ovl__rows"
          role="group"
          :aria-label="t('overlay_style')"
          @scroll.passive="onRowsScroll"
          @pointerdown="onRowsPointerDown"
          @pointermove="onRowsPointerMove"
          @pointerup="onRowsPointerUp"
          @pointerleave="onRowsPointerUp"
        >
          <div v-for="item in overlayStore.overlays" :key="item.name" v-show="item.show" class="wd-ovl__row" :class="{
            'wd-ovl__row--active': item.active,
            'wd-ovl__row--passive': !item.active,
          }" @click="onRowClick(<OverlaySwitchItem>(item as unknown))">
            <!-- Label + actions (LEFT of icon, only when expanded) -->
            <div v-if="expanded" class="wd-ovl__row-info">
              <button v-if="hasInfo(item.name)" class="wd-ovl__row-action wd-ovl__row-action--info"
                :aria-label="`${item.label} info`" title="Info" @click.stop="openConfig(item.name, 'legend')">
                <q-icon name="wd-info" size="xs" />
              </button>
              <span class="wd-ovl__row-name">{{ item.label }}</span>
              <button v-if="hasFilterConfig(item.name)" class="wd-ovl__row-action"
                :class="{ 'wd-ovl__row-action--filtered': hasActiveFilters(item.name) }"
                :aria-label="`${item.label} filter`" title="Filter" @click.stop="openConfig(item.name, 'filter')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                </svg>
              </button>
            </div>

            <!-- Icon button (ALWAYS at the right edge of the box) -->
            <span class="wd-ovl__icon" :class="{
              'wd-ovl__icon--active': item.active,
              'wd-ovl__icon--inactive': !item.active,
            }" :aria-label="item.label" role="button" :aria-pressed="item.active" @touchstart.passive="onSwipeStart"
              @touchend.passive="onSwipeEnd">
              <q-icon :name="layerIcon(item.icon)" size="20px" />
              <span v-if="hasActiveFilters(item.name)" class="wd-ovl__chip-filter"
                :aria-label="`${item.label}: filter active`">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
                </svg>
              </span>
            </span>
          </div>
        </div>

        <!-- Scroll thumb at BOX level (the rows scroll-clip ate it inside);
             rides exactly on the box's right border. Always visible while
             the list overflows — 2px on desktop (media query below). -->
        <div
          v-if="thumbH > 0"
          class="wd-ovl__scrollthumb"
          :class="{ 'wd-ovl__scrollthumb--end': scrollAtBottom }"
          :style="{ top: thumbAbsTop + 'px', height: thumbH + 'px' }"
        />

        <!-- More button: toggles the box between mini and expanded -->
        <button class="wd-ovl__more" :aria-label="expanded ? t('close') : t('overlay_style')" :aria-expanded="expanded"
          @click.stop="expanded = !expanded">
          <svg v-if="!expanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2.2" stroke-linecap="round">
            <path d="M14 6l-6 6 6 6" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round">
            <path d="M10 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ── Main toggle (48px, colored SVG icon, 360° rotation) ───────── -->
    <button class="wd-ovl__toggle" :aria-label="t('overlay_style')" :aria-expanded="stripOpen"
      @click="stripOpen = !stripOpen">
      <img v-show="!stripOpen" :src="iconOpen" alt="" class="wd-ovl__toggle-icon wd-ovl__toggle-icon--closed-icon"
        :class="{ 'wd-ovl__toggle-icon--hidden': stripOpen }" />
      <img v-show="stripOpen" :src="iconClose" alt="" class="wd-ovl__toggle-icon"
        :class="{ 'wd-ovl__toggle-icon--open': stripOpen }" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
// ══════════════════════════════════════════════════════════════════════
// WdOverlayControl v4 — Alpine Instrument polish
//
// - Gold = beam only (2px inset ring on active icons)
// - Passive icons: bordered chip (like the old round toggles)
// - Radius: 8px box / 4px controls (canonical ramp)
// - Motion: cubic-bezier(0.2, 0, 0, 1), 220–350ms
// ══════════════════════════════════════════════════════════════════════

$ease: cubic-bezier(0.2, 0, 0, 1);

// ── Container ────────────────────────────────────────────────────────────
.wd-ovl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  pointer-events: none; // map gestures pass through empty space
  -webkit-tap-highlight-color: transparent;

  *:focus {
    outline: none;
  }
}

// ── Toggle button (48px, colored icon) ──────────────────────────────────
.wd-ovl__toggle {
  position: relative; // anchor for the stacked absolute morph icons
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
  padding: 8px;
  outline: none;
  pointer-events: auto;

  &:active {
    transform: scale(0.96);
  }

  .wd-ovl__toggle-icon {
    position: absolute;
    inset: 8px;
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    object-fit: contain;
    transition:
      opacity 0.2s $ease,
      transform 0.28s $ease;
    will-change: transform, opacity;
  }

  // Morph: closed icon shrinks out, open icon grows in (no rotation)
  .wd-ovl__toggle-icon--open {
    opacity: 1;
    transform: scale(1);
  }

  .wd-ovl__toggle-icon--hidden {
    opacity: 0;
    transform: scale(0.6);
  }

  .wd-ovl__toggle-icon--closed-icon {
    opacity: 0.55; // passive clearly dimmer; hover restores
    transform: scale(1);
    transition:
      opacity 0.2s $ease 0.06s,
      transform 0.28s $ease 0.06s;
  }

  &:hover .wd-ovl__toggle-icon--closed-icon {
    opacity: 0.9;
  }
}

// ── THE BOX ──────────────────────────────────────────────────────────────
.wd-ovl__box {
  display: flex;
  flex-direction: column;
  width: 48px; // matches the basemap toggle width
  max-height: calc(min(60vh, 394px) + 26px); // rows + more button
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  box-shadow: var(--wd-ctl-shadow);
  overflow: hidden;
  position: relative; // anchor for the absolute scroll fades
  pointer-events: none; // map gestures pass through — rows opt back in
  transition:
    width 0.28s $ease,
    border-color 0.15s $ease;
  contain: layout;

  &--expanded {
    width: 216px; // slightly narrower than before, titles clip
    // Grow UP by the header height: the rows area keeps its exact size,
    // so the icon chips stay pixel-fixed while the header appears above.
    max-height: calc(min(60vh, 394px) + 26px + 28px);
    animation: wd-ovl-pop 0.28s $ease;
  }
}

// ── Top toolbar (space reserved in BOTH states — icons never move) ───────
.wd-ovl__toolbar {
  flex: none;
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-height: 28px;
  border-bottom: 1px solid var(--wd-ctl-border);
}

.wd-ovl__toolbar-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--wd-ctl-ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-ovl__toolbar-actions {
  display: flex;
  gap: 4px;
  flex: none;
  pointer-events: auto;
}

.wd-ovl__toolbar-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  opacity: 0.8; // reserved placeholder
  pointer-events: none; // disabled until functionality lands

  &:hover:not(:disabled) {
    background: var(--wd-ctl-hover);
  }
}

// ── Scroll fades (top + bottom) ───────────────────────────────────────────
// Tight 10px hints anchored to the box; they kiss the clipped row —
// not a dead band. Hidden when the respective end is reached.
.wd-ovl__fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 10px; // tight kiss, not a band
  opacity: 0.9;
  pointer-events: none;
  transition: opacity 0.25s $ease;
  z-index: 2;

  &--top {
    top: 0; // mini: rows start at the box top
    background: linear-gradient(to bottom, var(--wd-ctl-bg), transparent);
  }

  &--bottom {
    bottom: 24px; // directly above the more button
    background: linear-gradient(to top, var(--wd-ctl-bg) 10%, transparent);
  }

  &--hidden {
    opacity: 0;
  }
}

// Expanded: the toolbar occupies the top — fade sits below it
.wd-ovl__box--expanded .wd-ovl__fade--top {
  top: 28px;
}

// ── Rows (scrollable) ────────────────────────────────────────────────────
// FIXED height: identical in mini and expanded — the box grows UP by the
// header height when expanding, so the icon chips never move a pixel.
.wd-ovl__rows {
  flex: none;
  height: calc(min(60vh, 394px));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y;
  display: flex;
  flex-direction: column;
  padding: 2px 3px 4px 3px;
  position: relative;
  // native scrollbar REMOVED — it took layout space and squeezed the
  // 48px mini box (chips cut off on desktop). Custom overlay thumb above.
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

// custom overlay thumb: ON the box's right border (box-level so the
// rows' scroll clip cannot eat it). Mobile 3px; desktop 2px always-on.
.wd-ovl__scrollthumb {
  position: absolute;
  right: 0; // flush on the inner edge of the 1px box border
  width: 3px;
  border-radius: 999px;
  background: rgba(128, 145, 135, 0.55);
  pointer-events: none;
  z-index: 3;
  opacity: 1;
  transition: opacity 0.2s ease;

  &--end {
    opacity: 0.4; // reached the end — still visible, quieter
  }
}

@media (min-width: 900px) {
  .wd-ovl__scrollthumb {
    width: 2px; // hairline always visible on desktop
  }
}

// Mouse pan affordance: grab cursor over the list (desktop)
@media (min-width: 900px) and (pointer: fine) {
  .wd-ovl__rows {
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}

.wd-ovl__row {
  display: flex;
  flex-direction: row; // label-info … icon (DOM order = visual order)
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  border-radius: 4px;
  // The row is part of the PANEL — gestures inside the box scroll/toggle,
  // they do not pan the map (the box wrapper still passes around itself).
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 0.12s $ease;
  flex: none;
  margin: 1px 0;

  &:hover {
    background: var(--wd-ctl-hover);
  }

  &:active {
    background: var(--wd-ctl-active-bg);
  }
}

// ── Row info (expanded only): info icon | label | filter badge | filter ──
.wd-ovl__row-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px 0 8px;
  min-width: 0; // allow label to clip
  flex: 1;
  pointer-events: none; // container only; buttons opt back in
}

.wd-ovl__row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13.5px;
  font-weight: 400;
  letter-spacing: 0.02em;
  color: var(--wd-ctl-ink-soft);
  line-height: 1.2;
  pointer-events: none;
  transition: color 0.15s $ease, font-weight 0.15s $ease;
}

body.body--dark .wd-ovl__row-name {
  color: #cfe8dc; // brighter than ink-soft — passive but readable on pine
}


.wd-ovl__row--active .wd-ovl__row-name {
  font-weight: 600;
  color: var(--wd-ctl-ink);
}

.wd-ovl__row-action {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 0.12s $ease, color 0.12s $ease;

  &:hover {
    background: var(--wd-ctl-hover);
    color: var(--wd-ctl-ink);
  }

  &--info {
    color: #1f7a63; // turquoise touch (info = "learn more")
  }


  body.body--dark &--info {
    color: #7fe3c8;
  }
}

.wd-ovl__row-filter-badge {
  display: grid;
  place-items: center;
  width: 14px;
  height: 18px;
  flex: none;
  border-radius: 50%;
  background: #bfab25; // gold
  color: #fdfefd;
  pointer-events: none;
}

// ── Icon button (ALWAYS at the right edge; bordered chip look) ───────────
.wd-ovl__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 36px;
  margin: 0;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-date-bg);
  flex: none;
  transition:
    box-shadow 0.15s $ease,
    opacity 0.15s $ease;
  pointer-events: none; // the ROW handles the click (single handler)

  &--active {
    box-shadow: inset 0 0 0 1px var(--wd-ctl-ring);
    opacity: 1;
  }

  body.body--dark &--active {
    // !important escapes the global dark-mode elevation kill
    // (body.body--dark * { box-shadow: none !important }). The ring is
    // the ONLY edge (no border reservation) — reads exactly 2px.
    box-shadow: inset 0 0 0 2px #d4c23a !important;
    border-color: transparent;
    border-width: 0;
  }

  &--inactive {
    opacity: 0.55; // clearly dimmer than active — instant read
  }

  :deep(img),
  :deep(.q-icon) {
    display: block;
  }
}

// Dark theme icon inversion lives in app.scss (global invert treatment)

// Filter-active indicator ON the chip (gold dot, top-right)
.wd-ovl__chip-filter {
  position: absolute;
  top: -3px;
  right: -3px;
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #bfab25;
  color: #fdfefd;
  pointer-events: none;
  z-index: 1;
}

// ── More button (chevron, more obvious) ─────────────────────────────────
.wd-ovl__more {
  display: grid;
  place-items: center;
  height: 26px;
  min-height: 26px;
  border: none;
  border-top: 1px solid var(--wd-ctl-border);
  background: transparent; // no tonal band against the rows above
  color: var(--wd-ctl-ink);
  cursor: pointer;
  flex: none;
  width: 100%;
  border-radius: 0 0 8px 8px;
  transition: background-color 0.12s $ease, color 0.12s $ease;
  pointer-events: auto;

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

// Open/close feedback: one soft overshoot pop (crafted moment)
@keyframes wd-ovl-pop {
  0% {
    transform: scale(0.985);
  }

  55% {
    transform: scale(1.008);
  }

  100% {
    transform: scale(1);
  }
}

// ── Transitions ──────────────────────────────────────────────────────────
.wd-ovl-strip-enter-active,
.wd-ovl-strip-leave-active {
  transition:
    opacity 0.22s $ease,
    transform 0.22s $ease;
}

.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.wd-ovl-fade-enter-active,
.wd-ovl-fade-leave-active {
  transition: opacity 0.2s $ease;
}

.wd-ovl-fade-enter-from,
.wd-ovl-fade-leave-to {
  opacity: 0;
}
</style>
