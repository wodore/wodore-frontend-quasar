import { ref, watch, onScopeDispose, type Ref } from 'vue';
import { clientWodore, type schemasWodore } from '@clients/index';

// Request cache to prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<schemasWodore['HutSchemaDetails'] | undefined>>();

export function usePlace(slug: Ref<string | undefined>) {
  const place = ref<schemasWodore['HutSchemaDetails'] | undefined>(undefined);
  const loading = ref(false);
  const error = ref<Error | null>(null);

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
        error.value = err as Error;
      } finally {
        loading.value = false;
      }
      return;
    }

    abortController = new AbortController();
    loading.value = true;
    error.value = null;

    // Create request promise
    const requestPromise = clientWodore
      .GET('/v1/huts/{slug}', {
        params: { path: { slug: newSlug } },
      })
      .then(({ data, error: apiError }) => {
        // Only update if not aborted
        if (abortController?.signal.aborted) {
          return undefined;
        }

        if (apiError) {
          throw new Error(`Failed to fetch place "${newSlug}"`);
        }
        if (!data) {
          throw new Error(`No data returned for place "${newSlug}"`);
        }
        return data as schemasWodore['HutSchemaDetails'];
      })
      .catch(err => {
        error.value = err as Error;
        throw err;
      })
      .finally(() => {
        // Only update state if not aborted
        if (!abortController?.signal.aborted) {
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
      // Error already set in catch above
      if (err instanceof Error && err.name !== 'AbortError') {
        error.value = err as Error;
      }
    }
  }

  watch(
    slug,
    newSlug => {
      if (newSlug) {
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
