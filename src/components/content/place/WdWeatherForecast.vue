<script setup lang="ts">
import { computed, ref, watchEffect, watch, nextTick } from 'vue';
import { date, useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { FreeMode, Scrollbar, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/scrollbar';
import { useMeteoStore } from '@stores/meteo-store';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import { useSlideCount } from '@composables/useSlideCount';
import WdWeatherDay from './WdWeatherDay.vue';

const { formatDate, subtractFromDate, addToDate } = date;
const { t } = useI18n();
const $q = useQuasar();
const meteoStore = useMeteoStore();
const { weatherCodesCollection } = storeToRefs(meteoStore);
const { selectedDateOrToday } = storeToRefs(useHutsStore());

interface WeatherDay {
  date: string;
  weather_code: number | null;
  is_day_majority: boolean | null;
  temp_min: number | null;
  temp_max: number | null;
  rain_sum: number | null;
  snowfall_sum: number | null;
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
const swiperInstance = ref<SwiperType | null>(null);
const forecastContainer = ref<HTMLElement | null>(null);
const { slidesPerView } = useSlideCount(forecastContainer, 68);

const hasLocation = computed(
  () => Number.isFinite(props.latitude) && Number.isFinite(props.longitude)
);
const selectedDateObj = computed(() => {
  const parts = selectedDateOrToday.value.split('.');
  if (parts.length !== 3) return new Date();
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = 2000 + Number(parts[2]);
  return new Date(year, month - 1, day);
});
const canShowForecast = computed(
  () => hasLocation.value && meteoStore.forecastPossible(selectedDateObj.value)
);

const quasarLang = computed(() => {
  const isoName = $q.lang?.isoName ?? 'de';
  return isoName.split('-')[0];
});
const collection = computed(
  () => props.collection ?? weatherCodesCollection.value ?? 'weather-icons-filled'
);

// Today's index (used as fallback)
const todaySlideIndex = computed(() => {
  const today = new Date();
  const todayStr = formatDate(today, 'YYYY-MM-DD');
  const idx = forecastDays.value.findIndex(d => d.date === todayStr);
  return idx >= 0 ? idx : 0;
});

// Selected date as YYYY-MM-DD string for template comparison
const selectedDateStr = computed(() => formatDate(selectedDateObj.value, 'YYYY-MM-DD'));

// Find the selected date's index for initial scroll position
const selectedSlideIndex = computed(() => {
  const idx = forecastDays.value.findIndex(d => d.date === selectedDateStr.value);
  return idx >= 0 ? idx : todaySlideIndex.value;
});

const onSwiper = (swiper: SwiperType) => {
  swiperInstance.value = swiper;
};

const initializeDateRange = (): WeatherDay[] => {
  const items: WeatherDay[] = [];
  const today = new Date();
  const start = subtractFromDate(today, { days: 4 });
  const end = addToDate(today, { days: 13 });
  let current = new Date(start);
  while (current <= end) {
    items.push({
      date: formatDate(current, 'YYYY-MM-DD'),
      weather_code: null,
      is_day_majority: null,
      temp_min: null,
      temp_max: null,
      rain_sum: null,
      snowfall_sum: null,
      loading: true,
    });
    current = addToDate(current, { days: 1 });
  }
  return items;
};

const lastLoadedKey = ref<string | null>(null);

// Fetch daily forecast data
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
  }

  const latitude = props.latitude as number;
  const longitude = props.longitude as number;
  const elevation = props.elevation;

  error.value = null;

  meteoStore
    .getDaily({ latitude, longitude }, typeof elevation === 'number' ? elevation : undefined, {
      forecastDays: 14,
      pastDays: 4,
      weatherModels: ['meteoswiss_icon_seamless', 'best_match'],
    })
    .then(items => {
      if (!items.length) {
        error.value = t('weather.unavailable');
        return;
      }
      const existing = forecastDays.value.length ? forecastDays.value : initializeDateRange();
      const byDate = new Map(items.map(item => [item.date, item]));
      forecastDays.value = existing.map(item => {
        const incoming = byDate.get(item.date);
        if (!incoming) return item;
        return {
          date: item.date,
          weather_code: incoming.weather_code,
          is_day_majority: incoming.is_day_majority,
          temp_min: incoming.temp_min,
          temp_max: incoming.temp_max,
          rain_sum: incoming.rain_sum,
          snowfall_sum: incoming.snowfall_sum,
          loading: false,
        };
      });
    })
    .catch(() => {
      error.value = t('weather.unavailable');
    });
});

