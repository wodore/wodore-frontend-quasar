// Runtime environment for the Wodore SPA — see services/runtimeEnv.ts.
//
// This file is intentionally NOT processed at build time: in the docker
// image it ships double-at placeholders that replace_vars rewrites at
// container startup (docker/entrypoint.sh), and nginx serves it with
// Cache-Control: no-store. This keeps the exact freshness guarantees the
// inline <script> in index.html used to provide (env changes, e.g. a
// renewed MapTiler key, reach every client on the next visit) while the
// HTML shell itself stays free of volatile values — which is what lets
// the SEO edge (docker/seo.js) cache hut pages aggressively.
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
  WODORE_TILE_SERVER_URL: '@@WODORE_TILE_SERVER_URL@@',
  WODORE_IMAGOR_KEY: '@@WODORE_IMAGOR_KEY@@',
  WODORE_IMAGOR_URL: '@@WODORE_IMAGOR_URL@@',
  WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: '@@WODORE_IMAGOR_REPLACE_API_HOST_MEDIA@@',
  WODORE_CLOUDINARY_ENV: '@@WODORE_CLOUDINARY_ENV@@',
  WODORE_UMAMI_WEBSITE_ID: '@@WODORE_UMAMI_WEBSITE_ID@@',
  WODORE_UMAMI_WEBSITE_URL: '@@WODORE_UMAMI_WEBSITE_URL@@',
  WODORE_OICD_ISSUER_URL: '@@WODORE_OICD_ISSUER_URL@@',
  WODORE_OICD_CLIENT_ID: '@@WODORE_OICD_CLIENT_ID@@',
  WODORE_OICD_RESOURCE_ID: '@@WODORE_OICD_RESOURCE_ID@@',
  WODORE_MAPTILER_API_KEY: '@@WODORE_MAPTILER_API_KEY@@',
};
