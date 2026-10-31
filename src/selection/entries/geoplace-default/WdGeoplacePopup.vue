<script setup lang="ts">
/**
 * geoplace-default popup — the fail-open content for ANY geoplace target
 * that matches nothing more specific (unknown domains/kinds render
 * generically from payload fields; new backend kinds work
 * automatically). Props-ONLY: no fetch on the open path; the localized
 * name is picked at RENDER time so a mid-session language switch
 * re-renders the open popup (place-popup spec).
 */
import { computed } from 'vue';
import type { MapTarget } from '@selection/types';

const props = defineProps<{ target: MapTarget }>();

const p = computed(() => props.target.props as Record<string, unknown>);

/** Kind symbol chain (same as the search rows): wire symbol → category
 *  icon → domain tier fallback. */
const kindSymbolUrl = computed(() => {
  const symbol = p.value.kind as { symbol?: Record<string, string> } | undefined;
  return symbol?.symbol?.color ?? null;
});
const kindIdentifier = computed(() => {
  const kind = p.value.kind as { identifier?: string } | undefined;
  return kind?.identifier ?? '';
});
const kindName = computed(() => {
  const kind = p.value.kind as { name?: string } | undefined;
  return kind?.name ?? null;
});
const elevation = computed(() =>
  typeof p.value.elevation === 'number' ? p.value.elevation : null
);
/** Short description snippet — one line, clamp to keep the card tight. */
const description = computed(() => {
  const raw = p.value.description;
  if (typeof raw !== 'string' || !raw) return null;
  return raw.length > 90 ? `${raw.slice(0, 90).trimEnd()}…` : raw;
});
</script>

<template>
  <div class="wd-gp-popup">
    <div class="row items-center q-gutter-x-sm">
      <img
        v-if="kindSymbolUrl"
        :src="kindSymbolUrl"
        alt=""
        width="28"
        height="28"
        style="object-fit: contain"
      />
      <span v-else-if="kindIdentifier" class="wd-gp-popup__tier wd-gp-popup__tier--kind">
        {{ kindIdentifier.split('.')[1] ?? kindIdentifier }}
      </span>
    </div>
    <p v-if="kindName || elevation" class="wd-gp-popup__meta q-mb-none">
      <span v-if="kindName">{{ kindName }}</span>
      <span v-if="kindName && elevation"> · </span>
      <span v-if="elevation">{{ elevation }} m</span>
    </p>
    <p v-if="description" class="wd-gp-popup__desc q-mb-none">{{ description }}</p>
  </div>
</template>

<style lang="scss" scoped>
.wd-gp-popup {
  font-size: 13px;
  line-height: 1.35;
  padding-top: 2px;
}

.wd-gp-popup__meta {
  color: var(--wd-ink-soft, #5c5c5c);
  font-size: 12px;
}

.wd-gp-popup__desc {
  margin-top: 4px;
}

.wd-gp-popup__tier {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
