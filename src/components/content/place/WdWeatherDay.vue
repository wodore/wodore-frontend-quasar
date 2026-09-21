<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useMeteoStore } from '@stores/meteo-store';
import { storeToRefs } from 'pinia';
import WdDayLabel from './WdDayLabel.vue';

const { t } = useI18n();
const $q = useQuasar();
const meteoStore = useMeteoStore();
const { weatherCodesCollection } = storeToRefs(meteoStore);

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

const props = withDefaults(
  defineProps<{
    day: WeatherDay;
    collection?: string;
    /** Icon size in pixels (default: 36) */
    size?: number;
    /** CSS color to recolor the icon and text (e.g. "grey-7" or "#555") */
    color?: string;
    /** Whether this day is the currently selected date */
    isSelected?: boolean;
  }>(),
  {
    size: 44,
    color: undefined,
    isSelected: false,
  }
);

const quasarLang = computed(() => {
  const isoName = $q.lang?.isoName ?? 'de';
  return isoName.split('-')[0];
});
const resolvedCollection = computed(
  () => props.collection ?? weatherCodesCollection.value ?? 'weather-icons-filled'
);

// Local weather codes ref (independent of global store state, like WdWeatherSelect)
const localWeatherCodes = ref<Record<string, Record<string, unknown>>>({});

watchEffect(async () => {
  const codes = await meteoStore.getWeatherCodes(quasarLang.value, {
    collection: resolvedCollection.value,
  });
  if (codes) {
    localWeatherCodes.value = codes;
  }
});

const dateObj = computed(() => new Date(`${props.day.date}T00:00:00`));
const todayMidnight = computed(() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
});
const dayDiff = computed(() =>
  Math.round((dateObj.value.getTime() - todayMidnight.value.getTime()) / 86400000)
);
const isToday = computed(() => dayDiff.value === 0);
const isPast = computed(() => dayDiff.value < 0);
const isLoading = computed(() => props.day.loading === true);

const iconEntry = computed(() => {
  if (props.day.weather_code === null) return null;
  return localWeatherCodes.value[String(props.day.weather_code)] ?? null;
});
const iconUrl = computed(() => {
  if (!iconEntry.value) return null;
  const isDay = props.day.is_day_majority !== false;
  const symbolKey = isDay ? 'symbol_day' : 'symbol_night';
  const url = (iconEntry.value as Record<string, unknown>)[symbolKey] as string | undefined;
  return url ?? null;
});
const iconDescription = computed(() => {
  const entry = iconEntry.value as Record<string, unknown> | null;
  if (!entry) return '';
  const isDay = props.day.is_day_majority !== false;
  return (
    ((isDay ? entry.description_day : entry.description_night) as string | undefined) ??
    (entry.description as string | undefined) ??
    ''
  );
});
const tempMax = computed(() =>
  props.day.temp_max !== null ? Math.round(props.day.temp_max) : null
);
const tempMin = computed(() =>
  props.day.temp_min !== null ? Math.round(props.day.temp_min) : null
);
const hasRange = computed(
  () => tempMin.value !== null && tempMax.value !== null && tempMin.value !== tempMax.value
);
const rainSum = computed(() => props.day.rain_sum);
const snowfallSum = computed(() => props.day.snowfall_sum);
const hasRain = computed(() => rainSum.value !== null && rainSum.value > 0);
const hasSnowfall = computed(() => snowfallSum.value !== null && snowfallSum.value > 0);

/** Format precipitation with smart unit conversion: mm → cm → m */
const formatPrecip = (mm: number): { value: string; unit: string } => {
  if (mm >= 1000) {
    return { value: (mm / 1000).toFixed(1), unit: 'm' };
  }
  if (mm >= 10) {
    return { value: (mm / 10).toFixed(1), unit: 'cm' };
  }
  return { value: mm.toFixed(1), unit: 'mm' };
};

// Rain comes from Open-Meteo in mm, snowfall in cm — normalize both to mm for conversion
const rainDisplay = computed(() => {
  if (!hasRain.value) return null;
  return formatPrecip(rainSum.value!);
});
const snowfallDisplay = computed(() => {
  if (!hasSnowfall.value) return null;
  // Snowfall from API is in cm, convert to mm for unified formatting
  return formatPrecip(snowfallSum.value! * 10);
});

// Full labels for tooltip (with unit)
const rainLabel = computed(() => {
  if (!rainDisplay.value) return null;
  return `${rainDisplay.value.value} ${rainDisplay.value.unit}`;
});
const snowfallLabel = computed(() => {
  if (!snowfallDisplay.value) return null;
  return `${snowfallDisplay.value.value} ${snowfallDisplay.value.unit}`;
});

