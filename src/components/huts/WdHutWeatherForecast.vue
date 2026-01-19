<script setup lang="ts">
import { computed, ref, watchEffect, nextTick, watch } from 'vue';
import { date, QScrollArea, QVirtualScroll } from 'quasar';
import { useCssVar, useWindowSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const { formatDate, subtractFromDate, addToDate } = date;
const { width: windowWidth } = useWindowSize();
const { t } = useI18n();

interface WeatherDay {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  loading?: boolean;
}

interface OpenMeteoDaily {
  time: string[];
  [key: string]: Array<number | null> | string[];
}

interface OpenMeteoResponse {
  daily?: OpenMeteoDaily;
}

interface Props {
  latitude?: number;
  longitude?: number;
}

const props = defineProps<Props>();

const forecastDays = ref<WeatherDay[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const scrollAreaRef = ref<InstanceType<typeof QScrollArea> | null>(null);
const virtualScrollRef = ref<InstanceType<typeof QVirtualScroll> | null>(null);
const itemWidthVar = useCssVar('--weather-item-width', containerRef);
const itemWidth = computed(() => {
  const value = Number.parseFloat(itemWidthVar.value || '');
  return Number.isFinite(value) && value > 0 ? value : 64;
});

const hasLocation = computed(
  () => Number.isFinite(props.latitude) && Number.isFinite(props.longitude),
);

const scrollAreaHeight = computed(() =>
  windowWidth.value < 600 ? '96px' : '84px',
);
const todayStr = computed(() => formatDate(new Date(), 'YYYY-MM-DD'));

const weatherModels = ['meteoswiss_icon_seamless', 'best_match'] as const;

const buildUrl = (latitude: number, longitude: number) => {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    models: weatherModels.join(','),
    timezone: 'Europe/Berlin',
    past_days: '7',
    forecast_days: '14',
  });
  return `${base}?${params.toString()}`;
};

const initializeDateRange = () => {
  const items: WeatherDay[] = [];
  const today = new Date();
  const start = subtractFromDate(today, { days: 7 });
  const end = addToDate(today, { days: 13 });
  let current = new Date(start);
  while (current <= end) {
    items.push({
      date: formatDate(current, 'YYYY-MM-DD'),
      weatherCode: 0,
      tempMax: 0,
      tempMin: 0,
      loading: true,
    });
    current = addToDate(current, { days: 1 });
  }
  return items;
};

const normalizeForecast = (payload: OpenMeteoResponse): WeatherDay[] => {
  if (!payload?.daily?.time) {
    return [];
  }
  const { time } = payload.daily;
  if (!Array.isArray(time)) {
    return [];
  }
  const daily = payload.daily;

  const pickValue = (field: string, idx: number): number | null => {
    for (const model of weatherModels) {
      const key = `${field}_${model}`;
      const series = daily[key];
      if (Array.isArray(series)) {
        const value = series[idx];
        if (value !== null && value !== undefined) {
          return Number(value);
        }
      }
    }
    return null;
  };
  const today = new Date();
  const pastStartStr = formatDate(
    subtractFromDate(today, { days: 7 }),
    'YYYY-MM-DD',
  );
  const items = time.map((dateStr: string, idx: number) => {
    const weatherCode = pickValue('weather_code', idx);
    const tempMax = pickValue('temperature_2m_max', idx);
    const tempMin = pickValue('temperature_2m_min', idx);
    return {
      date: dateStr,
      weatherCode: weatherCode ?? 0,
      tempMax: tempMax ?? 0,
      tempMin: tempMin ?? 0,
      loading: weatherCode === null || tempMax === null || tempMin === null,
    };
  });
  return items
    .filter((item) => item.date >= pastStartStr)
    .slice(0, 21);
};

const scrollToToday = (animate: boolean) => {
  nextTick(() => {
    const index = forecastDays.value.findIndex(
      (item) => item.date === todayStr.value,
    );
    if (
      index < 0 ||
      !scrollAreaRef.value ||
      !virtualScrollRef.value ||
      forecastDays.value.length === 0
    ) {
      return;
    }
    const targetLeft = Math.max(0, index * itemWidth.value);
    scrollAreaRef.value.setScrollPosition(
      'horizontal',
      targetLeft,
      animate ? 300 : 0,
    );
  });
};

const lastLoadedKey = ref<string | null>(null);

watch(
  forecastDays,
  () => {
    scrollToToday(true);
  },
  { deep: true },
);

watchEffect((onInvalidate) => {
  if (!hasLocation.value) {
    forecastDays.value = [];
    error.value = null;
    return;
  }

  const locationKey = `${props.latitude}:${props.longitude}`;
  if (lastLoadedKey.value !== locationKey) {
    lastLoadedKey.value = locationKey;
    forecastDays.value = initializeDateRange();
    scrollToToday(false);
  }

  const controller = new AbortController();
  onInvalidate(() => controller.abort());

  const latitude = props.latitude as number;
  const longitude = props.longitude as number;

  loading.value = true;
  error.value = null;

  fetch(buildUrl(latitude, longitude), { signal: controller.signal })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Weather request failed');
      }
      return res.json();
    })
    .then((payload) => {
      const items = normalizeForecast(payload);
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
        return incoming ? { ...item, ...incoming, loading: incoming.loading } : item;
      });
    })
    .catch((err) => {
      if (err?.name === 'AbortError') {
        return;
      }
      error.value = t('weather.unavailable');
      forecastDays.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>

<template>
  <div v-if="hasLocation">
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
      <div ref="containerRef" class="weather-forecast__row">
        <q-virtual-scroll ref="virtualScrollRef" class="weather-forecast__row-inner"
          scroll-target="#weather-forecast-scroll > .scroll" :items="forecastDays" :virtual-scroll-item-size="itemWidth"
          virtual-scroll-horizontal virtual-scroll-slice-ratio-before="8" virtual-scroll-slice-ratio-after="12">
          <template v-slot="{ item }">
            <div class="weather-forecast__item">
              <WdHutWeatherDay :day="item" />
            </div>
          </template>
        </q-virtual-scroll>
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

.weather-forecast__row {
  padding: 6px 8px;
  background: #e2e2e2;
  border-radius: 10px;
  --weather-item-width: 64px;
  height: 100%;
  align-items: center;
}

.weather-forecast__row-inner {
  height: 100%;
}

.weather-forecast__item {
  width: var(--weather-item-width);
  padding: 0 2px;
  height: 100%;
  display: flex;
  align-items: center;
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
