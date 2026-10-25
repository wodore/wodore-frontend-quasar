/**
 * API base selection (public CDN split).
 *
 * The app has one API origin, `WODORE_API_HOST` (e.g.
 * https://hub.stg.wodore.com). On Kubernetes an optional CDN name
 * (`WODORE_PUBLIC_API_URL`, e.g. https://hub.cdn.stg.wodore.com) fronts
 * the same API for PUBLIC traffic: unauthenticated GETs (huts
 * list/details, categories, map catalog/styles, hut prefetch) go
 * through the CDN so its shared cache absorbs anonymous load.
 *
 * Requests that carry a Bearer token, auth flows (non-GET), and
 * anything personalized always keep `WODORE_API_HOST` — authenticated
 * responses vary per user and must never be served from a shared
 * cache. The per-request decision for the typed client lives in the
 * `publicBaseMiddleware` (src/clients/index.ts); raw-fetch call sites
 * that only ever fetch public data use `publicApiBase()` directly.
 *
 * `WODORE_PUBLIC_API_URL` empty/unset = single API host everywhere:
 * byte-identical to the previous behavior (local dev, docker-compose,
 * current prod).
 */
import { getEnv } from './runtimeEnv';

/** Base URL for public (unauthenticated) API requests: the CDN base
 *  (`WODORE_PUBLIC_API_URL`) when set, else `WODORE_API_HOST`. Trailing
 *  slashes are trimmed so consumers can concatenate paths. */
export function publicApiBase(): string | undefined {
  const cdn = getEnv('WODORE_PUBLIC_API_URL');
  if (cdn) return cdn.replace(/\/+$/, '');
  return getEnv('WODORE_API_HOST');
}
