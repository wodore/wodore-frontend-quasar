<script setup lang="ts">
/**
 * Opacity curve editor — the `opacity-curve` parameter widget.
 *
 * The parameter value is a parsed `["interpolate",["linear"],["zoom"],…]`
 * expression (stops kept read-only: zoom stops encode the fade-in
 * grammar; users tune the opacity at each stop).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OpacityCurve } from '@services/map-catalog';

const props = defineProps<{
  modelValue: OpacityCurve | undefined;
  label?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: OpacityCurve];
  reset: [];
}>();

const { t } = useI18n();

const FALLBACK_CURVE: OpacityCurve = { stops: [] };

const stops = computed(() => props.modelValue?.stops ?? FALLBACK_CURVE.stops);

function setStopOpacity(index: number, opacity: number): void {
  const next = stops.value.map((s, i) => (i === index ? { ...s, opacity } : s));
  emit('update:modelValue', { stops: next });
}
</script>

<template>
  <div class="wd-curve">
    <div v-if="label" class="text-caption wd-ink-soft-text q-mb-xs">{{ label }}</div>

    <div v-for="(stop, i) in stops" :key="i" class="row items-center no-wrap q-mb-xs">
      <div class="wd-curve__zoom text-caption text-weight-medium">{{ Math.round(stop.zoom) }}</div>
      <q-slider
        class="wd-curve__slider"
        :model-value="stop.opacity"
        :min="0"
        :max="1"
        :step="0.05"
        :label-value="stop.opacity.toFixed(2)"
        label-always
        dense
        color="primary"
        @update:model-value="(v: number | null) => v !== null && setStopOpacity(i, v)"
      />
    </div>

    <div class="row items-center q-mt-xs">
      <div class="wd-curve__axis text-caption wd-ink-soft-text">
        {{ t('overlay_config.curve_zoom') }}
      </div>
      <q-btn flat dense size="sm" :label="t('reset')" class="q-ml-auto" @click="emit('reset')" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wd-ink-soft-text {
  color: var(--wd-ink-soft) !important;
}

.wd-curve__zoom {
  width: 2rem;
  text-align: right;
  padding-right: 0.5rem;
  // Zoom stop as a small level marker
  color: var(--wd-ink-soft);
}

.wd-curve__slider {
  flex: 1;
}

.wd-curve__axis {
  padding-left: 2.5rem;
}
</style>
