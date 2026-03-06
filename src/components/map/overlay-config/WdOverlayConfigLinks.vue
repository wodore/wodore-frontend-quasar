<script setup lang="ts">
/**
 * Overlay Config Links Component
 *
 * Displays a list of related links for an overlay.
 */

import type { LinkItem } from '@stores/map/overlay-configs/types';

interface Props {
  links: LinkItem[];
}

defineProps<Props>();
</script>

<template>
  <div v-if="links.length > 0" class="q-px-md q-pb-md">
    <div class="text-caption text-grey-7 q-mb-xs">Weiterführende Links</div>
    <q-list dense class="transparent">
      <q-item
        v-for="(link, index) in links"
        :key="index"
        clickable
        tag="a"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="q-px-none"
      >
        <q-item-section side>
          <q-icon name="wd-link" size="xs" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-primary">{{ link.name }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>
