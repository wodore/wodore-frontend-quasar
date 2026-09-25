<script setup lang="ts">
import { computed } from 'vue';
import type { NamedColor } from 'quasar';
import InlineSvg from 'vue-inline-svg';

const sizeDefaults: Record<string, number> = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 38,
  xl: 46,
};

const props = withDefaults(
  defineProps<{
    /** Size in CSS units, including unit name or standard size name (xs|sm|md|lg|xl) */
    size?: string;
    /** Icon name following Quasar convention, or an SVG URL (e.g. "icon.svg") */
    name?: string;
    /** Color name for component from the Quasar Color Palette, or a CSS color value */
    color?: NamedColor | string;
    /** HTML tag to render (only applies when rendering a QIcon) */
    tag?: string;
    /** Standard margin on the right side */
    left?: boolean;
    /** Standard margin on the left side */
    right?: boolean;
  }>(),
  {
    size: undefined,
    name: undefined,
    color: undefined,
    tag: 'i',
    left: false,
    right: false,
  }
);

/** Whether the name should be rendered as an inline SVG via vue-inline-svg */
const isInlineSvg = computed(() => {
  if (!props.name) return false;
  // Delegate img: prefix, icon names, etc. to QIcon
  if (props.name.startsWith('img:')) return false;
  // Only URLs ending in .svg or absolute paths get inlined
  if (!props.name.endsWith('.svg') && !props.name.startsWith('/')) return false;
  // Cross-origin SVGs are rendered as <img> (inline fetching is CORS-blocked
  // when the API host differs from the page origin, e.g. PR previews)
  if (props.name.startsWith('http://') || props.name.startsWith('https://')) {
    try {
      return new URL(props.name).origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return true;
});

/** The SVG source URL */
const svgSrc = computed(() => props.name ?? '');

/** Resolve size to CSS value (matches QIcon's font-size-based sizing) */
const sizeStyle = computed(() => {
  if (props.size === undefined) return null;
  const resolved = props.size in sizeDefaults ? `${sizeDefaults[props.size]}px` : props.size;
  return { fontSize: resolved };
});

/** Whether color is a raw CSS color (not a Quasar palette name) */
const isCssColor = computed(
  () => props.color !== undefined && /^(#|rgb|var|hsl)/.test(props.color)
);

/** For QIcon: cross-origin SVG URLs become img: so QIcon renders them as <img> */
const qIconName = computed(() => {
  if (!props.name) return props.name;
  if (props.name.startsWith('img:')) return props.name;
  if (
    props.name.endsWith('.svg') &&
    (props.name.startsWith('http://') || props.name.startsWith('https://'))
  ) {
    return 'img:' + props.name;
  }
  return props.name;
});

/** CSS classes for the wrapper */
const wrapperClass = computed(() => ({
  'wd-icon--left': props.left,
  'wd-icon--right': props.right,
  ...(props.color && !isCssColor.value ? { [`text-${props.color}`]: true } : {}),
}));

/** Inline styles for the wrapper */
const wrapperStyle = computed(() => ({
  ...sizeStyle.value,
  ...(isCssColor.value && props.color ? { color: props.color } : {}),
}));
</script>

<template>
  <i v-if="isInlineSvg && name" :class="['wd-icon q-icon', wrapperClass]" :style="wrapperStyle">
    <InlineSvg :src="svgSrc" />
  </i>
  <QIcon
    v-else
    :name="qIconName"
    :size="size"
    :color="isCssColor ? undefined : (color as NamedColor)"
    :tag="tag"
    :class="['wd-icon', wrapperClass]"
    :style="isCssColor && color ? { color } : undefined"
  >
    <slot />
  </QIcon>
</template>

<style lang="scss">
.wd-icon {
  &.q-icon > svg {
    width: 100%;
    height: 100%;
  }

  &--left {
    margin-right: 4px;
  }

  &--right {
    margin-left: 4px;
  }
}
</style>
