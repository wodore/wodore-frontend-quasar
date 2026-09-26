<script setup lang="ts">
import { computed } from 'vue';

import { useMonthly, TypeMonths, TypeMonthIconsPath } from './index';

const { getMonthName } = useMonthly();

interface Props {
  month: TypeMonths;
  icons: TypeMonthIconsPath;
}
const props = defineProps<Props>();

const monthName = computed(() => getMonthName(props.month));
//const monthNumber = computed<number>(() => parseInt(props.month));
</script>
<style lang="scss" scoped>
.card {
  min-width: 50px;
  max-width: 200px;
  height: 100%;
}
.header {
  background-color: var(--wd-ridge);
  width: 100%;
  color: var(--wd-ink);
}

// Weather sprite icons render multicolor; monochrome them into the system
.card :deep(img) {
  filter: grayscale(1);
  opacity: 0.9;
}
</style>
<template>
  <div
    class="card column items-center overflow-hidden q-mb-xs"
    :class="'month_' + month + '--gradient-light'"
  >
    <div
      class="text-caption header text-center row justify-center"
      :class="'month_' + month + '--gradient'"
    >
      {{ monthName }}
    </div>
    <div class="q-ma-xs row items-center justify-center no-wrap">
      <q-icon size="24px" :name="icons.main0" />
      <q-icon size="24px" v-if="icons.main1" :name="icons.main1" />
      <q-icon
        size="20px"
        v-if="icons.minor"
        :name="icons.minor"
        style="transform: translate(-2px, 7px)"
      />
    </div>
  </div>
</template>
