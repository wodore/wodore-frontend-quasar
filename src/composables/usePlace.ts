import { ref, watch, onScopeDispose, type Ref } from 'vue';
import { consumePrefetchedHut } from '@services/hut-prefetch';
import { clientWodore, type schemasWodore } from '@clients/index';
import { currentLocale } from '@services/locale';

// Request cache to prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<schemasWodore['HutSchemaDetails'] | undefined>>();

/** Why a place request failed. The API's error body text is deliberately
 * not surfaced; 'http' carries the bare status code instead. */
export type PlaceErrorKind = 'offline' | 'unreachable' | 'http';

export interface PlaceError {
  kind: PlaceErrorKind;
  /** HTTP status code, set only for kind === 'http'. */
  status?: number;
}

/** Carries a PlaceError through the promise chain so the outer catch can
 * classify without guessing from message strings. */
class PlaceRequestError extends Error {
  readonly placeError: PlaceError;

  constructor(placeError: PlaceError, message: string) {
    super(message);
    this.name = 'PlaceRequestError';
    this.placeError = placeError;
  }
}

function toPlaceError(err: unknown): PlaceError {
  if (err instanceof PlaceRequestError) return err.placeError;
  // Raw fetch rejection (openapi-fetch re-throws): offline now, or the
  // server could not be reached (DNS, timeout, refused, CORS).
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { kind: 'offline' };
  return { kind: 'unreachable' };
}

// ── MVT identity seeds (module scope) ────────────────────────────────
// Hut name/elevation/owner/location are already in the map's vector-tile
// properties. Seeding usePlace from the selected feature lets the panel
// header paint instantly; the details request overwrites the seed on
// arrival (owner 2026-10: "we have this info from the mvt properties").
const seededPlaces = new Map<string, Partial<schemasWodore['HutSchemaDetails']>>();

/** Seed a hut's identity from a map feature (tile properties + geometry). */
export function seedPlaceFromMap(
  slug: string,
  properties: Record<string, unknown>,
  location?: { lat: number; lon: number }
): void {
  if (!slug) return;
  const localeName = String(properties[`name_${currentLocale()}`] ?? properties.name ?? '');
  const elevationRaw = properties.elevation;
  const ownerName = properties.owner_name;

  const seed: Partial<schemasWodore['HutSchemaDetails']> = {};
  if (localeName) seed.name = localeName;
  if (typeof properties.has_availability === 'boolean') {
    seed.has_availability = properties.has_availability;
  }
  if (elevationRaw !== undefined && elevationRaw !== null) {
    const elevation = Number(elevationRaw);
    if (!Number.isNaN(elevation)) seed.elevation = elevation;
  }
  if (typeof ownerName === 'string' && ownerName) {
    seed.owner = { name: ownerName } as schemasWodore['HutSchemaDetails']['owner'];
  }
  // Geometry-derived location: enables the weather read + forecast while
  // details load
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    seed.location = location as schemasWodore['HutSchemaDetails']['location'];
  }
  if (typeof properties.type_standard_slug === 'string') {
    // Partial type: consumers guard on `.name`/`.symbol`, so badges still
    // wait for the full payload. The title avatar renders instantly from
    // `slug` (WdCategoryIcon derives 'accommodation.{slug}' → direct SVG
    // URL, module-cached); the payload's symbol URL takes over later.
    seed.type_open = {
      slug: properties.type_standard_slug,
      color:
        typeof properties.type_standard_color === 'string'
          ? properties.type_standard_color
          : undefined,
    } as schemasWodore['HutSchemaDetails']['type_open'];
  }

  seededPlaces.set(slug, seed);
}

