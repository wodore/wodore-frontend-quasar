<script setup lang="ts">
import { computed, ref, watchEffect, nextTick, watch } from 'vue';
import { date, QScrollArea, QTable, useQuasar } from 'quasar';
import { useCssVar, useWindowSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { useMeteoStore } from '@stores/meteo-store';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';

const { formatDate, subtractFromDate, addToDate } = date;
const { width: windowWidth } = useWindowSize();
const { t } = useI18n();
const $q = useQuasar();
const meteoStore = useMeteoStore();
const { weatherCodesCollection, weatherCodes } = storeToRefs(meteoStore);
const { selectedDateOrToday } = storeToRefs(useHutsStore());

interface WeatherDay {
  date: string;
  weather_code: number | null;
  is_day_majority: boolean | null;
  temp_min: number | null;
  temp_max: number | null;
  loading?: boolean;
}

interface Props {
  latitude?: number;
  longitude?: number;
  elevation?: number;
  collection?: string;
}

const props = defineProps<Props>();

const forecastDays = ref<WeatherDay[]>([]);
const error = ref<string | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const scrollAreaRef = ref<InstanceType<typeof QScrollArea> | null>(null);
const itemWidthVar = useCssVar('--weather-item-width', containerRef);
const itemWidth = computed(() => {
  const value = Number.parseFloat(itemWidthVar.value || '');
  return Number.isFinite(value) && value > 0 ? value : 64;
});
const leftWidthVar = useCssVar('--weather-left-width', containerRef);
const leftWidth = computed(() => {
  const value = Number.parseFloat(leftWidthVar.value || '');
  return Number.isFinite(value) && value > 0 ? value : 72;
});
const columns = computed(() => [
  {
    name: 'label',
    label: '',
    field: 'label',
    align: 'left' as const,
  },
  ...forecastDays.value.map((day) => ({
    name: day.date,
    label: formatDayLabel(day.date),
    field: day.date,
    align: 'center' as const,
  })),
  {
    name: 'unit',
    label: '',
    field: 'unit',
    align: 'right' as const,
  },
]);
const rows = computed(() => [
  {
    row: 'day',
    label: '',
    unit: '',
  },
  {
    row: 'icons',
    label: '',
    unit: '',
  },
  {
    row: 'temp',
    label: '',
    unit: t('weather.unit'),
  },
]);

const hasLocation = computed(
  () => Number.isFinite(props.latitude) && Number.isFinite(props.longitude),
);
const selectedDateObj = computed(() => {
  const parts = selectedDateOrToday.value.split('.');
  if (parts.length !== 3) {
    return new Date();
  }
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = 2000 + Number(parts[2]);
  return new Date(year, month - 1, day);
});
const canShowForecast = computed(
  () => hasLocation.value && meteoStore.forecastPossible(selectedDateObj.value),
);

const scrollAreaHeight = computed(() =>
  windowWidth.value < 600 ? '120px' : '108px',
);
const quasarLang = computed(() => {
  const isoName = $q.lang?.isoName ?? 'de';
  return isoName.split('-')[0];
});
const collection = computed(
  () =>
    props.collection ?? weatherCodesCollection.value ?? 'weather-icons-filled',
);

const initializeDateRange = () => {
  const items: WeatherDay[] = [];
  const today = new Date();
  const start = subtractFromDate(today, { days: 7 });
  const end = addToDate(today, { days: 13 });
  let current = new Date(start);
  while (current <= end) {
    items.push({
      date: formatDate(current, 'YYYY-MM-DD'),
      weather_code: null,
      is_day_majority: null,
      temp_min: null,
      temp_max: null,
      loading: true,
    });
    current = addToDate(current, { days: 1 });
  }
  return items;
};

const formatDayLabel = (dateStr: string) => {
  const dateObj = new Date(dateStr);
  const today = new Date();
  const tomorrow = addToDate(today, { days: 1 });
  const yesterday = subtractFromDate(today, { days: 1 });
  const key = formatDate(dateObj, 'YYYY-MM-DD');
  if (key === formatDate(today, 'YYYY-MM-DD')) {
    return t('weather.today');
  }
  if (key === formatDate(tomorrow, 'YYYY-MM-DD')) {
    return t('weather.tomorrow');
  }
  if (key === formatDate(yesterday, 'YYYY-MM-DD')) {
    return t('weather.yesterday');
  }
  return formatDate(dateObj, 'DD.MM.');
};

const getWeatherEntry = (code: number | null) => {
  if (code === null || code === undefined) {
    return undefined;
  }
  return weatherCodes.value?.[String(code)];
};

const getIconUrl = (day: WeatherDay) => {
  const entry = getWeatherEntry(day.weather_code);
  if (!entry) {
    return null;
  }
  const isDay = day.is_day_majority ?? true;
  return (isDay ? entry.symbol_day : entry.symbol_night) ?? null;
};

const getIconLabel = (day: WeatherDay) => {
  const entry = getWeatherEntry(day.weather_code);
  return entry?.description ?? '';
};

const formatTemp = (day: WeatherDay) => {
  if (day.temp_min === null || day.temp_max === null) {
    return null;
  }
  const min = Math.round(day.temp_min);
  const max = Math.round(day.temp_max);
  if (min === max) {
    return `${min}`;
  }
  return `${min} | ${max}`;
};

const scrollToToday = (animate: boolean, targetDate: Date = new Date()) => {
  nextTick(() => {
    const targetKey = formatDate(targetDate, 'YYYY-MM-DD');
    const index = forecastDays.value.findIndex(
      (item) => item.date === targetKey,
    );
    if (index < 0 || !scrollAreaRef.value || forecastDays.value.length === 0) {
      return;
    }
    const targetLeft = Math.max(0, leftWidth.value + index * itemWidth.value);
    scrollAreaRef.value.setScrollPosition(
      'horizontal',
      targetLeft,
      animate ? 300 : 0,
    );
  });
};

const lastLoadedKey = ref<string | null>(null);

watchEffect(() => {
  if (!canShowForecast.value) {
    forecastDays.value = [];
    error.value = null;
    return;
  }
  console.debug('[weather-forecast] fetch', {
    lat: props.latitude,
    lon: props.longitude,
    collection: collection.value,
  });

  const locationKey = `${props.latitude}:${props.longitude}`;
  if (lastLoadedKey.value !== locationKey) {
    lastLoadedKey.value = locationKey;
    forecastDays.value = initializeDateRange();
  }

  const latitude = props.latitude as number;
  const longitude = props.longitude as number;
  const elevation = props.elevation;

  error.value = null;

  meteoStore
    .getDaily(
      { latitude, longitude },
      typeof elevation === 'number' ? elevation : undefined,
      {
        forecastDays: 14,
        pastDays: 7,
        weatherModels: ['meteoswiss_icon_seamless', 'best_match'],
      },
    )
    .then((items) => {
      console.debug('[weather-forecast] daily result', {
        count: items.length,
        first: items[0],
      });
      if (!items.length) {
        error.value = t('weather.unavailable');
        return;
      }
      const existing = forecastDays.value.length
        ? forecastDays.value
        : initializeDateRange();
      const byDate = new Map(items.map((item) => [item.date, item]));
      forecastDays.value = existing.map((item) => {
        const incoming = byDate.get(item.date);
        if (!incoming) {
          return item;
        }
        return {
          date: item.date,
          weather_code: incoming.weather_code,
          is_day_majority: incoming.is_day_majority,
          temp_min: incoming.temp_min,
          temp_max: incoming.temp_max,
          loading: false,
        };
      });
    })
    .catch(() => {
      error.value = t('weather.unavailable');
    });
});

watch(
  () => selectedDateObj.value,
  (value) => {
    if (!canShowForecast.value) {
      return;
    }
    scrollToToday(true, value);
  },
  { immediate: true },
);

watchEffect(() => {
  meteoStore.setWeatherCodesContext(quasarLang.value, collection.value);
});
</script>

<template>
  <div v-if="canShowForecast" id="weather-forecast-section">
    <div class="weather-forecast__header q-mt-sm q-mb-xs">
      <div class="text-subtitle1 text-accent">
        {{ t('weather.title') }}
      </div>
      <div class="weather-forecast__attribution">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Weather data by Open-Meteo.com
        </a>
      </div>
    </div>
    <div v-if="error" class="text-caption text-negative q-mb-sm">
      {{ error }}
    </div>
    <q-scroll-area ref="scrollAreaRef" id="weather-forecast-scroll" class="weather-forecast"
      :style="{ height: scrollAreaHeight }" :horizontal-thumb-style="{ height: '3px' }"
      :vertical-thumb-style="{ width: '0px' }" :vertical-bar-style="{ width: '0px' }">
      <div ref="containerRef" class="weather-forecast__table-wrap">
        <q-table dense flat :grid="false" hide-header hide-pagination :rows="rows" :columns="columns" row-key="row"
          class="weather-forecast__table" table-class="weather-forecast__table-el"
          card-class="weather-forecast__table-card">
          <template v-slot:body="props">
            <tr>
              <td class="weather-forecast__cell weather-forecast__cell--left" :class="{
                'weather-forecast__cell--day': props.row.row === 'day',
                'weather-forecast__cell--temp-label': props.row.row === 'temp',
              }">
                <q-icon v-if="props.row.row === 'temp'" size="16px"
                  class="weather-forecast__temp-icon weather-forecast__temp-icon--pill">
                  <IconEvaThermometerFill />
                </q-icon>
              </td>
              <td v-for="day in forecastDays" :key="`${props.row.row}-${day.date}`" class="weather-forecast__cell"
                :class="{
                  'weather-forecast__cell--day': props.row.row === 'day',
                  'weather-forecast__cell--icon': props.row.row === 'icons',
                  'weather-forecast__cell--temp': props.row.row === 'temp',
                }">
                <template v-if="props.row.row === 'day'">
                  {{ formatDayLabel(day.date) }}
                </template>
                <template v-else-if="props.row.row === 'icons'">
                  <q-skeleton v-if="day.loading" type="QAvatar" size="40px" />
                  <q-img v-else-if="getIconUrl(day)" :src="getIconUrl(day) ?? ''" width="48px" height="48px" no-spinner
                    class="weather-forecast__icon">
                    <q-tooltip :delay="500">
                      {{ getIconLabel(day) }}
                    </q-tooltip>
                  </q-img>
                  <div v-else class="weather-forecast__icon--empty">-</div>
                </template>
                <template v-else>
                  <q-skeleton v-if="day.loading" type="text" width="48px" />
                  <span v-else class="weather-forecast__temp">
                    <span class="weather-forecast__temp-text">
                      {{ formatTemp(day) ?? '-' }}
                    </span>
                  </span>
                </template>
              </td>
              <td class="weather-forecast__cell weather-forecast__cell--right">
                <span v-if="props.row.unit" class="weather-forecast__unit-pill">
                  {{ props.row.unit }}
                </span>
              </td>
            </tr>
          </template>
        </q-table>
      </div>
    </q-scroll-area>
  </div>
