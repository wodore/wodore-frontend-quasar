/**
 * API contract version pinning (date-based, backend `/v1/` API).
 *
 * The backend serves date-based contract versions; clients pin one via the
 * `Api-Version` request header (set by the client middleware in
 * `src/clients/index.ts`). Discovery and lifecycle status: `GET /v1/version`
 * → `api` block (never version-validated server-side, so it stays reachable
 * even when the pinned version has been retired).
 *
 * Bump the pin ONLY when deliberately absorbing a breaking API change —
 * see the backend's `CHANGELOG_API.md` for what each version change means.
 * Additive backend changes (new endpoints, optional fields) need no bump.
 */

/** Contract version this app is built and tested against (YYYY-MM-DD). */
export const PINNED_API_VERSION = '2026-10-01';

/** Lifecycle status of an API version, as reported by `/v1/version`. */
export type ApiVersionStatus = 'current' | 'deprecated' | 'sunset';

export interface ApiVersionEntry {
  version: string;
  status: ApiVersionStatus;
  /** Sunset date (YYYY-MM-DD) of deprecated versions; null while current. */
  sunset: string | null;
}

/** Outcome of checking the pin against the backend's version registry. */
export type ApiVersionCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; entry: ApiVersionEntry }
  | { state: 'deprecated'; entry: ApiVersionEntry }
  | { state: 'unsupported'; entry?: ApiVersionEntry }
  | { state: 'error'; message: string };

type VersionErrorListener = (code: string) => void;

/**
 * Listener registry for version errors surfaced by the API client
 * middleware (410 `api_version_sunset`). Decouples the middleware from the
 * Pinia store (which imports the client — a direct import would be cyclic).
 */
const versionErrorListeners = new Set<VersionErrorListener>();

export function onApiVersionError(listener: VersionErrorListener): () => void {
  versionErrorListeners.add(listener);
  return () => versionErrorListeners.delete(listener);
}

export function emitApiVersionError(code: string): void {
  for (const listener of versionErrorListeners) listener(code);
}
