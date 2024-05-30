import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { LoadingBar } from 'quasar';

export type schemasWodore = compWodore['schemas'];

const loadingMiddleware: Middleware = {
  async onRequest(req, options) {
    // set "foo" header
    //req.headers.set("foo", "bar");
    console.debug('Fetch: Request data from', req, options);
    LoadingBar.start();
    return req;
  },
  async onResponse(res, options) {
    //const { body, ...resOptions } = res;
    // change status of response
    console.debug('Fetch: Received data from', res, options);
    LoadingBar.stop();
    return res;
    //return new Response(body, { ...resOptions, status: 200 });
  },
};

export const clientWodore = createClient<pathsWodore>({
  baseUrl: process.env.API_HOST,
});

clientWodore.use(loadingMiddleware);