// Tooltip content: line 1 = description, line 2 = max/min temp with °C
const tooltipContent = computed(() => {
  const lines: string[] = [];
  if (iconDescription.value) {
    lines.push(iconDescription.value);
  }
  if (tempMax.value !== null && tempMin.value !== null) {
    lines.push(`${tempMax.value}°C / ${tempMin.value}°C`);
  } else if (tempMax.value !== null) {
    lines.push(`${tempMax.value}°C`);
  }
  if (rainLabel.value) {
    lines.push(`${t('weather.rain')}: ${rainLabel.value}`);
  }
  if (snowfallLabel.value) {
    lines.push(`${t('weather.snowfall')}: ${snowfallLabel.value}`);
  }
  return lines;
});
</script>

<template>
  <div
    class="wd-weather-day column items-center"
    :class="{
      'wd-weather-day--today': isToday,
      'wd-weather-day--past': isPast && !isToday,
      'wd-weather-day--selected': isSelected,
    }"
  >
    <!-- Day name + date -->
    <WdDayLabel :date="day.date" :is-active="isSelected || isToday" />

    <!-- Weather icon -->
    <div class="wd-weather-day__icon">
      <q-skeleton v-if="isLoading" type="circle" :width="`${size}px`" :height="`${size}px`" />
      <template v-else-if="iconUrl">
        <img
          :src="iconUrl"
          :width="size"
          :height="size"
          style="object-fit: contain"
          loading="eager"
        />
        <q-tooltip v-if="tooltipContent.length" :delay="700">
          <div v-for="(line, i) in tooltipContent" :key="i">{{ line }}</div>
        </q-tooltip>
      </template>
      <div
        v-else
        class="wd-weather-day__icon-empty"
        :style="{ width: `${size}px`, height: `${size}px` }"
      />
    </div>

    <!-- Temperature: max first (bold), then min -->
    <div class="wd-weather-day__temps">
      <template v-if="isLoading">
        <q-skeleton type="text" width="44px" height="12px" />
      </template>
      <template v-else-if="hasRange">
        <span class="wd-weather-day__temp-max">{{ tempMax }}°</span>
        <span class="wd-weather-day__temp-sep">&nbsp;</span>
        <span class="wd-weather-day__temp-min">{{ tempMin }}°</span>
      </template>
      <template v-else-if="tempMax !== null">
        <span class="wd-weather-day__temp-max">{{ tempMax }}°</span>
      </template>
      <template v-else>
        <span class="wd-weather-day__temp-empty">--</span>
      </template>
    </div>

    <!-- Precipitation (only when rain or snow > 0) -->
    <div v-if="!isLoading && (hasRain || hasSnowfall)" class="wd-weather-day__precip">
      <span v-if="hasRain" class="wd-weather-day__rain">
        <q-icon name="wd-rain" size="10px" />
        {{ rainDisplay!.value }}{{ rainDisplay!.unit }}
      </span>
      <span v-if="hasSnowfall" class="wd-weather-day__snow">
        <q-icon name="wd-snow" size="10px" />
        {{ snowfallDisplay!.value }}{{ snowfallDisplay!.unit }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.wd-weather-day {
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  padding: 6px 4px 5px;
  border-radius: 10px;
  user-select: none;
  box-sizing: border-box;
  transition: background-color 0.2s ease;
}

.wd-weather-day--past {
  opacity: 0.6;
}

.wd-weather-day--today {
  opacity: 1;
}

.wd-weather-day--selected {
  background: rgba(color('accent'), 0.12);
}

.wd-weather-day__icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.wd-weather-day__icon :deep(img) {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}

.wd-weather-day__icon-empty {
  /* size set via inline style */
}

.wd-weather-day__temps {
  font-size: 11px;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;

  @media (min-width: 600px) {
    font-size: 12px;
  }
}

.wd-weather-day__temp-max {
  color: rgba(color('dark'), 0.85);
  font-weight: 600;
}

.wd-weather-day__temp-sep {
  display: inline;
}

.wd-weather-day__temp-min {
  color: rgba(color('dark'), 0.45);
  font-weight: 400;
}

.wd-weather-day__temp-empty {
  color: rgba(color('dark'), 0.3);
  letter-spacing: 2px;
}

.wd-weather-day__precip {
  font-size: 9px;
  line-height: 1.3;
  min-height: 12px;
  margin-top: 1px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  flex-direction: column;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;

  @media (min-width: 600px) {
    font-size: 10px;
  }
}

.wd-weather-day__rain,
.wd-weather-day__snow {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.wd-weather-day__rain {
  color: rgba(color('dark'), 0.55);
}

.wd-weather-day__snow {
  color: rgba(color('dark'), 0.45);
}
</style>
