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
 */

import * as L from 'leaflet';
import { watch, type WatchStopHandle } from 'vue';
import type {
  CircleLayerSpecification,
  GeoJSONSourceSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { useOverlayStore } from '@stores/map/overlay-store';
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
// match, case, in, ==, interpolate, literal. This evaluator implements
// the same set — anything else evaluates to undefined (callers fall
// back to safe defaults) so an unknown future operator degrades to a
// visible default instead of a crash.

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
 * operators: `get` / `has` / `literal` / `in` / `==` / `case` / `match`
 * and `interpolate` restricted to a `["zoom"]` input with linear
 * interpolation (stop VALUES may be nested expressions —
 * transport-stops interpolates per-type case expressions for its
 * radius). Unknown or malformed expressions evaluate to undefined.
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
      // ["interpolate", ["linear"], ["zoom"], z1, v1, …] — zoom input
      // only (walker-enforced, same limitation as the raster curve).
      const input = expr[2];
      if (!Array.isArray(input) || input[0] !== 'zoom') return undefined;
      const rest = expr.slice(3);
      let prevZoom: number | null = null;
      for (let i = 0; i + 1 < rest.length; i += 2) {
        const z = rest[i];
        if (typeof z !== 'number' || !Number.isFinite(z)) continue;
        if (zoom <= z) {
          if (prevZoom !== null && z > prevZoom) {
            const from = finiteNumber(evalStyleExpr(rest[i - 1], zoom, props));
            const to = finiteNumber(evalStyleExpr(rest[i + 1], zoom, props));
            if (from !== null && to !== null) {
              return from + (to - from) * ((zoom - prevZoom) / (z - prevZoom));
            }
            return evalStyleExpr(rest[i + 1], zoom, props); // degenerate stop
          }
          return evalStyleExpr(rest[i + 1], zoom, props); // below the first stop
        }
        prevZoom = z;
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
 * Circle spec for a style: the first circle layer over a geojson
 * source whose `data` is a string URL without unresolved tokens.
 * Inline geojson objects and vector sources stay unsupported (defense
 * in depth for full-profile styles, which carry vector/symbol layers).
 */
export function circleSpecFor(
  style: StyleSpecification | undefined
): CircleOverlaySpec | undefined {
  if (!style) return undefined;
  const sources = style.sources ?? {};
  for (const layer of style.layers ?? []) {
    if (layer.type !== 'circle') continue;
    if (!('source' in layer) || typeof layer.source !== 'string') continue;
    const source = sources[layer.source] as GeoJSONSourceSpecification | undefined;
    if (source?.type !== 'geojson') continue;
    const data = source?.data;
    if (typeof data !== 'string' || data.length === 0) continue;
    if (STYLE_TOKEN_RE.test(data)) continue;
    const paint = (layer as CircleLayerSpecification).paint as Record<string, unknown> | undefined;
    return {
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
  }
  return undefined;
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
  const opacity = finiteNumber(evalStyleExpr(spec.opacityPaint, zoom, undefined));
  const weight = finiteNumber(evalStyleExpr(spec.strokeWidthPaint, zoom, undefined));
  const strokeColor = colorOr(evalStyleExpr(spec.strokeColorPaint, zoom, undefined), '#000000');
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
    else if (entry.group) map.removeLayer(entry.group);
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

  /** Add/remove the group around the spec's zoom floor. Returns true
   * when the group was ADDED (and already re-styled at the current
   * zoom) — callers skip their own follow-up re-style then, avoiding
   * a second 27k-marker pass on the floor-crossing frame. */
  function updateCircleVisibility(entry: CircleEntry): boolean {
    if (destroyed || !entry.group) return false;
    const shouldShow = map.getZoom() >= entry.spec.minZoom;
    const onMap = map.hasLayer(entry.group);
    if (shouldShow && !onMap) {
      entry.group.addTo(map);
      restyleCircle(entry); // styles were evaluated at the removal zoom
      return true;
    }
    if (!shouldShow && onMap) map.removeLayer(entry.group);
    return false;
  }

  /** Start (once) the deferred feature fetch for a circle entry. */
  function startCircleFetch(name: string, entry: CircleEntry): void {
    if (entry.features || entry.group) return;
    const spec = entry.spec;
    entry.features = featuresFor(spec.dataUrl);
    entry.features
      .then(features => {
        if (destroyed || live.get(name) !== entry) return; // stale resolution
        entry.group = buildCircleGroup(entry.spec, features);
        updateCircleVisibility(entry);
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

  /** Create/refresh the live circle entry for an active overlay. */
  function ensureCircleEntry(name: string, spec: CircleOverlaySpec): void {
    const existing = live.get(name);
    if (existing && existing.kind === 'circle') {
      if (existing.spec.dataUrl === spec.dataUrl && existing.spec.minZoom === spec.minZoom) {
        existing.spec = spec; // paint refresh (parameter epochs) — re-style below
        const addedNow = updateCircleVisibility(existing);
        if (!addedNow && existing.group && map.hasLayer(existing.group)) {
          restyleCircle(existing);
        }
        // A below-floor activation deferred the fetch — start it now if
        // the zoom crossed since.
        if (map.getZoom() >= spec.minZoom) startCircleFetch(name, existing);
        return;
      }
      removeEntry(name); // URL/floor changed — rebuild (new fetch when the URL differs)
    } else if (existing) {
      removeEntry(name); // kind switch (raster ↔ circle)
    }
    const entry: CircleEntry = { kind: 'circle', spec, group: null, features: null };
    live.set(name, entry);
    // Fetch only once the overlay is at/above its floor: a below-floor
    // activation must not pay the 4 MB download (the zoomend crossing
    // starts it instead).
    if (map.getZoom() >= spec.minZoom) startCircleFetch(name, entry);
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
   * drop the geojson cache too, data URLs may have rotated). */
  function reset(): void {
    for (const [name] of live) removeEntry(name);
    featureCache.clear();
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
      const addedNow = updateCircleVisibility(entry);
      if (!addedNow && entry.group && map.hasLayer(entry.group)) restyleCircle(entry);
      // Crossing up past the floor with the fetch still deferred (the
      // below-floor activation skipped it) — start it now.
      if (!entry.features && !entry.group && zoom >= entry.spec.minZoom) {
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
