/**
 * Basemap style-document failure detection.
 *
 * MapLibre fires an `error` event when the style DOCUMENT behind
 * `setStyle(url)` fails to load — the AJAXError shape from
 * maplibre-gl's ajax.ts (`status`, `statusText`, `url`; message
 * `AJAXError: Not Found (404): <url>`). A definitive "gone" status
 * (404/410) on the ACTIVE basemap's own style URL means the map has
 * NO style at all: tile requests never start, so the tile-host
 * fallbacks in WdMapView cannot fire and the map stays blank until a
 * reload (staging 2026-10: "No active map layer with slug
 * 'wd-outdoor-base-mtk'" while the persisted layers snapshot still
 * carried the layer — the style 404'd and no fallback applied).
 */

/** Statuses that definitively mean "this style no longer exists". */
export const STYLE_GONE_STATUSES: ReadonlySet<number> = new Set([404, 410]);

/** The error shape MapLibre's AJAXError surfaces on map error events. */
export interface StyleLoadErrorShape {
  status?: unknown;
  url?: unknown;
}

/**
 * Whether `error` is a definitive load failure of the ACTIVE
 * basemap's style document (`activeStyle` = the switch item's style
 * URL). Matches the exact URL, or the same style path behind a
 * rewritten origin (request transforms) — a different query (e.g.
 * `spec`) still counts: it addresses the same layer slug.
 */
export function isBasemapStyleGone(
  error: StyleLoadErrorShape | undefined,
  activeStyle: string | undefined
): boolean {
  if (!error || !activeStyle) return false;
  if (typeof error.status !== 'number' || !STYLE_GONE_STATUSES.has(error.status)) return false;
  const failedUrl = typeof error.url === 'string' ? error.url : '';
  if (!failedUrl) return false;
  if (failedUrl === activeStyle) return true;
  try {
    const base = typeof location !== 'undefined' ? location.href : 'https://localhost/';
    return new URL(failedUrl, base).pathname === new URL(activeStyle, base).pathname;
  } catch {
    return false;
  }
}
