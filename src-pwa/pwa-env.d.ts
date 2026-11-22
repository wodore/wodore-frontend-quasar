// Types for the PWA define constants injected by @quasar/app-vite v3
// (the v2 process.env.NODE_ENV-style defines are gone — client code reads
// import.meta.env now; see the app-vite v3 upgrade guide).
interface ImportMetaEnv {
  readonly QUASAR_SERVICE_WORKER_FILE: string;
  readonly QUASAR_PWA_FALLBACK_HTML: string;
  readonly QUASAR_PWA_SERVICE_WORKER_REGEX: string;
}
