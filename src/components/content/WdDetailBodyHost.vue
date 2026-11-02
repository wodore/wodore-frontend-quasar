<script setup lang="ts">
/**
 * WdDetailBodyHost — the thin generic BODY host for content named
 * views. The three-zone rule: this component renders ONLY the body
 * zone from the active entry's surfaces; the title/actions zones are
 * fed into the panel shells' slots by useActiveDetailEntry in
 * MainLayout (never flattened here).
 *
 * Legacy slug-prop adaptation (C2): the accommodation entry's body
 * (WdPlaceContent) still takes `slug` — the host passes the route slug
 * through. New surface components receive the whole target instead.
 */
import { useActiveDetailEntry } from '@composables/useActiveDetailEntry';

defineProps<{ slug?: string }>();

const { body } = useActiveDetailEntry();
</script>

<template>
  <component :is="body" v-if="body" :slug="slug" />
</template>
