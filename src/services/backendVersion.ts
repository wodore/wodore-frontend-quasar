/**
 * Backend version info — ONE shared /v1/version call per 5 minutes
 * (owner request: the menu panel and the api-version check each fired
 * their own request; DevTools showed two identical fetches per load).
 *
 * In-memory cache + in-flight dedupe (module scope, like the hut
 * prefetch). Both consumers go through this service:
 *  - api-version-store: classifies the pin (once per session)
 *  - WdVersionsPanel: shows backend version/hash
 */
import { clientWodore } from '@clients/index';

interface VersionResponse {
  version?: string;
  hash?: string;
  hash_long?: string;
  api?: { supported?: { version: string; status: string; sunset: string | null }[] };
  [key: string]: unknown;
}

export interface BackendVersionInfo {
  version: string;
  hash: string;
  hashLong: string;
  api: VersionResponse['api'];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { at: number; info: BackendVersionInfo } | null = null;
let inflight: Promise<BackendVersionInfo> | null = null;

export function getCachedBackendVersion(): BackendVersionInfo | null {
  return cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.info : null;
}

/** Test hook: drop the cached entry + in-flight promise (the store specs
 * stub a different /v1/version per test — the 5min cache would leak
 * the first response across them). */
export function resetBackendVersionCache(): void {
  cached = null;
  inflight = null;
}

export async function getBackendVersion(): Promise<BackendVersionInfo> {
  const hit = getCachedBackendVersion();
  if (hit) return hit;
  inflight ??= (async () => {
    const { data, error } = await clientWodore.GET('/v1/version', {});
    if (error || !data) {
      throw new Error(error ? JSON.stringify(error) : 'no version payload');
    }
    const payload = data as VersionResponse;
    const info: BackendVersionInfo = {
      version: payload.version ?? '',
      hash: payload.hash ?? '',
      hashLong: payload.hash_long ?? '',
      api: payload.api,
    };
    cached = { at: Date.now(), info };
    return info;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
