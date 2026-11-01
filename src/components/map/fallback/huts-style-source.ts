/**
 * Served-style tile source for the fallback's built-in huts rendering.
 *
 * The fallback's hut/availability MLT tiles, their pyramid bounds and
 * the sprite pack URL are extracted from the SAME backend-served style
 * document the MapLibre path renders — the overlay store's compiled
 * `huts` item (catalog `style_url` → `/v1/map/styles/huts.json`). On
 * fallback sessions the catalog is fetched with `profile=subset`, so
 * that document is the SUBSET twin (backend #440) — but its sources
 * are byte-identical to the full variant's: the tile URLs carry the
 * backend's serve-time tile origin (`{{env:MARTIN_TILE_URL}}` already
 * resolved — the CDN in staging/production), NOT the frontend's
 * `WODORE_TILE_SERVER_URL`. Same URLs ⇒ the browser HTTP-cache entries
 * are shared between the WebGL map and this fallback, and a local
 * Martin outage can no longer break the fallback while the CDN works.
 *
 * Subset-or-nothing (owner decision): when the item carries no usable
 * subset style the extraction returns undefined and the caller keeps
 * the built-in huts rendering OFF — there is deliberately NO
 * client-side fallback URL (the old `TILE_SERVER` constant).
 *
 * Date token: the `wd-bookings` tile template carries the runtime
 * `{{date}}` token. The TOKENIZED style document is preferred for it —
 * the RESOLVED document bakes the boot-day default into the URL
 * (map-catalog's `resolvedParameterValues` boot-defaults `date` to
 * today), which would freeze the fallback onto the wrong date. MapLibre
 * parity: `applyOverlayParameters` resolves the same token from the
 * same tokenized document on every date change (`setTiles`); the
 * fallback substitutes it per fetch instead (`expandTileUrl` with the
 * current picked date).
 */
