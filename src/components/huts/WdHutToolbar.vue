<script setup lang="ts">
import { ref } from 'vue';
import { schemasWodore } from '@clients/index';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | null;
}

defineProps<Props>();

const watchHut = ref(false);
function toggleHutWatch() {
  watchHut.value = !watchHut.value;
}
const starHut = ref(false);
function toggleHutStar() {
  starHut.value = !starHut.value;
}
</script>

<style lang="scss" scoped></style>

<template>
  <q-toolbar>
    <slot></slot>
    <q-space />
    <WdToolbarButton
      size="md"
      :color="starHut ? 'accent' : 'primary-900'"
      :icon="starHut ? 'wd-favorite' : 'wd-favorite-outline'"
      @click="toggleHutStar"
    />
    <WdToolbarButton
      size="md"
      :color="watchHut ? 'accent' : 'primary-900'"
      :icon="watchHut ? 'wd-eye' : 'wd-eye-outline'"
      @click="toggleHutWatch"
    />
    <WdToolbarButton
      size="md"
      class="text-primary-900"
      icon="wd-more-vertical"
    />
  </q-toolbar>
</template>
