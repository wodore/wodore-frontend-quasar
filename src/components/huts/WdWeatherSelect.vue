<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import { useMeteoStore } from '@stores/meteo-store';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdIcon from 'components/utils/WdIcon.vue';

const props = withDefaults(
  defineProps<{
    latitude: number;
    longitude: number;
    elevation?: number;
    collection?: string;
    targetId?: string;
    /** Icon size in pixels (default: 48) */
    size?: number;
    /** When true, the drop-shadow on the icon is removed */
    noShadow?: boolean;
    /** When true, shows the condition text next to the icon instead of a tooltip */
    label?: boolean;
    /** CSS color to recolor the icon and label text (e.g. "grey-7" or "#555") */
    color?: string;
  }>(),
  {
    size: 48,
    noShadow: false,
    label: false,
    color: undefined,
  }
);

const { selectedDateOrToday } = storeToRefs(useHutsStore());
const meteoStore = useMeteoStore();
const { weatherCodesCollection } = storeToRefs(meteoStore);
const { t } = useI18n();
const $q = useQuasar();
const isMobile = computed(() => $q.platform.is.mobile);

const quasarLang = computed(() => {
  const isoName = $q.lang?.isoName ?? 'de';
  return isoName.split('-')[0];
});
const collection = computed(
  () => props.collection ?? weatherCodesCollection.value ?? 'weather-icons-filled'
);

// Local weather codes ref so this component doesn't depend on the global store state
const localWeatherCodes = ref<Record<string, Record<string, unknown>>>({});

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

const canShow = computed(() => meteoStore.forecastPossible(selectedDateObj.value));

const summary = ref<{
  weather_code: number | null;
  is_day_majority: boolean | null;
} | null>(null);
const loading = ref(false);

const iconEntry = computed(() => {
  const code = summary.value?.weather_code;
  if (code === null || code === undefined) {
    return null;
  }
  return localWeatherCodes.value[String(code)] ?? null;
});
const iconUrl = computed(() => {
  if (!iconEntry.value) {
    return null;
  }
  const isDay = summary.value?.is_day_majority !== false;
  const symbolKey = isDay ? 'symbol_day' : 'symbol_night';
  const url = (iconEntry.value as Record<string, unknown>)[symbolKey] as string | undefined;
  return url ?? null;
});
const iconDescription = computed(() => {
  const entry = iconEntry.value as Record<string, unknown> | null;
  if (!entry) {
    return '';
  }
  const isDay = summary.value?.is_day_majority !== false;
  return (
    ((isDay ? entry.description_day : entry.description_night) as string | undefined) ??
    (entry.description as string | undefined) ??
    ''
  );
});
const selectedDayLabel = computed(() => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = selectedDateObj.value.toDateString();
  if (key === today.toDateString()) {
    return t('weather.today');
  }
  if (key === tomorrow.toDateString()) {
    return t('weather.tomorrow');
  }
  if (key === yesterday.toDateString()) {
    return t('weather.yesterday');
  }
  const dayName = selectedDateObj.value.toLocaleDateString('de-CH', {
    weekday: 'long',
  });
  const dateStr = selectedDateObj.value.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${dayName}, ${dateStr}`;
});
const conditionLabel = computed(() => {
  if (!iconDescription.value) {
    return '';
  }
  return `${selectedDayLabel.value}<br><strong>${iconDescription.value}</strong>`;
});
const targetId = computed(() => props.targetId ?? 'weather-forecast-section');

const scrollToForecast = () => {
  const el = document.getElementById(targetId.value);
  if (!el) {
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// Fetch weather codes for this component's own collection (independent of the global store)
watchEffect(async () => {
  const codes = await meteoStore.getWeatherCodes(quasarLang.value, {
    collection: collection.value,
  });
  if (codes) {
    localWeatherCodes.value = codes;
  }
});

watchEffect(() => {
  if (!canShow.value) {
    summary.value = null;
    return;
  }
  loading.value = true;
  // console.debug('[weather-select] fetch', {
  //   date: selectedDateObj.value,
  //   collection: collection.value,
  // });
  meteoStore
    .getDaily({ latitude: props.latitude, longitude: props.longitude }, props.elevation, {
      startDate: selectedDateObj.value,
      forecastDays: 1,
      pastDays: 0,
      weatherModels: ['meteoswiss_icon_seamless', 'best_match'],
    })
    .then(items => {
      // console.debug('[weather-select] daily result', {
      //   count: items.length,
      //   first: items[0],
      // });
      summary.value = items[0]
        ? {
            weather_code: items[0].weather_code,
            is_day_majority: items[0].is_day_majority,
          }
        : null;
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>

<template>
  <span v-if="canShow" class="weather-select" @click="isMobile && scrollToForecast()">
    <WdIcon
      v-if="iconUrl"
      :name="iconUrl"
      :size="`${size}px`"
      :color="color"
      :style="!noShadow ? 'filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))' : undefined"
    />
    <span v-else class="weather-select__empty"></span>
    <span v-if="label && iconDescription" class="weather-select__label">{{ iconDescription }}</span>
    <q-tooltip
      v-if="!label && conditionLabel"
      :delay="$q.platform.is.mobile ? 100 : 500"
      :hide-delay="$q.platform.is.mobile ? 800 : 200"
    >
      <span v-html="conditionLabel"></span>
    </q-tooltip>
  </span>
</template>

<style scoped lang="scss">
.weather-select {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  vertical-align: middle;
  cursor: pointer;
  flex-shrink: 0;
}

.weather-select__empty {
  width: v-bind('`${size}px`');
  height: v-bind('`${size}px`');
}

.weather-select__label {
  white-space: nowrap;
}
</style>
