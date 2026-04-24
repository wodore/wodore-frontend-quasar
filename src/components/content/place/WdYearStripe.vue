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
  // Background gets progressively darker with higher value
  // 0% → very light (0.7 lightened), 100% → full color
  const lightAmount = 0.7 - (value / 100) * 0.7; // 0.7 at 0%, 0 at 100%
  const bg = lighten(color, Math.max(0, lightAmount));
  if (value === 0) {
    return { backgroundColor: bg };
  }
  if (value >= 100) {
    return { backgroundColor: color };
  }
  // Stripes: proportional thickness, use lightened color softened to 85%
  const stripeColor = lighten(color, lightAmount * 0.5);
  const capped = Math.min(value, 70);
  const stripePx = Math.round((capped / 100) * 10);
  const gapPx = 10 - stripePx;
  return {
    backgroundColor: bg,
    backgroundImage: `repeating-linear-gradient(
      -45deg,
      ${stripeColor} 0,
      ${stripeColor} ${stripePx}px,
      transparent ${stripePx}px,
      transparent ${stripePx + gapPx}px
    )`,
  };
}

interface StackedSegment {
  value: number;
  color: string;
}

function stackedSegments(monthIndex: number): StackedSegment[] {
  const segments: StackedSegment[] = [];
  for (const row of props.rows) {
    const v = row.months[monthIndex];
    if (v !== undefined && v > 0 && row.color) {
      segments.push({ value: v, color: row.color });
    }
  }
  return segments;
}

function stackedCellStyle(monthIndex: number) {
  const segments = stackedSegments(monthIndex);
  if (segments.length === 0) return {};

  const totalRaw = segments.reduce((sum, s) => sum + s.value, 0);

  // Single type at 100%+ with no others → solid fill
  if (segments.length === 1 && segments[0].value >= 100) {
    return { backgroundColor: segments[0].color };
  }

  // Normalize if sum > 100
  const normalized: StackedSegment[] =
    totalRaw > 100
      ? segments.map(s => ({ value: (s.value / totalRaw) * 100, color: s.color }))
      : segments;

  const totalNorm = normalized.reduce((sum, s) => sum + s.value, 0);
  const basePx = 10;
  const cyclePx = basePx; // total cycle width in pixels

  // Build one repeating-linear-gradient with all colors in sequence
  const colorStops: string[] = [];
  let offset = 0;
  for (const seg of normalized) {
    const width = (seg.value / 100) * cyclePx;
    colorStops.push(`${seg.color} ${offset}px`);
    offset += width;
    colorStops.push(`${seg.color} ${offset}px`);
  }

  // Gray remainder if sum < 100
  const remainder = 100 - totalNorm;
  if (remainder > 0) {
    const grayWidth = (remainder / 100) * cyclePx;
    colorStops.push(`#e0e0e0 ${offset}px`);
    offset += grayWidth;
    colorStops.push(`#e0e0e0 ${offset}px`);
  }

  return {
    backgroundImage: `repeating-linear-gradient(-45deg, ${colorStops.join(', ')})`,
  };
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
        :style="stackedCellStyle(mi)"
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
  height: 8px;
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
