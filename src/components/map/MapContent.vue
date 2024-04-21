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
const topOffset = 38;
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
    return 'eva-code-outline';
  } else if (portraitHeight.value < portraitHeightAvg.value) {
    return 'eva-arrowhead-up';
  } else {
    return 'eva-arrowhead-down';
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
  draggingFab.value = ev.isFirst !== true && ev.isFinal !== true;
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
    if (portraitHeight.value >= 50) {
      portraitHeight.value -= ev.delta.y as number;
    } else {
      portraitHeight.value = 50;
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
<template>
  <!-- we use a drawer and footer in order to work correct with the QLayout component -->
  <!-- LANDSCAPE CONTENT (usually desktop) -->
  <q-drawer
    v-if="!showContentBottom"
    v-model="model"
    side="right"
    :width="400"
    :breakpoint="0"
    class="shadow-2"
  >
    <div
      class="text-primary-100 absolute-top z-max q-pa-xs"
      style="width: 50px"
    >
      <q-btn
        flat
        round
        dense
        icon="eva-close"
        class="text-primary-900"
        size="lg"
        @click="$emit('close', 'landscape')"
      />
    </div>
    <router-view name="content" />
  </q-drawer>
  <!-- PORTRAIT CONTENT (usually mobile) -->
  <q-footer class="text-black scroll fixed-bottom">
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
        'padding-top': '20px',
      }"
    >
      <div
        style="top: -2px; right: 20px"
        class="text-primary-100 absolute-top-right z-top q-pa-xs"
      >
        <q-btn
          round
          dense
          color="accent"
          :icon="portraitHeightBtnIcon"
          :class="{ 'rotate-90': draggingFab }"
          :size="$q.platform.is.mobile ? 'lg' : 'md'"
          v-touch-pan.vertical.prevent.mouse="moveFab"
          @click="setPortraitHeight"
        />
        <q-btn
          round
          dense
          color="accent"
          icon="eva-close"
          class="q-ml-md"
          :size="$q.platform.is.mobile ? 'lg' : 'md'"
          @click="$emit('close', 'portrait')"
        />
      </div>
      <div
        style="padding-top: 25px"
        class="background--blur scroll shadow-2 fit"
      >
        <router-view name="content" />
      </div>
    </div>
    <!-- </div> -->
  </q-footer>
</template>
