/**
 * usePlace — PR1a COMPAT wrapper over the generalized `usePlaceDetail`
 * engine (OpenSpec `add-place-interactions`). The hut fetch (incl. the
 * deep-link prefetch handoff) and the MVT identity seed keep their exact
 * legacy behavior; the accommodation entry (task group 4) takes over the
 * fetch/seed definitions from here.
 *
 * Public surface is unchanged for the PR1a consumers (WdContentPanel,
 * WdPlace* components, both map views' seedPlaceFromMap calls).
 */
import { computed, ref, type Ref } from 'vue';
import { consumePrefetchedHut } from '@services/hut-prefetch';
import { clientWodore, type schemasWodore } from '@clients/index';
import { currentLocale } from '@services/locale';
import {
  PlaceRequestError,
  stagePrebuiltSeed,
  usePlaceDetail,
  type PlaceError,
  type PlaceErrorKind,
} from '@composables/usePlaceDetail';
import { targetKey, type MapTarget, type Presentation } from '@selection/types';

export type { PlaceError, PlaceErrorKind };
export { PlaceRequestError, toPlaceError } from '@composables/usePlaceDetail';

// ── Hut schema helpers (move to the accommodation entry in group 4) ─────

export type HutDetails = schemasWodore['HutSchemaDetails'];

/** Legacy identity seed: name/elevation/owner/location/type from tile
 *  properties — enough for the panel header to paint before the details
 *  request resolves (owner 2026-10). */
function seedPartialFromProps(
  properties: Record<string, unknown>,
  location?: { lat: number; lon: number }
): Partial<HutDetails> {
  const localeName = String(properties[`name_${currentLocale()}`] ?? properties.name ?? '');
  const elevationRaw = properties.elevation;
  const ownerName = properties.owner_name;

  const seed: Partial<HutDetails> = {};
  if (localeName) seed.name = localeName;
  if (typeof properties.has_availability === 'boolean') {
    seed.has_availability = properties.has_availability;
  }
  if (elevationRaw !== undefined && elevationRaw !== null) {
    const elevation = Number(elevationRaw);
    if (!Number.isNaN(elevation)) seed.elevation = elevation;
  }
  if (typeof ownerName === 'string' && ownerName) {
    seed.owner = { name: ownerName } as HutDetails['owner'];
  }
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    seed.location = location as HutDetails['location'];
  }
  if (typeof properties.type_standard_slug === 'string') {
    seed.type_open = {
      slug: properties.type_standard_slug,
      color:
        typeof properties.type_standard_color === 'string'
          ? properties.type_standard_color
          : undefined,
    } as HutDetails['type_open'];
  }
  return seed;
}

const hutTargetKey = (slug: string): string => targetKey({ source: 'geoplace', id: slug });

/** Seed a hut's identity from a map feature (tile properties + geometry).
 *  Compat shim over the engine's seed cache — map views keep calling it
 *  until the click pipeline lands (PR2). */
export function seedPlaceFromMap(
  slug: string,
  properties: Record<string, unknown>,
  location?: { lat: number; lon: number }
): void {
  if (!slug) return;
  stagePrebuiltSeed(hutTargetKey(slug), seedPartialFromProps(properties, location));
}

// ── Synthetic hut entry (engine-driven, legacy behavior) ────────────────

const hutCompatEntry: Presentation = {
  id: 'huts-compat',
  match: { source: 'geoplace' }, // never matched — the wrapper passes the entry explicitly
  capabilities: ['detail'],
  fetch: async (ctx): Promise<HutDetails> => {
    // Deep-link prefetch handoff (perf/hut-fast-first-paint): if the boot
    // already fired this exact request, await its response — the promise
    // must be CHAINED (unwrapped into data); a REJECTED prefetch (e.g.
    // transient boot network error) falls back to a normal GET — a miss
    // fetches normally.
    const get = () =>
      clientWodore.GET('/v1/huts/{slug}', {
        params: { path: { slug: ctx.id }, query: { lang: ctx.lang } },
        signal: ctx.signal,
      });

    const prefetched = consumePrefetchedHut(ctx.id, ctx.lang);
    // Prefetch branch resolves to the same triple as the GET — the cast
    // aligns the union (openapi-fetch widens tuple members like `country`).
    const result = await (
      prefetched
        ? prefetched.then(
            hutData =>
              // SAFETY: the prefetch payload IS a HutDetails (same endpoint,
              // same shape as the GET); the double cast only aligns it with
              // the openapi-fetch response union, which widens tuple members
              // (country: string[] vs [string, string]) — an invariant the
              // generated types can't express.
              ({
                data: hutData as HutDetails,
                error: undefined,
                response: undefined,
              }) as unknown as Awaited<ReturnType<typeof get>>,
            () => get()
          )
        : get()
    );
    // SAFETY: single documented cast — same endpoint, same pattern as the
    // legacy usePlace fetch.
    const data = result.data as HutDetails | undefined;
    const { error: apiError, response } = result;

    // Read before the union narrows: past the apiError check, the success
    // member makes `!data` unreachable for TS and `response` collapses.
    const status = response?.status ?? 200;
    if (apiError) {
      throw new PlaceRequestError({ kind: 'http', status }, `Failed to fetch place "${ctx.id}"`);
    }
    if (!data) {
      throw new PlaceRequestError(
        { kind: 'http', status },
        `No data returned for place "${ctx.id}"`
      );
    }
    // SAFETY: the openapi-fetch response union widens tuple members
    // (country: string[] vs [string, string]) — the explicit cast mirrors
    // the legacy usePlace fetch (same pattern, same endpoint).
    return data as HutDetails;
  },
};

/** Legacy signature: slug-driven place details. Internally a target for
 *  the generalized engine, with the hut entry bound explicitly. */
export function usePlace(slug: Ref<string | undefined>) {
  const target = computed<MapTarget | null>(() =>
    slug.value
      ? { key: hutTargetKey(slug.value), source: 'geoplace', id: slug.value, props: {} }
      : null
  );
  const entry = ref<Presentation | null>(hutCompatEntry);
  const { detail, loading, error, refetch } = usePlaceDetail(target, { entry });

  const place = computed<HutDetails | undefined>(() =>
    detail.value ? (detail.value as HutDetails) : undefined
  );

  return { place, loading, error: error as Ref<PlaceError | null>, refetch };
}