</template>

<style scoped lang="scss">
.weather-forecast__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.weather-forecast__table-wrap {
  min-width: max-content;
  --weather-item-width: 56px;
  --weather-left-width: 8px;
  --weather-right-width: 20px;
  --weather-pill-size: 20px;
}

.weather-forecast__table {
  border-collapse: collapse;
  border-spacing: 0;
  min-width: max-content;
  table-layout: fixed;
}

.weather-forecast__table-card,
.weather-forecast__table-el,
.weather-forecast__table :deep(.q-table__container),
.weather-forecast__table :deep(.q-table__middle),
.weather-forecast__table :deep(.q-table__middle .q-table),
.weather-forecast__table :deep(.q-table__middle table),
.weather-forecast__table :deep(.q-table__middle tbody),
.weather-forecast__table :deep(.q-table__middle tr),
.weather-forecast__table :deep(.q-table__middle td),
.weather-forecast__table :deep(.q-table__middle th),
.weather-forecast__table :deep(.q-table),
.weather-forecast__table :deep(.q-table__card) {
  background: transparent;
}

.weather-forecast__table :deep(.q-table__container),
.weather-forecast__table :deep(.q-table__middle) {
  overflow: visible;
}

.weather-forecast__table :deep(.q-table tbody td),
.weather-forecast__table :deep(.q-table thead th) {
  border: 0;
}

