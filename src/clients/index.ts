import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { LoadingBar } from 'quasar';

import { useAuthStore } from '@stores/auth-store';
const authStore = useAuthStore();

export type schemasWodore = compWodore['schemas'];

export const loading: Record<string, 'start' | 'loading' | 'stopped'> = {};

const loadingMiddleware: Middleware = {
  async onRequest({ request }) {
    // Skip loading bar for search requests and availability requests
    if (
      request.url.includes('/geo/places/search') ||
      request.url.includes('/availability/')
    ) {
      return;
    }

    // console.debug('Fetch: Request data from', request.url);
    loading[request.url] = 'start';
    setTimeout(() => {
      if (loading[request.url] == 'start') {
        loading[request.url] = 'loading';
        LoadingBar.start();
        console.debug('  start loading bar');
      }
    }, 300);
  },
  async onResponse({ request }) {
    // Skip loading bar for search requests and availability requests
    if (
      request.url.includes('/geo/places/search') ||
      request.url.includes('/availability/')
    ) {
      return;
    }

    // console.debug('Fetch: Received data from', request.url);
    if (request.url in loading) {
      if (loading[request.url] == 'loading') {
        LoadingBar.stop();
        console.debug('  stop loading bar');
      }
    }
    loading[request.url] = 'stopped';
  },
};

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    // fetch token, if it doesn’t exist
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
