<script setup lang="ts">
//import { Map } from 'maplibre-gl';
import { QPageStickyProps, QFabProps, useQuasar } from 'quasar';
import { BasemapSwitchItem } from '../../stores/map/styles';
import { useBasemapStore } from '@stores/map/basemap-store';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
import { ref } from 'vue';

//const emitter = inject(emitterSymbol)!;
const basemapStore = useBasemapStore();
//basemapStore.setEmitter(emitter);
const $q = useQuasar();
const switcherOpen = ref<boolean>(false);
const switcherLocked = ref<boolean>(false);

interface Props {
  position?: QPageStickyProps['position'];
  direction?: QFabProps['direction'];
}
withDefaults(defineProps<Props>(), {
  position: 'top-left',
  direction: 'right',
});
//const mapRef = useMap();
//function setStyleByMap() {
//  const style = mapRef.map?.getStyle();
//  //console.debug('Set style by map', basemapStore.getBasemap());
//  //mapRef.map!.setStyle(basemapStore.getBasemap().style, { diff: false });
//  const basemap = basemapStore.getBasemap();
//  console.debug(
//    'Set style by map (current style, current basemap)',
//    style,
//    basemap,
//  );
//  if (basemap !== undefined) {
//    basemapStore.setBasemap(basemap);
//  }
//  //for (let i = 0, len = basemapStore.basemaps.length; i < len; i++) {
//  //  if (basemapStore.basemaps[i].name === name) {
//  //    console.debug('Set style by map', basemapStore.basemaps[i]);
//  //    setBasemap(basemapStore.basemaps[i]);
//  //    break;
//  //  }
//  //}
//}
//watch(
//  () => mapRef.isLoaded,
//  () => {
//    console.debug('Map loaded');
//    //if (v) setStyleByMap();
//  },
//  { immediate: true },
//);
//mapRef.map?.on('style.load', setStyleByMap);

//onBeforeUnmount(() => {
//  if (mapRef.isMounted) {
//    mapRef.map?.off('style.load', setStyleByMap);
//  }
//});

function setBasemap(s: BasemapSwitchItem): boolean {
  //emitter.emit('styleSwitched', s);
  const switched = basemapStore.setBasemap(s);
  if (!switcherLocked.value && switched) {
    switcherOpen.value = false;
    return true;
  }
  return switched;
}

function toggleSwitcherLocked() {
  switcherLocked.value = !switcherLocked.value;
}

const switchIcon =
  'img:' +
  new URL(
    '/src/assets/wodore-design/icons/export/style-switch.svg',
    import.meta.url,
  ).href;
</script>

<template>
  <q-page-sticky :position="position" :offset="[18, 24]" style="z-index: 5">
    <q-fab
      ref="fabStyleRef"
      push
      vertical-actions-align="left"
      :icon="switchIcon"
      padding="sm"
      :direction="direction"
      persistent
      :color="switcherOpen ? 'negative-400' : 'primary-100'"
      v-model="switcherOpen"
    >
      <WdBasemapSwitchItem
        v-for="(style, index) in basemapStore.basemaps"
        :tabindex="index"
        @click="setBasemap(style as BasemapSwitchItem)"
        v-show="style.show"
        :key="style.name"
        :label="style.label"
        :img="style.img"
        :active="style.active"
        :tooltip="$q.platform.is.desktop"
      />
      <!-- class="bg-primary" -->
      <q-btn
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
      </q-btn>
      <!-- </div> -->
    </q-fab>
  </q-page-sticky>
</template>
