import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { requestStart, requestStop } from '@composables/useRequestProgress';

import { useAuthStore } from '@stores/auth-store';
import { getEnv } from '@services/runtimeEnv';
import { publicApiBase } from '@services/apiBase';
import { PINNED_API_VERSION, emitApiVersionError } from '@services/apiVersion';

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

/** Progress-bar skip-list (owner spec): infrastructure traffic that
 * must never flash the header bar — per-keystroke search, availability
 * polling, and the background weather-code lookup prefetch. Keep this
 * list synced across onRequest/onResponse/onError or the counter leaks. */
const PROGRESS_SKIP = ['/geo/places/search', '/availability/', '/meteo/weather_codes'];
const skipProgress = (url: string): boolean => PROGRESS_SKIP.some(u => url.includes(u));

// (review n3: module-local on purpose — no external consumer; export
// only when a test actually needs to import it.)
const progressMiddleware: Middleware = {
  async onRequest({ request }) {
    if (skipProgress(request.url)) {
      return;
    }

    requestStart();
  },
  async onResponse({ request }) {
    // Keep start/stop balanced for the skipped URLs too
    if (skipProgress(request.url)) {
      return;
    }

    requestStop();
  },
  onError({ request }) {
    // Network-level failures never reach onResponse — decrement here
    // too or the progress counter leaks and the bar sticks visible
    if (skipProgress(request.url)) {
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
 * Public CDN base (WODORE_PUBLIC_API_URL): when set, unauthenticated
 * GETs are rewritten to the CDN origin (see services/apiBase.ts). Every
 * other request keeps the direct WODORE_API_HOST — a Bearer token makes
 * the response potentially personalized (never share-cacheable), and
 * non-GET methods cover auth flows and mutations. Unset/empty = no
 * rewrite at all, byte-identical to the single-host behavior.
 *
 * /v1/version is EXEMPT: it is deployment identity, consumed as a live
 * signal by the versions panel and the api-version check — a CDN-cached
 * copy would go stale per deploy, and on staging the CDN served it
 * without CORS headers (2026-10, cache variance à la PR #341), failing
 * the fetch from the app origin entirely.
 *
 * Registered AFTER authMiddleware on purpose: it decides the
 * Authorization header, so by the time this runs, "authenticated" is
 * simply "the header is present". Runs BEFORE apiVersionMiddleware so
 * the Api-Version header is set on the rewritten request either way.
 */
const publicBaseMiddleware: Middleware = {
  onRequest({ request }) {
    const publicBase = publicApiBase();
    if (!publicBase) return;
    if (request.headers.get('Authorization') || request.method !== 'GET') {
      return;
    }
    try {
      const url = new URL(request.url);
      const base = new URL(publicBase);
      if (url.origin === base.origin) return; // already the public base
      if (url.pathname === '/v1/version') return; // deployment identity — see doc block
      // Path + query stay untouched — same URL shape, different origin,
      // so the browser HTTP cache and ETag revalidation keep working.
      return new Request(new URL(url.pathname + url.search, base).href, request);
    } catch {
      // Unparsable base/request URL (e.g. relative baseUrl) — keep the
      // direct request rather than breaking the call.
      return;
    }
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
        `[apiVersion] backend served '${echoed}', pin is '${PINNED_API_VERSION}' — bump the pin (see backend CHANGELOG_API.md)`
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

clientWodore.use(progressMiddleware);
clientWodore.use(authMiddleware);
clientWodore.use(publicBaseMiddleware);
clientWodore.use(apiVersionMiddleware);
