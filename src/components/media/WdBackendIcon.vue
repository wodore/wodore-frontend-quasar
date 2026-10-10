<!-- One glyph from the backend icon library: stored reference → cached SVG. -->
<script setup lang="ts">
import { ref, watch } from 'vue';

import { getBackendIconUrl, parseIconRef } from '@services/icons';

const props = withDefaults(
  defineProps<{
    /** Stored icon reference "pack/slug[@style]" (services/icons) —
     *  unparsable values (legacy or unknown) show an empty placeholder. */
    icon?: string | null;
    /** Pre-resolved asset URL (e.g. from a search result) — skips lookup. */
    url?: string | null;
    size?: number;
  }>(),
  {
    icon: null,
    url: null,
    size: 20,
  }
);

const resolvedUrl = ref<string | null>(props.url ?? null);
let requestSeq = 0;

watch(
  () => [props.icon, props.url] as const,
  async ([icon, url]) => {
    const seq = ++requestSeq;
    if (url) {
      resolvedUrl.value = url;
      return;
    }
    const parsed = parseIconRef(icon);
    if (!parsed) {
      resolvedUrl.value = null;
      return;
    }
    const found = await getBackendIconUrl(parsed.slug, parsed.style, parsed.pack);
    if (seq === requestSeq) resolvedUrl.value = found;
  },
  { immediate: true }
);
</script>

<template>
  <img
    v-if="resolvedUrl"
    class="wd-backend-icon"
    :src="resolvedUrl"
    :width="size"
    :height="size"
    alt=""
    loading="lazy"
    decoding="async"
  />
  <!-- Same-size placeholder keeps the layout while resolving (or for
       references that no longer resolve) -->
  <span
    v-else
    class="wd-backend-icon wd-backend-icon--empty"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>

<style scoped>
.wd-backend-icon {
  display: inline-block;
  vertical-align: middle;
}
</style>
