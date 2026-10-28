// @vitest-environment happy-dom
/**
 * INTEGRATION tests for the fallback overlay adapter (Leaflet) against
 * the SERVED transport-stops subset style — the gap that let a phantom
 * "renders nothing" bug report through (2026-10-29): #368's unit tests
 * covered the pure pieces (spec parsing, bubble styling, expression
 * evaluation) in isolation, all green, while nothing drove the REAL
 * adapter (createFallbackOverlayAdapter) with a real Leaflet map, a
 * real overlay store entry, real zoom events and a resolving fetch.
 *
 * These tests pin the runtime DOM contract the pieces produce together:
 *
 * * cluster band (z5–z6 for transport-stops): aggregated bubbles render
 *   as divIcon markers with classes `wd-cluster-bubble
 *   leaflet-marker-icon` — the custom divIcon className REPLACES
 *   Leaflet's default `leaflet-div-icon` (querying that finds nothing),
 * * raw band (≥ the layer floor z10): the geojson group is ON the map
 *   as CircleMarkers on a shared canvas in the
 *   `.leaflet-wdOverlayData-pane` pane (no SVG circles exist anywhere),
 * * band boundaries: leaving the cluster band removes the bubbles,
 *   dropping below the floor removes the group,
 * * catalog epoch bump (reset) re-renders from the SAME cached feature
 *   promise — one geojson download per URL per session (the cache used
 *   to be cleared on every epoch bump, re-downloading the 4 MB BAV
 *   list on each subset-catalog arrival while an overlay was active).
 *
 * happy-dom: leaflet needs a window; its canvas renderer needs a 2D
 * context, which happy-dom does not implement — getContext is stubbed
 * with a no-op proxy (the same docblock pattern as the circles spec).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { createPinia, setActivePinia } from 'pinia';
import { createFallbackOverlayAdapter } from '@components/map/fallback/overlay-adapter';
import { useOverlayStore } from '@stores/map/overlay-store';
import type { StyleSpecification } from 'maplibre-gl';

// ── Fixtures ─────────────────────────────────────────────────────────────

const DATA_URL = 'https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson';

/** The transport-stops SUBSET style as staging serves it (fetched from
 * hub.stg.wodore.com /v1/map/styles/transport-stops.json?spec=medium
 * &profile=subset, 2026-10-29 — cluster source keys, three layers,
 * paints verbatim; only the glyphs token is shortened). */
const SERVED_SUBSET_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.cdn.stg.wodore.com/font/{fontstack}/{range}?v=x',
  sources: {
    'transport-stops': {
      type: 'geojson',
      data: DATA_URL,
      cluster: true,
      clusterRadius: 20,
      clusterMaxZoom: 6,
      clusterProperties: {
        bus_count: ['+', ['case', ['in', 'bus', ['get', 'types']], 1, 0]],
        train_count: ['+', ['case', ['in', 'train', ['get', 'types']], 1, 0]],
      },
    },
  },
  layers: [
    {
      id: 'transport-stops',
      type: 'circle',
      source: 'transport-stops',
      minzoom: 10,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['in', 'train', ['get', 'types']],
          '#C60018',
          ['in', 'bus', ['get', 'types']],
          '#2d327d',
          '#0079C7',
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7,
          ['case', ['in', 'train', ['get', 'types']], 3, ['in', 'bus', ['get', 'types']], 2, 1],
          9,
          ['case', ['in', 'train', ['get', 'types']], 4, ['in', 'bus', ['get', 'types']], 3, 3],
          16,
          ['case', ['in', 'train', ['get', 'types']], 9, ['in', 'bus', ['get', 'types']], 8, 8],
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 0.3, 8, 0.6, 12, 1],
        'circle-stroke-color': '#F6F6F6',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 1, 16, 2],
      },
    },
    {
      id: 'transport-stops-clusters',
      type: 'circle',
      source: 'transport-stops',
      minzoom: 5,
      maxzoom: 7,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'case',
          ['>', ['get', 'train_count'], 0],
          '#C60018',
          ['>', ['get', 'bus_count'], 0],
          '#2d327d',
          '#0079C7',
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'point_count'],
          2,
          5,
          10,
          7,
          50,
          9,
          200,
          11,
          1000,
          14,
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 0.3, 8, 0.6, 12, 1],
        'circle-stroke-color': '#F6F6F6',
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'transport-stops-cluster-count',
      type: 'symbol',
      source: 'transport-stops',
      minzoom: 5,
      maxzoom: 7,
      filter: ['has', 'point_count'],
      paint: {
        'text-color': '#F6F6F6',
        'text-opacity': 1,
        'text-halo-color': 'rgba(45, 50, 125, 0.45)',
        'text-halo-width': 0.8,
      },
      layout: {
        'text-font': ['Barlow Semi Condensed SemiBold', 'Noto Sans Bold'],
        'text-size': 11,
        'text-field': ['get', 'point_count_abbreviated'],
      },
    },
  ],
} as unknown as StyleSpecification;

