/**
 * Runtime environment accessor.
 *
 * Prefers values from `window.__WODORE_RUNTIME_ENV__` — set either inline
 * in index.html (dev/Capacitor builds, EJS-baked) or by the external
 * `/env.js` (docker: @@VAR@@ placeholders rewritten by replace_vars at
 * container start, served no-store) — falling back to `process.env`
 * (build-time Vite constants in the browser, dynamic Node.js env in
 * dev/test).
 *
 * Why this exists: `replace_vars` rewrites `@@VAR@@` placeholders inside
 * hashed JS chunks at container startup WITHOUT changing filenames — the
 * service worker's precache revisions (computed at build time) never
 * notice, so baked values go permanently stale for cached clients
 * (e.g. an exhausted MapTiler key). The env therefore lives in
 * unhashed, no-store documents: `/env.js` (and index.html where it is
 * still inline), both excluded from the SW precache and fetched on
 * every visit, so runtime env changes propagate immediately. Keeping
 * the env out of the HTML shell also lets the SEO edge (docker/seo.js)
 * cache hut pages for shared caches.
 */

type RuntimeEnv = Record<string, string | undefined>;

declare global {
  interface Window {
    __WODORE_RUNTIME_ENV__?: RuntimeEnv;
  }
}

const runtime: RuntimeEnv =
  typeof window !== 'undefined' ? (window.__WODORE_RUNTIME_ENV__ ?? {}) : {};

function isUsable(value: string | undefined): value is string {
  return value !== undefined && value !== '' && !value.startsWith('@@');
}

/** Get a runtime env value; falls back to the baked build-time value. */
export function getEnv(name: string): string | undefined {
  const fromRuntime = runtime[name];
  if (isUsable(fromRuntime)) return fromRuntime;
  // Dev/test (vitest/node): process.env is dynamic — read at call time
  // so tests can set/override vars after import. In the production
  // browser build, Vite's define replaces static process.env.WODORE_X
  // expressions with literals and `process` is undefined, so this
  // branch is skipped.
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as unknown as Record<string, string | undefined>)[
      name
    ];
  }
  return undefined;
}

/** Get a runtime env value or throw (for vars the app cannot run without). */
export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined || value === '') {
    throw new Error(`Missing required runtime env: ${name}`);
  }
  return value;
}
