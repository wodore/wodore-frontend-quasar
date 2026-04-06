<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export interface WdYearStripeRow {
  label?: string;
  icon?: string;
  color?: string;
  months: (number | undefined)[];
}

const props = withDefaults(
  defineProps<{
    rows: WdYearStripeRow[];
    selectedMonth?: number; // 1-12
    showIcon?: boolean;
    showLabel?: boolean;
    stacked?: boolean;
  }>(),
  {
    selectedMonth: undefined,
    showIcon: false,
    showLabel: false,
    stacked: false,
  }
);

const { t } = useI18n();

const monthLabels = computed(() => [
  t('jan'),
  t('feb'),
  t('mar'),
  t('apr'),
  t('may'),
  t('jun'),
  t('jul'),
  t('aug'),
  t('sep'),
  t('oct'),
  t('nov'),
  t('dec'),
]);

const hasData = computed(() => props.rows.some(row => row.months.some(v => v !== undefined)));

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lighten(hex: string, amount: number = 0.5): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function cellClass(value: number | undefined) {
  if (value === undefined) return 'wd-year-stripe__cell--unknown';
  return '';
}

function cellStyle(color: string | undefined, value: number | undefined) {
  if (value === undefined || !color) {
    return {};
  }
  const light = lighten(color, 0.2);
  const lightEmpty = lighten(color, 0.7);
  if (value === 0) {
    return { backgroundColor: lightEmpty };
  }
  if (value >= 100) {
    return { backgroundColor: color };
  }
  // Cap at 70% so stripes don't get too thick at 75%
  const capped = Math.min(value, 70);
  const stripePx = Math.round((capped / 100) * 10);
  const gapPx = 10 - stripePx;
  return {
    backgroundColor: light,
    backgroundImage: `repeating-linear-gradient(
      -45deg,
      ${color} 0,
      ${color} ${stripePx}px,
      transparent ${stripePx}px,
      transparent ${stripePx + gapPx}px
    )`,
  };
}

// Stacked: merge all rows into one, using the first row's color for cells
// where row[0] has the highest value, row[1] color otherwise
function stackedStyle(monthIndex: number) {
  if (props.rows.length === 0) return {};
  const values = props.rows.map(row => ({
    value: row.months[monthIndex],
    color: row.color,
  }));
  // Find the dominant row (highest value, ignore undefined)
  const defined = values.filter(v => v.value !== undefined);
  if (defined.length === 0) return {};
  const dominant = defined.reduce((a, b) => ((a.value ?? 0) > (b.value ?? 0) ? a : b));
  return cellStyle(dominant.color, dominant.value);
}

function stackedClass(monthIndex: number) {
  const allUndefined = props.rows.every(row => row.months[monthIndex] === undefined);
  if (allUndefined) return 'wd-year-stripe__cell--unknown';
  return '';
}
</script>

<template>
  <div v-if="hasData" class="wd-year-stripe q-mb-sm">
    <!-- Month labels -->
    <div class="wd-year-stripe__months">
      <div v-if="showIcon" class="wd-year-stripe__spacer" />
      <div
        v-for="(label, i) in monthLabels"
        :key="i"
        class="wd-year-stripe__month-label"
        :class="{ 'wd-year-stripe__month-label--active': selectedMonth === i + 1 }"
      >
        {{ label }}
      </div>
    </div>
    <!-- Stacked: single merged row -->
    <div v-if="stacked" class="wd-year-stripe__row">
      <div
        v-for="(_, mi) in monthLabels"
        :key="mi"
        class="wd-year-stripe__cell wd-year-stripe__cell--stacked"
        :class="stackedClass(mi)"
        :style="stackedStyle(mi)"
      />
    </div>
    <!-- Normal: one row per entry -->
    <div v-for="(row, ri) in rows" v-else :key="ri" class="wd-year-stripe__row">
      <div v-if="showIcon" class="wd-year-stripe__icon">
        <q-icon v-if="row.icon" :name="row.icon" size="14px" class="wd-year-stripe__icon-img" />
      </div>
      <div
        v-for="(value, mi) in row.months"
        :key="mi"
        class="wd-year-stripe__cell"
        :class="cellClass(value)"
        :style="cellStyle(row.color, value)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wd-year-stripe {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wd-year-stripe__months {
  display: flex;
  gap: 2px;
  align-items: center;
}

.wd-year-stripe__spacer {
  width: 18px;
  flex-shrink: 0;
}

.wd-year-stripe__month-label {
  flex: 1;
  text-align: center;
  font-size: 0.5rem;
  color: #aaa;
  line-height: 1;
  padding-bottom: 1px;

  &--active {
    color: #346751;
    font-weight: 700;
  }
}

.wd-year-stripe__row {
  display: flex;
  gap: 2px;
  align-items: center;
}

.wd-year-stripe__icon {
  width: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wd-year-stripe__icon-img {
  color: #777;
}

.wd-year-stripe__cell {
  flex: 1;
  height: 8px;
  border-radius: 3px;
  border: 1px solid #ccc;
}

.wd-year-stripe__cell--stacked {
  height: 12px;
}

.wd-year-stripe__cell--unknown {
  background:
    linear-gradient(
      to top right,
      transparent calc(50% - 1px),
      rgba(0, 0, 0, 0.15) calc(50% - 1px),
      rgba(0, 0, 0, 0.15) calc(50% + 1px),
      transparent calc(50% + 1px)
    ),
    linear-gradient(
      to bottom right,
      transparent calc(50% - 1px),
      rgba(0, 0, 0, 0.15) calc(50% - 1px),
      rgba(0, 0, 0, 0.15) calc(50% + 1px),
      transparent calc(50% + 1px)
    );
}
</style>
