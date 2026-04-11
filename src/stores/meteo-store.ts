import { defineStore } from 'pinia';
import { ref, watchEffect } from 'vue';
import { fetchWeatherApi } from 'openmeteo';
import { date } from 'quasar';
import { clientWodore } from '@clients/index';

const { formatDate, addToDate, subtractFromDate } = date;

const DEFAULT_MODELS: WeatherModel[] = ['meteoswiss_icon_seamless', 'best_match'];
//const DEFAULT_SYMBOL_COLLECTION = 'weather-icons-filled'
//const DEFAULT_SYMBOL_COLLECTION = 'meteoswiss-filled'
const DEFAULT_SYMBOL_COLLECTION = 'weather-icons-filled-animated';
const FULL_PAST_DAYS = 7;
const FULL_FORECAST_DAYS = 14;

type WeatherModel = 'meteoswiss_icon_seamless' | 'best_match';

interface LocationInput {
  latitude: number;
  longitude: number;
}

export interface WeatherWindowSummary {
  date: string;
  start_time: string;
  end_time: string;
  weather_code: number | null;
  is_day_majority: boolean | null;
  temp_min: number | null;
  temp_max: number | null;
  wind_min: number | null;
  wind_max: number | null;
  gust_max: number | null;
  sunshine_sum: number | null;
  rain_sum: number | null;
  snowfall_sum: number | null;
  model: string | null;
}

interface HourlyData {
  time: Date[];
  temperature_2m: number[];
  weather_code: number[];
  rain: number[];
  snowfall: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  is_day: number[];
  sunshine_duration: number[];
}

interface CacheEntry {
  updatedAt: number;
  hourly: HourlyData;
}

interface WeatherCodeEntry {
  symbol_day?: string;
  symbol_night?: string;
  [key: string]: unknown;
}

interface CachedWeatherCodes {
  storedAt: number;
  data: Record<string, WeatherCodeEntry>;
}

const WEATHER_CODES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const roundToStep = (value: number, step: number) => Math.round(value / step) * step;

const formatDateKey = (value: Date) => formatDate(value, 'YYYY-MM-DD');

const parseTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(part => Number(part));
  return hours * 60 + minutes;
};

const buildCacheKey = (latitude: number, longitude: number, elevation: number | undefined) => {
  const latRounded = roundToStep(latitude, 0.005);
  const lonRounded = roundToStep(longitude, 0.005);
  const elevRounded = typeof elevation === 'number' ? roundToStep(elevation, 50) : null;
  return `${latRounded}:${lonRounded}:${elevRounded ?? 'na'}`;
};

const summarizeWeatherCode = (codes: number[], minOccurrences: number) => {
  //console.debug('[meteo-store] summarizeWeatherCode', codes, minOccurrences);
  if (codes.length === 0) {
    return null;
  }
  if (codes.length < 5) {
    return Math.max(...codes);
  }
  const counts = new Map<number, number>();
  codes.forEach(code => {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  });
  const frequent = Array.from(counts.entries())
    .filter(([, count]) => count >= minOccurrences)
    .map(([code]) => code);
  if (frequent.length > 0) {
    return Math.max(...frequent);
  }
  return Math.max(...codes);
};

