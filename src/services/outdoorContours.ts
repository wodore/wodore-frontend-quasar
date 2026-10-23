/**
 * Client-side contour lines for the legacy "Wodore Outdoor" basemaps
 * (`{WODORE_TILE_SERVER_URL}/style/{id}`).
 *
 * Those styles reference contour tiles via the custom `dem-contour://`
 * protocol. That protocol — and the shared Mapterhorn DEM tile cache —
 * is registered here with `maplibre-contour` (BSD-3), which computes
 * contour vector tiles on the fly in a web worker. No API key, no
 * server-side component.
 *
 * The DEM (`id: 'dem'`) matches the protocol prefix hardcoded in the
 * style (`dem-contour://{z}/{x}/{y}?...`) — keep both in sync, and keep
 * the thresholds in sync with the served style JSONs (wodore-backend
 * `tile_server/styles/wd-outdoor-base-*.json`).
 *
 * `maplibre-contour` (+ its worker + tinyqueue, ~20 kB gz) is loaded
 * via dynamic import: no currently served style references the
 * protocol (contours come from server tiles since the hill rework), so
 * the library must not sit on the boot-critical chunk. First call
 * fetches it once, cached thereafter; callers get a memoized promise
 * and may fire-and-forget — the protocol only needs to exist before
 * MapLibre requests a dem-contour:// tile, which happens well after
 * the style document itself has loaded.
 */
import { addProtocol } from 'maplibre-gl';

/** Style ids of the Wodore outdoor basemaps served by Martin
 * (`{WODORE_TILE_SERVER_URL}/style/{id}`). The mtk style is the default;
 * the ofm style is the keyless fallback (Maptoolkit license). */
export const OUTDOOR_STYLE_IDS = ['wd-outdoor-base-mtk', 'wd-outdoor-base-ofm'] as const;

const MAPTERHORN_DEM = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';

let setupPromise: Promise<void> | null = null;

/**
 * Register the `dem-contour://` / `dem-shared://` protocols. Safe to
 * call repeatedly — only the first call registers anything. Runs
 * before MapLibre loads the outdoor style (it fires the tile requests).
 */
export function setupOutdoorContours(): Promise<void> {
  setupPromise ??= (async () => {
    try {
      const { default: mlcontour } = await import('maplibre-contour');
      const demSource = new mlcontour.DemSource({
        // Must stay 'dem': the style's protocol URLs are dem-contour://...
        id: 'dem',
        url: MAPTERHORN_DEM,
        encoding: 'terrarium',
        maxzoom: 15,
        // Contour isoline computation off the main thread
        worker: true,
        cacheSize: 100,
        timeoutMs: 10_000,
      });
      demSource.setupMaplibre({ addProtocol });
      console.debug('[outdoorContours] dem-contour protocol registered (Mapterhorn DEM)');
    } catch (error) {
      // Chunk-load failure must not permanently poison the memoized
      // promise (review finding): reset so the next call retries, and
      // surface the failure — silently void callers would otherwise
      // swallow it and the protocol would stay unregistered all session.
      setupPromise = null;
      console.warn(
        '[outdoorContours] maplibre-contour failed to load — dem-contour protocol not registered',
        error
      );
    }
  })();
  return setupPromise;
}

/** True if the given basemap style is a Martin-served Wodore outdoor
 * style (the ones that use the dem-contour protocol). */
export function isOutdoorStyle(style: unknown): boolean {
  return typeof style === 'string' && OUTDOOR_STYLE_IDS.some(id => style.includes(`/style/${id}`));
}
