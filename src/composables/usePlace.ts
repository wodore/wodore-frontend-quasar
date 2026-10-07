import { ref, watch, onScopeDispose, type Ref } from 'vue';
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

export function usePlace(slug: Ref<string | undefined>) {
  const place = ref<schemasWodore['HutSchemaDetails'] | undefined>(undefined);
  const loading = ref(false);
  const error = ref<PlaceError | null>(null);

  let abortController: AbortController | null = null;

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

    // Create request promise
    const requestPromise = clientWodore
      .GET('/v1/huts/{slug}', {
        params: { path: { slug: newSlug }, query: { lang: currentLocale() } },
        signal: controller.signal,
      })
      .then(({ data, error: apiError, response }) => {
        // Only update if this request was not superseded
        if (controller.signal.aborted) {
          return undefined;
        }

        // Read before the union narrows: past the apiError check, the
        // success member makes `!data` an unreachable state for TS and
        // `response` collapses to never.
        const status = response.status;
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
        // Refetches both on slug change and UI language change (hut details
        // are localized server-side via the lang param)
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
