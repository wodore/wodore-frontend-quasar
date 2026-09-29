<script setup lang="ts">
/**
 * WdOverlayControl — map layer overlay toggle (clean v2).
 *
 * Layout (bottom-right, above basemap):
 * - Main toggle (48px, colored SVG) — opens/closes the mini strip
 * - Mini strip: layer icon buttons (44px) inside a boxed surface,
 *   scrollable with bottom fade, one-tap toggle per layer
 * - "More" at strip bottom: expands the box to the LEFT (desktop) or
 *   opens a bottom sheet (mobile) with labeled rows + info/filter
 *
 * Icons: each overlay has an SVG in src/assets/wodore-design/overlays/exports/.
 */
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { LocalStorage } from 'quasar';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { LayerSpecification } from 'maplibre-gl';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';

const { t } = useI18n();
const overlayStore = useOverlayStore();
const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();
const mapRef = useMap();

// ── State ────────────────────────────────────────────────────────────────

const stripOpen = ref(
  LocalStorage.hasItem('wd_ovl_strip')
    ? (LocalStorage.getItem('wd_ovl_strip') as boolean)
    : true
);
watch(stripOpen, v => LocalStorage.set('wd_ovl_strip', v));

const expanded = ref(false);

// ── Icons ────────────────────────────────────────────────────────────────

/** Main toggle icon (original colored SVG from design assets) */
const iconOpen = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch.svg',
  import.meta.url
).href;
const iconClose = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch-close.svg',
  import.meta.url
).href;

/** Layer icon: resolves to the SVG file in the overlays exports dir */
function layerIcon(name: string): string {
  return (
    'img:' +
    new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href
  );
}

// ── Actions ──────────────────────────────────────────────────────────────

function toggleLayer(item: OverlaySwitchItem): void {
  overlayStore.toggleOverlay(item);
  // Apply visibility to the map layers
  if (mapRef.map && item.style?.layers) {
    const visibility = item.active ? 'visible' : 'none';
    for (const layer of item.style.layers) {
      if (mapRef.map.getLayer(layer.id)) {
        mapRef.map.setLayoutProperty(layer.id, 'visibility', visibility);
      }
    }
  }
}

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
    <!-- ── Expanded panel ─────────────────────────────────────────────── -->
    <!-- Desktop: absolute, slides LEFT from the strip box (same surface) -->
    <!-- Mobile: teleported bottom sheet -->
    <Transition name="wd-ovl-panel">
        <div
          v-if="expanded"
          class="wd-ovl__panel"
          :class="{ 'wd-ovl__panel--sheet': false }"
          role="dialog"
          :aria-label="t('overlay_style')"
        >
          <div class="wd-ovl__panel-head">
            <h4>{{ t('overlay_style') }}</h4>
            <button class="wd-ovl__close" :aria-label="t('close')" @click="expanded = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          <div class="wd-ovl__panel-body">
            <div
              v-for="item in overlayStore.overlays"
              :key="item.name"
              v-show="item.show"
              class="wd-ovl__row"
              :class="{ 'wd-ovl__row--active': item.active }"
              @click="toggleLayer(<OverlaySwitchItem>(item as unknown))"
            >
              <span class="wd-ovl__row-icon" :class="{ 'wd-ovl__row-icon--active': item.active }">
                <q-icon :name="layerIcon(item.icon)" size="24px" />
              </span>
              <span class="wd-ovl__row-label">{{ item.label }}</span>
              <span v-if="hasFilters(item.name)" class="wd-ovl__row-badge">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
              </span>
              <span class="wd-ovl__row-actions">
                <button
                  class="wd-ovl__row-btn"
                  :aria-label="`${item.label} info`"
                  title="Info"
                  @click.stop="openConfig(item.name, 'legend')"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
                </button>
                <button
                  class="wd-ovl__row-btn"
                  :aria-label="`${item.label} filter`"
                  title="Filter"
                  @click.stop="openConfig(item.name, 'filter')"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
                </button>
              </span>
            </div>
          </div>
        </div>
      </Transition>

    <!-- ── Mini strip (boxed, same width as buttons) ──────────────────── -->
    <Transition name="wd-ovl-strip">
      <div v-if="stripOpen" class="wd-ovl__box">
        <div class="wd-ovl__strip" role="group" :aria-label="t('overlay_style')">
          <button
            v-for="item in overlayStore.overlays"
            :key="item.name"
            v-show="item.show"
            class="wd-ovl__btn"
            :class="{
              'wd-ovl__btn--active': item.active,
              'wd-ovl__btn--inactive': !item.active,
            }"
            :aria-label="item.label"
            :aria-pressed="item.active"
            :title="item.label"
            @click="toggleLayer(<OverlaySwitchItem>(item as unknown))"
          >
            <q-icon :name="layerIcon(item.icon)" size="22px" />
            <span v-if="hasFilters(item.name)" class="wd-ovl__badge">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
            </span>
          </button>
        </div>
        <button
          class="wd-ovl__more"
          :aria-label="t('overlay_style')"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
        </button>
      </div>
    </Transition>

    <!-- ── Main toggle (48px, colored SVG icon, rotates) ──────────────── -->
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
  </div>
