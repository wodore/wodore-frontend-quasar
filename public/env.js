// Runtime environment for the Wodore SPA — see services/runtimeEnv.ts.
//
// In the docker image this file ships double-at placeholders that
// replace_vars rewrites at container startup (docker/entrypoint.sh); a
// build-time plugin minifies it (quasar.config.ts → wd-minify-env-js),
// so these comments never reach the served bytes. nginx serves it with
// a short browser window and an even shorter edge one (max-age=300,
// s-maxage=120, stale-while-revalidate=3600 — see nginx-default.conf),
// keeping the freshness guarantees of the old inline <script>: env
// changes, e.g. a renewed MapTiler key, reach every client on the next
// visit, while the HTML shell itself stays free of volatile values —
// which is what lets the SEO edge (docker/seo.js) cache hut pages
// aggressively.
//
// index.html loads this file only where replace_vars runs at runtime
// (production PWA/docker builds). Dev and Capacitor builds bake real
// values inline instead — see the EJS condition in index.html.
window.__WODORE_RUNTIME_ENV__ = {
  WODORE_APP_NAME: '@@WODORE_APP_NAME@@',
  WODORE_ENV: '@@WODORE_ENV@@',
  WODORE_DOMAIN: '@@WODORE_DOMAIN@@',
  WODORE_URL: '@@WODORE_URL@@',
  WODORE_OFFICIAL_URL: '@@WODORE_OFFICIAL_URL@@',
  WODORE_API_HOST: '@@WODORE_API_HOST@@',
  WODORE_API_VERSION: '@@WODORE_API_VERSION@@',
  // Optional CDN base for public/unauthenticated GETs (empty = off —
  // single API host). See services/apiBase.ts.
  WODORE_PUBLIC_API_URL: '@@WODORE_PUBLIC_API_URL@@',
  WODORE_TILE_SERVER_URL: '@@WODORE_TILE_SERVER_URL@@',
  WODORE_IMAGOR_KEY: '@@WODORE_IMAGOR_KEY@@',
  WODORE_IMAGOR_URL: '@@WODORE_IMAGOR_URL@@',
  WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: '@@WODORE_IMAGOR_REPLACE_API_HOST_MEDIA@@',
  WODORE_CLOUDINARY_ENV: '@@WODORE_CLOUDINARY_ENV@@',
  WODORE_UMAMI_WEBSITE_ID: '@@WODORE_UMAMI_WEBSITE_ID@@',
  WODORE_UMAMI_WEBSITE_URL: '@@WODORE_UMAMI_WEBSITE_URL@@',
  // Session recording (replays/heatmaps): 'on' loads recorder.js.
  WODORE_UMAMI_RECORDER: '@@WODORE_UMAMI_RECORDER@@',
  WODORE_OICD_ISSUER_URL: '@@WODORE_OICD_ISSUER_URL@@',
  WODORE_OICD_CLIENT_ID: '@@WODORE_OICD_CLIENT_ID@@',
  WODORE_OICD_RESOURCE_ID: '@@WODORE_OICD_RESOURCE_ID@@',
  WODORE_MAPTILER_API_KEY: '@@WODORE_MAPTILER_API_KEY@@',
  // Error tracking (openspec: add-error-tracking) — empty = fully inert;
  // tracing rate is a string here, parsed tolerantly by services/sentry.ts.
  WODORE_SENTRY_DSN: '@@WODORE_SENTRY_DSN@@',
  WODORE_SENTRY_TRACES_SAMPLE_RATE: '@@WODORE_SENTRY_TRACES_SAMPLE_RATE@@',
};
