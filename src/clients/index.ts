import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { requestStart, requestStop } from '@composables/useRequestProgress';

import { useAuthStore } from '@stores/auth-store';
import { getEnv } from '@services/runtimeEnv';
import {
  PINNED_API_VERSION,
  emitApiVersionError,
} from '@services/apiVersion';

export type schemasWodore = compWodore['schemas'];

const loadingMiddleware: Middleware = {
  async onRequest({ request }) {
    // Skip the progress bar for search and availability requests
    // (per-keystroke / polling traffic must not flash the header bar)
    if (request.url.includes('/geo/places/search') || request.url.includes('/availability/')) {
      return;
    }

    requestStart();
  },
  async onResponse({ request }) {
    // Keep start/stop balanced for the skipped URLs too
    if (request.url.includes('/geo/places/search') || request.url.includes('/availability/')) {
      return;
    }

    requestStop();
  },
  onError({ request }) {
    // Network-level failures never reach onResponse — decrement here
    // too or the progress counter leaks and the bar sticks visible
    if (request.url.includes('/geo/places/search') || request.url.includes('/availability/')) {
      return;
    }

    requestStop();
  },
};

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    // fetch token, if it doesn’t exist
    const authStore = useAuthStore();
    const accessToken = authStore.access_token;
    if (accessToken) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    //if (!accessToken) {
    //  const authRes = await someAuthFunc();
    //  if (authRes.accessToken) {
    //    accessToken = authRes.accessToken;
    //  } else {
    //    // handle auth error
    //  }
    //}

    // (optional) add logic here to refresh token when it expires

    // add Authorization header to every request
  },
};

/**
 * Pins every API request to the contract version this app is built for
 * (see `src/services/apiVersion.ts`). The backend echoes the resolved
 * version in the `Api-Version` response header and sends lifecycle headers
 * (`Deprecation`/`Sunset`) when the pinned version is being phased out.
 */
const apiVersionMiddleware: Middleware = {
  onRequest({ request }) {
    request.headers.set('Api-Version', PINNED_API_VERSION);
  },
  async onResponse({ response }) {
    // Development diagnostics: the backend resolved a different version
    // than the pin — usually a stale pin after the backend dropped support.
    const echoed = response.headers.get('Api-Version');
    if (import.meta.env.DEV && echoed && echoed !== PINNED_API_VERSION) {
      console.warn(
        `[apiVersion] backend served '${echoed}', pin is '${PINNED_API_VERSION}' — bump the pin (see backend CHANGELOG_API.md)`,
      );
    }
    // A retired pinned version answers 410 on every endpoint — surface it
    // once for the banner; reading the body must not consume it (clone).
    if (response.status === 410) {
      try {
        const body = (await response.clone().json()) as { code?: string };
        if (body.code === 'api_version_sunset') {
          emitApiVersionError('api_version_sunset');
        }
      } catch {
        // non-JSON body (proxy error page etc.) — nothing to surface
      }
    }
  },
};

export const clientWodore = createClient<pathsWodore>({
  baseUrl: getEnv('WODORE_API_HOST'),
});

clientWodore.use(loadingMiddleware);
clientWodore.use(authMiddleware);
clientWodore.use(apiVersionMiddleware);
