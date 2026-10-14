<script setup lang="ts">
/**
 * Category icon renderer — displays a category symbol by identifier and variant.
 *
 * For `mono`, the SVG is fetched and rendered INLINE so `currentColor`
 * resolves from the component's CSS `color` (settable via the `color` prop).
 * For `color` and `primitive`, the SVG has baked-in colors and renders
 * as a plain `<img>`.
 *
 * SVGs are cached per-URL (a module-level Map) so repeated icons in a list
 * fetch only once.
 */
import { computed, ref, watch } from 'vue';

import { getEnv } from '@services/runtimeEnv';

interface Props {
  /** Category identifier: `{parent}.{slug}` (e.g. `accommodation.hut`) */
  identifier: string;
  /**
   * Direct symbol URL from an API response (e.g. `type.symbol.mono`).
   * Always wins over `identifier` when set — better caching, no redirect.
   */
  href?: string | null;
  /** Symbol variant: `color` | `mono` | `primitive` */
  variant?: 'color' | 'mono' | 'primitive';
  /** Icon size in px */
  size?: number;
  /** Tint color for `mono` (CSS color string; ignored for color/primitive) */
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  href: undefined,
  variant: 'mono',
  size: 24,
  color: undefined,
});

// ---- SVG cache (module-level, shared across all instances) ----
const svgCache = new Map<string, string | null>();

async function fetchSvg(url: string): Promise<string | null> {
  if (svgCache.has(url)) return svgCache.get(url) ?? null;
  try {
    const res = await window.fetch(url);
    if (!res.ok) return null;
    const svg = await res.text();
    svgCache.set(url, svg);
    return svg;
  } catch {
    svgCache.set(url, null);
    return null;
  }
}

// ---- Inline SVG for mono (currentColor needs inline rendering) ----
const inlineSvg = ref<string | null>(null);
const svgUrl = computed(() => {
  // Direct URL from an API response always wins (better caching, no redirect)
  if (props.href) return props.href;
  // Symbol endpoint URL schema (fetch/img follow its 302 to media):
  // /v1/categories/symbol/{variant}/{parent}/{slug}.svg
  // 'accommodation.hut' → parent 'accommodation', slug 'hut'
  const [parent, ...rest] = props.identifier.split('.');
  const slug = rest.join('.') || parent;
  return `${getEnv('WODORE_API_HOST')}/v1/categories/symbol/${props.variant}/${parent}/${slug}.svg`;
});

watch(
  () => svgUrl.value,
  async url => {
    if (props.variant === 'mono') {
      inlineSvg.value = await fetchSvg(url);
    } else {
      inlineSvg.value = null;
    }
  },
  { immediate: true }
);

// For non-mono variants, use the img URL directly from the API
const imgSrc = computed(() => {
  if (props.variant === 'mono') return undefined;
  return svgUrl.value;
});

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  ...(props.variant === 'mono' && props.color ? { color: props.color } : {}),
}));
</script>

<template>
  <!-- Mono: inline SVG so currentColor tints correctly -->
  <span
    v-if="variant === 'mono' && inlineSvg"
    class="wd-cat-icon"
    :style="style"
    v-html="inlineSvg"
  />
  <!-- Color/Primitive: baked colors, render as img -->
  <img v-else-if="imgSrc" class="wd-cat-icon" :src="imgSrc" :style="style" :alt="identifier" />
  <!-- Fallback: empty placeholder maintaining size -->
  <span v-else class="wd-cat-icon wd-cat-icon--empty" :style="style" />
</template>

<style scoped>
.wd-cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}
.wd-cat-icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.wd-cat-icon--empty {
  border-radius: 50%;
  background: #e0e0e0;
  opacity: 0.3;
}
</style>
