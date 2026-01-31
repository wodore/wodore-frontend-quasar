<script setup lang="ts">
//import { Map } from 'maplibre-gl';
import { QPageStickyProps, QFabProps, useQuasar, LocalStorage } from 'quasar';
import { OpacitySpecification, OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { ref, watch } from 'vue';
import { LayerNames } from '@stores/map/utils/interfaces';
import {
  LayerSpecification,
  PropertyValueSpecification,
  //Source,
  //SourceSpecification,
} from 'maplibre-gl';

//const emitter = inject(emitterSymbol)!;
const overlayStore = useOverlayStore();
const basemapStore = useBasemapStore();
//basemapStore.setEmitter(emitter);
const mapRef = useMap();
const $q = useQuasar();
const switcherOpen = ref<boolean>(
  LocalStorage.hasItem('switcherOpen') ? (LocalStorage.getItem('switcherOpen') as boolean) : true
);
//const switcherLocked = ref<boolean>(true);

watch(switcherOpen, v => {
  LocalStorage.set('switcherOpen', v);
});

interface Props {
  position?: QPageStickyProps['position'];
  direction?: QFabProps['direction'];
  offset?: QPageStickyProps['offset'];
}
withDefaults(defineProps<Props>(), {
  position: 'top-left',
  direction: 'right',
  offset: undefined,
});

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
          mapRef.map?.setPaintProperty(layer.id, property, opacity);
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
}

mapRef.map?.on('load', addOverlays);

const switchIcon =
  'img:' +
  new URL('/src/assets/wodore-design/icons/export/overlay-switch.svg', import.meta.url).href;

function overlayIcon(name: string) {
  return (
    'img:' + new URL(`/src/assets/wodore-design/overlays/exports/${name}.svg`, import.meta.url).href
  );
}
</script>
<style lang="scss">
.overlay-scroll {
  max-height: calc(100vh - 210px);
  overflow: auto;
}

.styleFabGroup {
  pointer-events: none;
  // display: flex;
  min-width: 74vw;
  // justify-content: start;
  // align-items: flex-start;
}

.styleFab {
  pointer-events: auto;
}
</style>
<template>
  <q-page-sticky :position="position" :offset="offset" style="z-index: 5">
    <q-fab
      ref="fabStyleRef"
      push
      vertical-actions-align="center"
      :icon="switchIcon"
      padding="sm"
      :direction="direction"
      persistent
      :color="switcherOpen ? 'negative-400' : 'icon'"
      v-model="switcherOpen"
    >
      <div class="overlay-scroll">
        <WdOverlaySwitchItem
          v-for="(item, index) in overlayStore.overlays"
          :tabindex="index"
          @click="toggleOverlay(<OverlaySwitchItem>(item as unknown))"
          v-show="item.show"
          :key="item.name"
          :label="item.label"
          :icon="overlayIcon(item.icon)"
          :active="item.active"
          :tooltip="$q.platform.is.desktop"
        />
        <!-- class="bg-primary" -->
        <!-- <q-btn
          v-if="$q.screen.gt.xs"
          round
          flat
          style="padding: 0"
          :ripple="false"
          :color="switcherLocked ? 'accent-500' : 'secondary-800'"
          @click="toggleSwitcherLocked"
        >
          <q-icon>
            <IconEvaLockFill v-if="switcherLocked" />
            <IconEvaUnlockOutline v-if="!switcherLocked" />
          </q-icon>
        </q-btn> -->
        <!-- </div> -->
      </div>
    </q-fab>
  </q-page-sticky>
</template>
