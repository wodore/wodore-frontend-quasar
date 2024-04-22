<script setup lang="ts">
import { computed } from 'vue';

import { useMonthly, TypeMonths } from './index';

const { getMonthName } = useMonthly();

interface Props {
  month: TypeMonths;
  icons: string[];
}
const props = defineProps<Props>();

const monthName = computed(() => getMonthName(props.month));
const monthNumber = computed<number>(() => parseInt(props.month));
</script>
<style lang="scss" scoped>
.card {
  //border-radius: 5px;
  min-width: 50px;
  max-width: 200px;
  height: 100%;
  //border: 1px solid rgba(color('primary', 400), 0.1);
}
.header {
  background-color: black;
  width: 100%;
  //border-radius: 5px;
}
</style>
<template>
  <div
    class="card column items-center overflow-hidden q-mb-xs"
    :class="'month_' + month + '--gradient-light'"
  >
    <div
      class="text-caption header text-left row"
      :class="'month_' + month + '--gradient'"
    >
      <span class="q-px-xs"> </span>
      <b> {{ monthNumber }}</b> <q-space />
      {{ monthName }}
      <span class="q-px-xs"> </span>
    </div>
    <div class="q-ma-xs row items-center justify-center">
      <q-icon size="24px" v-for="i in icons" :key="i" :name="i" />
    </div>
  </div>
</template>
