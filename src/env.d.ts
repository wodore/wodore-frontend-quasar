interface ImportMetaEnv {
  readonly QUASAR_VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
  readonly QUASAR_VUE_ROUTER_BASE: string | undefined;
  readonly WODORE_GIT_HASH: string;
  readonly WODORE_APP_VERSION: string;
  readonly WODORE_APP_NAME: string;
  readonly WODORE_ENV: 'development' | 'staging' | 'preview' | 'production';
  readonly WODORE_URL: string;
  readonly WODORE_DOMAIN: string;
  readonly WODORE_API_HOST: string;
  readonly WODORE_API_VERSION: string;
  /** Optional CDN base for public/unauthenticated GETs (empty = off). */
  readonly WODORE_PUBLIC_API_URL: string;
  readonly WODORE_IMAGOR_KEY: string;
  readonly WODORE_IMAGOR_URL: string;
  readonly WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: string;
  readonly WODORE_UMAMI_WEBSITE_ID: string;
  readonly WODORE_UMAMI_WEBSITE_URL: string;
  /** Umami session recording opt-in ('on' = load recorder.js). */
  readonly WODORE_UMAMI_RECORDER: string;
  readonly WODORE_OICD_ISSUER_URL: string;
  readonly WODORE_OICD_CLIENT_ID: string;
  readonly WODORE_OICD_RESOURCE_ID: string;
  readonly WODORE_MAPTILER_API_KEY: string;
  readonly WODORE_OFFICIAL_URL: string;
  readonly WODORE_SENTRY_DSN: string;
  readonly WODORE_SENTRY_TRACES_SAMPLE_RATE: string;
  readonly TIMESTAMP_VERSION_HEX: string;
}
declare module '*?worker&url' {
  const workerUrl: string;
  export default workerUrl;
}
