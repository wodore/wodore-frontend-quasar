<script setup lang="ts">
import { computed } from 'vue';
//const model = defineModel();

interface Props {
  icon?: boolean;
  text?: boolean;
  textColorLeft?: string;
  textColorRight?: string;
  logoPath?: string;
}

const props = withDefaults(defineProps<Props>(), {
  icon: false,
  text: false,
  textColorLeft: 'black',
  textColorRight: 'accent',
  logoPath: '/logos/wodore_mobile.svg',
});

const showIcon = computed(() => {
  return !props.icon && !props.text ? true : props.icon;
});
const showText = computed(() => {
  return !props.icon && !props.text ? true : props.text;
});
</script>

<template>
  <span class="text-h4">
    <span v-if="showText" class="text-black text-weight-medium">wo</span>
    <q-icon
      v-if="showIcon"
      style="transform: translateY(-4px)"
      :name="'img:' + props.logoPath"
    />
    <span
      :style="{ 'margin-left': props.icon ? 0 : '3pt' }"
      v-if="showText"
      class="text-accent text-weight-regular"
      >dore</span
    >
  </span>
</template>
