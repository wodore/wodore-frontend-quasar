<script setup lang="ts">
/**
 * Overlay settings panel — renders one control per backend catalog
 * parameter (services/map-catalog.ts): sliders/pickers/toggles for
 * scalars, the curve editor for `opacity-curve`, an info note for
 * runtime-scope `date` parameters (the map date picker drives them).
 *
 * Values persist through the map catalog store (localStorage) and
 * re-resolve the layer's paint live — no style reload.
 */
import { computed } from 'vue';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useMapCatalogStore } from '@stores/map/map-catalog-store';
import type { MapLayerParameter, OpacityCurve } from '@services/map-catalog';
import WdOpacityCurveEditor from './WdOpacityCurveEditor.vue';

const props = defineProps<{
  overlayName: string;
}>();

const overlayStore = useOverlayStore();
const catalogStore = useMapCatalogStore();

// SAFETY: same widened cast as WdOverlayControl — the overlay store's
// real shape is { overlays: OverlaySwitchItem[] }; only .parameters is read.
const parameters = computed(
  () =>
    (
      overlayStore as unknown as {
        overlays: Array<{ name: string; parameters?: MapLayerParameter[] }>;
      }
    ).overlays.find(o => o.name === props.overlayName)?.parameters ?? []
);

type ScalarOption = { value: string; label: string };

// Typed accessors — template expressions stay cast-free (the `as` casts
// live here where the eslint Vue parser cannot misread them).
function curveValue(param: MapLayerParameter): OpacityCurve | undefined {
  const value = catalogStore.getParameterValue(props.overlayName, param.slug);
  return typeof value === 'object' && value !== null ? value : undefined;
}
function numberValue(param: MapLayerParameter): number | undefined {
  const value = catalogStore.getParameterValue(props.overlayName, param.slug);
  return typeof value === 'number' ? value : undefined;
}
function boolValue(param: MapLayerParameter): boolean | undefined {
  const value = catalogStore.getParameterValue(props.overlayName, param.slug);
  return typeof value === 'boolean' ? value : undefined;
}
function stringValue(param: MapLayerParameter): string | undefined {
  const value = catalogStore.getParameterValue(props.overlayName, param.slug);
  return typeof value === 'string' ? value : undefined;
}

function enumOptions(param: MapLayerParameter): ScalarOption[] {
  const raw = (param.constraints?.options ?? []) as Array<string | ScalarOption>;
  return raw.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
}

function numberMin(param: MapLayerParameter): number {
  const min = (param.constraints?.min as number | undefined) ?? 0;
  return typeof min === 'number' ? min : 0;
}

function numberMax(param: MapLayerParameter): number {
  const max = (param.constraints?.max as number | undefined) ?? 1;
  return typeof max === 'number' ? max : 1;
}

function numberStep(param: MapLayerParameter): number {
  const step = (param.constraints?.step as number | undefined) ?? 0.05;
  return typeof step === 'number' && step > 0 ? step : 0.05;
}
</script>

<template>
  <div v-if="parameters.length === 0" class="text-body2 wd-ink-soft-text">
    {{ $t('overlay_config.settings_placeholder') }}
  </div>

  <div v-else class="q-gutter-md">
    <div v-for="param in parameters" :key="param.slug">
      <!-- label + description -->
      <div class="text-subtitle2">{{ param.label || param.slug }}</div>
      <div v-if="param.description" class="text-caption wd-ink-soft-text q-mb-sm">
        {{ param.description }}
      </div>

      <!-- opacity curve -->
      <WdOpacityCurveEditor
        v-if="param.kind === 'opacity-curve'"
        :model-value="curveValue(param)"
        @update:model-value="(v: OpacityCurve) => catalogStore.setParameterValue(overlayName, param.slug, v)"
        @reset="catalogStore.resetLayerParameters(overlayName)"
      />

      <!-- number slider -->
      <q-slider
        v-else-if="param.kind === 'number'"
        :model-value="numberValue(param) ?? numberMin(param)"
        :min="numberMin(param)"
        :max="numberMax(param)"
        :step="numberStep(param)"
        :label-value="String(numberValue(param) ?? '')"
        label-always
        dense
        color="primary"
        @update:model-value="(v: number | null) => v !== null && catalogStore.setParameterValue(overlayName, param.slug, v)"
      />

      <!-- boolean toggle -->
      <q-toggle
        v-else-if="param.kind === 'boolean'"
        :model-value="boolValue(param) ?? false"
        color="primary"
        dense
        @update:model-value="(v: boolean) => catalogStore.setParameterValue(overlayName, param.slug, v)"
      />

      <!-- enum select -->
      <q-select
        v-else-if="param.kind === 'enum'"
        :model-value="stringValue(param)"
        :options="enumOptions(param)"
        emit-value
        map-options
        dense
        outlined
        color="primary"
        @update:model-value="(v: unknown) => v !== null && catalogStore.setParameterValue(overlayName, param.slug, String(v))"
      />

      <!-- color picker -->
      <q-color
        v-else-if="param.kind === 'color'"
        :model-value="stringValue(param) ?? ''"
        no-header
        no-footer
        default-view="palette"
        class="wd-color-picker"
        @update:model-value="(v: string | null) => v && catalogStore.setParameterValue(overlayName, param.slug, v)"
      />

      <!-- runtime date: driven by the map date picker -->
      <div v-else-if="param.kind === 'date'" class="text-caption wd-ink-soft-text">
        {{ $t('overlay_config.settings_date_hint') }}
      </div>

      <!-- plain string -->
      <q-input
        v-else
        :model-value="stringValue(param) ?? ''"
        dense
        outlined
        @update:model-value="(v: string | number | null) => v !== null && catalogStore.setParameterValue(overlayName, param.slug, String(v))"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.wd-ink-soft-text {
  color: var(--wd-ink-soft) !important;
}

.wd-color-picker {
  max-width: 260px;
  border-radius: 8px;
}
</style>
