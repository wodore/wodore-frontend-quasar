import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { requestStart, requestStop } from '@composables/useRequestProgress';

import { useAuthStore } from '@stores/auth-store';

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
  baseUrl: process.env.WODORE_API_HOST,
});

clientWodore.use(loadingMiddleware);
clientWodore.use(authMiddleware);