</template>

<style lang="scss" scoped>
// ── Container ────────────────────────────────────────────────────────────
.wd-ovl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

// ── Mini strip box ────────────────────────────────────────────────────────
.wd-ovl__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  padding: 2px;
  flex: none;
  // same width as the 48px toggle button
  width: 48px;
}

.wd-ovl__strip {
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: center;
  width: 100%;
  max-height: calc(100dvh - 320px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
}

// strip icon button (44px, fills the 48px box minus padding)
.wd-ovl__btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--wd-ctl-ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background-color 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  flex: none;
}

.wd-ovl__btn--inactive {
  opacity: 0.5;
}

.wd-ovl__btn:hover {
  background: rgba(128, 128, 128, 0.1);
  opacity: 1;
}

.wd-ovl__btn--active {
  box-shadow: inset 0 0 0 2px var(--wd-ctl-ring);
  background: var(--wd-ctl-active-bg);
  opacity: 1;
}

// filter badge
.wd-ovl__badge {
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

// ── More button ──────────────────────────────────────────────────────────
.wd-ovl__more {
  display: grid;
  place-items: center;
  width: 44px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  transition: background-color 0.12s ease;
  flex: none;
  margin-top: 2px;

  &:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--wd-ctl-ink);
  }
}

// ── Main toggle ──────────────────────────────────────────────────────────
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

  &:hover {
    background: var(--wd-ctl-hover);
  }
}

.wd-ovl__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl__toggle-icon--open {
  transform: rotate(360deg);
}

// ── Expanded panel ───────────────────────────────────────────────────────
.wd-ovl__panel {
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// desktop: positioned LEFT of the mini strip (same vertical alignment)
.wd-ovl__panel:not(.wd-ovl__panel--sheet) {
  position: absolute;
  right: calc(100% + 6px);
  bottom: 0;
  width: 300px;
  max-height: 480px;
}

// mobile: fullscreen bottom sheet
.wd-ovl__panel--sheet {
  position: fixed;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 16px;
  max-height: 70vh;
}

.wd-ovl__panel-head {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 14px;
  border-bottom: 1px solid var(--wd-ctl-border);
  flex: none;
}

.wd-ovl__panel-head h4 {
  margin: 0;
  flex: 1;
  font: 500 14px/1.2 'Barlow Semi Condensed', 'Barlow', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wd-ctl-ink);
}

.wd-ovl__close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--wd-ctl-ink);
  }
}

.wd-ovl__panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

// rows: icon + label + actions
.wd-ovl__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 14px;
  border-radius: 4px;
  cursor: pointer;
  min-height: 48px;

  &:hover {
    background: rgba(128, 128, 128, 0.05);
  }
}

.wd-ovl__row-icon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  flex: none;
  color: var(--wd-ctl-ink-soft);

  &--active {
    box-shadow: inset 0 0 0 2px var(--wd-ctl-ring);
    color: var(--wd-ctl-ink);
  }
}

.wd-ovl__row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: var(--wd-ctl-ink);
}

.wd-ovl__row-badge {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #2673bf;
  color: #fdfefd;
  display: grid;
  place-items: center;
  flex: none;
}

.wd-ovl__row-actions {
  display: flex;
  gap: 2px;
  flex: none;
}

.wd-ovl__row-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--wd-ctl-ink);
  }
}

// ── Animations ────────────────────────────────────────────────────────────

// strip collapse
.wd-ovl-strip-enter-active,
.wd-ovl-strip-leave-active {
  transition: opacity 0.18s cubic-bezier(0.2, 0, 0, 1), transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}
.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

// panel slide-left (desktop)
.wd-ovl-panel-enter-active,
.wd-ovl-panel-leave-active {
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}
.wd-ovl-panel-enter-from,
.wd-ovl-panel-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

// sheet slide-up (mobile)
.wd-ovl-sheet-enter-active,
.wd-ovl-sheet-leave-active {
  transition: opacity 0.25s cubic-bezier(0.2, 0, 0, 1), transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}
.wd-ovl-sheet-enter-from,
.wd-ovl-sheet-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
