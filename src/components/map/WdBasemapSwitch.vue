<script setup lang="ts">
//import { Map } from 'maplibre-gl';
import { QPageStickyProps, QFabProps, useQuasar } from 'quasar';
import { BasemapSwitchItem } from '../../stores/map/styles';
import { useBasemapStore } from '@stores/map/basemap-store';
import { ref } from 'vue';

const basemapStore = useBasemapStore();
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

function setStyle(s: BasemapSwitchItem): boolean {
  basemapStore.setBasemap(s);
  if (!switcherLocked.value) {
    switcherOpen.value = false;
  }
  return true;
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
        @click="setStyle(style as BasemapSwitchItem)"
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
