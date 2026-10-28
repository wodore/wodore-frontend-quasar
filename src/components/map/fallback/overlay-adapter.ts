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
 * * Vector/full-only overlays (huts, transport-stops — SDF symbols,
 *   vector sources) are NOT rendered: the fallback's overlay menu hides
 *   them (`rendererProfile="subset"` on WdOverlayControl) and the
 *   adapter skips any style without a Leaflet-servable raster base
 *   anyway (defense in depth against group-logic activations).
 * * The `wd-huts` content stays the fallback's built-in always-on
 *   rendering (MLT tiles + cluster groups) — unaffected by this
 *   adapter.
 *
 * Pane: a dedicated `wdOverlay` pane above the basemap's tile pane,
 * below the canvas dots (overlayPane) and cluster icons (markerPane).
 */

import * as L from 'leaflet';
import { watch, type WatchStopHandle } from 'vue';
import type { RasterSourceSpecification, StyleSpecification } from 'maplibre-gl';
import { useOverlayStore } from '@stores/map/overlay-store';
import type { OverlaySwitchItem } from '@stores/map/utils/interfaces';

/** Leaflet pane name for catalog raster overlays. */
const OVERLAY_PANE = 'wdOverlay';
/** Pane z-index: tilePane is 200, overlayPane 400 — overlays sit
 * between them (above every basemap, below hut dots + clusters). */
const OVERLAY_PANE_Z = 250;
/** Fallback map zoom ceiling (WdFallbackMapView MAX_ZOOM parity). */
const MAP_MAX_ZOOM = 19;

/** A Leaflet-servable raster overlay extracted from a resolved style. */
interface RasterOverlaySpec {
  /** Tile URL template ({z}/{x}/{y}). */
  url: string;
  /** Tile fetch floor (style layer minzoom). */
  minZoom?: number;
  /** Source maxzoom → maxNativeZoom (overzoom above). */
  maxNativeZoom?: number;
  /** The paint value driving opacity (number or interpolate-on-zoom). */
  opacityPaint: unknown;
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

/**
 * Evaluate a MapLibre paint property at a zoom: a plain number passes
 * through (clamped), an `["interpolate", ["linear"], ["zoom"], z1, v1,
 * …]` expression linearly interpolates between stops (clamped at the
 * ends — MapLibre semantics). Anything else renders fully opaque.
 */
export function paintOpacityAtZoom(paint: unknown, zoom: number): number {
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  if (typeof paint === 'number' && Number.isFinite(paint)) return clamp(paint);
  if (Array.isArray(paint) && paint[0] === 'interpolate') {
    const input = paint[2];
    if (!Array.isArray(input) || input[0] !== 'zoom') return 1;
    const rest = paint.slice(3);
    let prevZoom: number | null = null;
    let prevValue: number | null = null;
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const z = rest[i];
      const v = rest[i + 1];
      if (typeof z !== 'number' || typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (zoom <= z) {
        if (prevZoom !== null && prevValue !== null && z > prevZoom) {
          const t = (zoom - prevZoom) / (z - prevZoom);
          return clamp(prevValue + (v - prevValue) * t);
        }
        return clamp(v); // below the first stop
      }
      prevZoom = z;
      prevValue = v;
    }
    return prevValue !== null ? clamp(prevValue) : 1; // above the last stop
  }
  return 1;
}

/** Overlay layers currently on the map, keyed by overlay slug. */
type LiveOverlays = Map<string, { layer: L.TileLayer; spec: RasterOverlaySpec }>;

export interface FallbackOverlayAdapter {
  /** Drop every layer + watcher (component unmount). */
  destroy(): void;
}

/**
 * Subscribe the fallback map to the shared overlay store. Reconciles
 * raster overlays on toggle/parameter/catalog-swap changes and on every
 * zoom change (the opacity curves interpolate on zoom).
 */
export function createFallbackOverlayAdapter(map: L.Map): FallbackOverlayAdapter {
  const overlayStore = useOverlayStore();
  const live: LiveOverlays = new Map();
  const stops: WatchStopHandle[] = [];
  let paneReady = false;
  // Set by destroy() — teardown ordering guarantees destroy() runs
  // BEFORE the view's map.remove(), but a stray epoch tick after
  // destroy must never touch a half-torn map.
  let destroyed = false;

  function ensurePane(): void {
    if (paneReady || map.getPane(OVERLAY_PANE)) return;
    map.createPane(OVERLAY_PANE);
    const pane = map.getPane(OVERLAY_PANE);
    if (pane) {
      pane.style.zIndex = String(OVERLAY_PANE_Z);
      pane.classList.add('leaflet-pane'); // pane styling parity
    }
    paneReady = true;
  }

  // SAFETY: same widened cast as the overlay store's own consumers —
  // reading .name/.active/.style only, fields every item sets; breaks
  // the maplibre-style TS2589 type recursion.
  const overlays = overlayStore.overlays as unknown as Array<OverlaySwitchItem>;

  function specFor(overlay: OverlaySwitchItem): RasterOverlaySpec | undefined {
    const base = rasterBase(overlay.style);
    if (!base) return undefined;
    return {
      url: base.source.tiles[0]!,
      minZoom: base.layerMinZoom,
      maxNativeZoom: base.source.maxzoom,
      opacityPaint: base.opacityPaint,
    };
  }

  /** Add/remove/re-point layers so the map mirrors the store state. */
  function reconcile(): void {
    if (destroyed) return;
    ensurePane();
    const zoom = map.getZoom();
    const wanted = new Map<string, RasterOverlaySpec>();
    for (const overlay of overlays) {
      if (!overlay.active) continue;
      const spec = specFor(overlay);
      if (spec) wanted.set(overlay.name, spec);
    }
    // Remove layers no longer active (or no longer servable).
    for (const [name, entry] of live) {
      if (!wanted.has(name)) {
        map.removeLayer(entry.layer);
        live.delete(name);
      }
    }
    for (const [name, spec] of wanted) {
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
        live.set(name, { layer, spec });
        continue;
      }
      if (existing.spec.url !== spec.url) existing.layer.setUrl(spec.url);
      existing.spec = spec;
      existing.layer.setOpacity(paintOpacityAtZoom(spec.opacityPaint, zoom));
    }
  }

  /** Hard reset: the catalog swapped the items (styles may be replaced). */
  function reset(): void {
    for (const [, entry] of live) map.removeLayer(entry.layer);
    live.clear();
    reconcile();
  }

  /** Zoom-only pass: re-evaluate the opacity curves at the new zoom. */
  function reconcileOpacity(): void {
    const zoom = map.getZoom();
    for (const [, entry] of live) {
      entry.layer.setOpacity(paintOpacityAtZoom(entry.spec.opacityPaint, zoom));
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
  map.on('zoomend', reconcileOpacity);
  reconcile();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const stop of stops) stop();
      map.off('zoomend', reconcileOpacity);
      for (const [, entry] of live) map.removeLayer(entry.layer);
      live.clear();
    },
  };
}
