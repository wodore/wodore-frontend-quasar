/**
 * Selection framework types — the narrow contract between interaction
 * origins (map clicks, search, deep links) and presentations.
 *
 * Design source: _work/place-interactions.md (rev 3) + OpenSpec change
 * `add-place-interactions` (capability `place-registry`). Reactivity
 * rules are NORMATIVE (§2.1): targets are immutable wire data —
 * `markRaw` at construction, `shallowRef` in stores, never cloned,
 * never mutated; `featureRef` holds LIVE engine objects (MapLibre
 * feature-state keys, Leaflet markers) that must never be proxied.
 */
import type { Component } from 'vue';
import type { schemasWodore } from '@clients/index';

/** Raw wire payload bag (MVT tile properties, search row, probe
 *  response). Immutable read-only data — the only reactivity a popup
 *  needs is the locale ref (re-render picks `name_${locale}`). */
export type PropsBag = Record<string, unknown>;

/** WGS84 position used for popup anchoring + flyTo. */
export interface LatLng {
  lat: number;
  lon: number;
}

/** Lazy component loader — the raw Vite dynamic-import thunk. Hosts wrap
 *  with defineAsyncComponent + markRaw into keyed shallowRefs; the
 *  registry never wraps (route consumers take bare thunks). */
export type ComponentLoader = () => Promise<{ default: Component }>;

/**
 * Engine-tagged highlight handle, attached by the adapter that
 * created the target and passed back to THAT adapter (selected by
 * `engine`) to set/clear the selection highlight. MapLibre: handle is
 * `{source, sourceLayer, id}` with the NUMERIC feature id (≠ slug).
 * Leaflet: the marker instance. The handle is a LIVE engine object —
 * never proxied, never cloned (markRaw the whole target). Absent for
 * search/deep-link targets.
 */
export interface FeatureRef {
  readonly engine: 'maplibre' | 'leaflet';
  readonly handle: unknown;
}

/**
 * Normalized "what was clicked/selected" — produced by every entry
 * point; nothing downstream knows the origin.
 */
export interface MapTarget {
  /** Built by {@link targetKey} — never hand-built at call sites. */
  key: string;
  /** Owning family ('geoplace' | 'transport' | …) — flat strings. */
  source: string;
  /** CANONICAL id driving the URL (geoplace slug / external id). The
   *  hut source_id is entry-internal (from props or the probe). */
  id: string;
  /** Popup anchor + flyTo target (geometry-derived when present). */
  location?: LatLng;
  /** Raw payload: MVT props | search row | probe response. markRaw. */
  props: PropsBag;
  /** See {@link FeatureRef}. markRaw. */
  featureRef?: FeatureRef;
}

/**
 * Collision-free target key: LENGTH-PREFIXED so the source/id boundary
 * is unambiguous even when external ids contain the separator (e.g.
 * transport ids like `ch.sbb:123`). Split by reading the leading
 * `<len>:` then slicing.
 */
export function targetKey(t: Pick<MapTarget, 'source' | 'id'>): string {
  return `${t.source.length}:${t.source}${t.id}`;
}

// ── Matching ─────────────────────────────────────────────────────────────

/**
 * Declarative match spec — DATA, not an opaque predicate. Unit-testable
 * as tables, printable for diagnostics, vocabulary kept in taxonomy.ts.
 * `kindParent` is DERIVED (identifier prefix) — the wire carries no
 * parent member.
 */
export interface MatchSpec {
  /** Target source family — must equal `target.source`. */
  source: string;
  /** Match when `target.props.domain` equals (or is included in). */
  domain?: string | readonly string[];
  /** Derived kind parent (identifier prefix, via taxonomy.kindParentOf). */
  kindParent?: string | readonly string[];
  /** Full kind identifier ('accommodation.hut') or kind slug. */
  kind?: string | readonly string[];
  /** Escape hatch — consumes the ERASED target (contravariance-safe). */
  where?: (target: MapTarget) => boolean;
}

/** A map-layer claim: which style layers produce targets of an entry,
 *  which tile property is the canonical id, and the interaction zoom
 *  floor. Layer id constants live in map-layer-ids.ts (the single home
 *  of the catalog naming contract). */
export interface LayerClaim {
  /** MapLibre style layer id (from map-layer-ids.ts). */
  layer: string;
  /** Strict lower zoom bound for handled interactions (`zoom > minZoom`). */
  minZoom?: number;
  /** Which tile property carries the canonical id (feature→target
   *  mapping contract — see propsFromFeature). */
  idProp?: string;
}

// ── Data ─────────────────────────────────────────────────────────────────

/** Controller-resolved identity probe (cold deep links): the geoplace
 *  detail endpoint under a minimal sparse-fieldset selection — domain
 *  (required member), kind, sources. Entries MUST NOT re-probe when
 *  present on the fetch context. */
export type GeoPlaceProbe = schemasWodore['GeoPlaceDetailSchema'];

/** Fetch context — `probe` is set when the controller already resolved
 *  identity (cold link, search-select). */
export interface FetchCtx {
  id: string;
  lang: string;
  signal: AbortSignal;
  probe?: GeoPlaceProbe;
}

// ── Presentation ─────────────────────────────────────────────────────────

/** Surface components of an entry — ONE barrel module per entry
 *  (`surfaces.ts` re-exports), one lazy chunk per entry. */
export interface EntrySurfaces {
  popup?: Component;
  detail?: Component;
  /** Panel HEADER zone (name/badges) — feeds the panel's title slot. */
  detailTitle?: Component;
  /** Pinned FOOTER zone (CTAs) — feeds the panel's actions slot. */
  detailActions?: Component;
}

export type DetailStart = 'minimized' | 'expanded';

/** Entry-edge definition — generic for full inference; erases to
 *  {@link Presentation} via definePresentation. D is the entry's detail
 *  type (an object; the seed returns a partial of it). */
export interface PresentationDef<D extends object> {
  id: string;
  match: MatchSpec;
  /** Sync, declarative surface capabilities — lets `open()` pick the
   *  surface WITHOUT awaiting the lazy barrel (the loader stays the
   *  single chunk source). */
  capabilities?: ReadonlyArray<'popup' | 'detail'>;
  /** Barrel loader — `() => import('./surfaces')`. */
  surfaces?: () => Promise<EntrySurfaces>;
  /** Narrow return type erases soundly (covariant). */
  fetch?(ctx: FetchCtx): Promise<D>;
  /** Wide bag in, narrow partial out — the entry's decoder narrows
   *  inside; erasure is trivially sound. */
  seed?(props: PropsBag): Partial<D> | null;
  detailStart?: DetailStart;
  mapLayers?: ReadonlyArray<LayerClaim>;
}

/** Erased, registry-facing presentation — no generic parameters leak
 *  here (a generic match predicate would be contravariant). */
export interface Presentation {
  id: string;
  match: MatchSpec;
  capabilities?: ReadonlyArray<'popup' | 'detail'>;
  surfaces?: () => Promise<EntrySurfaces>;
  fetch?(ctx: FetchCtx): Promise<object>;
  seed?(props: PropsBag): object | null;
  detailStart?: DetailStart;
  mapLayers?: ReadonlyArray<LayerClaim>;
}

/**
 * Identity helper: generic at the entry edge, erased at the registry.
 * Entries get full type inference on fetch/seed; the registry stores
 * plain Presentations.
 */
export function definePresentation<D extends object>(def: PresentationDef<D>): Presentation {
  // Sound by construction: fetch/seed return types are covariant, the
  // wide seed parameter is already the erased bag, match consumes no
  // generics. The cast only widens the recorded def.
  return def as Presentation;
}