import type { StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import { resolveTokens } from '@services/map-catalog';

/** Served source ids (backend seed contract, apps/basemaps seed_lib). */
export const HUTS_SOURCE_ID = 'wd-huts';
export const AVAIL_SOURCE_ID = 'wd-bookings';

/** Sprite pack id the fallback's shields/cluster icons read (the
 *  `accommodation,availability` pack; may be merged with other
 *  overlays' packs under the same base by the catalog store). */
const SPRITE_PACK_ID = 'wd';

/** MapLibre vector-source pyramid defaults (style-spec: 0 / 22) — used
 *  when a served source omits minzoom/maxzoom, exactly what MapLibre
 *  itself would assume for that source. */
const VECTOR_MIN_ZOOM_DEFAULT = 0;
const VECTOR_MAX_ZOOM_DEFAULT = 22;

/** One vector tile source's served inputs. */
export interface FallbackTileSource {
  /** First served tile URL template (`{z}/{x}/{y}` maplibre
   *  placeholders; the availability template may carry `{{date}}`). */
  tiles: string;
  /** Source pyramid floor (overzoom below). */
  minZoom: number;
  /** Source pyramid cap (overzoom above — the fallback's
   *  viewportTileRange applies the same semantics MapLibre does). */
  maxZoom: number;
  /** MLT table name inside the tiles (the layers' `source-layer`). */
  sourceLayer: string;
}

/** Everything the fallback's built-in huts rendering needs from the
 *  served style. `huts` is the mandatory source (its absence makes the
 *  whole extraction undefined); `avail` and `spriteBase` are optional
 *  (availability/sprites simply stay off without them). */
export interface FallbackHutsSource {
  huts: FallbackTileSource;
  avail?: FallbackTileSource;
  spriteBase?: string;
}

/** A vector source's validated served inputs (tiles[0] is a string). */
interface ValidatedVectorSource {
  /** First tile URL template. */
  tiles: string;
  minzoom?: number;
  maxzoom?: number;
}

/** A style's vector source when it declares inline tile URLs. */
function vectorTilesSource(
  style: StyleSpecification | undefined,
  id: string
): ValidatedVectorSource | undefined {
  const src = style?.sources?.[id];
  if (!src || src.type !== 'vector') return undefined;
  const { tiles } = src as VectorSourceSpecification;
  if (!Array.isArray(tiles) || typeof tiles[0] !== 'string') return undefined;
  return {
    tiles: tiles[0],
    minzoom: src.minzoom,
    maxzoom: src.maxzoom,
  };
}

/** The MLT table name for a source — the first style layer referencing
 *  it (`source-layer`), degraded to the seed contract's default. */
function sourceLayerOf(
  style: StyleSpecification | undefined,
  sourceId: string,
  fallback: string
): string {
  for (const layer of style?.layers ?? []) {
    if (!('source' in layer) || layer.source !== sourceId) continue;
    const sourceLayer = (layer as { 'source-layer'?: unknown })['source-layer'];
    if (typeof sourceLayer === 'string' && sourceLayer.length > 0) return sourceLayer;
  }
  return fallback;
}

/** Base URL of the `wd` sprite pack (no extension) — the document's
 *  sprite array entry, or the whole string sprite when the style
 *  carries one (pre-array style dialect). */
function spriteBaseOf(style: StyleSpecification | undefined): string | undefined {
  const sprite = style?.sprite;
  if (typeof sprite === 'string' && sprite.length > 0) return sprite;
  if (Array.isArray(sprite)) {
    const pack = sprite.find(s => s && typeof s === 'object' && s.id === SPRITE_PACK_ID);
    const url = (pack ?? sprite[0])?.url;
    return typeof url === 'string' && url.length > 0 ? url : undefined;
  }
  return undefined;
}

function tileSourceOf(
  source: ValidatedVectorSource,
  style: StyleSpecification,
  sourceId: string,
  defaultLayer: string
): FallbackTileSource {
  return {
    tiles: source.tiles,
    minZoom: source.minzoom ?? VECTOR_MIN_ZOOM_DEFAULT,
    maxZoom: source.maxzoom ?? VECTOR_MAX_ZOOM_DEFAULT,
    sourceLayer: sourceLayerOf(style, sourceId, defaultLayer),
  };
}

/**
 * Extract the fallback's huts data-source inputs from the served huts
 * style. Returns undefined when the style carries no usable `wd-huts`
 * vector source (no style yet — metadata-first placeholder — or a
 * style the subset contract never promised): the caller must then keep
 * the built-in huts rendering OFF.
 *
 * @param style the compiled item's RESOLVED style (what MapLibre adds)
 * @param tokenizedStyle the item's tokenized sibling when the layer
 *   declares parameters — preferred for the `wd-bookings` template so
 *   the runtime `{{date}}` token stays substitutable per fetch
 */
export function fallbackHutsSource(
  style: StyleSpecification | undefined,
  tokenizedStyle?: StyleSpecification
): FallbackHutsSource | undefined {
  if (!style) return undefined;
  const huts = vectorTilesSource(style, HUTS_SOURCE_ID);
  if (!huts) return undefined;
  // Availability template: tokenized first ({{date}} preserved), the
  // resolved document only when no tokenized sibling exists.
  const availTokenized = vectorTilesSource(tokenizedStyle, AVAIL_SOURCE_ID);
  const avail = availTokenized ?? vectorTilesSource(style, AVAIL_SOURCE_ID);
  const availStyle = availTokenized && tokenizedStyle ? tokenizedStyle : style;
  const spriteBase = spriteBaseOf(style);
  return {
    huts: tileSourceOf(huts, style, HUTS_SOURCE_ID, 'huts'),
    ...(avail ? { avail: tileSourceOf(avail, availStyle, AVAIL_SOURCE_ID, 'availability') } : {}),
    ...(spriteBase ? { spriteBase } : {}),
  };
}

/**
 * Expand a served tile template for one tile: `{{token}}` runtime
 * tokens first (catalog `resolveTokens` semantics — the same
 * substitution MapLibre's setTiles path applies), then the maplibre
 * `{z}/{x}/{y}` placeholders. An undefined template yields '' — the
 * fetch rejects and the tile stays absent; callers gate on the served
 * source anyway, this is defense in depth.
 */
export function expandTileUrl(
  template: string | undefined,
  z: number,
  x: number,
  y: number,
  tokens?: Record<string, unknown>
): string {
  if (!template) return '';
  const substituted = tokens ? (resolveTokens(template, tokens) as string) : template;
  return substituted
    .replaceAll('{z}', String(z))
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y));
}
