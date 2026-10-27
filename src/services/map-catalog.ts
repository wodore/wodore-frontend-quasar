/**
 * Map layer catalog — the client side of the backend-defined layer
 * registry (wodore-backend `apps/basemaps`, PR #331 + #313 + #292).
 *
 * * `GET /v1/map/layers?lang=…&spec=…` — the RESOLVED catalog: one
 *   layer per slug (the backend applies the spec fallback chain and
 *   answers with the served `spec` + spec-resolved `style_url`),
 *   `{data: [...], count: N}` envelope, ETag + revalidate-always
 *   caching (one online reload is always fresh — no cache-busting
 *   params, the browser revalidates via If-None-Match).
 * * `GET /v1/map/slots?lang=…` — `{data: [{slug, label, order}]}` —
 *   the render-slot list that left the layers payload (#331).
 * * `GET /v1/map/styles/{slug}.json?spec=&mode=` — the style itself:
 *   resolved by default (a plain MapLibre style any client can use),
 *   `?mode=tokenized` keeps `{{param}}` tokens for customizing
 *   clients.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { clientWodore } from '@clients/index';
import { publicApiBase } from '@services/apiBase';
import { currentLocale } from '@services/locale';

// ── DTO types (narrowed views of the generated client shapes) ────────────

export type MapSpecTier = 'low' | 'medium' | 'high';

/** Parameter schema entry — drives the settings-tab controls. */
export interface MapLayerParameter {
  slug: string;
  kind: 'number' | 'color' | 'boolean' | 'enum' | 'string' | 'date' | 'opacity-curve';
  label: string;
  description: string;
  /** Default value — a whole MapLibre expression subtree for widget
   *  kinds (`opacity-curve`), a scalar otherwise, null for runtime-only
   *  parameters (`date`). */
  default: unknown;
  constraints?: Record<string, unknown> | null;
}

/** Catalog entry for ONE resolved layer (backend #331): no
 *  `variants[]` — the backend resolved the wanted `spec` and serves
 *  the winning row's fields directly. */
export interface MapCatalogLayer {
  slug: string;
  role: 'basemap' | 'overlay' | string;
  name: string;
  description: string;
  icon: string;
  icon_badge: string;
  slot: string | null;
  order: number;
  show: boolean;
  is_default: boolean;
  /** The SERVED device tier (after the backend's fallback chain
   *  resolved the wanted `?spec=`). */
  spec: MapSpecTier;
  /** Spec-resolved style URL — root-relative for owned styles
   *  (absolutize against WODORE_API_HOST, see `absolutizeStyleUrl` —
   *  the #285 bug class), absolute for external styles. */
  style_url: string | null;
  /** Layer content version (ISO timestamp = layer.modified) — the
   *  client's style-cache comparison key (replaces the old `version`
   *  field name, backend #331). */
  modified?: string | null;
  min_zoom: number | null;
  max_zoom: number | null;
  coverage_bbox: number[] | null;
  fallback_min_zoom: number | null;
  fallback: string | null;
  anchors: Record<string, { before: string | null } | undefined> | null;
  preview_url: string | null;
  config: Record<string, unknown> | null;
  interaction: Record<string, unknown> | null;
  parameters: MapLayerParameter[];
  categories: Array<Record<string, unknown>>;
  attributions: Array<{ name?: string; attribution?: string; url?: string }>;
  license: { name?: string; url?: string } | null;
  legend: {
    sections: Array<{
      title: string;
      description?: string;
      type?: string;
      category?: Record<string, unknown>;
      items?: Array<{
        label: string;
        description?: string;
        color?: string;
        width?: number;
        icon?: string;
      }>;
    }>;
    links?: Array<{ name: string; url: string }>;
  } | null;
}

export interface MapCatalogSlot {
  slug: string;
  label: string;
  order: number;
}

/** `GET /v1/map/layers` response — the generic collection envelope
 *  (one resolved layer per slug; `count` mirrors `data.length`). */
export interface MapLayersResponse {
  data: MapCatalogLayer[];
  count: number;
}

// ── Fetching ─────────────────────────────────────────────────────────────────────

/** In-session catalog cache per (lang, spec, role) — concurrent callers
 *  (overlay compile + basemap picker) share ONE request; a failed fetch
 *  clears the slot so the next call retries. Server ETags own freshness
 *  (revalidate-always) — no cache-busting params, ever. */
const catalogCache = new Map<string, Promise<MapLayersResponse>>();