export function usePlace(slug: Ref<string | undefined>) {
  const place = ref<schemasWodore['HutSchemaDetails'] | undefined>(undefined);
  const loading = ref(false);
  const error = ref<PlaceError | null>(null);

  let abortController: AbortController | null = null;

  function applySeed(newSlug: string): void {
    const seed = seededPlaces.get(newSlug);
    if (seed) {
      // Deliberate partial cast: every consumer guards the fields it
      // reads (type_open?.name, location, symbol, …) — the seed only
      // fills what the tiles carry.
      place.value = seed as schemasWodore['HutSchemaDetails'];
    }
  }

  async function fetchPlace(newSlug: string) {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    if (!newSlug) {
      place.value = undefined;
      return;
    }

    // Check if request is already pending
    if (pendingRequests.has(newSlug)) {
      loading.value = true;
      try {
        place.value = await pendingRequests.get(newSlug);
      } catch (err) {
        error.value = toPlaceError(err);
      } finally {
        loading.value = false;
      }
      return;
    }

    // Capture this request's controller: the closures below must not read
    // the reassigned abortController variable, or a superseded request
    // passes the aborted check and overwrites newer state
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    error.value = null;

    // Deep-link prefetch handoff (perf/hut-fast-first-paint): if the
    // boot already fired this exact request, await its response instead
    // of a second round-trip; a mismatch/miss fetches normally. The
    // prefetch promise must be CHAINED — its resolved value unwrapped
    // into `data` — wrapping it as Promise.resolve({ data: promise })
    // would pass the live Promise object through as the place payload
    // (review blocker). A REJECTED prefetch (e.g. transient boot
    // network error) falls back to a normal GET — a miss fetches
    // normally.
    const prefetched = consumePrefetchedHut(newSlug, currentLocale());
    const requestPromise = (
      prefetched
        ? prefetched.then(
            hutData => ({
              data: hutData as never,
              error: undefined as never,
              response: undefined as never,
            }),
            () =>
              clientWodore.GET('/v1/huts/{slug}', {
                params: { path: { slug: newSlug }, query: { lang: currentLocale() } },
                signal: controller.signal,
              })
          )
        : clientWodore.GET('/v1/huts/{slug}', {
            params: { path: { slug: newSlug }, query: { lang: currentLocale() } },
            signal: controller.signal,
          })
    )
      .then(({ data, error: apiError, response }) => {
        // Only update if this request was not superseded
        if (controller.signal.aborted) {
          return undefined;
        }

        // Read before the union narrows: past the apiError check, the
        // success member makes `!data` an unreachable state for TS and
        // `response` collapses to never.
        // Prefetch handoff path has no response object — a sane 200
        // stand-in keeps the destructure below total.
        const status = response?.status ?? 200;
        if (apiError) {
          throw new PlaceRequestError(
            { kind: 'http', status },
            `Failed to fetch place "${newSlug}"`
          );
        }
        if (!data) {
          throw new PlaceRequestError(
            { kind: 'http', status },
            `No data returned for place "${newSlug}"`
          );
        }
        return data as schemasWodore['HutSchemaDetails'];
      })
      .catch(err => {
        // A superseded request must not clobber the newer request's state
        if (!controller.signal.aborted) {
          error.value = toPlaceError(err);
        }
        throw err;
      })
      .finally(() => {
        // Only update state if this request was not superseded
        if (!controller.signal.aborted) {
          loading.value = false;
        }
        pendingRequests.delete(newSlug);
      });

    // Store pending request
    pendingRequests.set(newSlug, requestPromise);

    try {
      const result = await requestPromise;
      if (result !== undefined) {
        place.value = result;
      }
    } catch (err) {
      // Error already classified and set in the catch above
      if (err instanceof Error && err.name !== 'AbortError' && !error.value) {
        error.value = toPlaceError(err);
      }
    }
  }

  watch(
    [slug, currentLocale],
    ([newSlug]) => {
      if (newSlug) {
        // Paint the MVT seed (if any) immediately, then fetch the real
        // details (refetches on slug AND UI language change — hut details
        // are localized server-side via the lang param)
        applySeed(newSlug);
        fetchPlace(newSlug);
      } else {
        place.value = undefined;
      }
    },
    { immediate: true }
  );

  // Cleanup on unmount
  onScopeDispose(() => {
    if (abortController) {
      abortController.abort();
    }
  });

  return {
    place,
    loading,
    error,
    refetch: () => slug.value && fetchPlace(slug.value),
  };
}
