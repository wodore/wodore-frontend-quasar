import { ref, watch, type Ref } from 'vue';

export interface WeatherParams {
  lat: number;
  lon: number;
}

export function usePlaceWeather(params: Ref<WeatherParams | undefined>) {
  const weather = ref<Record<string, unknown> | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  watch(
    params,
    async newParams => {
      if (!newParams) {
        weather.value = null;
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        // Fetch weather data using Open-Meteo API
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${newParams.lat}&longitude=${newParams.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }

        const data = await response.json();
        weather.value = data;
      } catch (err) {
        error.value = err as Error;
        console.error('Failed to fetch weather:', err);
      } finally {
        loading.value = false;
      }
    },
    { immediate: true }
  );

  return {
    weather,
    loading,
    error,
  };
}
