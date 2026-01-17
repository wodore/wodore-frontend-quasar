<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';

const $q = useQuasar();

interface AvailabilityDay {
  date: string;
  reservation_status: string;
  free: number;
  total: number;
  occupancy_percent: number;
  occupancy_steps: number;
  occupancy_status: 'empty' | 'low' | 'medium' | 'high' | 'full';
  hut_type: string;
  link: string;
}

interface Props {
  day: AvailabilityDay;
}

const props = defineProps<Props>();

// Format date for display (e.g., "Mo")
const formattedDate = computed(() => {
  const date = new Date(props.day.date);
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return dayNames[date.getDay()];
});

// Format date as dd.mm
const formattedDay = computed(() => {
  const date = new Date(props.day.date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
});

// Calculate the height of the occupied portion based on occupancy_percent
// occupancy_percent might be 0-1 or 0-100, so we normalize it
const occupiedHeight = computed(() => {
  let occupiedRatio = props.day.occupancy_percent;

  // If occupancy_percent is already 0-100, convert to 0-1
  if (occupiedRatio > 1) {
    occupiedRatio = occupiedRatio / 100;
  }

  const occupiedPercent = Math.max(0, Math.min(1, occupiedRatio)) * 100;
  return `${occupiedPercent}%`;
});

// Determine if bar is full (no radius needed)
const isFull = computed(() => {
  return props.day.occupancy_status === 'full';
});

// Bar radius style - should be half the bar width (24px / 2 = 12px)
const barRadius = computed(() => {
  return isFull.value ? '0' : '12px 12px 0 0';
});

// Determine bar color based on occupancy_status
const barColor = computed(() => {
  switch (props.day.occupancy_status) {
    case 'full':
      return '#d32f2f'; // red
    case 'high':
      return '#ffa726'; // orange
    case 'medium':
      return '#99cc33'; // yellow-green
    case 'low':
      return '#33ff33'; // green
    case 'empty':
      return '#33ff33'; // green
    default:
      return '#333333'; // unknown - gray
  }
});

// Lighter version for background (30% opacity)
const barColorLight = computed(() => {
  switch (props.day.occupancy_status) {
    case 'full':
      return 'rgba(211, 47, 47, 0.3)'; // red with 30% opacity
    case 'high':
      return 'rgba(255, 167, 38, 0.3)'; // orange with 30% opacity
    case 'medium':
      return 'rgba(153, 204, 51, 0.3)'; // yellow-green with 30% opacity
    case 'low':
      return 'rgba(51, 255, 51, 0.3)'; // green with 30% opacity
    case 'empty':
      return 'rgba(51, 255, 51, 0.3)'; // green with 30% opacity
    default:
      return 'rgba(51, 51, 51, 0.3)'; // gray with 30% opacity
  }
});

// Determine text color based on background darkness
const textColor = computed(() => {
  // For darker backgrounds (red, dark colors), use white text
  // For lighter backgrounds (green, yellow), use dark text
  switch (props.day.occupancy_status) {
    case 'full':
      return '#ffffff'; // white for dark red
    case 'high':
      return '#000000'; // black for orange
    case 'medium':
      return '#000000'; // black for yellow-green
    case 'low':
      return '#000000'; // black for bright green
    case 'empty':
      return '#000000'; // black for bright green
    default:
      return '#ffffff'; // white for gray
  }
});

// Mixed color for header (blend of light and dark)
const headerColor = computed(() => {
  switch (props.day.occupancy_status) {
    case 'full':
      return 'rgba(211, 47, 47, 0.65)'; // 65% red
    case 'high':
      return 'rgba(255, 167, 38, 0.65)'; // 65% orange
    case 'medium':
      return 'rgba(153, 204, 51, 0.65)'; // 65% yellow-green
    case 'low':
      return 'rgba(51, 255, 51, 0.65)'; // 65% green
    case 'empty':
      return 'rgba(51, 255, 51, 0.65)'; // 65% green
    default:
      return 'rgba(51, 51, 51, 0.65)'; // 65% gray
  }
});

const isMobile = computed(() => $q.screen.xs);
</script>

<style scoped lang="scss">
.card {
  width: 100%;
  min-width: 28px;
  height: 100%;
}

.header {
  width: 100%;
  padding: 2px 4px;
}

.bar-wrapper {
  width: 100%;
  height: 48px;
  position: relative;
  overflow: visible;
  background-color: transparent;
  display: flex;
  justify-content: center;
}

.bar-bg {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.bar-occupied {
  width: 24px;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 -1px 3px rgba(0, 0, 0, 0.03));
}
</style>

<template>
  <div class="card column items-center overflow-hidden">
    <div class="header text-center column justify-center" :style="{ backgroundColor: headerColor, color: textColor }">
      <div class="text-caption">{{ formattedDate }}</div>
      <div style="font-size: 9px; line-height: 1">{{ formattedDay }}</div>
    </div>
    <div class="bar-wrapper">
      <!-- Free beds (background, light color) -->
      <div class="bar-bg" :style="{ backgroundColor: barColorLight }"></div>
      <!-- Occupied beds (overlay, dark color) -->
      <div class="bar-occupied" :style="{ backgroundColor: barColor, height: occupiedHeight, borderRadius: barRadius }">
      </div>
    </div>
    <div class="text-caption text-grey-7" style="font-size: 11px; padding: 2px 0">
      {{ day.free }}/{{ day.total }}
    </div>
  </div>
</template>
