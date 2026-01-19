<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface WeatherDay {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
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
const iconUrl = computed(
  () =>
    `${process.env.WODORE_API_HOST}/v1/meteo/symbol/simple/day/${props.day.weatherCode}.svg?org=weather-icons`,
);
const tempMax = computed(() => Math.round(props.day.tempMax));
const tempMin = computed(() => Math.round(props.day.tempMin));
const isRange = computed(() => tempMin.value !== tempMax.value);
const isLoading = computed(() => props.day.loading === true);
</script>

<template>
  <div class="weather-day column items-center">
    <div class="weather-day__label" :class="{ 'weather-day__label--today': isToday }">
      {{ dayLabel }}
    </div>
    <div class="weather-day__icon">
      <q-img v-if="!isLoading" :src="iconUrl" width="32px" height="32px" fit="contain" />
      <q-skeleton v-else type="circle" width="32px" height="32px" />
    </div>
    <div class="weather-day__temps">
      <template v-if="isLoading">
        <q-skeleton type="text" width="44px" height="12px" />
      </template>
      <template v-else-if="isRange">
        <span class="weather-day__temp-min">
          {{ tempMin }}
          <span class="weather-day__temp-unit">{{ t('weather.unit') }}</span>
        </span>
        <span class="weather-day__temp-sep">|</span>
        <span class="weather-day__temp-max">
          {{ tempMax }}
          <span class="weather-day__temp-unit">{{ t('weather.unit') }}</span>
        </span>
      </template>
      <template v-else>
        <span class="weather-day__temp-max">
          {{ tempMax }}
          <span class="weather-day__temp-unit">{{ t('weather.unit') }}</span>
        </span>
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
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weather-day__temps {
  font-size: 10px;
  line-height: 1;
  color: rgba(color('dark'), 0.7);
}

.weather-day__temp-min {
  color: rgba(color('dark'), 0.55);
}

.weather-day__temp-max {
  color: rgba(color('dark'), 0.85);
  font-weight: 600;
}

.weather-day__temp-sep {
  margin: 0 2px;
  color: rgba(color('dark'), 0.6);
}

.weather-day__temp-unit {
  font-size: 9px;
  color: rgba(color('dark'), 0.6);
  margin-left: 1px;
}
</style>