export class MapCatalogUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Map catalog unavailable: ${String(cause)}`);
    this.name = 'MapCatalogUnavailableError';
  }
}

/** Normalize a served layer into the narrow DTO (defensive: the
 *  generated envelope types entries as loose dicts — the backend
 *  serializes config/legend/categories that way). */
function toCatalogLayer(raw: Record<string, unknown>): MapCatalogLayer {
  // SAFETY: the served entries carry the scalar/array fields the DTO
  // describes (backend #331 contract); the cast only narrows the loose
  // dicts into the typed shape — no runtime transform.
  return {
    ...(raw as unknown as MapCatalogLayer),
    parameters: (raw.parameters ?? []) as unknown as MapLayerParameter[],
  };
}

/**
 * Upper bound for one catalog fetch attempt (two attempts total, 1.5 s
 * backoff between). A hung/blackholed catalog endpoint must not leave
 * the boot in 'loading' forever with no error surfaced — the abort
 * rejects and map-catalog-store logs + shows the error state, exactly
 * like the style fetches (STYLE_FETCH_TIMEOUT_MS).
 */
const CATALOG_FETCH_TIMEOUT_MS = 30_000;

/** One retrying `GET /v1/map/layers` attempt pair — shared by the layers
 *  fetch below. Returns the normalized envelope. */
async function fetchLayersOnce(query: MapLayersQuery): Promise<MapLayersResponse> {
  let lastError: unknown = 'empty response';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await clientWodore.GET('/v1/map/layers', {
        params: { query },
        signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
      });
      if (!error && data && Array.isArray(data.data)) {
        return {
          data: data.data.map(toCatalogLayer),
          count: data.count ?? data.data.length,
        };
      }
      lastError = error ?? 'empty response';
    } catch (e) {
      // Network throw or CATALOG_FETCH_TIMEOUT_MS abort — retry, then
      // reject loudly (the store's catch logs + shows the error row).
      lastError = e;
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new MapCatalogUnavailableError(lastError);
}

/** Query params for the layers collection — a typed subset of the
 *  generated operation's query (lang/spec/role/show/fields). */
interface MapLayersQuery {
  lang: string;
  spec?: MapSpecTier;
  role?: 'basemap' | 'overlay';
}

/**
 * Fetch the resolved map layer catalog in the given language (default:
 * the active UI locale). The backend resolves `spec` server-side and
 * serves ONE layer per slug (`spec` + `style_url` embedded per entry).
 * Rejects with MapCatalogUnavailableError on failure — callers fall
 * back to their persisted caches.
 */
export function fetchMapCatalog(
  lang?: string,
  spec?: MapSpecTier,
  role?: 'basemap' | 'overlay'
): Promise<MapLayersResponse> {
  const locale = lang ?? currentLocale();
  const key = `${locale}:${spec ?? '*'}:${role ?? '*'}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;
  const promise = fetchLayersOnce({
    lang: locale,
    ...(spec ? { spec } : {}),
    ...(role ? { role } : {}),
  });
  catalogCache.set(key, promise);
  promise.catch(() => catalogCache.delete(key));
  return promise;
}

/** In-session slot cache per lang — one request per locale per session. */
const slotsCache = new Map<string, Promise<MapCatalogSlot[]>>();

/**
 * Fetch the render-slot list (`GET /v1/map/slots`, backend #331) —
 * `{data: [{slug, label, order}]}`. Rejects with
 * MapCatalogUnavailableError; callers degrade to the seeded slot set.
 */
export function fetchMapSlots(lang?: string): Promise<MapCatalogSlot[]> {
  const locale = lang ?? currentLocale();
  const cached = slotsCache.get(locale);
  if (cached) return cached;
  const promise = (async () => {
    let lastError: unknown = 'empty response';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await clientWodore.GET('/v1/map/slots', {
          params: { query: { lang: locale } },
          signal: AbortSignal.timeout(CATALOG_FETCH_TIMEOUT_MS),
        });
        if (!error && data && Array.isArray(data.data)) {
          // SAFETY: the generated slots response is a loose dict; the
          // rows carry {slug, label, order} (backend #331 contract).
          return data.data as unknown as MapCatalogSlot[];
        }
        lastError = error ?? 'empty response';
      } catch (e) {
        lastError = e;
      }
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new MapCatalogUnavailableError(lastError);
  })();
  slotsCache.set(locale, promise);
  promise.catch(() => slotsCache.delete(locale));
  return promise;
}

/** Drop cached catalogs (e.g. before a tab-focus revalidation or a
 *  locale round trip) so the next fetch issues a conditional GET (the
 *  browser revalidates the ETag — cheap when unchanged). */
