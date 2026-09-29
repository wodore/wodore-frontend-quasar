<script setup lang="ts">
//import { Map } from 'maplibre-gl';
import { QPageStickyProps, useQuasar, LocalStorage } from 'quasar';
import type { AllPaintProperties } from '@maplibre/maplibre-gl-style-spec';
import { OpacitySpecification, OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { useI18n } from 'vue-i18n';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { computed, ref, watch } from 'vue';
import { LayerNames } from '@stores/map/utils/interfaces';
import {
  LayerSpecification,
  PropertyValueSpecification,
  //Source,
  //SourceSpecification,
} from 'maplibre-gl';
import WdOverlayConfig from './overlay-config/WdOverlayConfig.vue';
import { useOverlayConfigStore } from '@stores/map/overlay-config-store';
import { useMapMenuStore } from '@stores/map/map-menu-store';

//const emitter = inject(emitterSymbol)!;
const { t } = useI18n();
const overlayStore = useOverlayStore();
const overlaySwitchIcon = new URL(
  '/src/assets/wodore-design/icons/export/overlay-switch.svg',
  import.meta.url
).href;
const basemapStore = useBasemapStore();
//basemapStore.setEmitter(emitter);
const mapRef = useMap();
const $q = useQuasar();
const switcherOpen = ref<boolean>(
  LocalStorage.hasItem('switcherOpen') ? (LocalStorage.getItem('switcherOpen') as boolean) : true
);
const expanded = ref(false);
//const switcherLocked = ref<boolean>(true);

const configDialogOpen = ref(false);
const configOverlayName = ref('');
const configInitialTab = ref<string | undefined>(undefined);

const configStore = useOverlayConfigStore();
const menuStore = useMapMenuStore();

watch(switcherOpen, v => {
  LocalStorage.set('switcherOpen', v);
});

interface Props {
  position?: QPageStickyProps['position'];
  offset?: QPageStickyProps['offset'];
}
withDefaults(defineProps<Props>(), {
  position: 'bottom-right',
  offset: undefined,
});

/** Panel mode: bottom sheet on mobile, popover above the chip on desktop */


function toggleOverlay(s: OverlaySwitchItem): boolean {
  console.debug('[toggleOverlay] toogle', s);
  overlayStore.toggleOverlay(s);

  if (s.active) {
    const overlaysOrder = getOverlaysInRenderOrder();
    addOverlay(s, overlaysOrder);
  }
  setOverlayVisibility(s);
  ////emitter.emit('styleSwitched', s);
  //const switched = overlayStore.setBasemap(s);
  //if (!switcherLocked.value && switched) {
  //  switcherOpen.value = false;
  //  return true;
  //}
  //return switched;
  return true;
}

function setOverlayVisibility(overlay: OverlaySwitchItem): boolean {
  if (mapRef.map === undefined) {
    return false;
  }
  for (const layer of overlay.style.layers) {
    const currentLayer = mapRef.map.getLayer(layer.id);
    //console.debug('Current layer', currentLayer);
    if (currentLayer) {
      const visibility = overlay.active ? 'visible' : 'none';
      //console.debug('Set visibility to ', visibility);
      mapRef.map.setLayoutProperty(layer.id, 'visibility', visibility);
    }
  }
  return true;
}

function openConfig(overlayName: string, initialTab?: string) {
  console.debug('[WdOverlaySwitch] Opening config for overlay:', overlayName, 'tab:', initialTab);

  // The overlays array's deeply nested MapLibre style types crash the
  // dev checker's type inference. Cast to a flat shape for lookups.
  const items = overlayStore.overlays as unknown as Array<{ name: string; label: string }>;
  let overlayLabel = overlayName;
  for (const o of items) {
    if (o.name === overlayName) {
      overlayLabel = o.label;
      break;
    }
  }

  menuStore.openOverlayConfig(overlayName, initialTab);
  menuStore.menuData.title = overlayLabel;

  // Also keep dialog option for backwards compatibility
  configOverlayName.value = overlayName;
  configInitialTab.value = initialTab;
  // configDialogOpen.value = true; // Disabled - now using drawer
}

function hasActiveFilters(overlayName: string): boolean {
  // Same type depth workaround as openConfig
  const items = overlayStore.overlays as unknown as Array<{
    name: string;
    config?: { filters?: Array<{ id: string; defaultValue: unknown; options?: Array<{ value: unknown }> }> };
  }>;
  let config = items.find(o => o.name === overlayName)?.config;

  if (!config?.filters || config.filters.length === 0) {
    return false;
  }

  // Check if any filter has a non-default value
  for (const filter of config.filters) {
    const value = configStore.getFilterValue(overlayName, filter.id);
    const defaultValue = filter.defaultValue;

    // For arrays (like multi-select), check if value is different from "all selected"
    if (Array.isArray(value)) {
      const allOptions = filter.options?.map(opt => opt.value) || [];
      // If value is empty or has all options, it's not filtered
      if (value.length === 0 || value.length === allOptions.length) {
        continue;
      }
      return true; // Partial selection = active filter
    }

    // For other types, compare with default
    if (value !== defaultValue) {
      return true;
    }
  }

  return false;
}

//function toggleSwitcherLocked() {
//  switcherLocked.value = !switcherLocked.value;
//}

interface addOverlayLayerArgs {
  layer: LayerSpecification;
  onLayer?: LayerNames | undefined;
  defaultOpacity?: OpacitySpecification;
  beforeId?: string | undefined;
}

function addOverlayLayer({
  layer,
  onLayer = undefined,
  defaultOpacity = undefined,
  beforeId = undefined,
}: addOverlayLayerArgs) {
  //const styleId = mapRef.map?.style.stylesheet.id;
  const basemap = basemapStore.getBasemap();
  const basemapOpacity =
    basemap && onLayer !== undefined ? basemap.layers[onLayer]?.opacity : undefined;
  let autoOpacity = false;
  if (defaultOpacity === undefined || defaultOpacity == true) {
    autoOpacity = true;
    defaultOpacity = ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 0.6, 22, 0.5];
  }
  if (mapRef.map?.getLayer(layer.id) === undefined) {
    let opacity: PropertyValueSpecification<number> | undefined =
      defaultOpacity != false ? defaultOpacity : undefined;
    let _beforeId = beforeId;
    if (_beforeId === undefined && onLayer) {
      _beforeId = basemap?.layers[onLayer]?.before;
    }
    //if (_beforeId === undefined) {
    //  // vector
    //  opacity = ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 0.4, 22, 0.3];
    //}
    if (basemapOpacity !== undefined) {
      opacity = basemapOpacity;
    }
    const _source = 'source' in layer ? layer.source : undefined;
    if ((_source && mapRef.map?.getSource(_source)) || _source === undefined) {
      console.debug(`[addOverlayLayer] Add layer '${layer.id}' (before layer '${_beforeId}')`);
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
      if (
        layer.paint !== undefined &&
        opacityProperties.some(property => property in layer.paint!)
      ) {
        defaultOpacity = false;
      }
      if (defaultOpacity == false) {
        opacity = undefined;
      } else if (autoOpacity == false) {
        opacity = defaultOpacity;
      }
      if (opacity !== undefined && opacityProperties.length > 0) {
        for (const property of opacityProperties) {
          console.debug(`  Set paint '${property}' property for layer '${layer.id}' to ${opacity}`);
          // maplibre-gl v6: setPaintProperty expects a literal paint property name; the
          // dynamic names come from opacityPropertiesByType and are valid paint props
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
  // Access store as any first, then cast to avoid TypeScript deep type recursion
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const allOverlays = (overlayStore as any).overlays as Array<OverlaySwitchItem>;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const backOverlays = allOverlays.slice().filter(v => v.onLayer == 'background');
  const frontOverlays = allOverlays.slice().filter(v => v.onLayer == 'ways');
  return frontOverlays.concat(backOverlays).reverse();
}

function findBeforeLayerId(
  overlay: OverlaySwitchItem,
  overlaysOrder: Array<OverlaySwitchItem>
): string | undefined {
  const overlayIndex = overlaysOrder.findIndex(item => item.name === overlay.name);
  if (overlayIndex === -1) {
    return undefined;
  }
  for (let i = overlayIndex + 1; i < overlaysOrder.length; i += 1) {
    const candidate = overlaysOrder[i];
    if (candidate.onLayer !== overlay.onLayer) {
      continue;
    }
    for (const layer of candidate.style.layers) {
      if (mapRef.map?.getLayer(layer.id)) {
        return layer.id;
      }
    }
  }
  return undefined;
}

function addOverlay(overlay: OverlaySwitchItem, overlaysOrder: Array<OverlaySwitchItem>) {
  if (addedOverlays.has(overlay.name)) {
    return;
  }
  for (const label in overlay.style.sources) {
    if (mapRef.map?.getSource(label) === undefined) {
      const sourceSpec = overlay.style.sources[label];
      console.debug(`[addOverlays] Add ${sourceSpec.type} source '${label}'`);
      mapRef.map?.addSource(label, sourceSpec);
    }
  }
  // Add sprites if defined
  const spriteData = overlay.style.sprite;
  if (spriteData) {
    // Get existing sprites to avoid duplicates
    const existingSprites = mapRef.map?.getSprite() || [];

    // Handle array format: [{ id: string, url: string }, ...]
    if (Array.isArray(spriteData)) {
      for (const sprite of spriteData) {
        const spriteId = sprite.id;
        const spriteUrl = sprite.url;

        // Check if sprite already exists
        const alreadyAdded = existingSprites.some(existing => existing.id === spriteId);

        if (!alreadyAdded) {
          console.debug(`[addOverlays] Add sprite '${spriteId}' from '${spriteUrl}'`);
          mapRef.map?.addSprite(spriteId, spriteUrl);
        }
      }
    } else if (typeof spriteData === 'object') {
      // Handle object format: { id: url, ... }
      for (const [spriteId, spriteUrl] of Object.entries(spriteData)) {
        // Check if sprite already exists
        const alreadyAdded = existingSprites.some(existing => existing.id === spriteId);

        if (!alreadyAdded) {
          console.debug(`[addOverlays] Add sprite '${spriteId}' from '${spriteUrl}'`);
          mapRef.map?.addSprite(spriteId, spriteUrl as string);
        }
      }
    }
  }
  const beforeId = findBeforeLayerId(overlay, overlaysOrder);
  for (const layer of overlay.style.layers) {
    const layerWithVisibility = {
      ...layer,
      layout: {
        ...(layer.layout || {}),
        visibility: overlay.active ? 'visible' : 'none',
      },
    };
    console.debug(
      `[addOverlays] Try to add layer '${layer.id}' (call to 'addOverlayLayer')`,
      layerWithVisibility
    );

    addOverlayLayer({
      layer: <LayerSpecification>(layerWithVisibility as unknown),
      defaultOpacity: <OpacitySpecification>(overlay.opacity as unknown),
      onLayer: overlay.onLayer,
      beforeId: beforeId,
    });
  }
  setOverlayVisibility(<OverlaySwitchItem>(overlay as unknown));
  addedOverlays.add(overlay.name);
}

function addOverlays() {
  console.debug('[addOverlays] called');
  addedOverlays.clear();
  const overlaysOrder = getOverlaysInRenderOrder();
  for (const overlay of overlaysOrder) {
    if (overlay.active) {
      addOverlay(overlay, overlaysOrder);
    }
  }

  // Reapply any saved filters after overlays are loaded
  console.debug('[addOverlays] Reapplying saved filters');
  configStore.reapplyAllFilters();
}

mapRef.map?.on('load', addOverlays);


function overlayIcon(name: string) {
  return (
    'img:' + new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href
  );
}
</script>
<style lang="scss">

// ── overlay control (dark chips, mockup r6 + owner polish) ────────────
.wd-layerctl {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

// shared dark chip: pine panel + ice-mint icons (owner: "we can have dark buttons")
.wd-layerctl__main,
.wd-layerctl__box {
  background: #112119;
  border: 1px solid #1c3629;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(10, 20, 15, 0.35);
}

// main toggle: 48px square, original colored SVG icon
.wd-layerctl__main {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  flex: none;
  padding: 6px;
}

.wd-layerctl__main:hover {
  background: #1a2f24;
}

.wd-layerctl__main-icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.2s ease;
}

.wd-layerctl__main-icon--open {
  transform: rotate(180deg);
}

// box around the mini strip
.wd-layerctl__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  gap: 0;
  flex: none;
}

// strip: icon buttons inside the box (scrollable, fade at bottom)
.wd-layerctl__strip {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  // adaptive height: fill available space but leave room for topbar + margin
  max-height: calc(100dvh - 220px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  // scroll hint: last icon fades out at the bottom edge
  mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
}

// layer icon button: 44px (slightly smaller than the 48px main, fits the box)
.wd-layerctl__strip-btn {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #a9f0d2;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background-color 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  flex: none;
}

// inactive layers: faded
.wd-layerctl__strip-btn:not(.wd-layerctl__strip-btn--active) {
  opacity: 0.55;
}

.wd-layerctl__strip-btn:hover {
  background: rgba(169, 240, 210, 0.1);
  opacity: 1;
}

.wd-layerctl__strip-btn:active {
  transform: scale(0.95);
}

// active: gold ring (not fill - gold is a beam)
.wd-layerctl__strip-btn--active {
  box-shadow: inset 0 0 0 2px #bfab25;
  background: rgba(191, 171, 37, 0.1);
  opacity: 1;
}

// filter badge
.wd-layerctl__strip-badge {
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

// more button: at the bottom of the box, expands in place
.wd-layerctl__more {
  display: grid;
  place-items: center;
  width: 44px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #1c3629;
  background: #0e1b14;
  color: #a9f0d2;
  cursor: pointer;
  transition: background-color 0.12s ease;
  flex: none;
  margin-top: 2px;
}

.wd-layerctl__more:hover {
  background: #1c3629;
}

// expanded panel: slides out LEFT from the box, same dark chrome
.wd-layerctl__expanded {
  position: absolute;
  right: calc(100% + 6px);
  bottom: 0;
  width: 300px;
  max-height: 480px;
  background: #112119;
  border: 1px solid #1c3629;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(10, 20, 15, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wd-layerctl__expanded-head {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 14px;
  border-bottom: 1px solid #1c3629;
  flex: none;
}

.wd-layerctl__expanded-head h4 {
  margin: 0;
  flex: 1;
  font: 500 14px/1.2 'Barlow Semi Condensed', 'Barlow', sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #a9f0d2;
}

.wd-layerctl__expanded-close {
  color: #a9f0d2 !important;
}

.wd-layerctl__expanded-rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 0;
}

// expanded panel rows: dark theme
.wd-layerctl__expanded .overlay-item-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 14px;
  border-radius: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.wd-layerctl__expanded .overlay-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #f2f7f4;
}

.wd-layerctl__expanded .overlay-side-icons {
  flex: none;
}

// expanded panel animation: slides in from the right (from the box)
.wd-layerctl-expand-enter-active,
.wd-layerctl-expand-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.2, 0, 0, 1),
    transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.wd-layerctl-expand-enter-from,
.wd-layerctl-expand-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

// strip collapse animation
.wd-layerctl-strip-enter-active,
.wd-layerctl-strip-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.2, 0, 0, 1),
    transform 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.wd-layerctl-strip-enter-from,
.wd-layerctl-strip-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.overlay-scroll {
  max-height: calc(100vh - 210px);
  overflow-y: auto;
  overflow-x: hidden;
  /* room for the 2px gold selection ring (a box-shadow) - without the
  padding it is clipped at the top/bottom of the scroll viewport */
  padding: 3px 0;

  /* native app: keep the expanded list clear of the Android
     navigation bar zone */
  body.capacitor & {
    max-height: calc(100vh - env(safe-area-inset-bottom, 0px) - 210px);
    padding-bottom: calc(3px + env(safe-area-inset-bottom, 0px));
  }
}

.styleFabGroup {
  pointer-events: none;
  min-width: 74vw;
}

.styleFab {
  pointer-events: auto;
}

.wd-layerctl__rows .overlay-item-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 14px;
  border-radius: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.wd-layerctl__rows .overlay-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-layerctl__rows .overlay-side-icons {
  flex: none;
}

.wd-layerctl__rows .overlay-item-container:hover {
  background: rgba(120, 120, 120, 0.07);
}

.overlay-item-label {
  font: 500 14px/1.2 'Barlow Semi Condensed', 'Barlow', sans-serif;
  color: #1c1c1c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.overlay-item-container {
  margin-bottom: 6px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}
</style>
<template>
  <q-page-sticky :position="position" :offset="offset" style="z-index: 5">
    <div class="wd-layerctl">
      <!-- Expanded panel (when "more" is clicked): slides out LEFT from the box -->
      <Transition name="wd-layerctl-expand">
        <div v-if="expanded" class="wd-layerctl__expanded">
          <div class="wd-layerctl__expanded-head">
            <h4>{{ t('overlay_style') }}</h4>
            <q-btn flat round dense icon="wd-close" :aria-label="t('close')" @click="expanded = false" class="wd-layerctl__expanded-close" />
          </div>
          <div class="wd-layerctl__expanded-rows overlay-scroll">
            <div
              v-for="(item, index) in overlayStore.overlays"
              :key="item.name"
              v-show="item.show"
              class="overlay-item-container"
            >
              <WdOverlaySwitchItem
                :tabindex="index"
                @toggle-overlay="toggleOverlay(<OverlaySwitchItem>(item as unknown))"
                @configure="openConfig(item.name, $event)"
                :label="item.label"
                :show-label="true"
                :icon="overlayIcon(item.icon)"
                :active="item.active"
                :tooltip="false"
                :overlay-name="item.name"
                :show-badge="hasActiveFilters(item.name)"
              />
            </div>
          </div>
        </div>
      </Transition>

      <!-- Mini strip in a dark box (collapsible) -->
      <Transition name="wd-layerctl-strip">
        <div v-if="switcherOpen" class="wd-layerctl__box">
          <div class="wd-layerctl__strip" role="group" :aria-label="t('overlay_style')">
            <div
              v-for="item in overlayStore.overlays"
              :key="item.name"
              v-show="item.show"
            >
              <button
                class="wd-layerctl__strip-btn"
                :class="{ 'wd-layerctl__strip-btn--active': item.active, 'wd-layerctl__strip-btn--filtered': hasActiveFilters(item.name) }"
                :aria-label="item.label"
                :aria-pressed="item.active"
                :title="item.label"
                @click="toggleOverlay(<OverlaySwitchItem>(item as unknown))"
              >
                <q-icon :name="overlayIcon(item.icon)" size="22px" />
                <span v-if="hasActiveFilters(item.name)" class="wd-layerctl__strip-badge">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"/></svg>
                </span>
              </button>
            </div>
          </div>
          <!-- more button: expands the box to the left (not a new window) -->
          <button
            class="wd-layerctl__more"
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

      <!-- Main toggle: original colored overlay icon -->
      <button
        class="wd-layerctl__main"
        :class="{ 'wd-layerctl__main--open': switcherOpen }"
        :aria-label="t('overlay_style')"
        :aria-expanded="switcherOpen"
        @click="switcherOpen = !switcherOpen"
      >
        <img
          :src="overlaySwitchIcon"
          alt=""
          class="wd-layerctl__main-icon"
          :class="{ 'wd-layerctl__main-icon--open': switcherOpen }"
        />
      </button>
    </div>
  </q-page-sticky>

  <!-- Config Dialog -->
  <WdOverlayConfig
    v-model="configDialogOpen"
    :overlay-name="configOverlayName"
    :initial-tab="configInitialTab"
  />
</template>
