<script setup lang="ts">
/**
 * Legend Section Component
 *
 * Renders a legend section with items based on type.
 * Supports multiple rendering modes for symbols and geometric shapes.
 */

import type { LegendSection } from '@stores/map/overlay-configs/types';

interface Props {
  section: LegendSection;
}

defineProps<Props>();
</script>

<template>
  <div>
    <!-- Section Description -->
    <div v-if="section.description" class="text-caption text-grey-7 q-mb-md">
      {{ section.description }}
    </div>

    <!-- Legend Items -->
    <q-list class="transparent">
      <q-item v-for="(item, index) in section.items" :key="index" class="q-px-none">
        <q-item-section side>
          <!-- Symbol: Detailed Icon Only -->
          <template v-if="section.type === 'symbol_detailed'">
            <q-avatar v-if="item.metadata?.iconDetailed || item.icon" size="38px" square>
              <img :src="item.metadata?.iconDetailed || item.icon" :alt="item.label" />
            </q-avatar>
          </template>

          <!-- Symbol: Simple Icon Only -->
          <template v-else-if="section.type === 'symbol_simple'">
            <q-avatar v-if="item.metadata?.iconSimple || item.icon" size="28px" square>
              <img :src="item.metadata?.iconSimple || item.icon" :alt="item.label" />
            </q-avatar>
          </template>

          <!-- Symbol: Monochrome Icon Only -->
          <template v-else-if="section.type === 'symbol_mono'">
            <q-avatar v-if="item.metadata?.iconMono || item.icon" size="32px" square>
              <img :src="item.metadata?.iconMono || item.icon" :alt="item.label" />
            </q-avatar>
          </template>

          <!-- Symbol: Dual Icons (detailed + simple side-by-side) -->
          <template v-else-if="section.type === 'symbol_dual'">
            <div class="row items-center q-gutter-sm">
              <q-avatar v-if="item.metadata?.iconDetailed" size="38px" square>
                <img :src="item.metadata.iconDetailed" :alt="`${item.label} (detailed)`" />
              </q-avatar>

              <q-avatar v-if="item.metadata?.iconSimple" size="28px" square>
                <img :src="item.metadata.iconSimple" :alt="`${item.label} (simple)`" />
              </q-avatar>

              <!-- Fallback: Show color if icons not available -->
              <div
                v-if="!item.metadata?.iconDetailed && !item.metadata?.iconSimple && item.color"
                class="point-indicator"
                :style="{ backgroundColor: item.color }"
              />
            </div>
          </template>

          <!-- Line: Colored line -->
          <template v-else-if="section.type === 'line'">
            <div class="line-indicator" :style="{ backgroundColor: item.color || '#000' }" />
          </template>

          <!-- Area: Colored rectangle -->
          <template v-else-if="section.type === 'area'">
            <div class="area-indicator" :style="{ backgroundColor: item.color || '#000' }" />
          </template>

          <!-- Point: Colored circle -->
          <template v-else-if="section.type === 'point'">
            <div class="point-indicator" :style="{ backgroundColor: item.color || '#000' }" />
          </template>

          <!-- Fallback: Auto-detect based on available data -->
          <template v-else>
            <!-- Show icon if available -->
            <q-avatar
              v-if="item.icon || item.metadata?.iconDetailed || item.metadata?.iconSimple"
              size="32px"
              square
            >
              <img
                :src="(item.icon || item.metadata?.iconDetailed || item.metadata?.iconSimple) ?? ''"
                :alt="item.label"
              />
            </q-avatar>
            <!-- Otherwise show color point -->
            <div
              v-else-if="item.color"
              class="point-indicator"
              :style="{ backgroundColor: item.color }"
            />
          </template>
        </q-item-section>

        <!-- Item Label and Description -->
        <q-item-section>
          <q-item-label>{{ item.label }}</q-item-label>
          <q-item-label v-if="item.description" caption class="text-grey-7">
            {{ item.description }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<style scoped lang="scss">
.line-indicator {
  width: 40px;
  height: 3px;
  border-radius: 1.5px;
}

.area-indicator {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.point-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}
</style>
