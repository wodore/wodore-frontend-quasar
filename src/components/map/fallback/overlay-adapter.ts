/**
 * FALLBACK OVERLAY ADAPTER — applies the shared overlay store's catalog
 * overlays to the Leaflet fallback map.
 *
 * The SAME store WdOverlayControl drives (stores/map/overlay-store):
 * toggling an overlay on either map mutates the shared active flags, so
 * the state round-trips when the renderer switches. This adapter is the
 * Leaflet counterpart of WdOverlayControl's maplibre layer management:
 *
 * * Raster overlays (the 9 subset-seeded swisstopo/waymarkedtrails
 *   tiles, backend #440) render as `L.tileLayer` from the overlay's
 *   RESOLVED style (`overlay.style.sources/layers` — the same document
 *   the maplibre path adds): tile URL template, `minzoom`,
 *   `maxNativeZoom` (source maxzoom) and the zoom-interpolated
 *   `raster-opacity` curve.
 * * Circle overlays (geojson sources — the transport-stops subset
 *   variant, backend #442) render as canvas CircleMarkers: the geojson
 *   `data` URL is fetched ONCE per adapter (cleared on catalog swap),
 *   `circle-color` / `circle-radius` / `circle-opacity` /
 *   `circle-stroke-*` are evaluated per zoom + feature through
 *   `evalStyleExpr` (the operator subset the backend's subset walker
 *   whitelists). Attribution note: geojson overlays carry the raw data
 *   URL — no attribution wiring yet (the raw.githubusercontent.com
 *   BAV list carries none).
 * * CLUSTERED circle overlays (backend subset twin declares `cluster`
 *   source keys): the fetched points feed a supercluster index whose
 *   options mirror the served config; on the cluster band (z5–z6 for
 *   transport-stops) aggregated bubbles render as divIcon markers —
 *   palette-colored, sized by member count, count text honoring the
 *   `ui.overlayClusterCounts` user setting. Outside the band the raw
 *   circle path takes over exactly as before. Clustering is a
 *   SUBSET-profile feature: full (WebGL) styles never declare it.
 * * Everything else (huts symbols, vector sources, tokenized geojson
 *   data URLs) stays NOT rendered: the overlay menu's profile filtering
 *   (rendererProfile="subset" on WdOverlayControl) hides full-only rows
 *   where the backend serves a profile, and the adapter skips any style
 *   without a Leaflet-servable base anyway (defense in depth against
 *   group-logic activations; pre-profile backends show lenient
 *   visible-but-inert rows).
 * * The `wd-huts` content stays the fallback's built-in always-on
 *   rendering (MLT tiles + cluster groups) — unaffected by this
 *   adapter.
 *
 * Panes: a dedicated `wdOverlay` pane for catalog raster tiles, plus a
 * `wdOverlayData` pane (one z-step above; both below the canvas dots on
 * overlayPane 400 and cluster icons on markerPane 600) for circle
 * overlays — circles paint above raster overlays regardless of toggle
 * order, always below the huts.
 *
 * DEBUGGING/VERIFICATION CONTRACT (a 2026-10-29 investigation chased a
 * phantom "renders nothing" bug caused by non-matching DOM probes —
 * these are the shapes that ACTUALLY exist at runtime):
 * * cluster bubbles are divIcon markers with classes
 *   `wd-cluster-bubble leaflet-marker-icon` (custom `className`
 *   REPLACES Leaflet's default `leaflet-div-icon` — querying
 *   `.leaflet-div-icon` finds NOTHING), in the marker pane;
 * * raw circle markers are painted on a shared `<canvas>` (L.canvas)
 *   in the pane element `.leaflet-wdOverlayData-pane` — custom panes
 *   get Leaflet's `leaflet-` prefix + `-pane` suffix, and canvas
 *   rendering produces NO SVG `circle` elements anywhere;
 * * `window.__wdFbDebug.map` (dev builds) exposes the live map for
 *   layer-walk assertions (e.g. counting markers with `.feature`).
 */

import * as L from 'leaflet';
import Supercluster from 'supercluster';
import { watch, type WatchStopHandle } from 'vue';
import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  LayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useUserSettingsStore } from '@stores/user-settings-store';
import { isClusterCountLayer, isClusterLayer } from '@stores/map/utils/overlay-clusters';
import type { OverlaySwitchItem } from '@stores/map/utils/interfaces';

/** Leaflet pane name for catalog raster overlays. */
const OVERLAY_PANE = 'wdOverlay';
/** Pane z-index: tilePane is 200, overlayPane 400 — overlays sit
 * between them (above every basemap, below hut dots + clusters). */
const OVERLAY_PANE_Z = 250;
/** Leaflet pane name for catalog circle (geojson) overlays. */
const CIRCLE_PANE = 'wdOverlayData';
/** One z-step above the raster overlay pane — circle overlays paint
 * above active raster overlays, still below overlayPane (hut dots). */
const CIRCLE_PANE_Z = 255;
/** Fallback map zoom ceiling (WdFallbackMapView MAX_ZOOM parity). */
const MAP_MAX_ZOOM = 19;
/**
 * Default zoom floor for geojson circle overlays whose style layers
 * declare no `minzoom`: the BAV list is ~27k point features and the
 * fallback map runs on low-spec devices — sub-z10 circles are
 * invisible clutter (transport-stops' interpolated radius is 1–3px and
 * its opacity curve only reaches 0.6 at z8), so painting the whole
 * country of stops at world view is wasted memory + redraw time. The
 * backend's subset twin sets `minzoom: 10` explicitly — this default
 * keeps the served FULL variant (no minzoom today) equally safe.
 */
const CIRCLE_DEFAULT_MIN_ZOOM = 10;
/** Upper bound for one geojson document fetch (the BAV list is ~4 MB —
 * low-spec devices on slow networks need more headroom than a style
 * document). */
const GEOJSON_FETCH_TIMEOUT_MS = 60_000;
/** Unresolved `{{param}}` token — tokenized data URLs stay unsupported
 * (the adapter consumes RESOLVED styles only; a token in the data URL
 * means the store could not resolve it). */