export function clearMapCatalogCache(): void {
  catalogCache.clear();
  slotsCache.clear();
}

// ── Style endpoint ───────────────────────────────────────────────────────

/** Public origin for root-relative style URLs (catalog `style_url`s
 *  are root-relative paths like `/v1/map/styles/x.json?spec=high`)
 *  — CDN base when one is configured: styles are unauthenticated raw
 *  fetches (services/apiBase.ts). */
function apiBase(): string {
  return publicApiBase() || '';
}

export interface StyleVariantOptions {
  /** Fetch the tokenized sibling ({{param}} tokens kept for client-side
   *  resolution) instead of the resolved document. */
  tokenized?: boolean;
}

/**
 * Absolute URL for a layer's style VARIANT, derived from the catalog's
 * canonical `style_url` — which already embeds the backend's SERVED
 * `spec` and the immutable version token (`&v=<style_version>`, backend
 * #434). Parameterized layers append `mode=tokenized`; the version
 * token rides along, so BOTH variants cache immutable — a client-built
 * URL (the old `styleEndpointUrl`) guessed the spec and lost the token.
 * External style URLs (env-resolved by the backend, e.g. MapTiler) pass
 * through untouched — they carry no parameters.
 */
export function styleVariantUrl(styleUrl: string, opts: StyleVariantOptions = {}): string {
  const url = absolutizeStyleUrl(styleUrl);
  if (!opts.tokenized) return url;
  // URLSearchParams (not a substring test) so a future query param like
  // `x-mode=` can never suppress the append. The query slice keeps this
  // valid for root-relative URLs (no URL base needed).
  const queryAt = url.indexOf('?');
  const params = new URLSearchParams(queryAt === -1 ? '' : url.slice(queryAt + 1));
  if (params.has('mode')) return url;
  return `${url}${queryAt === -1 ? '?' : '&'}mode=tokenized`;
}

/** Absolutize a catalog variant's style URL (root-relative → API origin). */
export function absolutizeStyleUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiBase();
  if (!base) return url;
  return new URL(url, base).href;
}

/** Style fetch cache keyed by URL — tokenized/resolved distinction and
 *  the spec are part of the URL, so one entry per concrete document. */
const styleCache = new Map<string, Promise<StyleSpecification>>();

/** Upper bound for one style document fetch. A hung/gateway-timeouting
 *  style endpoint must not block the overlay list forever — the fetch
 *  aborts and the layer skips loudly (map-catalog-store). */
const STYLE_FETCH_TIMEOUT_MS = 30_000;

export class MapStyleUnavailableError extends Error {
  constructor(
    public readonly slug: string,
    cause: unknown
  ) {
    super(`Map style '${slug}' unavailable: ${String(cause)}`);
    this.name = 'MapStyleUnavailableError';
  }
}

/** Fetch a style document from the style endpoint (or an absolute URL).
 *  Aborts after STYLE_FETCH_TIMEOUT_MS — see map-catalog-store for the
 *  skip-with-notice handling of failed fetches. */
export function fetchMapStyle(url: string, slug = url): Promise<StyleSpecification> {
  const cached = styleCache.get(url);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STYLE_FETCH_TIMEOUT_MS);
  const promise = fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .catch(cause => {
      styleCache.delete(url);
      throw new MapStyleUnavailableError(slug, cause);
    })
    .finally(() => clearTimeout(timer));
  styleCache.set(url, promise);
  return promise;
}

// ── Persistence (boot cache + version sync, design.md D1) ────────────────

import { storageGet, storageRemove, storageSet } from '@services/storage';

const LAYERS_CACHE_KEY = 'mapLayersCache';

/** Pre-#331 cache keys (config-catalog split) — removed on first read
 *  so stale shapes never shadow the new layers cache. */
const LEGACY_CACHE_KEYS = ['mapCatalogCache', 'mapBasemapCatalogCache'];

/** Persisted layers snapshot (last successful fetch, any locale):
 *  `{savedAt, lang, data}` — renders instantly on warm boot, the
 *  background refresh revalidates after (server ETags own freshness). */
export interface PersistedLayers {
  savedAt: string;
  lang: string;
  data: MapCatalogLayer[];
}

export function persistLayers(layers: MapCatalogLayer[], lang: string): void {
  storageSet(LAYERS_CACHE_KEY, {
    savedAt: new Date().toISOString(),
    lang,
    data: layers,
  } satisfies PersistedLayers);
}

/** Last persisted layers snapshot (synchronous — the storage service
 *  preloads its cache at boot). Null on a cold first run; migrates away
 *  the legacy pre-#331 cache keys when present. */
