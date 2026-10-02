import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { requestStart, requestStop } from '@composables/useRequestProgress';

import { useAuthStore } from '@stores/auth-store';
import { getEnv } from '@services/runtimeEnv';

export type schemasWodore = compWodore['schemas'];

/**
 * Sparse fieldset projection: the response type an endpoint returns when
 * the request narrows it via `fields[TYPE]=name1,name2` (JSON:API sparse
 * fieldsets, API version 2026-10-02). The generated OpenAPI types always
 * describe the FULL schema (OpenAPI cannot express query-dependent
 * response shapes) — derive the narrowed view on top of them.
 *
 * K is compile-time checked against the real keys of T, so a backend
 * field rename breaks the frontend build instead of silently mismatching.
 *
 * Usage:
 *   type HutCard = Sparse<schemasWodore['HutSchemaDetails'], 'slug' | 'name' | 'elevation'>;
 */
export type Sparse<T, K extends keyof T> = Pick<T, K>;

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

export const clientWodore = createClient<pathsWodore>({
  baseUrl: getEnv('WODORE_API_HOST'),
});

clientWodore.use(loadingMiddleware);
clientWodore.use(authMiddleware);