const STYLE_TOKEN_RE = /\{\{/;

// ── Expression evaluation (backend subset walker parity) ─────────────────
//
// The backend's subset validation (wodore-backend apps/basemaps
// validation.py SUBSET_EXPRESSION_OPS) whitelists exactly: get, has,
// match, case, in, ==, >, !, interpolate, literal. This evaluator
// implements the same set — anything else evaluates to undefined
// (callers fall back to safe defaults) so an unknown future operator
// degrades to a visible default instead of a crash.

/** Feature properties for expression evaluation (geojson properties). */
export type StyleProps = Record<string, unknown> | undefined;

/** The result of evaluating one whitelisted expression: a scalar
 * literal, a literal array (e.g. match label sets), or undefined for
 * unsupported/malformed shapes. Consumers narrow via finiteNumber /
 * colorOr / boolean checks — exactly the MapLibre type domains. */
export type StyleValue = string | number | boolean | null | unknown[] | undefined;

/**
 * Evaluate a whitelisted MapLibre style expression at a zoom with a
 * feature's properties. Plain scalars pass through; supported
 * operators: `get` / `has` / `literal` / `in` / `==` / `>` / `!` /
 * `case` / `match` and `interpolate` with a `['zoom']` or
 * `['get', '<property>']` input, linear interpolation (stop VALUES may
 * be nested expressions — transport-stops interpolates per-type case
 * expressions for its radius, and its cluster bubbles interpolate on
 * the aggregated `point_count`). Unknown or malformed expressions
 * evaluate to undefined.
 *
 * LIMITATION: `interpolate` with an exponential base
 * (["exponential", e]) would evaluate as if linear — fine for today's
 * catalog styles (the backend walker only whitelists ["linear"]);
 * revisit if a catalog style ever ships a non-linear curve.
 */
export function evalStyleExpr(expr: unknown, zoom: number, props: StyleProps): StyleValue {
  if (expr === null) return null;
  if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') {
    return expr;
  }
  if (!Array.isArray(expr) || expr.length === 0) return undefined;
  const op = expr[0];
  if (typeof op !== 'string') return undefined;
  switch (op) {
    case 'get': {
      const key = expr[1];
      return typeof key === 'string' && props ? (props[key] as StyleValue) : undefined;
    }
    case 'has': {
      const key = expr[1];
      return typeof key === 'string' && props
        ? Object.prototype.hasOwnProperty.call(props, key)
        : false;
    }
    case 'literal':
      return expr[1];
    case 'in': {
      const needle = evalStyleExpr(expr[1], zoom, props);
      const haystack = evalStyleExpr(expr[2], zoom, props);
      if (typeof haystack === 'string') return haystack.includes(String(needle));
      if (Array.isArray(haystack)) return haystack.some(v => v === needle);
      return false;
    }
    case '==':
      return evalStyleExpr(expr[1], zoom, props) === evalStyleExpr(expr[2], zoom, props);
    case '>': {
      // numeric comparison (cluster paints compare aggregated counts)
      const left = finiteNumber(evalStyleExpr(expr[1], zoom, props));
      const right = finiteNumber(evalStyleExpr(expr[2], zoom, props));
      return left !== null && right !== null ? left > right : undefined;
    }
    case '!': {
      // MapLibre truthiness negation (cluster filters: !has point_count)
      const value = evalStyleExpr(expr[1], zoom, props);
      const falsy =
        value === false ||
        value === null ||
        value === undefined ||
        value === 0 ||
        value === '' ||
        (typeof value === 'number' && !Number.isFinite(value));
      return !falsy ? false : true;
    }
    case 'case': {
      // ["case", cond1, val1, …, condN, valN, fallback]
      const rest = expr.slice(1);
      for (let i = 0; i + 1 < rest.length; i += 2) {
        if (evalStyleExpr(rest[i], zoom, props) === true) {
          return evalStyleExpr(rest[i + 1], zoom, props);
        }
      }
      return rest.length % 2 === 1 ? evalStyleExpr(rest[rest.length - 1], zoom, props) : undefined;
    }
    case 'match': {
      // ["match", input, label1, val1, …, fallback]; labels may be
      // arrays (label sets, MapLibre semantics).
      const input = evalStyleExpr(expr[1], zoom, props);
      const rest = expr.slice(2);
      for (let i = 0; i + 1 < rest.length; i += 2) {
        const label = rest[i];
        const matches = Array.isArray(label) ? label.some(v => v === input) : label === input;
        if (matches) return evalStyleExpr(rest[i + 1], zoom, props);
      }
      return rest.length % 2 === 1 ? evalStyleExpr(rest[rest.length - 1], zoom, props) : undefined;
    }
    case 'interpolate': {
      // ["interpolate", ["linear"], input, t1, v1, …] — the input is
      // ['zoom'] or ['get', '<property>'] (walker-enforced; the cluster
      // bubble radius interpolates on the aggregated point_count).
      const input = expr[2];
      let inputOp: 'zoom' | 'get' | null = null;
      let inputProp: string | null = null;
      if (Array.isArray(input) && input[0] === 'zoom') {
        inputOp = 'zoom';
      } else if (
        Array.isArray(input) &&
        input.length === 2 &&
        input[0] === 'get' &&
        typeof input[1] === 'string'
      ) {
        inputOp = 'get';
        inputProp = input[1];
      }
      if (inputOp === null) return undefined;
      const t =
        inputOp === 'zoom'
          ? zoom
          : finiteNumber(props && inputProp !== null ? props[inputProp] : undefined);
      if (t === null) return undefined;
      const rest = expr.slice(3);
      let prevT: number | null = null;
      for (let i = 0; i + 1 < rest.length; i += 2) {
        const stopT = rest[i];
        if (typeof stopT !== 'number' || !Number.isFinite(stopT)) continue;
        if (t <= stopT) {
          if (prevT !== null && stopT > prevT) {
            const from = finiteNumber(evalStyleExpr(rest[i - 1], zoom, props));
            const to = finiteNumber(evalStyleExpr(rest[i + 1], zoom, props));
            if (from !== null && to !== null) {
              return from + (to - from) * ((t - prevT) / (stopT - prevT));
            }
            return evalStyleExpr(rest[i + 1], zoom, props); // degenerate stop
          }
          return evalStyleExpr(rest[i + 1], zoom, props); // below the first stop
        }
        prevT = stopT;
      }
      return evalStyleExpr(rest[rest.length - 1], zoom, props); // above the last stop
    }
    default:
      return undefined;
  }
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Evaluate a MapLibre raster-opacity paint property at a zoom: a plain
 * number passes through (clamped), an interpolate-on-zoom expression
 * interpolates linearly between stops (clamped at the ends — MapLibre
 * semantics). Anything else renders fully opaque.
 */
export function paintOpacityAtZoom(paint: unknown, zoom: number): number {
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  if (typeof paint === 'number' && Number.isFinite(paint)) return clamp(paint);
  const n = finiteNumber(evalStyleExpr(paint, zoom, undefined));
  return n !== null ? clamp(n) : 1;
}

// ── Spec extraction ──────────────────────────────────────────────────────

/** A Leaflet-servable raster overlay extracted from a resolved style. */
export interface RasterOverlaySpec {
  kind: 'raster';
  /** Tile URL template ({z}/{x}/{y}). */
  url: string;
  /** Tile fetch floor (style layer minzoom). */
  minZoom?: number;
  /** Source maxzoom → maxNativeZoom (overzoom above). */
  maxNativeZoom?: number;
  /** The paint value driving opacity (number or interpolate-on-zoom). */
  opacityPaint: unknown;
}

/** Cluster count-badge spec from the `-cluster-count` symbol layer. */
export interface ClusterCountTextSpec {
  fieldPaint: unknown;
  sizePaint: unknown;
  colorPaint: unknown;
  haloColorPaint: unknown;
  haloWidthPaint: unknown;
}

/** Clustering a clustered geojson circle overlay declares (the
 * backend subset twin's `cluster*` source keys + cluster layers). */
export interface ClusterOverlaySpec {
  /** Bubble band floor (the cluster circle layer's minzoom). */
  minZoom: number;
  /** Bubbles render while floor(zoom) <= maxZoom (supercluster
   * semantics: clusters AT maxZoom, raw points above). */
  maxZoom: number;
  /** supercluster screen radius (px). */
  radius: number;
  /** Cluster bubble paints — evaluated per cluster feature props
   * (point_count / train_count / bus_count) like the raw path. */
  colorPaint: unknown;
  radiusPaint: unknown;
  opacityPaint: unknown;
  strokeColorPaint: unknown;
  strokeWidthPaint: unknown;
  /** Count badge text (``ui.overlayClusterCounts`` gates the text —
   * bubbles always render). */
  countText: ClusterCountTextSpec;
}

/** A Leaflet-servable circle (geojson) overlay from a resolved style. */
export interface CircleOverlaySpec {
  kind: 'circle';
  /** Geojson `data` URL (http(s) or data:) — no {{tokens}}. */
  dataUrl: string;
  /** Add/remove floor: the layer's minzoom (which the store's catalog
   * mapping already folds the catalog row's min_zoom into) or the
   * circle default when the style declares none. */
  minZoom: number;
  colorPaint: unknown;
  radiusPaint: unknown;
  opacityPaint: unknown;
  strokeColorPaint: unknown;
  strokeWidthPaint: unknown;
  /** Present when the source declares clustering (subset profile):
   * aggregated bubbles on the cluster band instead of raw points. */
  cluster?: ClusterOverlaySpec;
}

/** First raster-sourced layer + its source, if Leaflet can serve it. */
function rasterBase(style: StyleSpecification | undefined):
  | {
      source: RasterSourceSpecification & { tiles: string[] };
      layerMinZoom?: number;
      opacityPaint: unknown;
    }
  | undefined {
  if (!style) return undefined;
  const sources = style.sources ?? {};
  for (const layer of style.layers ?? []) {
    if (!('source' in layer) || typeof layer.source !== 'string') continue;
    const source = sources[layer.source] as RasterSourceSpecification | undefined;
    if (source?.type !== 'raster') continue;
    if (!Array.isArray(source.tiles) || source.tiles.length === 0) continue;
    const paint = ('paint' in layer ? layer.paint : undefined) as
      | Record<string, unknown>
      | undefined;
    return {
      source: source as RasterSourceSpecification & { tiles: string[] },
      layerMinZoom: layer.minzoom,
      opacityPaint: paint?.['raster-opacity'] ?? 1,
    };
  }
  return undefined;
}

/** Raster spec for a style, if Leaflet can serve its raster base. */
export function rasterSpecFor(
  style: StyleSpecification | undefined
): RasterOverlaySpec | undefined {
  const base = rasterBase(style);
  if (!base) return undefined;
  // LIMITATION: multi-URL raster sources render tiles[0] only — every
  // catalog raster overlay serves one template today; a source
  // sharding across hosts would need URL rotation.
  return {
    kind: 'raster',
    url: base.source.tiles[0]!,
    minZoom: base.layerMinZoom,
    maxNativeZoom: base.source.maxzoom,
    opacityPaint: base.opacityPaint,
  };
}

/**
 * Circle spec for a style: the first NON-CLUSTER circle layer over a
 * geojson source whose `data` is a string URL without unresolved
 * tokens, plus (when the source declares `cluster: true`) the cluster
 * config from the source keys and the cluster render layers (`has
 * point_count` filter circle + `-cluster-count` symbol). Inline geojson
 * objects and vector sources stay unsupported (defense in depth for
 * full-profile styles, which carry vector/symbol layers).
 */
export function circleSpecFor(
  style: StyleSpecification | undefined
): CircleOverlaySpec | undefined {
  if (!style) return undefined;
  const sources = style.sources ?? {};
  let rawSpec: CircleOverlaySpec | undefined;
  let rawSource: GeoJSONSourceSpecification | undefined;
  let clusterCircle: CircleLayerSpecification | undefined;
  let countLayer: LayerSpecification | undefined;
  for (const layer of style.layers ?? []) {
    if (!('source' in layer) || typeof layer.source !== 'string') continue;
    const source = sources[layer.source] as GeoJSONSourceSpecification | undefined;
    if (source?.type !== 'geojson') continue;
    const data = source?.data;
    if (typeof data !== 'string' || data.length === 0) continue;
    if (STYLE_TOKEN_RE.test(data)) continue;
    if (layer.type === 'circle' && isClusterLayer(layer)) {
      // cluster bubble circle (visual spec for the bubble band)
      clusterCircle ??= layer as CircleLayerSpecification;
      continue;
    }
    if (isClusterCountLayer(layer.id)) {
      countLayer ??= layer;
      continue;
    }
    if (layer.type !== 'circle') continue;
    // raw stops — the first non-cluster circle layer wins
    if (rawSpec) continue;
    const paint = (layer as CircleLayerSpecification).paint as Record<string, unknown> | undefined;
    rawSpec = {
      kind: 'circle',
      dataUrl: data,
      minZoom: typeof layer.minzoom === 'number' ? layer.minzoom : CIRCLE_DEFAULT_MIN_ZOOM,
      // MapLibre circle paint defaults (style spec) for missing keys.
      colorPaint: paint?.['circle-color'] ?? '#000000',
      radiusPaint: paint?.['circle-radius'] ?? 5,
      opacityPaint: paint?.['circle-opacity'] ?? 1,
      strokeColorPaint: paint?.['circle-stroke-color'] ?? '#000000',
      strokeWidthPaint: paint?.['circle-stroke-width'] ?? 0,
    };
    rawSource = source;
  }
  if (!rawSpec || !rawSource) return undefined;
  if (rawSource.cluster === true) {
    const clusterPaint = (clusterCircle?.paint ?? {}) as Record<string, unknown>;
    const countLayout = ((countLayer as LayerSpecification & { layout?: Record<string, unknown> })
      ?.layout ?? {}) as Record<string, unknown>;
    const countPaint = ((countLayer as LayerSpecification & { paint?: Record<string, unknown> })
      ?.paint ?? {}) as Record<string, unknown>;
    rawSpec.cluster = {
      minZoom: clusterCircle?.minzoom ?? 0,
      // maplibre defaults when the source omits the bounds
      maxZoom: typeof rawSource.clusterMaxZoom === 'number' ? rawSource.clusterMaxZoom : 16,
      radius: typeof rawSource.clusterRadius === 'number' ? rawSource.clusterRadius : 50,
      colorPaint: clusterPaint['circle-color'] ?? '#0079C7',
      radiusPaint: clusterPaint['circle-radius'] ?? 5,
      opacityPaint: clusterPaint['circle-opacity'] ?? 1,
      strokeColorPaint: clusterPaint['circle-stroke-color'] ?? '#000000',
      strokeWidthPaint: clusterPaint['circle-stroke-width'] ?? 0,
      countText: {
        fieldPaint: countLayout['text-field'] ?? ['get', 'point_count_abbreviated'],
        sizePaint: countLayout['text-size'] ?? 11,
        colorPaint: countPaint['text-color'] ?? '#F6F6F6',
        haloColorPaint: countPaint['text-halo-color'] ?? 'rgba(0, 0, 0, 0)',
        haloWidthPaint: countPaint['text-halo-width'] ?? 0,
      },
    };
  }
  return rawSpec;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Unvalidated CSS color strings pass through — the canvas silently
 * keeps its previous fill for invalid strings (unreachable with the
 * backend-whitelisted hex literals). */
function colorOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

/** The feature-DEPENDENT circle paints: radius in px (MapLibre
 * circle-radius is screen pixels, Leaflet CircleMarker radius too,
 * 1:1) and fill color. The lean pair the per-marker path evaluates —
 * 2 expressions per marker, not 5. Unknown/malformed expressions fall
 * back to MapLibre's paint defaults, never a crash. */
export interface CircleFeaturePaints {
  radius: number;
  fillColor: string;
}

/** Lean per-feature evaluation: ONLY the feature-dependent paints. */
export function circleFeaturePaints(
  spec: CircleOverlaySpec,
  zoom: number,
  props: StyleProps
): CircleFeaturePaints {
  const radius = finiteNumber(evalStyleExpr(spec.radiusPaint, zoom, props));
  const fillColor = colorOr(evalStyleExpr(spec.colorPaint, zoom, props), '#000000');
  return {
    radius: radius !== null ? Math.max(0, radius) : 5, // MapLibre circle-radius default
    fillColor,
  };
}

/** The feature-INDEPENDENT circle paints at a zoom: fill opacity and
 * the stroke (width + color). ASSUMPTION: in the fallback renderer
 * these paints are feature-independent — they are evaluated ONCE per
 * pass with zoom only. A future subset style with feature-dependent
 * `circle-opacity`/`circle-stroke-*` (none exists today) would be
 * flattened to its fallback branch here, silently — widen to a
 * per-marker evaluation then (the lean per-feature pair above is the
 * pattern). */
export interface CircleBaseStyle {
  fillOpacity: number;
  stroke: boolean;
  color: string;
  weight: number;
}

/** Zoom-only evaluation of the feature-independent paints. */
export function circleBaseStyle(spec: CircleOverlaySpec, zoom: number): CircleBaseStyle {
  return baseStyleFromPaints(spec.opacityPaint, spec.strokeColorPaint, spec.strokeWidthPaint, zoom);
}

/** Zoom-only evaluation of the feature-independent paints, straight
 * from the paint values (the cluster bubble path shares it). */
function baseStyleFromPaints(
  opacityPaint: unknown,
  strokeColorPaint: unknown,
  strokeWidthPaint: unknown,
  zoom: number
): CircleBaseStyle {
  const opacity = finiteNumber(evalStyleExpr(opacityPaint, zoom, undefined));
  const weight = finiteNumber(evalStyleExpr(strokeWidthPaint, zoom, undefined));
  const strokeColor = colorOr(evalStyleExpr(strokeColorPaint, zoom, undefined), '#000000');
  const w = weight !== null ? Math.max(0, weight) : 0;
  return {
    fillOpacity: opacity !== null ? clamp01(opacity) : 1,
    stroke: w > 0,
    weight: w,
    color: strokeColor,
  };
}

/** The FULL paint the adapter applies to one circle marker: the
 * feature-dependent pair per feature + the hoisted zoom-only base.
 * This is the production shape — what buildCircleGroup spreads into
 * the marker options and restyleCircle hands to setStyle. */
export function circleMarkerPaint(
  spec: CircleOverlaySpec,
  zoom: number,
  props: StyleProps,
  base: CircleBaseStyle
): CircleFeaturePaints & CircleBaseStyle {
  return { ...circleFeaturePaints(spec, zoom, props), ...base };
}

// ── Clustering (subset profile: cluster* source keys) ────────────────────

/** Point properties of clustered geojson features (the BAV list). */
type StopProps = { types?: unknown };

/** Aggregated per-cluster counts the backend's clusterProperties
 * declare — mirrored via supercluster's map/reduce functions
 * (supercluster 8 has no expression evaluator; the semantics of the
 * served train_count/bus_count expressions are implemented here). */
type ClusterCounts = { train_count: number; bus_count: number };

type StopClusterIndex = Supercluster<StopProps, ClusterCounts>;

/** Whole-world bbox — the cluster band renders the entire (small: ~30
 * to ~120 for the BAV list) bubble set; Leaflet culls off-viewport DOM
 * markers itself. */
const WORLD_BBOX: [number, number, number, number] = [-180, -85, 180, 85];

/** Hex → rgba(): MapLibre circle-opacity fades only the fill — CSS
 * background-color with the same alpha keeps stroke + count text
 * opaque, like the canvas CircleMarker path. */
function hexWithAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const clamped = Math.min(1, Math.max(0, alpha));
  if (clamped >= 1) return hex;
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const r = parseInt(hex[1] + hex[1], 16);
    const g = parseInt(hex[2] + hex[2], 16);
    const b = parseInt(hex[3] + hex[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  return hex; // non-hex literals pass through at full opacity
}

/** The visual shape of ONE cluster bubble (divIcon html + square size). */
export interface ClusterBubbleStyle {
  /** Icon width/height in px (2 x evaluated radius). */
  size: number;
  html: string;
}

/** Build one cluster bubble's divIcon payload from the cluster circle
 * + count-text specs, evaluated against the cluster feature's
 * aggregated properties (point_count / train_count / bus_count) — the
 * same evaluator the raw path uses, so the served style stays the
 * single source of the visual spec. `showCounts` is the user setting:
 * bubbles render either way, ONLY the count text toggles. */
export function clusterBubbleStyle(
  cluster: ClusterOverlaySpec,
  zoom: number,
  props: StyleProps,
  showCounts: boolean
): ClusterBubbleStyle {
  const radiusValue = finiteNumber(evalStyleExpr(cluster.radiusPaint, zoom, props));
  const radius = radiusValue !== null ? Math.max(1, radiusValue) : 5;
  const color = colorOr(evalStyleExpr(cluster.colorPaint, zoom, props), '#0079C7');
  const base = baseStyleFromPaints(
    cluster.opacityPaint,
    cluster.strokeColorPaint,
    cluster.strokeWidthPaint,
    zoom
  );
  const count = cluster.countText;
  const text = showCounts ? String(evalStyleExpr(count.fieldPaint, zoom, props) ?? '') : '';
  const fontSize = finiteNumber(evalStyleExpr(count.sizePaint, zoom, props)) ?? 11;
  const textColor = colorOr(evalStyleExpr(count.colorPaint, zoom, props), '#F6F6F6');
  const haloColor = colorOr(evalStyleExpr(count.haloColorPaint, zoom, props), 'rgba(0, 0, 0, 0)');
  const haloWidth = finiteNumber(evalStyleExpr(count.haloWidthPaint, zoom, props)) ?? 0;
  const diameter = Math.round(2 * radius);
  const border = base.stroke ? `${base.weight}px solid ${base.color}` : 'none';
  const shadow = haloWidth > 0 ? `text-shadow:0 0 ${haloWidth}px ${haloColor};` : '';
  const span = text
    ? `<span style="font-family:'Barlow Semi Condensed SemiBold','Noto Sans Bold',sans-serif;` +
      `font-size:${fontSize}px;line-height:1;color:${textColor};${shadow}">${text}</span>`
    : '';
  const div =
    `<div style="box-sizing:border-box;width:${diameter}px;height:${diameter}px;` +
    `border-radius:50%;background-color:${hexWithAlpha(color, base.fillOpacity)};` +
    `border:${border};display:flex;align-items:center;justify-content:center;` +
    `pointer-events:none;">${span}</div>`;
  return { size: diameter, html: div };
}

/** Build the supercluster index mirroring the served cluster config
 * (radius / maxZoom) + the clusterProperties count semantics. */
function buildClusterIndex(features: Feature[], cluster: ClusterOverlaySpec): StopClusterIndex {
  const index: StopClusterIndex = new Supercluster<StopProps, ClusterCounts>({
    radius: cluster.radius,
    maxZoom: cluster.maxZoom,
    map: props => ({
      train_count: Array.isArray(props?.types) && props.types.includes('train') ? 1 : 0,
      bus_count: Array.isArray(props?.types) && props.types.includes('bus') ? 1 : 0,
    }),
    reduce: (accumulated, props) => {
      accumulated.train_count += props.train_count;
      accumulated.bus_count += props.bus_count;
    },
  });
  // SAFETY: featuresFor() guarantees Point-geometry Features — the
  // same array buildCircleGroup hands to L.geoJSON; the cast only
  // satisfies supercluster's PointFeature<P> shape (structural twin).
  index.load(features as unknown as Parameters<StopClusterIndex['load']>[0]);
  return index;
}

// ── Adapter ──────────────────────────────────────────────────────────────

/** One overlay's live Leaflet state, keyed by overlay slug. */
type LiveEntry =
  | { kind: 'raster'; layer: L.TileLayer; spec: RasterOverlaySpec }
  | {
      kind: 'circle';
      spec: CircleOverlaySpec;
      /** Built once the features resolved; null while loading/failed. */
      group: L.GeoJSON | null;
      /** The shared per-URL feature fetch (adapter-level cache). */
      features: Promise<Feature[]> | null;
      /** supercluster index once the spec clusters + features resolved. */
      clusterIndex: StopClusterIndex | null;
      /** Live cluster bubble layer (on the map inside the cluster band). */
      clusterLayer: L.LayerGroup | null;
      /** Cluster zoom LEVEL (floor(zoom)) the bubble layer was built at. */
      clusterLevel: number | null;
    };

/** The circle variant of a live entry (helper alias). */
type CircleEntry = Extract<LiveEntry, { kind: 'circle' }>;

/** Overlay layers currently on the map, keyed by overlay slug. */
type LiveOverlays = Map<string, LiveEntry>;

export interface FallbackOverlayAdapter {
  /** Drop every layer + watcher (component unmount). */
  destroy(): void;
}

/**
 * Subscribe the fallback map to the shared overlay store. Reconciles
 * Leaflet-servable overlays (raster tiles + geojson circles) on
 * toggle/parameter/catalog-swap changes and on every zoom change (the
 * opacity curves and circle radii interpolate on zoom; circle overlays
 * gate on their min-zoom floor).
 */
export function createFallbackOverlayAdapter(map: L.Map): FallbackOverlayAdapter {
  const overlayStore = useOverlayStore();
  const userSettingsStore = useUserSettingsStore();
  const live: LiveOverlays = new Map();
  /** Parsed geojson features per data URL — ONE fetch per overlay per
   * catalog generation (cleared on catalog swap/destroy; the fetch is
   * deferred until the overlay is both active and at/above its zoom
   * floor, so a below-floor toggle costs nothing). */
  const featureCache = new Map<string, Promise<Feature[]>>();
  const stops: WatchStopHandle[] = [];
  let paneReady = false;
  /** One shared canvas renderer for every circle overlay's markers
   * (pane-level, NOT per-marker — 27k marker renderers would be one
   * canvas each). Created lazily on the first circle group. */
  let circleRenderer: L.Canvas | null = null;
  // Set by destroy() — teardown ordering guarantees destroy() runs
  // BEFORE the view's map.remove(), but a stray epoch tick after
  // destroy must never touch a half-torn map.
  let destroyed = false;

  function ensurePane(): void {
    if (paneReady) return;
    if (!map.getPane(OVERLAY_PANE)) {
      map.createPane(OVERLAY_PANE);
      const pane = map.getPane(OVERLAY_PANE)!;
      pane.style.zIndex = String(OVERLAY_PANE_Z);
      pane.classList.add('leaflet-pane'); // pane styling parity
    }
    if (!map.getPane(CIRCLE_PANE)) {
      map.createPane(CIRCLE_PANE);
      const pane = map.getPane(CIRCLE_PANE)!;
      pane.style.zIndex = String(CIRCLE_PANE_Z);
      pane.classList.add('leaflet-pane');
    }
    paneReady = true;
  }

  // SAFETY: same widened cast as the overlay store's own consumers —
  // reading .name/.active/.style only, fields every item sets; breaks
  // the maplibre-style TS2589 type recursion.
  const overlays = overlayStore.overlays as unknown as Array<OverlaySwitchItem>;

  /** Fetch + parse one geojson document (cached per URL). */
  function featuresFor(url: string): Promise<Feature[]> {
    const cached = featureCache.get(url);
    if (cached) return cached;
    const promise = fetch(url, {
      headers: { Accept: 'application/geo+json, application/json' },
      signal: AbortSignal.timeout(GEOJSON_FETCH_TIMEOUT_MS),
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((doc: unknown) => {
        const raw = Array.isArray(doc)
          ? doc
          : ((doc as FeatureCollection | null)?.features ?? null);
        if (!Array.isArray(raw)) throw new Error('not a geojson FeatureCollection');
        // Point features only (the circle primitive): non-points would
        // fall back to Leaflet's default geometry layers.
        return raw.filter((f): f is Feature => {
          const feat = f as Feature | null;
          const geom = feat?.geometry;
          return (
            feat?.type === 'Feature' &&
            geom?.type === 'Point' &&
            Array.isArray(geom.coordinates) &&
            geom.coordinates.length >= 2 &&
            typeof geom.coordinates[0] === 'number' &&
            typeof geom.coordinates[1] === 'number'
          );
        });
      });
    // A failed fetch drops its cache slot (a later reconcile retries)
    // and never surfaces as an unhandled rejection when the caller is
    // gone by the time it settles. Identity-guarded: an OLD in-flight
    // fetch's rejection must never evict a NEW entry for the same URL
    // (a catalog epoch can swap the slot mid-flight).
    void promise.catch(() => {
      if (featureCache.get(url) === promise) featureCache.delete(url);
    });
    featureCache.set(url, promise);
    return promise;
  }

  function removeEntry(name: string): void {
    const entry = live.get(name);
    if (!entry) return;
    if (entry.kind === 'raster') map.removeLayer(entry.layer);
    else {
      if (entry.group) map.removeLayer(entry.group);
      if (entry.clusterLayer) map.removeLayer(entry.clusterLayer);
    }
    live.delete(name);
  }

  function buildCircleGroup(spec: CircleOverlaySpec, features: Feature[]): L.GeoJSON {
    ensurePane();
    if (!circleRenderer) circleRenderer = L.canvas({ padding: 0.5, pane: CIRCLE_PANE });
    const renderer = circleRenderer;
    const zoom = map.getZoom();
    const base = circleBaseStyle(spec, zoom);
    const collection = { type: 'FeatureCollection', features } as FeatureCollection;
    // The group carries the pane tag too (identification: the e2e debug
    // hook walks map layers by options.pane — the group is the top-level
    // map layer, its markers are children).
    return L.geoJSON(collection, {
      pane: CIRCLE_PANE,
      pointToLayer: (feature, latLng) => {
        const paint = circleMarkerPaint(spec, zoom, feature?.properties, base);
        // pane/renderer/interactive go on EVERY marker: pointToLayer
        // layers do not inherit the geoJSON container's options.
        return L.circleMarker(latLng, {
          pane: CIRCLE_PANE,
          renderer,
          interactive: false, // no circle interactions wired — skip hit-testing 27k markers
          radius: paint.radius,
          fillColor: paint.fillColor,
          fillOpacity: paint.fillOpacity,
          stroke: paint.stroke,
          color: paint.color,
          weight: paint.weight,
        });
      },
    });
  }

  /** Re-style every marker at the current zoom (setStyle, not
   * recreate — the canvas renderer batches the redraw per frame; the
   * feature-dependent paints are evaluated lean per marker, the
   * zoom-only base once per pass). */
  function restyleCircle(entry: CircleEntry): void {
    const group = entry.group;
    if (!group) return;
    const spec = entry.spec;
    const zoom = map.getZoom();
    const base = circleBaseStyle(spec, zoom);
    group.eachLayer(marker => {
      const props = (marker as L.CircleMarker).feature?.properties;
      (marker as L.CircleMarker).setStyle(circleMarkerPaint(spec, zoom, props, base));
    });
  }

  /** Cluster band? Bubbles render while zoom >= the band floor and
   * floor(zoom) <= maxZoom (supercluster clusters AT maxZoom — the
   * served clusterMaxZoom is inclusive). */
  function inClusterBand(spec: CircleOverlaySpec, zoom: number): boolean {
    const cluster = spec.cluster;
    return !!cluster && zoom >= cluster.minZoom && Math.floor(zoom) <= cluster.maxZoom;
  }

  /** Should the geojson fetch start at this zoom (either render band)?
   * A below-band activation must not pay the 4 MB download. */
  function circleFetchDue(spec: CircleOverlaySpec, zoom: number): boolean {
    return zoom >= spec.minZoom || inClusterBand(spec, zoom);
  }

  /** Rebuild the cluster bubble layer at the current cluster zoom
   * LEVEL (~30–120 bubbles — cheap to rebuild on level change or a
   * badge-setting toggle; the raw marker group is never touched). */
  function rebuildClusterLayer(entry: CircleEntry): void {
    const cluster = entry.spec.cluster;
    const index = entry.clusterIndex;
    if (destroyed || !cluster || !index) return;
    const zoom = map.getZoom();
    const level = Math.floor(zoom);
    const showCounts = userSettingsStore.uiSettings.overlayClusterCounts;
    const markers: L.Marker[] = [];
    for (const feature of index.getClusters(WORLD_BBOX, level)) {
      // union of cluster + raw point properties — narrow to the
      // cluster shape (index signature for the evaluator)
      const props = feature.properties as (StyleProps & { cluster?: unknown }) | undefined;
      if (props?.cluster !== true) continue;
      const bubble = clusterBubbleStyle(cluster, zoom, props, showCounts);
      const lng = feature.geometry.coordinates[0];
      const lat = feature.geometry.coordinates[1];
      if (typeof lng !== 'number' || typeof lat !== 'number') continue;
      markers.push(
        L.marker([lat, lng], {
          interactive: false, // no bubble interactions wired (yet)
          keyboard: false,
          icon: L.divIcon({
            className: 'wd-cluster-bubble',
            html: bubble.html,
            iconSize: [bubble.size, bubble.size],
          }),
        })
      );
    }
    if (entry.clusterLayer) map.removeLayer(entry.clusterLayer);
    entry.clusterLayer = L.layerGroup(markers);
    entry.clusterLayer.addTo(map);
    entry.clusterLevel = level;
  }

  /** Add/remove the raw group + cluster bubble layer around their zoom
   * bands. Returns true when the raw group was ADDED (and already
   * re-styled at the current zoom) — callers skip their own follow-up
   * re-style then, avoiding a second 27k-marker pass on the
   * floor-crossing frame. */
  function updateCircleBands(entry: CircleEntry): boolean {
    if (destroyed) return false;
    const zoom = map.getZoom();
    let addedNow = false;
    // raw stops: at/above the layer floor, exactly as before clustering
    if (entry.group) {
      const shouldShow = zoom >= entry.spec.minZoom;
      const onMap = map.hasLayer(entry.group);
      if (shouldShow && !onMap) {
        entry.group.addTo(map);
        restyleCircle(entry); // styles were evaluated at the removal zoom
        addedNow = true;
      } else if (!shouldShow && onMap) {
        map.removeLayer(entry.group);
      }
    }
    // cluster bubbles: inside the cluster band, rebuilt per level
    if (entry.spec.cluster && entry.clusterIndex) {
      const inBand = inClusterBand(entry.spec, zoom);
      const onMap = entry.clusterLayer ? map.hasLayer(entry.clusterLayer) : false;
      if (inBand && (!onMap || entry.clusterLevel !== Math.floor(zoom))) {
        rebuildClusterLayer(entry);
      } else if (!inBand && onMap) {
        map.removeLayer(entry.clusterLayer as L.LayerGroup);
        entry.clusterLayer = null;
        entry.clusterLevel = null;
      }
    }
    return addedNow;
  }

  /** Start (once) the deferred feature fetch for a circle entry. */
  function startCircleFetch(name: string, entry: CircleEntry): void {
    if (entry.features || entry.group) return;
    const spec = entry.spec;
    entry.features = featuresFor(spec.dataUrl);
    entry.features
      .then(features => {
        if (destroyed || live.get(name) !== entry) return; // stale resolution
        if (entry.spec.cluster) {
          entry.clusterIndex = buildClusterIndex(features, entry.spec.cluster);
        }
        entry.group = buildCircleGroup(entry.spec, features);
        updateCircleBands(entry);
      })
      .catch(error => {
        // Render nothing (the menu row stays — an unchanged group from
        // a previous generation is gone with its entry).
        if (live.get(name) === entry) removeEntry(name);
        console.warn(
          `[overlay-adapter] geojson overlay '${name}' failed to load:`,
          error instanceof Error ? error.message : error
        );
      });
  }

  /** Cluster config identity (a changed band/radius rebuilds the index
   * with the entry — the fetch itself is cached per URL). */
  const sameClusterConfig = (
    a: CircleOverlaySpec['cluster'],
    b: CircleOverlaySpec['cluster']
  ): boolean => JSON.stringify(a) === JSON.stringify(b);

  /** Create/refresh the live circle entry for an active overlay. */
  function ensureCircleEntry(name: string, spec: CircleOverlaySpec): void {
    const existing = live.get(name);
    if (existing && existing.kind === 'circle') {
      if (
        existing.spec.dataUrl === spec.dataUrl &&
        existing.spec.minZoom === spec.minZoom &&
        sameClusterConfig(existing.spec.cluster, spec.cluster)
      ) {
        existing.spec = spec; // paint refresh (parameter epochs) — re-style below
        const addedNow = updateCircleBands(existing);
        if (!addedNow && existing.group && map.hasLayer(existing.group)) {
          restyleCircle(existing);
        }
        // A below-band activation deferred the fetch — start it now if
        // a band was crossed since.
        if (circleFetchDue(spec, map.getZoom())) startCircleFetch(name, existing);
        return;
      }
      removeEntry(name); // URL/floor/cluster config changed — rebuild
    } else if (existing) {
      removeEntry(name); // kind switch (raster ↔ circle)
    }
    const entry: CircleEntry = {
      kind: 'circle',
      spec,
      group: null,
      features: null,
      clusterIndex: null,
      clusterLayer: null,
      clusterLevel: null,
    };
    live.set(name, entry);
    // Fetch only once a render band is due: a below-band activation
    // must not pay the 4 MB download (the zoomend crossing starts it).
    if (circleFetchDue(spec, map.getZoom())) startCircleFetch(name, entry);
  }

  /** Add/remove/re-point layers so the map mirrors the store state. */
  function reconcile(): void {
    if (destroyed) return;
    ensurePane();
    const zoom = map.getZoom();
    const wantedRaster = new Map<string, RasterOverlaySpec>();
    const wantedCircle = new Map<string, CircleOverlaySpec>();
    for (const overlay of overlays) {
      if (!overlay.active) continue;
      const raster = rasterSpecFor(overlay.style);
      if (raster) {
        wantedRaster.set(overlay.name, raster);
        continue;
      }
      const circle = circleSpecFor(overlay.style);
      if (circle) wantedCircle.set(overlay.name, circle);
    }
    // Remove layers no longer active (or no longer servable as their kind).
    for (const [name, entry] of live) {
      const stillWanted = entry.kind === 'raster' ? wantedRaster.has(name) : wantedCircle.has(name);
      if (!stillWanted) removeEntry(name);
    }
    for (const [name, spec] of wantedRaster) {
      const existing = live.get(name);
      if (!existing) {
        const layer = L.tileLayer(spec.url, {
          pane: OVERLAY_PANE,
          opacity: paintOpacityAtZoom(spec.opacityPaint, zoom),
          minZoom: spec.minZoom,
          maxNativeZoom: spec.maxNativeZoom,
          maxZoom: MAP_MAX_ZOOM,
        });
        layer.addTo(map);
        live.set(name, { kind: 'raster', layer, spec });
        continue;
      }
      if (existing.kind !== 'raster') continue; // kind switches were removed above
      if (existing.spec.url !== spec.url) existing.layer.setUrl(spec.url);
      existing.spec = spec;
      existing.layer.setOpacity(paintOpacityAtZoom(spec.opacityPaint, zoom));
    }
    for (const [name, spec] of wantedCircle) ensureCircleEntry(name, spec);
  }

  /** Hard reset: the catalog swapped the items (styles were replaced —
   * drop every layer and re-add from the new styles). The geojson
   * feature cache SURVIVES: it is keyed by URL, so a rotated data URL
   * misses naturally and fetches fresh, while an unchanged one (the
   * 4 MB BAV list) keeps its in-flight/settled promise — clearing it
   * re-downloaded the whole document on every catalog epoch bump
   * (live-observed double fetch at 2026-10-29: boot fetched from the
   * persisted style, then the fresh subset catalog arrived, bumped
   * the epoch, reset() dropped the cache and fetched again). */
  function reset(): void {
    for (const [name] of live) removeEntry(name);
    reconcile();
  }

  /** Zoom-only pass: re-evaluate the opacity curves + circle styles at
   * the new zoom, and gate circle overlays on their zoom floor. */
  function onZoomEnd(): void {
    if (destroyed) return;
    const zoom = map.getZoom();
    for (const [name, entry] of live) {
      if (entry.kind === 'raster') {
        entry.layer.setOpacity(paintOpacityAtZoom(entry.spec.opacityPaint, zoom));
        continue;
      }
      const addedNow = updateCircleBands(entry);
      if (!addedNow && entry.group && map.hasLayer(entry.group)) restyleCircle(entry);
      // Crossing into a render band with the fetch still deferred (the
      // below-band activation skipped it) — start it now.
      if (!entry.features && !entry.group && circleFetchDue(entry.spec, zoom)) {
        startCircleFetch(name, entry);
      }
    }
  }

  stops.push(
    // Active flags (+ catalog list identity) — same composite key idea
    // as WdNativeMapView's renderer watcher.
    watch(
      () =>
        `${overlays.map(o => `${o.name}:${o.active ? 1 : 0}`).join('|')}#${overlayStore.parametersEpoch}`,
      () => reconcile()
    ),
    // Catalog swap: styles were replaced — drop everything, re-add.
    watch(
      () => overlayStore.overlaysEpoch,
      () => reset()
    ),
    // Cluster count badges: the user setting toggles ONLY the badge
    // text — rebuild the (small) bubble layers in place, bubbles stay.
    watch(
      () => userSettingsStore.uiSettings.overlayClusterCounts,
      () => {
        if (destroyed) return;
        for (const entry of live.values()) {
          if (entry.kind !== 'circle' || !entry.spec.cluster || !entry.clusterIndex) {
            continue;
          }
          if (inClusterBand(entry.spec, map.getZoom())) {
            entry.clusterLevel = null; // force a rebuild with/without text
            updateCircleBands(entry);
          }
        }
      }
    )
  );
  map.on('zoomend', onZoomEnd);
  reconcile();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const stop of stops) stop();
      map.off('zoomend', onZoomEnd);
      for (const [name] of live) removeEntry(name);
      live.clear();
      featureCache.clear();
      if (circleRenderer && map.hasLayer(circleRenderer)) map.removeLayer(circleRenderer);
    },
  };
}
