import { ref, watch, type Ref } from 'vue';
import { clientWodore } from '@clients/index';
import { currentLocale } from '@services/locale';

/**
 * useHutAvailabilityStatus — the occupancy status of ONE hut on ONE date.
 *
 * Feeds the header-brow availability chip (owner 2026-10: the go/no-go
 * read next to the weather — "is the weather OK AND are there beds" on
 * the date the user selected in the topbar pill; today when unset).
 * Fetches the same endpoint the availability strip uses, `days=1`,
 * module-cached per date+slug so re-opens and date flips are instant.
 */
export interface HutAvailabilityDayStatus {
  status: string;
  free: number | null | undefined;
  total: number | null | undefined;
}

const cache = new Map<string, HutAvailabilityDayStatus>();
const pending = new Map<string, Promise<HutAvailabilityDayStatus>>();

async function fetchStatus(
  slug: string,
  dateISO: string
): Promise<HutAvailabilityDayStatus> {
  const { data, error } = await clientWodore.GET('/v1/huts/{slug}/availability/{date}', {
    params: {
      path: { slug, date: dateISO },
      query: { lang: currentLocale(), days: 1 },
    },
  });
  if (error || !data || !('data' in data) || !Array.isArray(data.data) || !data.data.length) {
    return { status: 'unknown', free: undefined, total: undefined };
  }
  const day = data.data[0];
  return { status: day.occupancy_status ?? 'unknown', free: day.free, total: day.total };
}

function getStatus(slug: string, dateISO: string): Promise<HutAvailabilityDayStatus> {
  const key = `${dateISO}::${slug}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);

  const inflight = pending.get(key);
  if (inflight) return inflight;

  const request = fetchStatus(slug, dateISO)
    .then(status => {
      cache.set(key, status);
      return status;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function useHutAvailabilityStatus(slug: Ref<string | undefined>, dateISO: Ref<string>) {
  const status = ref<HutAvailabilityDayStatus | null>(null);

  watch(
    [slug, dateISO],
    async ([newSlug, newDate]) => {
      if (!newSlug || !newDate) {
        status.value = null;
        return;
      }
      status.value = cache.get(`${newDate}::${newSlug}`) ?? null;
      try {
        status.value = await getStatus(newSlug, newDate);
      } catch {
        status.value = null;
      }
    },
    { immediate: true }
  );

  return { status };
}
