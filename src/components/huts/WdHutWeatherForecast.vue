<script setup lang="ts">
import { computed, ref, watchEffect, nextTick } from 'vue';
import { date, QScrollArea, QVirtualScroll } from 'quasar';
import { useCssVar, useWindowSize } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { useMeteoStore } from '@stores/meteo-store';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';

const { formatDate, subtractFromDate, addToDate } = date;
const { width: windowWidth } = useWindowSize();
const { t } = useI18n();
const meteoStore = useMeteoStore();
const { selectedDateOrToday } = storeToRefs(useHutsStore());

interface WeatherDay {
  date: string;
  icon_url: string | null;
  temp_min: number | null;
  temp_max: number | null;
  loading?: boolean;
}

interface Props {
  latitude?: number;
  longitude?: number;
  elevation?: number;
}

const props = defineProps<Props>();

const forecastDays = ref<WeatherDay[]>([]);
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
  windowWidth.value < 600 ? '96px' : '84px',
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
      icon_url: null,
      temp_min: null,
      temp_max: null,
      loading: true,
    });
    current = addToDate(current, { days: 1 });
  }
  return items;
};

const scrollToToday = (animate: boolean, targetDate: Date = new Date()) => {
  nextTick(() => {
    const targetKey = formatDate(targetDate, 'YYYY-MM-DD');
    const index = forecastDays.value.findIndex(
      (item) => item.date === targetKey,
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

watchEffect(() => {
  if (!canShowForecast.value) {
    forecastDays.value = [];
    error.value = null;
    return;
  }

  const locationKey = `${props.latitude}:${props.longitude}`;
  if (lastLoadedKey.value !== locationKey) {
    lastLoadedKey.value = locationKey;
    forecastDays.value = initializeDateRange();
    scrollToToday(false, selectedDateObj.value);
  }

  const latitude = props.latitude as number;
  const longitude = props.longitude as number;
  const elevation = props.elevation;

  error.value = null;

  meteoStore.getDaily(
    { latitude, longitude },
    typeof elevation === 'number' ? elevation : undefined,
    {
      forecastDays: 14,
      pastDays: 7,
      weatherModels: ['meteoswiss_icon_seamless', 'best_match'],
    },
  )
    .then((items) => {
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
          icon_url: incoming.icon_url,
          temp_min: incoming.temp_min,
          temp_max: incoming.temp_max,
          loading: false,
        };
      });
      scrollToToday(true, selectedDateObj.value);
    })
    .catch(() => {
      error.value = t('weather.unavailable');
    })
});
</script>

<template>
  <div v-if="canShowForecast">
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