// Scroll to selected date when it changes
watch(
  () => selectedDateStr.value,
  () => {
    if (!canShowForecast.value || !swiperInstance.value) return;
    const idx = selectedSlideIndex.value;
    if (idx >= 0) {
      nextTick(() => {
        swiperInstance.value?.slideTo(idx, 300);
      });
    }
  },
  { immediate: true }
);

// Ensure weather codes are loaded
watchEffect(async () => {
  await meteoStore.getWeatherCodes(quasarLang.value, { collection: collection.value });
});
</script>

<template>
  <div v-if="canShowForecast" ref="forecastContainer" class="wd-weather-forecast">
    <!-- Header -->
    <div class="wd-weather-forecast__header q-mt-sm q-mb-xs">
      <div class="text-subtitle1 text-accent">
        {{ t('weather.title') }}
      </div>
      <div class="wd-weather-forecast__attribution">
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          open-meteo.com
        </a>
        <span class="wd-weather-forecast__disclaimer">({{ t('weather.no_guarantee') }})</span>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="text-caption text-negative q-mb-sm">
      {{ error }}
    </div>

    <!-- Swiper forecast slider -->
    <swiper
      v-if="forecastDays.length"
      :modules="[FreeMode, Scrollbar, Mousewheel]"
      :slides-per-view="slidesPerView"
      :space-between="0"
      :free-mode="{
        enabled: true,
        sticky: false,
        momentum: true,
        momentumRatio: 1,
        momentumBounce: false,
        minimumVelocity: 0.3,
      }"
      :scrollbar="{
        draggable: false,
        hide: true,
        snapOnRelease: false,
      }"
      :mousewheel="{
        enabled: true,
        forceToAxis: false,
        releaseOnEdges: false,
        sensitivity: 0.22,
      }"
      :initial-slide="selectedSlideIndex"
      :grab-cursor="true"
      class="wd-weather-forecast__swiper"
      @swiper="onSwiper"
    >
      <swiper-slide v-for="day in forecastDays" :key="day.date" class="wd-weather-forecast__slide">
        <WdWeatherDay
          :day="day"
          :collection="collection"
          :is-selected="day.date === selectedDateStr"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<style scoped lang="scss">
// Root container: establish width containment so the Swiper's wide
// flex wrapper cannot push this (or any ancestor) wider than the
// available space in the drawer layout.
.wd-weather-forecast {
  overflow: hidden;
}

.wd-weather-forecast__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.wd-weather-forecast__attribution {
  text-align: right;
  font-size: 10px;
  color: rgba(color('dark'), 0.5);
}

.wd-weather-forecast__attribution a {
  color: inherit;
  text-decoration: none;
}

.wd-weather-forecast__attribution a:hover {
  text-decoration: underline;
}

.wd-weather-forecast__disclaimer {
  color: rgba(color('dark'), 0.35);
}

.wd-weather-forecast__swiper {
  width: 100%;
  padding-bottom: 2px;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  // Hide scrollbar when all slides fit
  &.swiper-scrollbar-lock {
    padding-bottom: 0;
    cursor: default;
  }
}

.wd-weather-forecast__slide {
  width: 68px;
  flex-shrink: 0;
}

// Scrollbar styling
.wd-weather-forecast__swiper :deep(.swiper-scrollbar) {
  height: 3px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  bottom: 2px;
}

.wd-weather-forecast__swiper :deep(.swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 2px;
  min-width: 24px;
}

.wd-weather-forecast__swiper :deep(.swiper-scrollbar:hover) {
  height: 5px;
}

.wd-weather-forecast__swiper :deep(.swiper-scrollbar:hover .swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.35);
}
</style>
