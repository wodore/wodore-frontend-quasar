import { ref } from 'vue';
import { defineStore } from 'pinia';
import { clientWodore } from '@clients/index';
import {
  PINNED_API_VERSION,
  onApiVersionError,
  type ApiVersionCheck,
  type ApiVersionEntry,
} from '@services/apiVersion';

/**
 * API version lifecycle state: pins `PINNED_API_VERSION` against the
 * backend's `/v1/version` registry (called once at app start) and reacts
 * to 410 `api_version_sunset` errors reported by the client middleware.
 *
 * Never auto-switches the pin — it is build-time only; users upgrade by
 * updating the app.
 */
export const useApiVersionStore = defineStore('apiVersion', () => {
  const check = ref<ApiVersionCheck>({ state: 'idle' });

  /** Set when a retired pin starts answering 410 on live requests. */
  const sunsetErrorSeen = ref(false);

  function classify(entry: ApiVersionEntry | undefined): ApiVersionCheck {
    if (!entry) return { state: 'unsupported' };
    if (entry.status === 'sunset') return { state: 'unsupported', entry };
    if (entry.status === 'deprecated') return { state: 'deprecated', entry };
    return { state: 'ok', entry };
  }

  async function checkApiVersion(): Promise<void> {
    if (check.value.state === 'checking') return; // in flight
    if (check.value.state !== 'idle') return; // already checked this session
    check.value = { state: 'checking' };

    try {
      const { data, error } = await clientWodore.GET('/v1/version', {});
      if (error || !data?.api) {
        throw new Error(error ? JSON.stringify(error) : 'no api block');
      }
      const supported = (data.api.supported ?? []) as ApiVersionEntry[];
      check.value = classify(
        supported.find((entry: ApiVersionEntry) => entry.version === PINNED_API_VERSION)
      );
    } catch (err) {
      // Offline / old backend without the api block: no banner — the app
      // still works; the middleware surfacing handles hard failures.
      check.value = {
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Live 410s from the middleware (the registry check above may race or
  // be cached behind a proxy — this is the authoritative failure signal).
  onApiVersionError(code => {
    if (code === 'api_version_sunset') sunsetErrorSeen.value = true;
  });

  return { check, sunsetErrorSeen, checkApiVersion };
});
