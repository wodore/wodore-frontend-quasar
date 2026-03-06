<script setup lang="ts">
/**
 * Overlay Config Attribution Component
 *
 * Displays attribution/data sources for an overlay.
 */

import type { LinkItem } from '@stores/map/overlay-configs/types';

interface Props {
  attribution: LinkItem[];
}

defineProps<Props>();
</script>

<template>
  <div v-if="attribution.length > 0" class="q-px-md q-pb-md">
    <div class="row q-gutter-xs">
      <q-chip
        v-for="(attr, index) in attribution"
        :key="index"
        size="sm"
        clickable
        tag="a"
        :href="attr.url"
        target="_blank"
        rel="noopener noreferrer"
        color="grey-3"
        text-color="grey-8"
        class="attribution-chip"
      >
        {{ attr.name }}
      </q-chip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.attribution-chip {
  text-decoration: none;

  &:hover {
    opacity: 0.8;
  }
}
</style>
