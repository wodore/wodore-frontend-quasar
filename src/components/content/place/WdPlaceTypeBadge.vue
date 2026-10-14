<script setup lang="ts">
import { computed } from 'vue';

import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';

interface Props {
  /** Category color (hex) — drives border, background tint and icon tint */
  color?: string;
  /** Explicit background override (wins over the derived tint) */
  bgColor?: string;
  /** Category identifier `{parent}.{slug}` for the mono icon */
  iconIdentifier?: string;
  /** Direct mono symbol URL from an API response (wins over identifier) */
  iconHref?: string | null;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  color: '#346751',
  bgColor: undefined,
  iconIdentifier: undefined,
  iconHref: undefined,
  label: undefined,
});

// Expose the category color as a custom property — background tint and icon
// tint derive from it via color-mix, so both adapt to light/dark surfaces.
const badgeStyle = computed(() => ({
  '--badge-color': props.color,
  ...(props.bgColor ? { backgroundColor: props.bgColor } : {}),
}));
</script>

<template>
  <div class="wd-info-badge" :style="badgeStyle">
    <WdCategoryIcon
      v-if="iconIdentifier || iconHref"
      class="wd-info-badge__icon"
      :identifier="iconIdentifier ?? 'accommodation.unknown'"
      :href="iconHref"
      variant="mono"
      :size="24"
    />
    <div class="wd-info-badge__text">
      <div v-if="label" class="wd-info-badge__label">
        {{ label }}
      </div>
      <div class="wd-info-badge__content">
        <slot />
      </div>
    </div>
    <slot name="append" />
  </div>
</template>

<style lang="scss" scoped>
.wd-info-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 6px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-left: 6px solid;
  border-left-color: var(--badge-color);
  // Tint mixes toward the themed surface — light and dark both stay subtle
  background: color-mix(in srgb, var(--badge-color) 10%, var(--wd-surface));
  border-radius: 4px;
}

// Mono icon tint: deepened toward ink on light surfaces, lifted toward white
// on dark surfaces — keeps contrast in both modes.
.wd-info-badge__icon {
  color: color-mix(in srgb, var(--badge-color) 78%, var(--wd-ink));
}

.wd-info-badge__icon {
  flex-shrink: 0;
}

.wd-info-badge__text {
  min-width: 0;
  line-height: 1;
  flex: 1;
}

.wd-info-badge__label {
  font-size: 0.5rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--wd-ink);
  line-height: 1;
}

.wd-info-badge__content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--wd-ink-soft);
  font-size: 0.8rem;
  line-height: 1.2;
}

// Dark mode: stronger background tint for visibility, lighter icon tint
:global(body.body--dark) .wd-info-badge {
  background: color-mix(in srgb, var(--badge-color) 16%, var(--wd-surface));
  border-color: rgba(255, 255, 255, 0.09);
}

:global(body.body--dark) .wd-info-badge__icon {
  color: color-mix(in srgb, var(--badge-color) 55%, white);
}
</style>
