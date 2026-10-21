import { computed, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useHutsStore } from '@stores/huts-store';
import { useMeteoStore } from '@stores/meteo-store';

/**
 * useWeatherPossible — whether a weather read EXISTS for the currently
 * selected date (owner 2026-10).
 *
 * The meteo forecast covers ±14 days (meteo-store FULL_FORECAST_DAYS).
 * With no date selected, today is used and weather always exists; with a
 * far date picked in the topbar pill there is NO weather — the briefing
 * row's weather read and the content's forecast block both collapse, and
 * the detail card's expanded floor drops the weather block's height
 * accordingly. One composable so all three surfaces agree.
 */
export function useWeatherPossible(): Ref<boolean> {
  const { selectedDateOrToday } = storeToRefs(useHutsStore());
  const meteoStore = useMeteoStore();

  return computed(() => {
    const parts = (selectedDateOrToday.value ?? '').split('.');
    const date =
      parts.length === 3
        ? new Date(Number(`20${parts[2]}`), Number(parts[1]) - 1, Number(parts[0]))
        : new Date();
    return meteoStore.forecastPossible(date);
  });
}