const summarizeDaily = (
  hourly: HourlyData,
  startMinutes: number,
  endMinutes: number,
  minOccurrences: number
) => {
  if (hourly.time.length === 0) {
    console.debug('[meteo-store] hourly time empty');
  }
  const grouped = new Map<
    string,
    {
      temps: number[];
      winds: number[];
      gusts: number[];
      rains: number[];
      snowfalls: number[];
      sunshines: number[];
      codes: number[];
      isDayCount: number;
      totalCount: number;
    }
  >();

  hourly.time.forEach((time, idx) => {
    const minutes = time.getHours() * 60 + time.getMinutes();
    if (minutes < startMinutes || minutes > endMinutes) {
      return;
    }
    const dateKey = formatDateKey(time);
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        temps: [],
        winds: [],
        gusts: [],
        rains: [],
        snowfalls: [],
        sunshines: [],
        codes: [],
        isDayCount: 0,
        totalCount: 0,
      });
    }
    const bucket = grouped.get(dateKey)!;
    const temp = hourly.temperature_2m[idx];
    const wind = hourly.wind_speed_10m[idx];
    const gust = hourly.wind_gusts_10m[idx];
    const rain = hourly.rain[idx];
    const snow = hourly.snowfall[idx];
    const sunshine = hourly.sunshine_duration[idx];
    const code = hourly.weather_code[idx];
    if (Number.isFinite(temp)) bucket.temps.push(temp);
    if (Number.isFinite(wind)) bucket.winds.push(wind);
    if (Number.isFinite(gust)) bucket.gusts.push(gust);
    if (Number.isFinite(rain)) bucket.rains.push(rain);
    if (Number.isFinite(snow)) bucket.snowfalls.push(snow);
    if (Number.isFinite(sunshine)) bucket.sunshines.push(sunshine);
    if (Number.isFinite(code)) bucket.codes.push(code);
    if (hourly.is_day[idx] === 1) {
      bucket.isDayCount += 1;
    }
    bucket.totalCount += 1;
  });

  // Build full-day (00:00-23:59) precipitation sums
  const fullDayPrecip = new Map<string, { rain: number; snowfall: number }>();
  hourly.time.forEach((time, idx) => {
    const dateKey = formatDateKey(time);
    if (!fullDayPrecip.has(dateKey)) {
      fullDayPrecip.set(dateKey, { rain: 0, snowfall: 0 });
    }
    const bucket = fullDayPrecip.get(dateKey)!;
    const rain = hourly.rain[idx];
    const snow = hourly.snowfall[idx];
    if (Number.isFinite(rain)) bucket.rain += rain;
    if (Number.isFinite(snow)) bucket.snowfall += snow;
  });

  // if (grouped.size === 0 && hourly.time.length > 0) {
  //   const sample = hourly.time.slice(0, 3).map((t) => t.toISOString());
  //   // console.debug('[meteo-store] no samples in time window', {
  //   //   startMinutes,
  //   //   endMinutes,
  //   //   firstTimes: sample,
  //   // });
  // }

  const summaries: Record<
    string,
    Omit<WeatherWindowSummary, 'date' | 'model' | 'start_time' | 'end_time'>
  > = {};
  grouped.forEach((bucket, dateKey) => {
    const tempMin = bucket.temps.length > 0 ? Math.min(...bucket.temps) : null;
    const tempMax = bucket.temps.length > 0 ? Math.max(...bucket.temps) : null;
    const windMin = bucket.winds.length > 0 ? Math.min(...bucket.winds) : null;
    const windMax = bucket.winds.length > 0 ? Math.max(...bucket.winds) : null;
    const gustMax = bucket.gusts.length > 0 ? Math.max(...bucket.gusts) : null;
    const sunshineSum =
      bucket.sunshines.length > 0 ? bucket.sunshines.reduce((sum, value) => sum + value, 0) : null;
    const weatherCode = summarizeWeatherCode(bucket.codes, minOccurrences);
    const isDayRatio = bucket.totalCount > 0 ? bucket.isDayCount / bucket.totalCount : 0;
    const isDayMajority = bucket.totalCount > 0 ? isDayRatio >= 0.5 : null;
    // Use full-day precipitation (not just time window)
    const fullDay = fullDayPrecip.get(dateKey);
    const rainSum = fullDay ? (fullDay.rain > 0 ? fullDay.rain : null) : null;
    const snowfallSum = fullDay ? (fullDay.snowfall > 0 ? fullDay.snowfall : null) : null;
    summaries[dateKey] = {
      weather_code: weatherCode,
      is_day_majority: isDayMajority,
      temp_min: tempMin,
      temp_max: tempMax,
      wind_min: windMin,
      wind_max: windMax,
      gust_max: gustMax,
      sunshine_sum: sunshineSum,
      rain_sum: rainSum,
      snowfall_sum: snowfallSum,
    };
  });
  return summaries;
};

