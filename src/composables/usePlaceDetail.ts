/**
 * usePlaceDetail — the generalized detail-data engine (OpenSpec
 * `add-place-interactions`, capability `place-interactions` / async
 * data rules). Per-entry fetchers/seeds with the framework concerns
 * written ONCE:
 *
 * - Supersession correctness via a sequence token; `AbortController`
 *   only as a bandwidth optimization — a DEDUPED request is never
 *   aborted while another consumer still awaits it (owner counting).
 * - Simultaneous identical requests dedupe on a module-scope Map keyed
 *   `${entry.id}:${id}:${lang}` (fixes the legacy slug-only key, which
 *   cross-talked locales).
 * - Seed-then-overwrite: entry.seed(props) computed once per target key
 *   (LRU-bounded cache, cleared on overlay-catalog epoch bumps — props
 *   from pre-swap tiles are semantically stale).
 * - Locale refetch only while a target is present (a closed/unmounted
 *   surface never fires background requests).
 *
 * `usePlace` is a thin compat wrapper over this engine during PR1a; the
 * accommodation entry (task group 4) takes over the hut fetch/seed.
 */
import {
  effectScope,
  ref,
  shallowRef,
  watch,
  onScopeDispose,
  type EffectScope,
  type Ref,
  type ShallowRef,
} from 'vue';
import { currentLocale } from '@services/locale';
import { defaultRegistry } from '@selection/registry';
import { useOverlayStore } from '@stores/map/overlay-store';
import type { MapTarget, Presentation } from '@selection/types';

// ── Errors (shared with the legacy usePlace surface) ────────────────────

/** Why a detail request failed. */
export type PlaceErrorKind = 'offline' | 'unreachable' | 'http';

export interface PlaceError {
  kind: PlaceErrorKind;
  /** HTTP status code, set only for kind === 'http'. */
  status?: number;
}

/** Carries a PlaceError through promise chains so an outer catch can
 *  classify without guessing from message strings. */
export class PlaceRequestError extends Error {
  readonly placeError: PlaceError;

  constructor(placeError: PlaceError, message: string) {
    super(message);
    this.name = 'PlaceRequestError';
    this.placeError = placeError;
  }
}

export function toPlaceError(err: unknown): PlaceError {
  if (err instanceof PlaceRequestError) return err.placeError;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { kind: 'offline' };
  return { kind: 'unreachable' };
}

// ── Module-scope engine state ───────────────────────────────────────────

/** Dedup of simultaneous identical requests. Keyed by
 *  `${entry.id}:${id}:${lang}` — never reactive state (promises in
 *  reactive refs cause churn for zero benefit). */
const pending = new Map<string, Promise<object>>();

/** Owner count per pending key — a request with >1 awaiting consumer is
 *  NEVER aborted by one of them leaving (dedup cross-talk guard). */
const owners = new Map<string, number>();

/** Seed cache: entry.seed(props) computed once per target key.
 *  Insertion-order LRU, capped; cleared on catalog epoch bumps. */
const seedCache = new Map<string, object>();
const SEED_CACHE_MAX = 50;

function cacheSeed(key: string, value: object): void {
  if (seedCache.has(key)) seedCache.delete(key); // refresh LRU position
  seedCache.set(key, value);
  if (seedCache.size > SEED_CACHE_MAX) {
    const oldest = seedCache.keys().next().value;
    if (oldest !== undefined) seedCache.delete(oldest);
  }
}

/** Test hook: reset module state between spec cases. */
export function __resetPlaceDetailEngine(): void {
  pending.clear();
  owners.clear();
  seedCache.clear();
  epochScope?.stop();
  epochScope = null;
}

/** Catalog-epoch invalidation, registered ONCE on first composable use
 *  in a DETACHED effect scope (GLM review F2): a plain watch would die
 *  with the first host component's scope (panel unmount) while the
 *  installed-flag stayed true — the seed cache would never clear again.
 *  Detached scopes are never auto-disposed; the reset hook stops it. */
let epochScope: EffectScope | null = null;

function installEpochWatch(): void {
  if (epochScope) return;
  try {
    epochScope = effectScope(true);
    epochScope.run(() => {
      watch(
        () => useOverlayStore().overlaysEpoch,
        () => seedCache.clear()
      );
    });
  } catch {
    // Store unavailable (no pinia yet — early boot/test env): the LRU
    // bound still caps memory; the next composable instance retries.
    epochScope = null;
  }
}

/** Seed the cache from an adapter (map click): computes and stores
 *  entry.seed(props) for the target key so the composable paints it
 *  before any fetch resolves (the generalized seedPlaceFromMap). The
 *  entry may be passed explicitly (claim/route-aware resolution); the
 *  fallback resolves through the default registry, which reads
 *  source/id — both required here. */
export function stageSeed(
  target: Pick<MapTarget, 'key' | 'source' | 'id'> & { props?: MapTarget['props'] },
  entry?: Presentation | null
): void {
  if (!target.key || !target.props) return;
  const resolved = entry ?? defaultRegistry().resolve(target as MapTarget);
  if (!resolved?.seed) return;
  const partial = resolved.seed(target.props);
  if (partial) cacheSeed(target.key, partial);
}

