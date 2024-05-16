<script setup lang="ts">
//import { Map } from 'maplibre-gl';
import { QPageStickyProps, QFabProps, useQuasar } from 'quasar';
import {
  OpacitySpecification,
  OverlaySwitchItem,
} from '@stores/map/utils/interfaces';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { ref } from 'vue';
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
const switcherOpen = ref<boolean>(false);
//const switcherLocked = ref<boolean>(true);

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
  console.debug('toogle', s);
  overlayStore.toggleOverlay(s);

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
    console.log('Current layer', currentLayer);
    if (currentLayer) {
      if (!layer.layout) {
        layer['layout'] = { visibility: 'none' };
      }
      if (layer.layout) {
        if (overlay.active) {
          layer.layout.visibility = 'visible';
        } else {
          layer.layout.visibility = 'none';
        }
        console.log('Set visibility to ', layer.layout?.visibility);
        mapRef.map.setLayoutProperty(
          layer.id,
          'visibility',
          layer.layout?.visibility,
        );
      }
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
}

function addOverlayLayer({
  layer,
  onLayer = undefined,
  defaultOpacity = undefined,
}: addOverlayLayerArgs) {
  //const styleId = mapRef.map?.style.stylesheet.id;
  const basemap = basemapStore.getBasemap();
  const basemapOpacity =
    onLayer !== undefined ? basemap?.layers[onLayer]?.opacity : undefined;
  let autoOpacity = false;
  if (defaultOpacity === undefined || defaultOpacity == true) {
    autoOpacity = true;
    defaultOpacity = [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      0.9,
      14,
      0.6,
      22,
      0.5,
    ];
  }
  if (mapRef.map?.getLayer(layer.id) === undefined) {
    let opacity: PropertyValueSpecification<number> | undefined =
      defaultOpacity != false ? defaultOpacity : undefined;
    let _beforeId = undefined;
    if (onLayer) {
      _beforeId = basemap?.layers[onLayer]?.before;
    }
    if (_beforeId === undefined) {
      // vector
      opacity = ['interpolate', ['linear'], ['zoom'], 7, 0.8, 12, 0.4, 22, 0.3];
    }
    if (basemapOpacity !== undefined) {
      opacity = basemapOpacity;
    }
    const _source = 'source' in layer ? layer.source : undefined;
    if ((_source && mapRef.map?.getSource(_source)) || _source === undefined) {
      console.debug(`Add layer ${layer.id} before layer ${_beforeId}.`);
      mapRef.map?.addLayer(layer, _beforeId);
      if (defaultOpacity == false) {
        opacity = undefined;
      } else if (autoOpacity == false) {
        opacity = defaultOpacity;
      }
      if (opacity !== undefined) {
        console.debug(
          `Set paint '${layer.type}-opacity' property for layer '${layer.id}' to ${opacity}`,
          opacity,
          mapRef.map?.getLayer(layer.id),
        );
        mapRef.map?.setPaintProperty(
          layer.id,
          `${layer.type}-opacity`,
          opacity,
        );
      }
    } else {
      console.error(
        `Source '${_source}' not added,  tried to add layer '${layer.id}'.`,
      );
    }
  }
}

function addOverlays() {
  for (const overlay of overlayStore.overlays) {
    for (const label in overlay.style.sources) {
      if (mapRef.map?.getSource(label) === undefined) {
        const sourceSpec = overlay.style.sources[label];
        console.debug('Add source', label, sourceSpec);
        mapRef.map?.addSource(label, sourceSpec);
      }
    }
    setOverlayVisibility(<OverlaySwitchItem>(overlay as unknown));
    console.debug('Add layers', overlay.style.layers);
    for (const layer of overlay.style.layers) {
      //console.debug('Add layer', layer);
      addOverlayLayer({
        layer: <LayerSpecification>(layer as unknown),
        // @ts-expect-error: extensive
        defaultOpacity: <OpacitySpecification>(overlay.opacity as unknown),
        onLayer: overlay.onLayer,
      });
    }
  }
}

mapRef.map?.on('styledata', addOverlays);
mapRef.map?.on('load', addOverlays);

const switchIcon =
  'img:' +
  new URL(
    '/src/assets/wodore-design/icons/export/overlay-switch.svg',
    import.meta.url,
  ).href;

function overlayIcon(name: string) {
  return (
    'img:' +
    new URL(
      `/src/assets/wodore-design/overlays/exports/${name}.svg`,
      import.meta.url,
    ).href
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
      :color="switcherOpen ? 'negative-400' : 'primary-100'"
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
