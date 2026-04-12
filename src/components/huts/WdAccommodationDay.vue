<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import WdDayLabel from '@components/content/place/WdDayLabel.vue';

const { t } = useI18n();

type OccupancyStatus = 'empty' | 'low' | 'medium' | 'high' | 'full' | 'unknown';

interface AvailabilityDay {
  date: string;
  reservation_status: string;
  free: number;
  total: number;
  occupancy_percent: number;
  occupancy_steps: number;
  occupancy_status: OccupancyStatus;
  hut_type: string;
  type_slug?: string | null;
  type_color?: string | null;
  link: string;
  loading?: boolean;
}

interface Props {
  day: AvailabilityDay;
  /** Maps occupancy_status slug → SVG URL */
  availabilityIcons: Record<string, string>;
  isSelected?: boolean;
  hutTypeColor?: string;
  /** Map of type_slug → icon URL for hut type icons */
  hutTypeIcons?: Record<string, string>;
  /** Whether this day is in the past */
  isPast?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  hutTypeColor: undefined,
  hutTypeIcons: () => ({}),
  isPast: false,
});

const isLoading = computed(() => props.day.loading === true);
const isUnknown = computed(
  () =>
    props.day.reservation_status === 'unknown' ||
    (props.day.free === 0 && props.day.total === 0 && !isLoading.value)
);

const iconUrl = computed(() => {
  const status = props.day.occupancy_status;
  return props.availabilityIcons[status] ?? props.availabilityIcons['unknown'] ?? null;
});

/** Occupancy status display name */
const statusLabel = computed(() => {
  if (isLoading.value) return '';
  const map: Record<string, string> = {
    empty: 'FREI',
    low: 'TIEF',
    medium: 'MITTEL',
    high: 'HOCH',
    full: 'VOLL',
    unknown: 'unbekannt',
  };
  return map[props.day.occupancy_status] ?? '';
});

/** Hut type icon URL based on per-day type_slug */
const hutTypeIconUrl = computed(() => {
  const slug = props.day.type_slug;
  if (!slug) return null;
  return props.hutTypeIcons[slug] ?? null;
});

/** Free number color based on occupancy status */
const freeColor = computed(() => {
  if (isUnknown.value) return 'rgba(17, 33, 25, 0.4)';
  switch (props.day.occupancy_status) {
    case 'full':
      return '#d32f2f';
    case 'high':
      return '#ef6c00';
    case 'medium':
      return '#87b52d';
    case 'low':
    case 'empty':
      return '#4B8E43';
    default:
      return 'rgba(17, 33, 25, 0.4)';
  }
});

/** Badge style derived from hut type color (like PlaceTypeBadge) */
const badgeStyle = computed(() => {
  if (!props.hutTypeColor) return undefined;
  const hex = props.hutTypeColor;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    borderLeftColor: hex,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.10)`,
  };
});

// Full date for tooltip
const fullDate = computed(() => {
  const d = new Date(`${props.day.date}T00:00:00`);
  return d.toLocaleDateString('de-CH', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
});

const tooltipLines = computed(() => {
  const lines: string[] = [fullDate.value];
  if (isUnknown.value) {
    lines.push(t('availability.no_data'));
  } else if (!isLoading.value) {
    lines.push(
      `${props.day.free} ${t('availability.free')} / ${props.day.total} ${t('availability.total')}`
    );
  }
  if (props.day.hut_type && props.day.hut_type !== 'unknown') {
    lines.push(props.day.hut_type);
  }
  return lines;
});
</script>

<template>
  <a
    :href="day.link"
    target="_blank"
    rel="noopener noreferrer"
    class="wd-accommodation-day column items-center"
    :class="{
      'wd-accommodation-day--selected': isSelected,
      'wd-accommodation-day--past': isPast,
    }"
  >
    <!-- Day name -->
    <WdDayLabel :date="day.date" :is-active="isSelected" />

    <!-- Availability icon + free number on one line -->
    <div class="wd-accommodation-day__main">
      <template v-if="isLoading">
        <q-skeleton type="circle" width="16px" height="16px" />
        <q-skeleton type="text" width="20px" height="14px" />
      </template>
      <template v-else>
        <div class="wd-accommodation-day__avail-icon">
          <q-img
            v-if="iconUrl"
            :src="iconUrl"
            width="16px"
            height="16px"
            fit="contain"
            no-spinner
          />
        </div>
        <span v-if="!isUnknown" class="wd-accommodation-day__free" :style="{ color: freeColor }">
          {{ day.free }}
        </span>
      </template>
    </div>

    <!-- Occupancy status label -->
    <div
      v-if="statusLabel"
      class="wd-accommodation-day__status"
      :class="{ 'wd-accommodation-day__status--small': statusLabel.length > 5 }"
      :style="{ color: freeColor }"
    >
      {{ statusLabel }}
    </div>

    <!-- Total badge at bottom -->
    <div class="wd-accommodation-day__badge-row">
      <template v-if="isLoading">
        <q-skeleton type="text" width="40px" height="14px" />
      </template>
      <div
        v-else-if="day.total > 0 && hutTypeColor"
        class="wd-accommodation-day__badge"
        :style="badgeStyle"
      >
        <q-img
          v-if="hutTypeIconUrl"
          :src="hutTypeIconUrl"
          width="14px"
          height="14px"
          fit="contain"
          no-spinner
          class="wd-accommodation-day__badge-icon"
        />
        <span class="wd-accommodation-day__badge-total">{{ day.total }}</span>
      </div>
      <!-- Unknown: show ? in same space, no badge -->
      <span v-else-if="isUnknown" class="wd-accommodation-day__badge-unknown">?</span>
    </div>

    <!-- Tooltip -->
    <q-tooltip :delay="700">
      <div v-for="(line, i) in tooltipLines" :key="i">{{ line }}</div>
    </q-tooltip>
  </a>
</template>

<style scoped lang="scss">
.wd-accommodation-day {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  padding: 6px 2px 8px;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  transition: background-color 0.2s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    opacity: 0.85;
  }
}

.wd-accommodation-day--past {
  opacity: 0.55;
}

.wd-accommodation-day--selected {
  background: rgba(color('accent'), 0.12);
}

// Badge row at bottom: color strip + icon + total (or ? for unknown)
.wd-accommodation-day__badge-row {
  min-height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 3px;
}

.wd-accommodation-day__badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px 2px 4px;
  border-left: 4px solid;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-left: 4px solid;
}

.wd-accommodation-day__badge-icon {
  flex-shrink: 0;
  opacity: 0.75;
}

.wd-accommodation-day__badge-total {
  font-size: 11px;
  line-height: 1.1;
  color: rgba(color('dark'), 0.6);
  font-weight: 600;
}

.wd-accommodation-day__badge-unknown {
  font-size: 13px;
  font-weight: 700;
  color: rgba(color('dark'), 0.3);
  line-height: 1;
}

// Main line: availability icon + free number
.wd-accommodation-day__main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 22px;
  margin-top: 2px;
}

.wd-accommodation-day__avail-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wd-accommodation-day__free {
  font-size: 13px;
  line-height: 1.1;
  font-weight: 700;
  min-width: 18px;
  text-align: center;
}

.wd-accommodation-day__status {
  font-size: 9px;
  line-height: 1.1;
  font-weight: 500;
  text-align: center;
  letter-spacing: 0.02em;
  margin-top: 1px;
}

.wd-accommodation-day__status--small {
  font-size: 7px;
}
</style>
