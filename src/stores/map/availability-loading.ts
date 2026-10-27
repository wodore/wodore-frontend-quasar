/**
 * Availability date-load spinner state.
 *
 * Module-scope ref shared by two owners on purpose: the writer is the
 * map-catalog store (the date pick swaps the wd-bookings tile URLs and
 * settles the spinner on the map's `sourcedata` event — map-coupled
 * logic that stays there), while the reader is WdSelectDate's spinner
 * glyph. Keeping the ref in this dependency-free module lets
 * WdSelectDate — bundled into the eager MainLayout chunk — share the
 * state WITHOUT statically importing the map-store cluster chunk,
 * which would drag the MapLibre vendor chunk onto every crawler's
 * download list (follow-up to PR #347).
 */
import { ref } from 'vue';

/** True from the date pick's setTiles call until the tile source
 * settles — held for a 600ms minimum so the user always sees the
 * state change (empty 204 tiles included). */
export const availabilityLoading = ref(false);

/** Spinner bookkeeping shared by both owners (gen counter + shown-at
 * timestamp + the manual-settle flag for non-MapLibre renderers). */
export const availabilitySpinner = {
  gen: 0,
  shownAt: 0,
  manualSettle: false,
};
export const AVAILABILITY_MIN_SPIN_MS = 600;

/** Settle the spinner (600ms minimum applies); gen-guarded. */
export function settleAvailabilitySpinner(): void {
  const { gen, shownAt } = availabilitySpinner;
  const elapsed = performance.now() - shownAt;
  const remaining = AVAILABILITY_MIN_SPIN_MS - elapsed;
  if (remaining > 0) {
    setTimeout(() => {
      if (availabilitySpinner.gen === gen) availabilityLoading.value = false;
    }, remaining);
  } else {
    availabilityLoading.value = false;
  }
}

/** Begin a spinner cycle (bumps the generation, stamps the time). */
export function beginAvailabilitySpinner(): void {
  availabilitySpinner.gen += 1;
  availabilitySpinner.shownAt = performance.now();
  availabilityLoading.value = true;
}

/** Manual begin/settle for non-MapLibre availability renderers (the
 *  Leaflet fallback): settle when THEIR data is rendered. */
export function beginAvailabilityLoadManual(): void {
  beginAvailabilitySpinner();
}

export function settleAvailabilityLoadManual(): void {
  settleAvailabilitySpinner();
}

export function setAvailabilityManualSettle(on: boolean): void {
  availabilitySpinner.manualSettle = on;
}

/** DD.MM.YY picker format → ISO (or undefined for unparseable input).
 *  Shared by the map-catalog store (runtime {{date}} tokens) and the
 *  Leaflet fallback (availability tile URLs) — one normalization. */
export function toIsoDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const euro = input.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);
  if (euro) {
    const year = euro[3]!.length === 2 ? `20${euro[3]}` : euro[3]!;
    return `${year}-${euro[2]}-${euro[1]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return undefined;
}
