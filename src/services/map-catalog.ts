/**
 * Map layer catalog — the client side of the backend-defined layer
 * registry (wodore-backend `apps/basemaps`, PR #313).
 *
 * * `GET /v1/map/catalog?lang=…[&role=…]` — light metadata index:
 *   identity, i18n labels, parameters, device-tier variants, legends,
 *   coverage bounds. Styles are referenced, not inlined.
 * * `GET /v1/map/styles/{slug}.json?spec=&mode=&v=` — the style itself:
 *   resolved by default (a plain MapLibre style any client can use),
 *   `?mode=tokenized` keeps `{{param}}` tokens for customizing clients.
 *
 * The catalog may not be deployed on every environment yet — callers
 * treat it as an UPGRADE over the bundled factory definitions, never as
 * a hard dependency (see map-catalog-store / overlay-store).
 */
import type { StyleSpecification } from 'maplibre-gl';
import { clientWodore } from '@clients/index';
import { getEnv } from '@services/runtimeEnv';
import { currentLocale } from '@services/locale';
import type { schemasWodore } from '@clients/index';

// ── DTO types (narrowed views of the generated client shapes) ────────────

export type MapSpecTier = 'low' | 'medium' | 'high';

/** One device-tier variant of a layer (catalog entry). */
export interface MapLayerVariant {
  spec: MapSpecTier;
  /** Style endpoint URL (root-relative) or an env-resolved external URL. */
  style_url?: string | null;
  /** Authored style document — tokens/env NOT resolved (we use the style
   *  endpoint instead; kept for type completeness). */
  inline_style?: Record<string, unknown> | null;
}

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

/** Catalog entry for one layer (all variants share the identity). */
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
  variants: MapLayerVariant[];
}

export interface MapCatalogSlot {
  slug: string;
  label: string;
  order: number;
}

export interface MapCatalog {
  slots: MapCatalogSlot[];
  layers: MapCatalogLayer[];
}

// ── Fetching ─────────────────────────────────────────────────────────────

/** In-session catalog cache per (lang, role) — concurrent callers share
 *  one request; a failed fetch clears the slot so the next call retries. */
const catalogCache = new Map<string, Promise<MapCatalog>>();

export class MapCatalogUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`Map catalog unavailable: ${String(cause)}`);
    this.name = 'MapCatalogUnavailableError';
  }
}

/** Normalize a generated-client layer into the narrow DTO (defensive:
 *  the backend serializes loose dicts for config/legend/categories). */
function toCatalogLayer(raw: schemasWodore['LayerSummary']): MapCatalogLayer {
  // SAFETY: the backend LayerSummary pydantic model guarantees the
  // scalar/array fields the generated client types as loose dicts
  // (config, legend, categories, anchors) — the DTO only narrows shapes
  // the serializer emits; no runtime transformation happens here.
  const narrowed = raw as unknown as MapCatalogLayer;
  // SAFETY: ParameterSummary/LayerVariant are fully typed in the schema —
  // the cast only narrows the generated `extra: allow` passthroughs.
  narrowed.parameters = (raw.parameters ?? []) as unknown as MapLayerParameter[];
  // SAFETY: same schema-typed list as parameters above.
  narrowed.variants = (raw.variants ?? []) as unknown as MapLayerVariant[];
  return narrowed;
}

/**
 * Fetch the map layer catalog in the given language (default: the active
 * UI locale). Rejects with MapCatalogUnavailableError on failure —
 * callers fall back to the bundled factories.
 */