export const useMeteoStore = defineStore('meteo', () => {
  const cache = ref<Record<string, CacheEntry>>({});
  const weatherCodes = ref<Record<string, WeatherCodeEntry>>({});
  const weatherCodesLang = ref('de');
  const weatherCodesCollection = ref(DEFAULT_SYMBOL_COLLECTION);
  const weatherCodesCache = ref<Record<string, Record<string, WeatherCodeEntry>>>({});
  const weatherCodesInFlight = ref<Set<string>>(new Set());
  const weatherCodesLastFetchKey = ref<string | null>(null);

  const forecastPossible = (value: Date | string) => {
    const selected = new Date(value);
    if (Number.isNaN(selected.getTime())) {
      return false;
    }
    const today = new Date();
    const start = subtractFromDate(today, { days: FULL_PAST_DAYS });
    const end = addToDate(today, { days: FULL_FORECAST_DAYS });
    const selectedDate = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    return selectedDate >= start && selectedDate <= end;
  };

  const fetchWeatherCodes = async (lang: string, collection: string) => {
    const { data, error } = await clientWodore.GET('/v1/meteo/weather_codes', {
      params: {
        query: {
          lang,
          collection,
          include_symbols: 'all',
          include_category: 'no',
          include_collection: 'no',
        },
      },
    });
    if (error || !data) {
      return null;
    }
    return data as Record<string, WeatherCodeEntry>;
  };

  /** Parse localStorage value, handling both old (raw data) and new (envelope) formats */
  const parseCachedWeatherCodes = (raw: string): CachedWeatherCodes | null => {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // New envelope format
      if (typeof parsed.storedAt === 'number' && parsed.data && typeof parsed.data === 'object') {
        return parsed as unknown as CachedWeatherCodes;
      }
      // Old format — wrap it so we can still use the data but flag it as stale
      return { storedAt: 0, data: parsed as unknown as Record<string, WeatherCodeEntry> };
    } catch {
      return null;
    }
  };

  /** Background refresh: fetch and update cache without blocking callers */
  const refreshWeatherCodesCache = async (lang: string, collection: string, key: string) => {
    if (weatherCodesInFlight.value.has(key)) {
      return;
    }
    weatherCodesInFlight.value.add(key);
    const data = await fetchWeatherCodes(lang, collection);
    if (data) {
      weatherCodesCache.value[key] = data;
      weatherCodes.value = data;
      const envelope: CachedWeatherCodes = { storedAt: Date.now(), data };
      localStorage.setItem(key, JSON.stringify(envelope));
    }
    weatherCodesInFlight.value.delete(key);
  };

  const getWeatherCodes = async (
    lang: string,
    options: { collection: string }
  ): Promise<Record<string, WeatherCodeEntry>> => {
    const collection = options.collection;
    const key = `weather_codes:${lang}:${collection}`;

    // 1. In-memory cache — return immediately
    if (weatherCodesCache.value[key]) {
      weatherCodes.value = weatherCodesCache.value[key];
      return weatherCodesCache.value[key];
    }

    // 2. localStorage — stale-while-revalidate
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = parseCachedWeatherCodes(raw);
      if (cached) {
        weatherCodesCache.value[key] = cached.data;
        weatherCodes.value = cached.data;

        // If cache is older than TTL, refresh in background
        if (Date.now() - cached.storedAt > WEATHER_CODES_CACHE_TTL) {
          void refreshWeatherCodesCache(lang, collection, key);
        }
        return cached.data;
      }
    }

    // 3. No cache at all — fetch from API
    if (weatherCodesInFlight.value.has(key)) {
      return weatherCodes.value;
    }
    weatherCodesInFlight.value.add(key);
    const data = await fetchWeatherCodes(lang, collection);
    if (data) {
      weatherCodesCache.value[key] = data;
      weatherCodes.value = data;
      const envelope: CachedWeatherCodes = { storedAt: Date.now(), data };
      localStorage.setItem(key, JSON.stringify(envelope));
      return data;
    }
    weatherCodesInFlight.value.delete(key);
    return weatherCodes.value;
  };

  const setWeatherCodesContext = (lang: string, collection?: string) => {
    if (weatherCodesLang.value !== lang) {
      weatherCodesLang.value = lang;
    }
    if (collection && weatherCodesCollection.value !== collection) {
      weatherCodesCollection.value = collection;
    }
  };

  watchEffect(() => {
    const key = `weather_codes:${weatherCodesLang.value}:${weatherCodesCollection.value}`;
    const cached =
      weatherCodesCache.value[key] ??
      (() => {
        const stored = localStorage.getItem(key);
        if (!stored) {
          return null;
        }
        return parseCachedWeatherCodes(stored)?.data ?? null;
      })();
    if (cached) {
      weatherCodesCache.value[key] = cached;
      weatherCodes.value = cached;
    }
    if (weatherCodesLastFetchKey.value === key) {
      return;
    }
    weatherCodesLastFetchKey.value = key;
    void getWeatherCodes(weatherCodesLang.value, {
      collection: weatherCodesCollection.value,
    });
  });

  const fetchHourly = async ({
    latitude,
    longitude,
    elevation,
    timezone,
    models,
  }: {
    latitude: number;
    longitude: number;
    elevation?: number;
    timezone: string;
    models: string[];
  }) => {
    const params: Record<string, unknown> = {
      latitude,
      longitude,
      hourly: [
        'temperature_2m',
        'weather_code',
        'rain',
        'snowfall',
        'wind_speed_10m',
        'wind_gusts_10m',
        'is_day',
        'sunshine_duration',
      ],
      models,
      timezone,
      past_days: FULL_PAST_DAYS,
      forecast_days: FULL_FORECAST_DAYS,
    };
    if (typeof elevation === 'number' && elevation != 0) {
      params.elevation = elevation;
    }
    const responses = await fetchWeatherApi('https://api.open-meteo.com/v1/forecast', params);

    //console.debug('[meteo-store] open-meteo response:', responses);
    const result: Record<string, HourlyData> = {};
    for (const response of responses) {
      const hourly = response.hourly();
      // console.debug('[meteo-store] open-meteo hourly:', hourly);
      if (!hourly) {
        continue;
      }
      const utcOffsetSeconds = response.utcOffsetSeconds();
      const interval = hourly.interval();
      const timeStart = Number(hourly.time());
      const timeEnd = Number(hourly.timeEnd());
      const length = (timeEnd - timeStart) / interval;
      const time = Array.from({ length }, (_, i) => {
        const timestamp = (timeStart + i * interval + utcOffsetSeconds) * 1000;
        return new Date(timestamp);
      });
      const temperature = hourly.variables(0)?.valuesArray() ?? [];
      const weatherCode = hourly.variables(1)?.valuesArray() ?? [];
      const rain = hourly.variables(2)?.valuesArray() ?? [];
      const snowfall = hourly.variables(3)?.valuesArray() ?? [];
      const windSpeed = hourly.variables(4)?.valuesArray() ?? [];
      const windGusts = hourly.variables(5)?.valuesArray() ?? [];
      const isDay = hourly.variables(6)?.valuesArray() ?? [];
      const sunshine = hourly.variables(7)?.valuesArray() ?? [];

      // console.debug('[meteo-store] hourly model stats', {
      //   model: response.model(),
      //   timeCount: time.length,
      //   tempSample: Array.from(temperature).slice(0, 3),
      //   codeSample: Array.from(weatherCode).slice(0, 3),
      //   rainSample: Array.from(rain).slice(0, 3),
      // });

      result[response.model()] = {
        time,
        temperature_2m: Array.from(temperature),
        weather_code: Array.from(weatherCode),
        rain: Array.from(rain),
        snowfall: Array.from(snowfall),
        wind_speed_10m: Array.from(windSpeed),
        wind_gusts_10m: Array.from(windGusts),
        is_day: Array.from(isDay),
        sunshine_duration: Array.from(sunshine),
      };
    }
    const orderedModels = models.filter(model => model in result);
    const fallbackModels = orderedModels.length > 0 ? orderedModels : Object.keys(result);
    const primary = result[fallbackModels[0]] ?? Object.values(result)[0];
    // console.debug('[meteo-store] primary', primary);
    if (!primary) {
      return null;
    }
    const combined: HourlyData = {
      time: primary.time,
      temperature_2m: [],
      weather_code: [],
      rain: [],
      snowfall: [],
      wind_speed_10m: [],
      wind_gusts_10m: [],
      is_day: [],
      sunshine_duration: [],
    };
    const length = primary.time.length;
    type NumericHourlyField =
      | 'temperature_2m'
      | 'weather_code'
      | 'rain'
      | 'snowfall'
      | 'wind_speed_10m'
      | 'wind_gusts_10m'
      | 'is_day'
      | 'sunshine_duration';
    const pickValue = (field: NumericHourlyField, idx: number) => {
      for (const model of fallbackModels) {
        const series = result[model][field];
        const value = series[idx];
        if (value !== null && value !== undefined && !Number.isNaN(value)) {
          return value;
        }
      }
      return null;
    };
    for (let idx = 0; idx < length; idx += 1) {
      combined.temperature_2m.push(pickValue('temperature_2m', idx) ?? NaN);
      combined.weather_code.push(pickValue('weather_code', idx) ?? NaN);
      combined.rain.push(pickValue('rain', idx) ?? NaN);
      combined.snowfall.push(pickValue('snowfall', idx) ?? NaN);
      combined.wind_speed_10m.push(pickValue('wind_speed_10m', idx) ?? NaN);
      combined.wind_gusts_10m.push(pickValue('wind_gusts_10m', idx) ?? NaN);
      combined.is_day.push(pickValue('is_day', idx) ?? NaN);
      combined.sunshine_duration.push(pickValue('sunshine_duration', idx) ?? NaN);
    }
    // console.debug('[meteo-store] Length, Combined data', length, combined);
    return combined;
  };

  const fetchCachedHourly = async ({
    latitude,
    longitude,
    elevation,
    timezone,
    models,
  }: {
    latitude: number;
    longitude: number;
    elevation?: number;
    timezone: string;
    models: string[];
  }) => {
    const key = buildCacheKey(latitude, longitude, elevation);
    const now = Date.now();
    const cached = cache.value[key];
    const needsRefresh = !cached || now - cached.updatedAt > 30 * 60 * 1000;

    if (needsRefresh) {
      const hourly = await fetchHourly({
        latitude,
        longitude,
        elevation,
        timezone,
        models,
      });
      if (!hourly) {
        return null;
      }
      // console.log('[meteo-store] fetched hourly summary', {
      //   key,
      //   timeCount: hourly.time.length,
      // });
      cache.value[key] = {
        updatedAt: now,
        hourly,
      };
    }

    return cache.value[key]?.hourly ?? null;
  };

  const getDaily = async (
    location: LocationInput,
    elevation?: number,
    options?: {
      startDate?: 'now' | string | Date;
      startTime?: string;
      endTime?: string;
      forecastDays?: number;
      pastDays?: number;
      weatherModels: string[];
      weatherCodeMinOccurrences?: number;
      timezone?: string;
    }
  ): Promise<WeatherWindowSummary[]> => {
    const startDateInput = options?.startDate ?? 'now';
    const startTime = options?.startTime ?? '05:00';
    const endTime = options?.endTime ?? '19:00';
    const forecastDays = options?.forecastDays ?? 14;
    const pastDays = options?.pastDays ?? 7;
    const timezone = options?.timezone ?? 'Europe/Berlin';
    const weatherCodeMinOccurrences = options?.weatherCodeMinOccurrences ?? 3;
    const models = options?.weatherModels ?? DEFAULT_MODELS;
    // const hourly = await fetchCachedHourly({
    const hourly = await fetchHourly({
      latitude: location.latitude,
      longitude: location.longitude,
      elevation,
      timezone,
      models,
    });

    // console.log('[meteo-store] Cached Fetched Hourly data', hourly);

    if (!hourly) {
      return [];
    }

    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);

    const summariesByModel: Record<
      string,
      Record<string, Omit<WeatherWindowSummary, 'date' | 'model' | 'start_time' | 'end_time'>>
    > = {
      combined: summarizeDaily(hourly, startMinutes, endMinutes, weatherCodeMinOccurrences),
    };
    // console.log('Sumarized by model', summariesByModel);

    const selectedDate =
      startDateInput === 'now' || startDateInput === undefined
        ? new Date()
        : new Date(startDateInput);
    let startDate = subtractFromDate(selectedDate, { days: pastDays });
    let endDate = addToDate(selectedDate, { days: forecastDays - 1 });
    if (hourly.time.length > 0) {
      const minDate = new Date(
        hourly.time[0].getFullYear(),
        hourly.time[0].getMonth(),
        hourly.time[0].getDate()
      );
      const last = hourly.time[hourly.time.length - 1];
      const maxDate = new Date(last.getFullYear(), last.getMonth(), last.getDate());
      if (startDate < minDate) {
        startDate = minDate;
      }
      if (endDate > maxDate) {
        endDate = maxDate;
      }
    }
    if (startDate > endDate) {
      return [];
    }
    const results: WeatherWindowSummary[] = [];
    let current = new Date(startDate);
    const pickField = <
      K extends keyof Omit<WeatherWindowSummary, 'date' | 'model' | 'start_time' | 'end_time'>,
    >(
      dateKey: string,
      field: K
    ): Omit<WeatherWindowSummary, 'date' | 'model' | 'start_time' | 'end_time'>[K] | null => {
      const modelSummary = summariesByModel.combined?.[dateKey];
      if (modelSummary && modelSummary[field] !== null) {
        return modelSummary[field];
      }
      return null;
    };

    const pickIconModel = (dateKey: string) => {
      const modelSummary = summariesByModel.combined?.[dateKey];
      if (modelSummary && modelSummary.weather_code !== null) {
        return {
          isDayMajority: modelSummary.is_day_majority,
          model: models[0] ?? null,
        };
      }
      return { isDayMajority: null, model: null };
    };

    while (current <= endDate) {
      const dateKey = formatDateKey(current);
      const { isDayMajority, model } = pickIconModel(dateKey);
      results.push({
        date: dateKey,
        start_time: startTime,
        end_time: endTime,
        weather_code: pickField(dateKey, 'weather_code'),
        is_day_majority: isDayMajority,
        temp_min: pickField(dateKey, 'temp_min'),
        temp_max: pickField(dateKey, 'temp_max'),
        wind_min: pickField(dateKey, 'wind_min'),
        wind_max: pickField(dateKey, 'wind_max'),
        gust_max: pickField(dateKey, 'gust_max'),
        sunshine_sum: pickField(dateKey, 'sunshine_sum'),
        rain_sum: pickField(dateKey, 'rain_sum'),
        snowfall_sum: pickField(dateKey, 'snowfall_sum'),
        model,
      });
      current = addToDate(current, { days: 1 });
    }
    // console.log('[meteo-store] summary sample:', {
    //   first: results[0],
    //   last: results[results.length - 1],
    //   count: results.length,
    // });
    return results;
  };

  return {
    forecastPossible,
    fetchCachedHourly,
    fetchHourly,
    getDaily,
    getWeatherCodes,
    setWeatherCodesContext,
    weatherCodes,
    weatherCodesCollection,
    weatherCodesLang,
  };
});
