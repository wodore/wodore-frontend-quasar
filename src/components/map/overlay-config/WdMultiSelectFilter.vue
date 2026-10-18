<script setup lang="ts">
/**
 * Multi-Select Filter Component
 *
 * Displays a list of checkboxes for multi-select filtering.
 * Includes Select All / Deselect All functionality.
 */

import { computed, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import type { FilterDefinition } from '@stores/map/overlay-configs/types';

interface Props {
  overlayName: string;
  filter: FilterDefinition;
  modelValue: unknown;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:modelValue', value: string[]): void;
}

const emit = defineEmits<Emits>();

const selectedValues = computed<string[]>({
  get: () => {
    const val = props.modelValue as string[] | undefined;
    // No preference yet = all selected (the "no filter" state). An
    // EMPTY array is meaningful: nothing selected (Deselect all) — it
    // must NOT snap back to all-selected.
    if (val === undefined || val === null) {
      return props.filter.options?.map(opt => opt.value as string) || [];
    }
    return val;
  },
  set: newValue => emit('update:modelValue', newValue),
});

const allOptions = computed(() => props.filter.options || []);
const allSelected = computed(() => selectedValues.value.length === allOptions.value.length);

// Info popover state: the option whose popover is open (one at a time).
// Controlled via v-model so it can be closed programmatically — Quasar
// menus do not track ancestor scroll and would visually detach from
// their row when the options list scrolls.
const openInfoKey = ref<string | null>(null);

// Any scroll intent closes the open popover before it detaches.
// Capture phase: the surrounding scroll containers intercept native
// scroll events, but wheel/touchmove still surface here.
useEventListener(document, 'wheel', () => (openInfoKey.value = null), { capture: true });
useEventListener(document, 'touchmove', () => (openInfoKey.value = null), { capture: true });

function toggleAll() {
  if (allSelected.value) {
    // Deselect all
    selectedValues.value = [];
  } else {
    // Select all
    selectedValues.value = allOptions.value.map(opt => opt.value as string);
  }
}

function toggleOption(value: string) {
  const index = selectedValues.value.indexOf(value);
  if (index > -1) {
    // Remove from selection
    selectedValues.value = selectedValues.value.filter(v => v !== value);
  } else {
    // Add to selection
    selectedValues.value = [...selectedValues.value, value];
  }
}
</script>

<template>
  <div class="multiselect-filter">
    <!-- Filter label and Select All toggle -->
    <div class="filter-header">
      <div class="text-subtitle2">{{ filter.label }}</div>
      <q-btn
        flat
        dense
        size="sm"
        :label="allSelected ? $t('multi_select.deselect_all') : $t('multi_select.select_all')"
        color="primary"
        @click="toggleAll"
        class="select-all-btn"
      />
    </div>

    <!-- Selection count -->
    <div class="text-caption wd-ink-soft-text q-mb-sm">
      <span v-if="allSelected">{{ $t('multi_select.no_filter_active') }}</span>
      <span v-else>{{
        $t('multi_select.selected_count', {
          selected: selectedValues.length,
          total: allOptions.length,
        })
      }}</span>
    </div>

    <!-- Options list -->
    <q-list dense class="options-list bg-transparent">
      <q-item
        v-for="option in allOptions"
        :key="option.value"
        clickable
        class="option-item"
        :class="{ 'option-inactive': !selectedValues.includes(option.value as string) }"
        @click="toggleOption(option.value as string)"
      >
        <q-item-section avatar v-if="option.iconColor || option.iconPrimitive">
          <q-avatar size="32px" square class="icon-container">
            <img :src="option.iconColor || option.iconPrimitive" :alt="option.label" class="icon-img" />
          </q-avatar>
        </q-item-section>

        <q-item-section>
          <q-item-label
            :class="{ 'text-weight-bold': selectedValues.includes(option.value as string) }"
            >{{ option.label }}</q-item-label
          >
        </q-item-section>

        <q-item-section side v-if="option.description">
          <q-btn
            flat
            round
            dense
            size="sm"
            icon="wd-info-outline"
            class="wd-filter-info-btn"
            :aria-label="$t('multi_select.info')"
            :aria-expanded="openInfoKey === option.value"
            :aria-describedby="
              openInfoKey === option.value ? 'wd-filter-info-desc-' + option.value : undefined
            "
            @click.stop
          >
            <q-menu
              :model-value="openInfoKey === option.value"
              anchor="top right"
              self="top left"
              :offset="[8, 0]"
              class="wd-filter-info"
              @update:model-value="
                (open: boolean) => (openInfoKey = open ? option.value : null)
              "
            >
              <div class="wd-filter-info__head">
                <img
                  v-if="option.iconColor"
                  :src="option.iconColor"
                  :alt="option.label"
                  class="wd-filter-info__icon"
                />
                <div class="wd-filter-info__title">{{ option.label }}</div>
              </div>
              <p :id="'wd-filter-info-desc-' + option.value" class="wd-filter-info__desc">
                {{ option.description }}
              </p>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped lang="scss">
.wd-ink-soft-text {
  color: var(--wd-ink-soft) !important;
}
.multiselect-filter {
  margin-bottom: 16px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.select-all-btn {
  margin-left: auto;
  min-height: 24px;
  padding: 2px 8px;
}

.options-list {
  height: 100%;
  overflow-y: auto;
}

.option-item {
  min-height: 40px;
  padding: 4px 8px;
  transition: opacity 0.2s ease;
}

.option-inactive {
  opacity: 0.5;
}

.option-inactive img {
  filter: grayscale(100%);
}

.icon-container {
  position: relative;
  overflow: hidden;
}

.icon-img {
  display: block;
  width: 100%;
  height: 100%;
}

// ≥40px glove target (DESIGN.md) without enlarging the glyph: the
// ::after extends the clickable area beyond the visual ~28px circle.
.wd-filter-info-btn {
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: -8px;
  }
}
</style>

<style lang="scss">
/* The info popover TELEPORTS to <body> — scoped styles cannot reach it
   (same pattern as WdOverlayControl's .wd-ovl__menu). It floats OVER
   same-tone panel content (the config card body is --wd-surface too),
   so separation needs the detached-chrome soft shadow — the same value
   as the .wd-ovl__menu sibling; !important overrides the global .q-menu
   unset ("dark-mode elevation kill escape"). Panel tokens (surface /
   ridge) are correct here (floats over a panel, not the map — unlike
   .wd-ovl__menu's --wd-ctl-* chrome tokens). Both lighting conditions
   come along via the themed custom properties. */
.wd-filter-info {
  background: var(--wd-surface) !important; // q-menu defaults are unset globally
  border: 1px solid var(--wd-ridge);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(10, 20, 15, 0.18) !important;
  padding: 12px;
  min-width: 200px;
  max-width: 260px;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__icon {
    width: 24px;
    height: 24px;
    flex: none;
  }

  &__title {
    font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--wd-ink);
  }

  &__desc {
    margin: 8px 0 0;
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--wd-ink-soft);
  }
}
</style>
