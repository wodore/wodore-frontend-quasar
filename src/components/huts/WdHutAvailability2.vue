<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
  loading?: boolean;
}

interface Props {
  day: AvailabilityDay;
  isSelected?: boolean;
  isToday?: boolean;
}

const props = defineProps<Props>();

// Check if in loading state
const isLoadingState = computed(() => props.day.loading === true);

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
// Uses a formula that exaggerates low values and dampens high values for better visual representation
const occupiedHeight = computed(() => {
  // If unknown, no bar should be shown
  if (isUnknown.value) {
    return '0%';
  }

  let occupiedRatio = props.day.occupancy_percent;

  // If occupancy_percent is already 0-100, convert to 0-1
  if (occupiedRatio > 1) {
    occupiedRatio = occupiedRatio / 100;
  }

  // Clamp to 0-1 range
  occupiedRatio = Math.max(0, Math.min(1, occupiedRatio));

  let adjustedRatio: number;

  // Special cases: empty stays at 0, full stays at 100
  if (props.day.occupancy_status === 'empty' || occupiedRatio === 0) {
    adjustedRatio = 0;
  } else if (props.day.occupancy_status === 'full' || occupiedRatio === 1) {
    adjustedRatio = 1;
  } else {
    // Use power function with exponent < 1 to exaggerate low values and compress high values
    // exponent of 0.5 makes low values appear higher and high values appear lower
    // This ensures the function is continuous and monotonic
    adjustedRatio = Math.pow(occupiedRatio, 0.6);
  }

  const occupiedPercent = adjustedRatio * 100;
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

// Check if data is unknown
const isUnknown = computed(() => {
  return (
    props.day.reservation_status === 'unknown' ||
    (props.day.free === 0 && props.day.total === 0)
  );
});

// Determine bar color based on occupancy_status
const barColor = computed(() => {
  if (isUnknown.value) {
    return '#808080'; // gray for unknown
  }
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
      return '#808080'; // unknown - gray
  }
});

// Lighter version for background (30% opacity)
const barColorLight = computed(() => {
  if (isUnknown.value) {
    return 'rgba(128, 128, 128, 0.3)'; // gray with 30% opacity
  }
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
      return 'rgba(128, 128, 128, 0.3)'; // gray with 30% opacity
  }
});

// Determine text color based on background darkness
const textColor = computed(() => {
  if (isUnknown.value) {
    return '#ffffff'; // white for gray
  }
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
  if (isUnknown.value) {
    return 'rgba(128, 128, 128, 0.65)'; // 65% gray
  }
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
      return 'rgba(128, 128, 128, 0.65)'; // 65% gray
  }
});

// Tooltip text with translated labels and numbers
const tooltipText = computed(() => {
  if (isUnknown.value) {
    return t('availability.no_data');
  }
  return t('availability.tooltip', {
    free: props.day.free,
    total: props.day.total,
  });
});
</script>

<style scoped lang="scss">
.card {
  width: 100%;
  min-width: 28px;
  height: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: opacity 0.2s;
  border: 2px solid transparent;
  border-radius: 4px;

  &:hover {
    opacity: 0.85;
  }

  &.selected {
    border-color: $accent;
    box-shadow: 0 0 8px rgba($accent, 0.4);
  }

  &.today {
    border-color: rgba(128, 128, 128, 0.5);
  }

  &.selected.today {
    border-color: $accent;
    box-shadow: 0 0 8px rgba($accent, 0.4);
  }
}

.header {
  width: 100%;
  padding: 2px 4px;
}

.footer {
  width: 100%;
  padding: 2px 4px;
}

.bar-wrapper {
  width: 100%;
  height: 36px;
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
  transition: background-color 0.3s ease;
}

.cross-overlay {
  width: 24px;
  height: 100%;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cross-line {
  position: absolute;
  width: 3px;
  height: 141.42%;
  /* sqrt(2) * 100% to span diagonal */
  background-color: rgba(0, 0, 0, 0.08);
  top: 50%;
  left: 50%;
}

.cross-line:first-child {
  transform: translate(-50%, -50%) rotate(45deg);
}

.cross-line:last-child {
  transform: translate(-50%, -50%) rotate(-45deg);
}
</style>

<template>
  <a
    :href="day.link"
    target="_blank"
    rel="noopener noreferrer"
    class="card column items-center overflow-hidden no-underline"
    :class="{ selected: isSelected, today: isToday }"
  >
    <!-- Loading/Skeleton State -->
    <template v-if="isLoadingState">
      <div
        class="header text-center column justify-center"
        style="background-color: rgba(128, 128, 128, 0.2)"
      >
        <div class="text-caption">{{ formattedDate }}</div>
        <div style="font-size: 9px; line-height: 1">{{ formattedDay }}</div>
      </div>
      <div class="bar-wrapper">
        <!-- Just the background with skeleton animation, no occupied bar -->
        <div class="bar-bg">
          <q-skeleton type="rect" width="100%" height="100%" />
        </div>
      </div>
      <div
        class="footer text-center column justify-center items-center"
        style="min-height: 28px"
      >
        <q-skeleton type="rect" width="100%" height="28px" />
      </div>
    </template>

    <!-- Normal/Unknown State -->
    <template v-else>
      <div
        class="header text-center column justify-center"
        :style="{ backgroundColor: headerColor, color: textColor }"
      >
        <div class="text-caption">{{ formattedDate }}</div>
        <div style="font-size: 9px; line-height: 1">{{ formattedDay }}</div>
      </div>
      <div class="bar-wrapper">
        <!-- Free beds (background, light color) -->
        <div class="bar-bg" :style="{ backgroundColor: barColorLight }"></div>
        <!-- Occupied beds (overlay, dark color) -->
        <div
          class="bar-occupied"
          :style="{
            backgroundColor: barColor,
            height: occupiedHeight,
            borderRadius: barRadius,
          }"
        ></div>
        <!-- Diagonal cross for unknown data -->
        <div
          v-if="isUnknown"
          class="cross-overlay"
          :style="{ color: textColor }"
        >
          <div class="cross-line"></div>
          <div class="cross-line"></div>
        </div>
      </div>
      <div
        class="footer text-center column justify-center items-center"
        :style="{
          backgroundColor: headerColor,
          color: textColor,
          minHeight: '28px',
        }"
      >
        <template v-if="isUnknown">
          <div style="font-size: 10px; line-height: 1.2">
            {{ t('availability.unknown') }}
          </div>
        </template>
        <template v-else>
          <div style="font-size: 10px; line-height: 1.2">{{ day.free }}</div>
          <div
            style="
              height: 1px;
              width: 60%;
              background-color: currentColor;
              opacity: 0.5;
            "
          ></div>
          <div style="font-size: 10px; line-height: 1.2">{{ day.total }}</div>
        </template>
        <q-tooltip>{{ tooltipText }}</q-tooltip>
      </div>
    </template>
  </a>
</template>
