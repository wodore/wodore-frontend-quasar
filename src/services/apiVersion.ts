/**
 * API contract version pinning (date-based, backend `/v1/` API).
 *
 * The backend serves date-based contract versions; clients pin one via the
 * `Api-Version` request header (set by the client middleware in
 * `src/clients/index.ts`). Discovery and lifecycle status: `GET /v1/version`
 * → `api` block (never version-validated server-side, so it stays reachable
 * even when the pinned version has been retired).
 *
 * The pin is GENERATED: `pnpm gen:api` (latest) or `pnpm gen:api-version
 * 2026-10-01` (frozen snapshot for that version) writes both the typed
 * client and the pin (`src/clients/apiVersion.ts`) from the same schema,
 * so types and pin cannot drift. Generating with latest after a new API
 * version was released absorbs it — types and pin bump together in the
 * diff. Additive backend changes never bump the pin.
 *
 * During an unreleased window the backend serves `info.version` as the
 * literal `unreleased`, so generating against it pins the unreleased tip
 * (e.g. to pick up unreleased contract features on staging); the next
 * coordinated backend api-release re-pins via a routine `gen:api`.
 */

export { PINNED_API_VERSION } from '@clients/apiVersion';

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
