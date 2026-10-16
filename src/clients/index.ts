import createClient, { Middleware } from 'openapi-fetch';
import type { paths as pathsWodore } from './wodore_v1';
import type { components as compWodore } from './wodore_v1';
import { requestStart, requestStop } from '@composables/useRequestProgress';

import { useAuthStore } from '@stores/auth-store';
import { getEnv } from '@services/runtimeEnv';
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

clientWodore.use(loadingMiddleware);
clientWodore.use(authMiddleware);
clientWodore.use(apiVersionMiddleware);

// ── Map layers API (backend #331) ─────────────────────────────────────────

/**
 * Hand-declared contract for `/v1/map/layers` + `/v1/map/slots`
 * (backend PR wodore/wodore-backend#331) — the resolved-layer catalog
 * that replaced `/v1/map/config`. These paths exist only in the
 * backend's unreleased API version, so the generated `wodore_v1.d.ts`
 * does not carry them yet: once the backend deploys and `pnpm gen:api`
 * absorbs the endpoints, this block can be deleted in favour of
 * `clientWodore` + generated schemas (shapes are deliberately
 * minimal — only what the map client consumes).
 */
export interface MapLayerSummary {
  slug: string;
  role: 'basemap' | 'overlay';
  name: string;
  description: string;
  icon: string;
  icon_badge: string;
  slot: string | null;
  order: number;
  show: boolean;
  is_default: boolean;
  /** Served device tier after the backend's fallback chain resolved
   *  the wanted `?spec=` — the client states intent, never policy. */
  spec: 'low' | 'medium' | 'high';
  /** Spec-resolved style URL: root-relative for owned styles (needs
   *  absolutization against WODORE_API_HOST — the #285 class of bug),
   *  absolute for external ones (env-resolved by the backend). */
  style_url: string | null;
  /** Layer content version (ISO timestamp = layer.modified) — the
   *  client's style-cache key (replaces the old `version` field). */
  modified: string | null;
  min_zoom: number | null;
  max_zoom: number | null;
  coverage_bbox: number[] | null;
  fallback_min_zoom: number | null;
  fallback: string | null;
  anchors: Record<string, unknown> | null;
  preview_url: string | null;
  config: Record<string, unknown> | null;
  interaction: Record<string, unknown> | null;
  parameters: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  attributions: Array<Record<string, unknown>>;
  license: Record<string, unknown> | null;
  legend: Record<string, unknown> | null;
}

export interface MapLayersPaths {
  '/v1/map/layers': {
    get: {
      parameters: {
        query?: {
          lang?: string;
          spec?: 'low' | 'medium' | 'high';
          role?: 'basemap' | 'overlay';
          /** Opt-in visibility filter — left off so hidden
           *  fallback basemaps stay resolvable client-side. */
          show?: boolean;
          /** Sparse fieldsets (`fields[map_layers]=slug,name,…`). */
          'fields[map_layers]'?: string;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              data: MapLayerSummary[];
              count: number;
            };
          };
        };
      };
    };
  };
  '/v1/map/slots': {
    get: {
      parameters: { query?: { lang?: string } };
      responses: {
        200: {
          content: {
            'application/json': {
              data: Array<{ slug: string; label: string; order: number }>;
              count: number;
            };
          };
        };
      };
    };
  };
}

/** The map layers API client — same origin/middleware stack (auth,
 *  Api-Version pin, progress bar) as the generated client. Every map
 *  endpoint sends a strong ETag with revalidate-always caching, so the
 *  browser's fetch cache handles conditional revalidation for free. */
export const clientMapLayers = createClient<MapLayersPaths>({
  baseUrl: getEnv('WODORE_API_HOST'),
});

clientMapLayers.use(loadingMiddleware);
clientMapLayers.use(authMiddleware);
clientMapLayers.use(apiVersionMiddleware);
