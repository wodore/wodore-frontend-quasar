<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeteoStore } from '@stores/meteo-store';
import { storeToRefs } from 'pinia';

const { t } = useI18n();
const { weatherCodes } = storeToRefs(useMeteoStore());

interface WeatherDay {
  date: string;
  weather_code: number | null;
  is_day_majority: boolean | null;
  temp_min: number | null;
  temp_max: number | null;
  loading?: boolean;
}

interface Props {
  day: WeatherDay;
}

const props = defineProps<Props>();

const dateObj = computed(() => new Date(`${props.day.date}T00:00:00`));
const todayMidnight = computed(() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
});
const dayDiff = computed(() =>
  Math.round(
    (dateObj.value.getTime() - todayMidnight.value.getTime()) / 86400000,
  ),
);
const isToday = computed(() => dayDiff.value === 0);
const dayLabel = computed(() => {
  if (dayDiff.value === 0) {
    return t('weather.today');
  }
  if (dayDiff.value === 1) {
    return t('weather.tomorrow');
  }
  if (dayDiff.value === -1) {
    return t('weather.yesterday');
  }
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const d = dateObj.value;
  return `${d.getDate()} • ${dayNames[d.getDay()]}`;
});
const iconEntry = computed(() => {
  if (props.day.weather_code === null) {
    return null;
  }
  return weatherCodes.value[String(props.day.weather_code)] ?? null;
});
const iconUrl = computed(() => {
  if (!iconEntry.value) {
    return null;
  }
  const isDay = props.day.is_day_majority !== false;
  const symbolKey = isDay ? 'symbol_day' : 'symbol_night';
  const url = (iconEntry.value as Record<string, unknown>)[symbolKey] as
    | string
    | undefined;
  return url ?? null;
});
const iconDescription = computed(() => {
  const entry = iconEntry.value as Record<string, unknown> | null;
  if (!entry) {
    return '';
  }
  return (
    (entry.description as string | undefined) ??
    (entry.name as string | undefined) ??
    (entry.label as string | undefined) ??
    (entry.title as string | undefined) ??
    (entry.summary as string | undefined) ??
    ''
  );
});
const tempMax = computed(() =>
  props.day.temp_max !== null ? Math.round(props.day.temp_max) : null,
);
const tempMin = computed(() =>
  props.day.temp_min !== null ? Math.round(props.day.temp_min) : null,
);
const isRange = computed(
  () =>
    tempMin.value !== null &&
    tempMax.value !== null &&
    tempMin.value !== tempMax.value,
);
const isLoading = computed(() => props.day.loading === true);
const hasTemps = computed(
  () => tempMin.value !== null && tempMax.value !== null,
);
const conditionLabel = computed(() => {
  if (iconDescription.value) {
    return iconDescription.value;
  }
  if (props.day.weather_code !== null) {
    return `WMO ${props.day.weather_code}`;
  }
  return '';
});
</script>

<template>
  <div class="weather-day column items-center">
    <div
      class="weather-day__label"
      :class="{ 'weather-day__label--today': isToday }"
    >
      {{ dayLabel }}
    </div>
    <div class="weather-day__icon">
      <q-img
        v-if="!isLoading && iconUrl"
        :src="iconUrl"
        width="36px"
        height="36px"
        fit="contain"
        no-spinner
      />
      <q-skeleton
        v-else-if="isLoading"
        type="circle"
        width="36px"
        height="36px"
      />
      <div v-else class="weather-day__icon-empty"></div>
      <q-tooltip v-if="conditionLabel" :delay="500">
        {{ conditionLabel }}
      </q-tooltip>
    </div>
    <div class="weather-day__temps">
      <template v-if="isLoading">
        <q-skeleton type="text" width="44px" height="12px" />
      </template>
      <template v-else-if="isRange">
        <IconEvaThermometerFill class="weather-day__temp-icon" />
        <span class="weather-day__temp-min">{{ tempMin }}°</span>
        <span class="weather-day__temp-sep">|</span>
        <span class="weather-day__temp-max">{{ tempMax }}°C</span>
      </template>
      <template v-else-if="hasTemps">
        <IconEvaThermometerFill class="weather-day__temp-icon" />
        <span class="weather-day__temp-max">{{ tempMax }}°C</span>
      </template>
      <template v-else>
        <span class="weather-day__temp-empty">--</span>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.weather-day {
  width: 60px;
  min-height: 68px;
  padding: 4px 2px 6px;
}

.weather-day__label {
  font-size: 10px;
  line-height: 1;
  color: rgba(color('dark'), 0.7);
  margin-bottom: 2px;
  white-space: nowrap;
}

.weather-day__label--today {
  font-weight: 600;
  color: rgba(color('dark'), 0.9);
}

.weather-day__icon {
  margin-bottom: 4px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weather-day__icon :deep(img) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}

.weather-day__icon-empty {
  width: 36px;
  height: 36px;
}

.weather-day__temps {
  font-size: 10px;
  line-height: 1;
  color: rgba(color('dark'), 0.6);
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.weather-day__temp-min {
  color: rgba(color('dark'), 0.5);
}

.weather-day__temp-max {
  color: rgba(color('dark'), 0.7);
  font-weight: 600;
}

.weather-day__temp-sep {
  color: rgba(color('dark'), 0.45);
  margin: 0 2px;
}

.weather-day__temp-icon {
  color: rgba(color('dark'), 0.5);
  font-size: 12px;
}

.weather-day__temp-empty {
  color: rgba(color('dark'), 0.45);
}
</style>