export function loadPersistedLayers(): PersistedLayers | null {
  for (const legacy of LEGACY_CACHE_KEYS) {
    if (storageGet(legacy) !== null) storageRemove(legacy);
  }
  const cached = storageGet(LAYERS_CACHE_KEY) as PersistedLayers | null;
  if (!cached || !Array.isArray(cached.data)) return null;
  return cached;
}

const STYLE_CACHE_KEY = 'mapCatalogStyleCache';

/** A persisted style document + the layer version it was built from. */
export interface PersistedStyleEntry {
  /** Resolved-mode document (non-parameterized layers). */
  style?: StyleSpecification | null;
  /** Tokenized document (parameterized layers — resolved client-side). */
  tokenized?: StyleSpecification | null;
  /** `modified` of the catalog layer this was fetched from (ISO
   *  timestamp, backend #331 — was `version`; absent on pre-#331
   *  persisted entries, which simply revalidate once). */
  modified?: string | null;
}

export type PersistedStyleCache = Record<string, PersistedStyleEntry>;

/** Cache key: one entry per slug × spec × mode. */
export function styleCacheKey(slug: string, spec: MapSpecTier, tokenized: boolean): string {
  return `${slug}|${spec}|${tokenized ? 'tokenized' : 'resolved'}`;
}

export function loadStyleCache(): PersistedStyleCache {
  return (storageGet(STYLE_CACHE_KEY) as PersistedStyleCache | null) ?? {};
}

export function persistStyleEntry(
  key: string,
  entry: PersistedStyleEntry,
  cache: PersistedStyleCache = loadStyleCache()
): void {
  cache[key] = entry;
  storageSet(STYLE_CACHE_KEY, cache);
}

/** Drop cached style entries that no longer match any catalog layer
 *  (removed layers) — keeps the persisted cache from growing forever.
 *  Keys are `slug|spec|mode`; the slug segment decides membership. */
export function pruneStyleCache(validSlugs: Set<string>): void {
  const cache = loadStyleCache();
  const stale = Object.keys(cache).filter(k => {
    const slug = k.split('|')[0];
    return slug !== undefined && !validSlugs.has(slug);
  });
  if (stale.length === 0) return;
  for (const k of stale) {
    delete cache[k];
  }
  storageSet(STYLE_CACHE_KEY, cache);
}

// ── Persisted BASEMAP styles (SWR for the boot-critical style) ────────────

const BASEMAP_STYLE_CACHE_KEY = 'basemapStyleCache';

/** Bounded so a long session hopping basemaps can't grow the store
 *  unbounded (style docs run 100-300 kB each; localStorage is ~5 MB). */
const BASEMAP_STYLE_CACHE_MAX = 6;

export interface PersistedBasemapStyle {
  savedAt: string;
  /** RAW style document (URL resolution is deterministic, recomputed
   *  on read — see basemap-store's loadStyleObject). */
  style: StyleSpecification;
}

export function loadBasemapStyleCache(): Record<string, PersistedBasemapStyle> {
  const raw = storageGet(BASEMAP_STYLE_CACHE_KEY);
  // Runtime guard (review finding): a corrupted or schema-drifted entry
  // from an older build must degrade to a cache MISS, never leak a
  // wrong-shaped value through the cast.
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, PersistedBasemapStyle>;
}

/** Store one style document (keyed by its URL). SWR semantics: an
 *  entry may go stale if the backend updates the style under an
 *  unchanged URL (the URL carries slug+spec, not the layer's
 *  `modified`) — the background revalidate in basemap-store refreshes
 *  the copy so at latest the NEXT warm boot serves fresh content.
 *  Prunes to the newest MAX entries by savedAt. */
export function persistBasemapStyle(url: string, style: StyleSpecification): void {
  const cache = loadBasemapStyleCache();
  cache[url] = { savedAt: new Date().toISOString(), style };
  const entries = Object.entries(cache).sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt));
  const pruned = Object.fromEntries(entries.slice(0, BASEMAP_STYLE_CACHE_MAX));
  storageSet(BASEMAP_STYLE_CACHE_KEY, pruned);
}

/** GPU tier → style `spec` param. `shouldUseRaster` (basemap-store) stays
 *  the single detector; this maps its boolean onto the catalog tiers. */
export function gpuSpec(useRaster: boolean): MapSpecTier {
  return useRaster ? 'low' : 'high';
}

// ── Client-side token resolution (mirrors backend resolution.py) ─────────

