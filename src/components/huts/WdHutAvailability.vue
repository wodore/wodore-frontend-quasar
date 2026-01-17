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
  typeIcon?: string;
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

const isWeekend = computed(() => {
  const date = new Date(props.day.date);
  const day = date.getDay();
  return day === 0 || day === 6;
});

// Format day number (no leading zero)
const dayNumber = computed(() => {
  const date = new Date(props.day.date);
  return String(date.getDate());
});

const monthKey = computed(() => {
  const date = new Date(props.day.date);
  return String(date.getMonth() + 1).padStart(2, '0');
});

// Full weekday name (e.g., "Montag")
const fullWeekday = computed(() => {
  const date = new Date(props.day.date);
  return date.toLocaleDateString('de-CH', { weekday: 'long' });
});

// Full date with year (e.g., "12.03.2024")
const fullDateWithYear = computed(() => {
  const date = new Date(props.day.date);
  return date.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

// Bar radius style - should be half the bar width (24px / 2 = 12px)
const barRadius = computed(() => {
  return '12px';
});

// Check if data is unknown
const isUnknown = computed(() => {
  return props.day.reservation_status === 'unknown' ||
    (props.day.free === 0 && props.day.total === 0);
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

  &:hover {
    opacity: 0.85;
  }
}

.bar-wrapper {
  width: 100%;
  height: 80px;
  position: relative;
  overflow: visible;
  background-color: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
}

.bar-frame {
  width: 30px;
  height: 80px;
  border-radius: 4px;
  padding: 4px;
  border: 1px solid rgba(0, 0, 0, 0.16);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}

.bar-frame.weekend {
  border-width: 3px;
}

.bar-frame.selected {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  border: 4px solid rgba($accent, 0.6);
}

.bar-frame.today {
  border-width: 3px;
  border-color: rgba($primary, 0.5);
}

.bar-frame.selected.today {
  border: 3px solid rgba($primary, 0.6);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.bar-bg {
  width: 100%;
  height: 52px;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
}

.bar-occupied {
  width: 22px;
  height: 0;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 -1px 3px rgba(0, 0, 0, 0.03));
  transition: background-color 0.3s ease;
}

.bar-content {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  align-items: center;
  padding: 3px 2px;
  color: rgba(color('dark'), 0.6);
  pointer-events: none;
}

.day-number {
  font-size: 12px;
  line-height: 1;
  color: rgba(color('dark'), 0.6);
}

.day-week {
  font-size: 10px;
  line-height: 1;
  letter-spacing: 0.1px;
  color: rgba(color('dark'), 0.6);
}

.day-week--bold {
  font-weight: 700;
}

.free-label {
  font-size: 11px;
  line-height: 1;
}

.footer-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
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
  <a :href="day.link" target="_blank" rel="noopener noreferrer"
    class="card column items-center overflow-hidden no-underline">
    <!-- Loading/Skeleton State -->
    <template v-if="isLoadingState">
      <div class="text-center column justify-center items-center" style="min-height: 36px"></div>
      <div class="bar-wrapper">
        <!-- Just the background with skeleton animation, no occupied bar -->
        <div class="bar-bg">
          <q-skeleton type="rect" width="100%" height="100%" />
        </div>
      </div>
      <div class="text-center column justify-center items-center" style="min-height: 28px"></div>
    </template>

    <!-- Normal/Unknown State -->
    <template v-else>
      <div class="text-center column justify-center items-center" style="min-height: 6px"></div>
      <div class="bar-wrapper">
        <div class="bar-frame" :class="[
          isSelected ? `month_${monthKey}--gradient-dark` : `month_${monthKey}--gradient-light`,
          { selected: isSelected, today: isToday, weekend: isWeekend },
        ]">
          <div class="day-number">{{ dayNumber }}</div>
          <!-- Free beds (background, light color) -->
          <div class="bar-bg" :style="{ backgroundColor: barColorLight, borderRadius: barRadius }">
            <!-- Occupied beds (overlay, dark color) -->
            <div class="bar-occupied"
              :style="{ backgroundColor: barColor, height: occupiedHeight, borderRadius: barRadius }">
            </div>
            <div class="bar-content">
              <template v-if="isUnknown">
                <div class="free-label">?</div>
              </template>
              <template v-else>
                <div class="free-label">{{ day.free }}</div>
              </template>
            </div>
          </div>
          <div class="footer-stack">
            <div class="day-week" :class="{ 'day-week--bold': isWeekend }">{{ formattedDate }}</div>
            <q-icon v-if="typeIcon" :name="typeIcon" size="20px" />
          </div>
        </div>
        <!-- No cross overlay for unknown data -->
        <q-tooltip>
          <div>{{ fullWeekday }}, {{ fullDateWithYear }}</div>
          <div v-if="isUnknown">{{ t('availability.no_data') }}</div>
          <div v-else>{{ t('availability.tooltip', { free: day.free, total: day.total }) }}</div>
        </q-tooltip>
      </div>
      <div class="text-center column justify-center items-center" style="min-height: 6px"></div>
    </template>
  </a>
</template>