/** A small clustered subset of the BAV list (Bern-area stops). */
const stop = (id: number, lng: number, lat: number, types: string[]) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point' as const, coordinates: [lng, lat] },
  properties: { id, types, name: `stop ${id}` },
});
const FEATURES = Array.from({ length: 60 }, (_, i) =>
  stop(1000 + i, 7.4 + (i % 10) * 0.002, 46.95 + Math.floor(i / 10) * 0.002, i % 2 === 0 ? ['train'] : ['bus'])
);

// ── Harness ──────────────────────────────────────────────────────────────

/** happy-dom implements no canvas 2D context — stub one with no-ops so
 * leaflet's canvas renderer runs its full layer lifecycle. */
const noopCtx = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (prop in (target as object)) return (target as Record<string|symbol, unknown>)[prop];
      return () => undefined;
    },
    set: (target, prop, value) => {
      (target as Record<string|symbol, unknown>)[prop] = value;
      return true;
    },
  }
) as unknown as CanvasRenderingContext2D;

let fetchMock: ReturnType<typeof vi.fn>;
let origRedraw: typeof L.Canvas.prototype._redraw;
const cleanup: Array<() => void> = [];

/** A real Leaflet map in the document at z7 (outside both bands). */
function makeMap(): { map: L.Map; container: HTMLElement } {
  const container = document.createElement('div');
  container.id = 'wd-fallback-test-map';
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(container);
  const map = L.map(container, { zoomControl: false, zoomSnap: 1, minZoom: 4, maxZoom: 19 });
  map.setView([46.95, 7.45], 7);
  cleanup.push(() => {
    map.remove();
    container.remove();
  });
  return { map, container };
}

/** Seed the shared overlay store with the catalog-compiled transport
 * item (the catalog store's applyCatalogOverlays normally owns this). */
function seedTransportOverlay(): void {
  const overlayStore = useOverlayStore();
  overlayStore.overlays.push({
    name: 'transport-stops',
    label: 'Public transport stops',
    show: true,
    active: false,
    onLayer: 'ways',
    icon: 'transport',
    style: SERVED_SUBSET_STYLE,
  } as never);
}

/** Toggle the seeded overlay ON (one chip click). */
function toggleTransportOn(): void {
  const overlayStore = useOverlayStore();
  overlayStore.toggleOverlay(overlayStore.overlays[0] as never);
  expect((overlayStore.overlays[0] as unknown as { active: boolean }).active).toBe(true);
}