.weather-forecast__table :deep(.q-table thead tr),
.weather-forecast__table :deep(.q-table tbody tr),
.weather-forecast__table :deep(.q-table tbody td) {
  height: 16px;
}

.weather-forecast__table :deep(.q-table th),
.weather-forecast__table :deep(.q-table td) {
  padding: 0;
}

.weather-forecast__table :deep(.q-table tbody tr:hover > td) {
  background: transparent;
}

.weather-forecast__table :deep(.q-table tbody td:hover),
.weather-forecast__table :deep(.q-table tbody td.q-hoverable:hover),
.weather-forecast__table :deep(.q-table tbody td.q-hoverable:hover > *) {
  background: transparent;
}

.weather-forecast__table :deep(.q-table tbody td:before),
.weather-forecast__table :deep(.q-table tbody td:after),
.weather-forecast__table :deep(.q-table > tbody > tr:not(.q-tr--no-hover):hover > td:not(.q-td--no-hover):before) {
  content: none !important;
  background: transparent !important;
}

.weather-forecast__cell {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.72);
  text-align: center;
  white-space: nowrap;
  width: var(--weather-item-width);
  min-width: var(--weather-item-width);
  padding: 0 4px;
  position: relative;
}

.weather-forecast__cell--left {
  position: sticky;
  left: 0;
  z-index: 2;
  text-align: center;
  width: var(--weather-left-width);
  min-width: var(--weather-left-width);
  padding-left: 0 !important;
  padding-right: 0 !important;
  background: transparent;
  overflow: hidden;
}