export function fetchMapCatalog(lang?: string, role?: 'overlay' | 'basemap'): Promise<MapCatalog> {
  const locale = lang ?? currentLocale();
  const key = `${locale}:${role ?? '*'}`;
  const cached = catalogCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await clientWodore.GET('/v1/map/catalog', {
      params: {
        query: {
          lang: locale,
          ...(role ? { role } : {}),
        },
      },
    });
    if (error || !data) {
      throw new MapCatalogUnavailableError(error ?? 'empty response');
    }
    // SAFETY: MapCatalogResponse types slots/layers as loose dict lists
    // (backend dict[str, Any] passthrough); the serializer's actual rows
    // carry the fields MapCatalogSlot/MapCatalogLayer describe.
    return {
      slots: (data.slots ?? []) as unknown as MapCatalogSlot[],
      layers: ((data.layers ?? []) as schemasWodore['LayerSummary'][]).map(toCatalogLayer),
    } satisfies MapCatalog;
  })();
  catalogCache.set(key, promise);
  promise.catch(() => catalogCache.delete(key));
  return promise;
}

/** Drop cached catalogs (e.g. after a locale switch round trip). */
export function clearMapCatalogCache(): void {
  catalogCache.clear();
}

// ── Style endpoint ───────────────────────────────────────────────────────

/** API origin for root-relative style URLs (catalog `style_url`s are
 *  root-relative paths like `/v1/map/styles/x.json?spec=high`). */
function apiBase(): string {
  return (getEnv('WODORE_API_HOST') || '').replace(/\/$/, '');
}

export interface StyleRequestOptions {
  /** Device tier — the server falls back exact → nearest → single. */
  spec?: MapSpecTier;
  /** Keep parameter tokens for client-side resolution. */
  tokenized?: boolean;
}

/**
 * Absolute style endpoint URL for a layer slug. External style URLs
 * (env-resolved by the backend, e.g. MapTiler) pass through untouched.
 */
export function styleEndpointUrl(slug: string, opts: StyleRequestOptions = {}): string {
  const params = new URLSearchParams();
  if (opts.spec) params.set('spec', opts.spec);
  if (opts.tokenized) params.set('mode', 'tokenized');
  const qs = params.toString();
  const path = `/v1/map/styles/${slug}.json${qs ? `?${qs}` : ''}`;
  const base = apiBase();
  if (!base) return path;
  return new URL(path, base).href;
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

export class MapStyleUnavailableError extends Error {
  constructor(
    public readonly slug: string,
    cause: unknown
  ) {
    super(`Map style '${slug}' unavailable: ${String(cause)}`);
    this.name = 'MapStyleUnavailableError';
  }
}

/** Fetch a style document from the style endpoint (or an absolute URL). */
export function fetchMapStyle(url: string, slug = url): Promise<StyleSpecification> {
  const cached = styleCache.get(url);
  if (cached) return cached;
  const promise = fetch(url, { headers: { Accept: 'application/json' } })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<StyleSpecification>;
    })
    .catch(cause => {
      styleCache.delete(url);
      throw new MapStyleUnavailableError(slug, cause);
    });
  styleCache.set(url, promise);
  return promise;
}

// ── Variant selection (mirrors backend MapLayer.pick_variant) ────────────

const TIER_ORDER: Record<MapSpecTier, number> = { low: 0, medium: 1, high: 2 };

/**
 * Select the catalog variant for a requested spec: exact match, else the
 * nearest available tier (ties → the lower/simpler tier), else the single
 * existing variant. Mirrors the backend rule so client-side selection
 * between variant entries (external style URLs) agrees with the server.
 */
export function pickVariant(
  variants: MapLayerVariant[],
  spec: MapSpecTier | undefined
): MapLayerVariant | undefined {
  if (variants.length === 0) return undefined;
  if (spec) {
    const exact = variants.find(v => v.spec === spec);
    if (exact) return exact;
    const wanted = TIER_ORDER[spec];
    return [...variants].sort(
      (a, b) =>
        Math.abs(TIER_ORDER[a.spec] - wanted) - Math.abs(TIER_ORDER[b.spec] - wanted) ||
        TIER_ORDER[a.spec] - TIER_ORDER[b.spec]
    )[0];
  }
  return variants[0];
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