/** Geojson document downloads observed by the adapter's featuresFor. */
function dataDownloads(): number {
  return fetchMock.mock.calls.filter(([url]) => String(url) === DATA_URL).length;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(noopCtx);
  // happy-dom's setImmediate-based requestAnimationFrame ignores
  // leaflet's cancelAnimFrame — a redraw frame queued by the final path
  // removal during teardown can fire AFTER the renderer deleted its
  // ctx (_destroyContainer). Real browsers honor the cancel; skip the
  // zombie frames so they do not surface as unhandled errors.
  origRedraw = L.Canvas.prototype._redraw;
  L.Canvas.prototype._redraw = function (this: L.Canvas, ...args: Parameters<typeof origRedraw>) {
    if (!this._ctx) return;
    return origRedraw.apply(this, args);
  };
  fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(input) === DATA_URL
        ? { type: 'FeatureCollection', features: FEATURES }
        : { error: 'unexpected url ' + String(input) },
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
  L.Canvas.prototype._redraw = origRedraw;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('fallback overlay adapter — served subset style integration', () => {
  it('activates the cluster band at z5: bubbles in the DOM, one download', async () => {
    const { map } = makeMap();
    seedTransportOverlay();
    const adapter = createFallbackOverlayAdapter(map);
    try {
      toggleTransportOn(); // z7 — outside both bands: no download yet
      // Give a wrongly-started fetch a moment to surface, then assert
      // the deferred-download contract: neither band is due at z7.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(dataDownloads()).toBe(0);

      map.setZoom(5); // cluster band — starts the fetch
      await vi.waitFor(() => {
        // DOM contract: custom divIcon className REPLACES leaflet's
        // default — `.leaflet-div-icon` matches NOTHING here.
        const bubbles = document.querySelectorAll('.wd-cluster-bubble');
        expect(bubbles.length).toBeGreaterThan(0);
        expect(bubbles[0]!.classList.contains('leaflet-marker-icon')).toBe(true);
        expect(document.querySelectorAll('.wd-cluster-bubble.leaflet-div-icon').length).toBe(0);
      });
      expect(dataDownloads()).toBe(1);

      // Leaving the band upwards removes the bubble layer.
      map.setZoom(7);
      await vi.waitFor(() =>
        expect(document.querySelectorAll('.wd-cluster-bubble').length).toBe(0)
      );
      expect(dataDownloads()).toBe(1); // cached — no second download
    } finally {
      adapter.destroy();
    }
  });

  it('adds the raw circle group at the layer floor and removes it below', async () => {
    const { map } = makeMap();
    seedTransportOverlay();
    const adapter = createFallbackOverlayAdapter(map);
    try {
      toggleTransportOn();
      map.setZoom(11); // raw band (floor z10) — starts the fetch
      await vi.waitFor(() => {
        let markers = 0;
        map.eachLayer(l => {
          if ((l as L.CircleMarker).feature) markers++;
        });
        expect(markers).toBe(FEATURES.length);
        // canvas pane exists with the shared renderer canvas
        const pane = map.getPane('wdOverlayData');
        expect(pane).toBeTruthy();
        expect(pane!.querySelector('canvas')).toBeTruthy();
      });
      expect(dataDownloads()).toBe(1);

      map.setZoom(9); // below the floor — group removed
      await vi.waitFor(() => {
        let markers = 0;
        map.eachLayer(l => {
          if ((l as L.CircleMarker).feature) markers++;
        });
        expect(markers).toBe(0);
      });
    } finally {
      adapter.destroy();
    }
  });

  it('re-renders on a catalog epoch bump without re-downloading the geojson', async () => {
    const { map } = makeMap();
    seedTransportOverlay();
    const overlayStore = useOverlayStore();
    const adapter = createFallbackOverlayAdapter(map);
    try {
      toggleTransportOn();
      map.setZoom(5);
      await vi.waitFor(() =>
        expect(document.querySelectorAll('.wd-cluster-bubble').length).toBeGreaterThan(0)
      );
      expect(dataDownloads()).toBe(1);

      // Catalog swap (fresh subset catalog arrival): epoch bump → the
      // adapter resets every entry and re-adds from the new styles.
      overlayStore.overlaysEpoch += 1;
      await vi.waitFor(() =>
        expect(document.querySelectorAll('.wd-cluster-bubble').length).toBeGreaterThan(0)
      );
      // The URL-keyed feature cache survives the reset — the 4 MB
      // document is NOT fetched again (live-observed double download
      // before the fix).
      expect(dataDownloads()).toBe(1);
    } finally {
      adapter.destroy();
    }
  });
});
