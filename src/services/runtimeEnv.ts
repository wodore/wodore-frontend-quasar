/**
 * Runtime environment accessor.
 *
 * Prefers values from `/env.json` (fetched synchronously in index.html
 * rewritten by replace_vars), falling back to the build-time Vite-baked
 * constants (offline first load, capacitor/static builds).
 *
 * Why this exists: `replace_vars` rewrites `@@VAR@@` placeholders inside
 * hashed JS chunks at container startup WITHOUT changing filenames — the
 * service worker's precache revisions (computed at build time) never
 * notice, so baked values go permanently stale for cached clients
 * (e.g. an exhausted MapTiler key). `index.html` (where the env now lives inline) is unhashed, served with
 * `Cache-Control: no-store`, excluded from the SW precache, and fetched
 * on every visit (NetworkFirst), so runtime env changes propagate immediately.
 */

type RuntimeEnv = Record<string, string | undefined>;

declare global {
  interface Window {
    __WODORE_RUNTIME_ENV__?: RuntimeEnv;
  }
}

const runtime: RuntimeEnv =
  typeof window !== 'undefined' ? (window.__WODORE_RUNTIME_ENV__ ?? {}) : {};

// Build-time baked values: each property is a static member expression
// that Vite's `define` replaces at compile time. Must be kept in sync
// with public/env.json and quasar.config.ts > build > env.
const baked: RuntimeEnv = {
  WODORE_APP_NAME: process.env.WODORE_APP_NAME,
  WODORE_APP_VERSION: process.env.WODORE_APP_VERSION,
  WODORE_ENV: process.env.WODORE_ENV,
  WODORE_DOMAIN: process.env.WODORE_DOMAIN,
  WODORE_URL: process.env.WODORE_URL,
  WODORE_OFFICIAL_URL: process.env.WODORE_OFFICIAL_URL,
  WODORE_API_HOST: process.env.WODORE_API_HOST,
  WODORE_API_VERSION: process.env.WODORE_API_VERSION,
  WODORE_TILE_SERVER_URL: process.env.WODORE_TILE_SERVER_URL,
  WODORE_IMAGOR_KEY: process.env.WODORE_IMAGOR_KEY,
  WODORE_IMAGOR_URL: process.env.WODORE_IMAGOR_URL,
  WODORE_IMAGOR_REPLACE_API_HOST_MEDIA:
    process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA,
  WODORE_CLOUDINARY_ENV: process.env.WODORE_CLOUDINARY_ENV,
  WODORE_UMAMI_WEBSITE_ID: process.env.WODORE_UMAMI_WEBSITE_ID,
  WODORE_UMAMI_WEBSITE_URL: process.env.WODORE_UMAMI_WEBSITE_URL,
  WODORE_OICD_ISSUER_URL: process.env.WODORE_OICD_ISSUER_URL,
  WODORE_OICD_CLIENT_ID: process.env.WODORE_OICD_CLIENT_ID,
  WODORE_OICD_RESOURCE_ID: process.env.WODORE_OICD_RESOURCE_ID,
  WODORE_MAPTILER_API_KEY: process.env.WODORE_MAPTILER_API_KEY,
  WODORE_FRONTEND_GITHUB: process.env.WODORE_FRONTEND_GITHUB,
  WODORE_BACKEND_GITHUB: process.env.WODORE_BACKEND_GITHUB,
};

function isUsable(value: string | undefined): value is string {
  return value !== undefined && value !== '' && !value.startsWith('@@');
}

/** Get a runtime env value; falls back to the baked build-time value. */
export function getEnv(name: string): string | undefined {
  const fromRuntime = runtime[name];
  if (isUsable(fromRuntime)) return fromRuntime;
  return baked[name];
}

/** Get a runtime env value or throw (for vars the app cannot run without). */
export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined || value === '') {
    throw new Error(`Missing required runtime env: ${name}`);
  }
  return value;
}
