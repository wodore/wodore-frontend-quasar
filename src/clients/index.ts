import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { LoadingBar } from 'quasar';

import { useAuthStore } from '@stores/auth-store';
const authStore = useAuthStore();

export type schemasWodore = compWodore['schemas'];

export const loading: Record<string, 'start' | 'loading' | 'stopped'> = {};

const loadingMiddleware: Middleware = {
  async onRequest(req, options) {
    // set "foo" header
    //req.headers.set("foo", "bar");
    console.debug('Fetch: Request data from', req, options);
    loading[req.url] = 'start';
    setTimeout(() => {
      if (loading[req.url] == 'start') {
        loading[req.url] = 'loading';
        LoadingBar.start();
        console.debug('  start loading bar');
      }
    }, 300);
    return req;
  },
  async onResponse(res, options) {
    //const { body, ...resOptions } = res;
    // change status of response
    console.debug('Fetch: Received data from', res, options);
    if (res.url in loading) {
      if (loading[res.url] == 'loading') {
        LoadingBar.stop();
        console.debug('  stop loading bar');
      }
    }
    loading[res.url] = 'stopped';
    return res;
    //return new Response(body, { ...resOptions, status: 200 });
  },
};

const authMiddleware: Middleware = {
  async onRequest(req) {
    // fetch token, if it doesn’t exist
    const accessToken = authStore.access_token;
    if (accessToken) {
      req.headers.set('Authorization', `Bearer ${accessToken}`);
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
    return req;
  },
};

export const clientWodore = createClient<pathsWodore>({
  baseUrl: process.env.API_HOST,
});

clientWodore.use(loadingMiddleware);
clientWodore.use(authMiddleware);
