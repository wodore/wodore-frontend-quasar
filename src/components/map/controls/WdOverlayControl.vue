<script setup lang="ts">
/**
 * WdOverlayControl — the map layer overlay toggle.
 *
 * Architecture (mockup r6, owner-approved):
 * - Main toggle button (48px, colored SVG icon) — opens/closes the mini strip
 * - Mini strip: vertical column of layer icon buttons (44px each) inside a
 *   boxed surface, one-tap toggle per layer, scrollable with bottom fade
 * - "More" button at the strip bottom: expands the box to the LEFT with
 *   labeled rows (icon + name + info + filter per layer)
 * - Mobile: the expanded panel becomes a fullscreen bottom sheet
 *
 * Theme: all colors via --wd-ctl-* custom properties (light/dark aware).
 * No q-fab — pure HTML buttons with CSS transitions.
 */
import { computed, ref, watch } from 'vue';
import { LocalStorage } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import WdOverlaySwitchItem from './WdOverlaySwitchItem.vue';

const { t } = useI18n();
const overlayStore = useOverlayStore();
const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();

/** Mini strip open/closed (persisted) */
const stripOpen = ref(
  LocalStorage.hasItem('wd_overlayStripOpen')
    ? (LocalStorage.getItem('wd_overlayStripOpen') as boolean)
    : true
);

watch(stripOpen, v => {
  LocalStorage.set('wd_overlayStripOpen', v);
});

/** Expanded panel (labels + info/filter) */
const expanded = ref(false);

/** Mobile detection (reactive via matchMedia) */
const isMobile = computed(() => window.matchMedia('(max-width: 899px)').matches);

/** Original colored toggle icon */
const toggleIcon = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch.svg',
  import.meta.url
).href;
const toggleIconClose = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch-close.svg',
  import.meta.url
).href;

// ── Actions ──────────────────────────────────────────────────────────────

function toggleLayer(item: OverlaySwitchItem): void {
  overlayStore.toggleOverlay(item);
  // visibility is handled by the map event system
}

function openConfig(overlayName: string, initialTab?: string): void {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  menuStore.openOverlayConfig(overlayName, initialTab);
  menuStore.menuData.title = overlay?.label ?? overlayName;
}

function hasFilters(overlayName: string): boolean {
  const overlay = overlayStore.overlays.find(o => o.name === overlayName);
  const config = overlay?.config;
  if (!config?.filters?.length) return false;
  return config.filters.some(f => {
    const value = configStore.getFilterValue(overlayName, f.id);
    if (Array.isArray(value)) {
      const all = f.options?.length ?? 0;
      return value.length > 0 && value.length < all;
    }
    return value !== f.defaultValue;
  });
}

/** Resolve the icon for a layer (from the overlay store's icon field) */
function layerIcon(icon: string | undefined): string {
  if (!icon) return 'wd-layers';
  return icon.startsWith('img:') || icon.startsWith('wd-') ? icon : `img:${icon}`;
}
</script>

<template>
  <div class="wd-ovl">
    <!-- ── Expanded panel ─────────────────────────────────────────────── -->
    <!-- Desktop: slides LEFT from the mini strip box (same surface) -->
    <!-- Mobile: fullscreen bottom sheet -->
    <Teleport to="body" :disabled="!isMobile">
      <Transition :name="isMobile ? 'wd-ovl-sheet' : 'wd-ovl-panel'">
        <div
          v-if="expanded"
          class="wd-ovl__panel"
          :class="{ 'wd-ovl__panel--sheet': isMobile }"
          role="dialog"
          :aria-label="t('overlay_style')"
        >
          <div class="wd-ovl__panel-head">
            <h4>{{ t('overlay_style') }}</h4>
            <button class="wd-ovl__panel-close" :aria-label="t('close')" @click="expanded = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div class="wd-ovl__panel-body">
            <div
              v-for="item in overlayStore.overlays"
              :key="item.name"
              v-show="item.show"
              class="wd-ovl__panel-row"
            >
              <WdOverlaySwitchItem
                :label="item.label"
                :show-label="true"
                :icon="layerIcon(item.icon)"
                :active="item.active"
                :overlay-name="item.name"
                :show-badge="hasFilters(item.name)"
                @toggle-overlay="toggleLayer(<OverlaySwitchItem>(item as unknown))"
                @configure="openConfig(item.name, $event)"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Mini strip (boxed, collapsible) ────────────────────────────── -->
    <Transition name="wd-ovl-strip">
      <div v-if="stripOpen" class="wd-ovl__box">
        <div class="wd-ovl__strip" role="group" :aria-label="t('overlay_style')">
          <button
            v-for="item in overlayStore.overlays"
            :key="item.name"
            v-show="item.show"
            class="wd-map-btn wd-map-btn--sm"
            :class="{
              'wd-map-btn--active': item.active,
              'wd-map-btn--inactive': !item.active,
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
        <!-- more button: expands the panel -->
        <button
          class="wd-ovl__more"
          :aria-label="t('overlay_style')"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ── Main toggle (48px, colored icon, 180° rotation) ────────────── -->
    <button
      class="wd-map-btn wd-map-btn--lg wd-ovl__toggle"
      :aria-label="t('overlay_style')"
      :aria-expanded="stripOpen"
      @click="stripOpen = !stripOpen"
    >
      <img
        :src="stripOpen ? toggleIconClose : toggleIcon"
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
  padding: 3px;
  flex: none;
}

.wd-ovl__strip {
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  max-height: calc(100dvh - 240px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  // scroll hint: last icons fade out
  mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
}

// filter badge on strip buttons
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

// ── More button (bottom of the box) ──────────────────────────────────────
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

// ── Main toggle icon ──────────────────────────────────────────────────────
.wd-ovl__toggle-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl__toggle-icon--open {
  transform: rotate(180deg);
}

// ── Expanded panel (desktop: slides LEFT from the box) ──────────────────
.wd-ovl__panel {
  background: var(--wd-ctl-bg);
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// desktop: positioned to the LEFT of the mini strip
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

.wd-ovl__panel-close {
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

// rows inside the panel
.wd-ovl__panel-row {
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-radius: 4px;

  &:hover {
    background: rgba(128, 128, 128, 0.05);
  }
}

// ── Animations ────────────────────────────────────────────────────────────

// strip collapse
.wd-ovl-strip-enter-active,
.wd-ovl-strip-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.2, 0, 0, 1),
    transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl-strip-enter-from,
.wd-ovl-strip-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

// panel slide-left (desktop)
.wd-ovl-panel-enter-active,
.wd-ovl-panel-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.2, 0, 0, 1),
    transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl-panel-enter-from,
.wd-ovl-panel-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

// sheet slide-up (mobile)
.wd-ovl-sheet-enter-active,
.wd-ovl-sheet-leave-active {
  transition:
    opacity 0.25s cubic-bezier(0.2, 0, 0, 1),
    transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.wd-ovl-sheet-enter-from,
.wd-ovl-sheet-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
