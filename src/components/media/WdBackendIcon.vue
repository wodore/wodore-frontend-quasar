<!-- One glyph from the backend icon library: slug → resolved, HTTP-cached SVG. -->
<script setup lang="ts">
import { ref, watch } from 'vue';

import { DEFAULT_ICON_PACK, getBackendIconUrl, type BackendIconStyle } from '@services/icons';

const props = withDefaults(
  defineProps<{
    /** Icon slug within the pack (stored group icons are bare slugs). */
    slug: string;
    /** Pre-resolved asset URL (e.g. from a search result) — skips lookup. */
    url?: string | null;
    pack?: string;
    /** Asset style: detailed=Color, simple=Flat, mono=High Contrast. */
    variant?: BackendIconStyle;
    size?: number;
  }>(),
  {
    url: null,
    pack: DEFAULT_ICON_PACK,
    variant: 'simple',
    size: 20,
  },
);

const resolvedUrl = ref<string | null>(props.url ?? null);
let requestSeq = 0;

watch(
  () => [props.slug, props.pack, props.variant, props.url] as const,
  async ([slug, pack, variant, url]) => {
    const seq = ++requestSeq;
    if (url) {
      resolvedUrl.value = url;
      return;
    }
    if (!slug) {
      resolvedUrl.value = null;
      return;
    }
    const found = await getBackendIconUrl(slug, variant, pack);
    if (seq === requestSeq) resolvedUrl.value = found;
  },
  { immediate: true },
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
       slugs that no longer resolve) -->
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