.weather-forecast__cell--right {
  position: sticky;
  right: 0;
  z-index: 2;
  text-align: center;
  width: var(--weather-right-width);
  min-width: var(--weather-right-width);
  padding-right: 0 !important;
  padding-left: 0 !important;
  background: transparent;
  overflow: hidden;
}

.weather-forecast__cell--day {
  font-size: 11px;
}

.weather-forecast__cell--icon {
  align-items: center;
  justify-content: center;
}

.weather-forecast__icon {
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
}

.weather-forecast__icon--empty {
  color: rgba(0, 0, 0, 0.35);
}

.weather-forecast__cell--temp {
  font-size: 11px;
}

.weather-forecast__cell--temp-label {
  display: flex;
  align-items: right;
  justify-content: center;
}

.weather-forecast__temp {
  display: inline-flex;
  align-items: center;
  color: rgba(0, 0, 0, 0.65);
}

.weather-forecast__temp-icon {
  color: rgba(0, 0, 0, 0.35);
}

.weather-forecast__temp-icon--pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--weather-pill-size);
  height: var(--weather-pill-size);
  min-width: var(--weather-pill-size);
  min-height: var(--weather-pill-size);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  padding: 0;
  line-height: 1;
}

.weather-forecast__unit-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--weather-pill-size);
  height: var(--weather-pill-size);
  min-width: var(--weather-pill-size);
  min-height: var(--weather-pill-size);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  padding: 0;
  font-size: 11px;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.5);
  font-weight: 600;
}

.weather-forecast__temp-text {
  font-weight: 500;
}

.weather-forecast__attribution {
  text-align: right;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
}

.weather-forecast__attribution a {
  color: inherit;
  text-decoration: none;
}

.weather-forecast__attribution a:hover {
  text-decoration: underline;
}
</style>
