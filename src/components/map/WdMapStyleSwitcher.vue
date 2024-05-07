<script setup lang="ts">
import { mapSymbol } from 'vue-maplibre-gl';
//import { Map } from 'maplibre-gl';
import { QPageStickyProps } from 'quasar';
import WdMapStyleSwitchItem from './WdMapStyleSwitchItem.vue';
import { StyleSwitchItem } from './styles';
import { inject, ref } from 'vue';
//const link = ref('outbox');
//const active_classes = 'bg-accent text-white';

const switcherOpen = ref<boolean>(false);
const switcherLocked = ref<boolean>(false);

const map = inject(mapSymbol)!; //, isMapLoaded = inject(isLoadedSymbol)!;
// function setStyleByMap() {
//   const name = map.value!.getStyle().name;
//   if (model.value === undefined) {
//     return;
//   }
//   for (let i = 0, len = model.value.length; i < len; i++) {
//     if (model.value[i].name === name) {
//       setStyle(model.value[i]);
//       break;
//     }
//   }
// }

function getCurrentStyle(): StyleSwitchItem | undefined {
  if (model.value !== undefined) {
    for (let i = 0, len = model.value.length; i < len; i++) {
      if (model.value[i].active) {
        return model.value[i];
      }
    }
  }
  return undefined;
}
// TODO: needed
//watch(
//  isMapLoaded,
//  (v) => {
//    if (v) setStyleByMap();
//  },
//  { immediate: true },
//);
//map.value!.on('style.load', setStyleByMap);

function setStyle(s: StyleSwitchItem): boolean {
  if (model.value === undefined) {
    return false;
  }
  const currentStyle = getCurrentStyle();
  if (currentStyle !== undefined && s.name == currentStyle.name) {
    return false;
  }
  //emitter.emit('styleSwitched', s);

  /*
   * Skip diff as long as Maplibre-GL doesn't fie `style.load` correctly
   * @see https://github.com/maplibre/maplibre-gl-js/issues/2587
   */
  map.value!.setStyle(s.style, { diff: false });
  for (let i = 0, len = model.value.length; i < len; i++) {
    model.value[i].active = false;
  }
  s.active = true;
  if (!switcherLocked.value) {
    switcherOpen.value = false;
  }
  return true;
}

function toggleSwitcherLocked() {
  switcherLocked.value = !switcherLocked.value;
}
const model = defineModel<Array<StyleSwitchItem>>();
interface Props {
  //mapStyles: Array<StyleSwitchItem>;
  mapStyle: StyleSwitchItem;
  position?: QPageStickyProps['position'];
}
const props = withDefaults(defineProps<Props>(), {
  //mapStyles: defaultMapStyle,
  //mapStyle: defaultMapStyle[0],
  position: 'top-left',
});
console.debug(props.mapStyle);

const switchIcon =
  'img:' +
  new URL(
    '/src/assets/wodore-design/icons/export/style-switch.svg',
    import.meta.url,
  ).href;
</script>

<template>
  <q-page-sticky :position="position" :offset="[18, 18]" style="z-index: 5">
    <q-fab
      ref="fabStyleRef"
      push
      vertical-actions-align="left"
      :icon="switchIcon"
      padding="sm"
      direction="right"
      persistent
      :color="switcherOpen ? 'negative-300' : 'primary-100'"
      v-model="switcherOpen"
    >
      <!-- <q-fab-action color="primary" @click="onClick" icon="mail" /> -->
      <!-- <q-fab-action color="accent" @click="onClick" icon="alarm" /> -->
      <!-- class="styleFabGroup row wrap items-start justify-start" -->
      <!-- <div ref="fabStyleGroupRef" :style="{ 'pointer-events': 'none' }"> -->
      <!-- @click="firstTime = false" -->
      <!-- :style="pointerEventsStyle" -->
      <WdMapStyleSwitchItem
        v-for="(style, index) in model"
        :tabindex="index"
        @click="setStyle(style)"
        v-show="true"
        :key="style.name"
        :item="style"
      />
      <!-- class="bg-primary" -->
      <q-btn
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