const TOKEN_WHOLE = /^\{\{([a-z0-9][a-z0-9_.-]*)\}\}$/;
const TOKEN_INLINE = /\{\{([a-z0-9][a-z0-9_.-]*)\}\}/g;

/** A JSON-style tree node after token substitution. */
export type TokenTree =
  | string
  | number
  | boolean
  | null
  | TokenTree[]
  | { [key: string]: TokenTree };

/** Whether a parameter value is substitutable into a style tree. */
function isTokenTree(value: unknown): value is TokenTree {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isTokenTree);
  if (typeof value === 'object') return Object.values(value).every(isTokenTree);
  return false;
}

/**
 * Recursively replace `"{{slug}}"` nodes with resolved values.
 *
 * Whole-node tokens may be replaced by scalars OR entire expression
 * subtrees (opacity curves); tokens embedded inside longer strings (URL
 * templates like `…/{{date}}.geojson`) substitute scalar values only.
 * Unknown tokens pass through untouched; `null` values never substitute
 * (runtime params without a current value stay tokenized).
 *
 * The returned tree has the caller's type: resolution only substitutes
 * JSON nodes inside the tree (values are scalars or subtrees from the
 * same style document family).
 */
export function resolveTokens<T>(value: T, values: Record<string, unknown>): T {
  const usable: Record<string, TokenTree> = {};
  for (const [slug, v] of Object.entries(values)) {
    if (v !== undefined && v !== null && isTokenTree(v)) usable[slug] = v;
  }
  // SAFETY: resolveNode preserves the node kinds (strings, arrays,
  // objects, scalars) — the walk returns the same shape it received,
  // only with token strings substituted.
  return resolveNode(value as unknown as TokenTree, usable) as unknown as T;
}

function resolveNode(value: TokenTree, values: Record<string, TokenTree>): TokenTree {
  if (typeof value === 'string') {
    const whole = TOKEN_WHOLE.exec(value);
    if (whole && whole[1]! in values) return values[whole[1]!];
    if (value.includes('{{')) {
      return value.replace(TOKEN_INLINE, (match, slug: string) =>
        slug in values ? String(values[slug]) : match
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => resolveNode(item, values));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, TokenTree>).map(([k, v]) => [
        k,
        resolveNode(v, values),
      ])
    );
  }
  return value;
}

/** Collect the slugs of every `{{token}}` occurring in a value tree. */
export function collectTokens(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    const re = /\{\{([a-z0-9][a-z0-9_.-]*)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) into.add(m[1]!);
  } else if (Array.isArray(value)) {
    for (const item of value) collectTokens(item, into);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectTokens(v, into);
  }
  return into;
}

// ── Opacity curve helpers ────────────────────────────────────────────────

/** A parsed `["interpolate",["linear"],["zoom"],z1,v1,…]` expression. */
export interface OpacityCurve {
  /** Zoom stops, strictly ascending. */
  stops: Array<{ zoom: number; opacity: number }>;
}

/** Structural check for an opacity-curve expression (persisted-value guard). */
export function isOpacityCurve(value: unknown): value is OpacityCurve {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const stops = (value as OpacityCurve).stops;
  if (!Array.isArray(stops) || stops.length < 2) return false;
  let prev = -Infinity;
  return stops.every(s => {
    const zoom = (s as { zoom?: unknown }).zoom;
    const opacity = (s as { opacity?: unknown }).opacity;
    if (typeof zoom !== 'number' || typeof opacity !== 'number') return false;
    if (!Number.isFinite(zoom) || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      return false;
    }
    if (zoom <= prev) return false;
    prev = zoom;
    return true;
  });
}

/** Parse the interpolate expression into editable stops (zoom kept read-only). */
export function parseOpacityCurve(expr: unknown): OpacityCurve | undefined {
  if (!Array.isArray(expr) || expr[0] !== 'interpolate') return undefined;
  const rest = expr.slice(3); // [z1, v1, z2, v2, …]
  const stops: OpacityCurve['stops'] = [];
  for (let i = 0; i + 1 < rest.length; i += 2) {
    const zoom = rest[i];
    const opacity = rest[i + 1];
    if (typeof zoom !== 'number' || typeof opacity !== 'number') return undefined;
    stops.push({ zoom, opacity });
  }
  return stops.length >= 2 ? { stops } : undefined;
}

/** Serialize editable stops back into the interpolate expression. */
export function serializeOpacityCurve(curve: OpacityCurve): unknown[] {
  return ['interpolate', ['linear'], ['zoom'], ...curve.stops.flatMap(s => [s.zoom, s.opacity])];
}
