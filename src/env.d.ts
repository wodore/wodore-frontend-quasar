/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
    WODORE_GIT_HASH: string;
    WODORE_APP_VERSION: string;
    WODORE_URL: string;
    WODORE_DOMAIN: string;
    WODORE_API_HOST: string;
    WODORE_API_VERSION: string;
    WODORE_IMAGOR_KEY: string;
    WODORE_IMAGOR_URL: string;
    WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: string;
    WODORE_UMAMI_WEBSITE_ID: string;
    WODORE_UMAMI_WEBSITE_URL: string;
    WODORE_OICD_ISSUER_URL: string;
    WODORE_OICD_CLIENT_ID: string;
    WODORE_OICD_RESOURCE_ID: string;
    WODORE_MAPTILER_API_KEY: string;
    TIMESTAMP_VERSION_HEX: string;
  }
}
