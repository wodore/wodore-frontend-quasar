<script setup lang="ts">
import { computed } from 'vue';
import { usePlace } from '@composables/usePlace';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();

// Fetch place data for header
const { place } = usePlace(computed(() => props.slug));
</script>

<template>
  <div class="wd-place-header">
    <!-- Minimal header - most info is in WdPlaceContent -->
    <div v-if="place" class="q-pa-md">
      <h1 class="text-h5 text-accent-900 q-ma-none">{{ place.name }}</h1>
      <div v-if="place.elevation" class="text-caption text-grey-7">{{ place.elevation }} m</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wd-place-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