/** Seed the cache with a PREBUILT partial (compat path: the legacy
 *  seedPlaceFromMap builds its own partial from tile properties +
 *  geometry-derived location, which entry.seed(props) cannot express). */
export function stagePrebuiltSeed(key: string, partial: Record<string, unknown>): void {
  if (!key) return;
  cacheSeed(key, partial);
}

/** Take/put a deduped request with owner accounting. */
function joinPending(key: string, create: () => Promise<object>): Promise<object> {
  const existing = pending.get(key);
  if (existing) {
    owners.set(key, (owners.get(key) ?? 1) + 1);
    return existing;
  }
  const promise = create();
  pending.set(key, promise);
  owners.set(key, 1);
  promise
    .catch(() => undefined) // never propagate into the cleanup chain
    .finally(() => {
      pending.delete(key);
      owners.delete(key);
    });
  return promise;
}

/** Release ownership; returns true if the caller was the LAST owner
 *  (an abort would not hurt anyone else). */
function releasePending(key: string): boolean {
  const count = (owners.get(key) ?? 0) - 1;
  if (count <= 0) {
    owners.set(key, 0);
    return true;
  }
  owners.set(key, count);
  return false;
}

/** Dedup key — entry, target AND locale dimensions (fixes the legacy
 *  slug-only key, which let a wrong-locale payload cross-talk between
 *  simultaneous consumers). */
export function dedupKey(entryId: string, id: string, lang: string): string {
  return `${entryId}:${id}:${lang}`;
}

// ── Composable ──────────────────────────────────────────────────────────

export interface UsePlaceDetailOptions {
  /** Entry override (routed-side binding). Falls back to registry
   *  resolution of the target. */
  entry?: Ref<Presentation | null | undefined>;
}

export interface UsePlaceDetailReturn {
  /** The entry's detail payload (seed partial until the fetch lands).
   *  shallowRef — payloads are wire objects, replaced not mutated. */
  detail: ShallowRef<object | null>;
  loading: Ref<boolean>;
  error: Ref<PlaceError | null>;
  refetch: () => void;
}

export function usePlaceDetail(
  target: Ref<MapTarget | null | undefined>,
  opts: UsePlaceDetailOptions = {}
): UsePlaceDetailReturn {
  installEpochWatch();
  const detail = shallowRef<object | null>(null);
  const loading = ref(false);
  const error = ref<PlaceError | null>(null);

  // Token = supersession correctness; abort = optimization (owner-
  // guarded). The captured controller must not be read after reassign.
  let seq = 0;
  let controller: AbortController | null = null;
  let pendingKey: string | null = null;

  function resolveEntry(t: MapTarget): Presentation | null | undefined {
    return opts.entry?.value ?? defaultRegistry().resolve(t);
  }

  async function load(t: MapTarget): Promise<void> {
    const entry = resolveEntry(t);
    if (!entry?.fetch) {
      // Props-only entry (geoplace-default popups): seeds/props are the
      // whole payload, no network.
      loading.value = false;
      return;
    }
    const lang = currentLocale();
    const key = dedupKey(entry.id, t.id, lang);
    const token = ++seq;

    // Best-effort abort of the superseded request — only when this
    // composable is its sole owner (shared requests are never aborted)
    // and only when it is a DIFFERENT key (GLM review F6: a refetch of
    // the identical in-flight request would abort-then-join its own
    // aborted promise).
    const sameKey = pendingKey === key;
    if (!sameKey && controller && pendingKey && releasePending(pendingKey)) {
      controller.abort();
    }
    controller = new AbortController();
    pendingKey = key;

    // Seed application belongs to the target watcher (one source of
    // truth); a refetch keeps the full payload painted (legacy parity).
    loading.value = true;
    error.value = null;

    // Locals for the create closure — provably non-null here (fetch
    // checked above, controller just assigned); no assertions (F9).
    const fetcher = entry.fetch;
    const signal = controller.signal;
    const request = joinPending(key, () => fetcher({ id: t.id, lang, signal }) as Promise<object>);

    try {
      const data = await request;
      if (token !== seq) return; // superseded: state belongs to a newer load
      detail.value = data;
    } catch (err) {
      if (token !== seq) return;
      // A teardown abort is not an error state (legacy filtered
      // AbortError by name — GLM review F7).
      if (err instanceof Error && err.name === 'AbortError') return;
      error.value = toPlaceError(err);
    } finally {
      if (token === seq) {
        loading.value = false;
        if (pendingKey === key) releasePending(key);
      }
    }
  }

  watch(
    [() => target.value?.key, currentLocale],
    () => {
      const t = target.value;
      if (!t) {
        detail.value = null;
        return;
      }
      // Apply (or lazily compute) the seed before loading — with the
      // resolved entry passed through (GLM review F5: default-registry
      // fallback resolution is wrong for entry-override targets).
      if (!seedCache.has(t.key)) stageSeed(t, resolveEntry(t));
      const seeded = seedCache.get(t.key);
      if (seeded) detail.value = seeded;
      void load(t);
    },
    { immediate: true }
  );

  onScopeDispose(() => {
    // Owner-guarded best-effort abort on teardown, too.
    if (controller && pendingKey && releasePending(pendingKey)) {
      controller.abort();
    }
  });

  return {
    detail,
    loading,
    error,
    refetch: () => {
      const t = target.value;
      if (t) void load(t);
    },
  };
}
