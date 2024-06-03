<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuasar, TouchPanValue } from 'quasar';
const $q = useQuasar();
const model = defineModel<boolean>();
const showContentBottom = computed(() => {
  return $q.screen.lt.md;
});

defineEmits<{ close: [mode: string] }>();
//function onClose() {
//  router.push({
//    name: 'map',
//    hash: route.hash,
//    query: route.query,
//  });
//}
const topOffset = 76.5;
const bottomOffset = 100;
const portraitHeight = ref(process.env.CLIENT ? window.innerHeight * 0.4 : 400);
const portraitHeightMax = ref(
  process.env.CLIENT ? window.innerHeight - topOffset : 800,
);
const portraitHeightMin = ref(portraitHeight.value);
const portraitHeightAvg = computed(() => {
  return (
    portraitHeightMin.value +
    (portraitHeightMax.value - portraitHeightMin.value) / 2
  );
});
const portraitHeightBtnIcon = computed(() => {
  if (draggingFab.value) {
    return 'wd-arrow-up-down';
  } else if (portraitHeight.value < portraitHeightAvg.value) {
    return 'wd-arrowhead-up';
  } else {
    return 'wd-arrowhead-down';
  }
});
function setPortraitHeight() {
  if (portraitHeight.value < portraitHeightAvg.value) {
    portraitHeight.value = portraitHeightMax.value;
  } else {
    portraitHeight.value = portraitHeightMin.value;
  }
}

const draggingFab = ref(false);

const moveFab: TouchPanValue = (ev) => {
  if (!(ev && ev.evt && ev.delta)) {
    return;
  }
  //draggingFab.value = ev.isFirst !== true && ev.isFinal !== true;
  draggingFab.value = ev.isFinal !== true;
  const winHeight = (ev.evt as MouseEvent).view
    ? ((ev.evt as MouseEvent).view?.innerHeight as number)
    : 600;
  if (ev.direction == 'up') {
    if (portraitHeight.value <= winHeight - 150) {
      portraitHeight.value -= ev.delta.y as number;
    } else {
      portraitHeight.value = winHeight - topOffset;
    }
  }
  if (ev.direction == 'down') {
    if (portraitHeight.value >= bottomOffset) {
      portraitHeight.value -= ev.delta.y as number;
    } else {
      portraitHeight.value = bottomOffset;
    }
  }
  if (ev.isFinal) {
    if (portraitHeight.value < portraitHeightAvg.value) {
      portraitHeightMin.value = portraitHeight.value;
    } else {
      portraitHeightMax.value = portraitHeight.value;
    }
  }
  //fabPos.value = [fabPos.value[0] - ev.delta.x, fabPos.value[1] - ev.delta.y];
};
</script>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition-duration: 0.2s;
  transition-property: opacity;
  transition-timing-function: ease;
}

.fade-enter,
.fade-leave-active {
  opacity: 0;
}
</style>
<template>
  <!-- we use a drawer and footer in order to work correct with the QLayout component -->
  <!-- LANDSCAPE CONTENT (usually desktop) -->
  <q-drawer
    v-if="!showContentBottom"
    v-model="model"
    side="right"
    :width="$q.screen.gt.md ? 460 : 380"
    :breakpoint="0"
    class="shadow-2"
  >
    <div
      class="text-primary-100 absolute-top z-max q-pa-xs"
      style="width: 50px"
    >
      <q-btn
        round
        dense
        unelevated
        color="accent-100"
        icon="wd-close"
        class="text-primary-900 q-ma-sm"
        size="md"
        @click="$emit('close', 'landscape')"
      />
    </div>
    <router-view v-slot="{ Component, route }" name="content">
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </q-drawer>
  <!-- PORTRAIT CONTENT (usually mobile) -->
  <q-footer class="text-black fixed-bottom">
    <!-- <div
    style="
      min-height: 20px;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: rgba(0, 0, 0, 0);
    "
    class="text-black scroll fixed-bottom z-max"
  > -->
    <div
      v-if="model && showContentBottom"
      :style="{
        'max-height': portraitHeight + 'px',
        height: portraitHeight + 'px',
        'padding-top': '0px',
      }"
    >
      <div
        style="top: -20px; right: 50px"
        class="text-primary-100 absolute-top-right z-top q-pa-xs"
      >
        <q-btn
          round
          dense
          unelevated
          color="accent-100"
          :icon="portraitHeightBtnIcon"
          size="md"
          class="text-primary-700"
          v-touch-pan.vertical.prevent.mouse="moveFab"
          @click="setPortraitHeight"
        />
        <q-btn
          round
          dense
          unelevated
          color="accent-100"
          icon="wd-close"
          class="q-ml-md text-primary-700"
          size="md"
          @click="$emit('close', 'portrait')"
        />
      </div>
      <div
        style="padding-top: 0px"
        class="background--blur scroll shadow-2 fit"
      >
        <!-- <transition name="fade" mode="out-in">
          <router-view name="content" />
        </transition> -->
        <router-view v-slot="{ Component, route }" name="content">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </div>
    </div>
    <!-- </div> -->
    <WdBeta />
  </q-footer>
</template>
