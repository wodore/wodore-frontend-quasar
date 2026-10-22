/**
 * Generic map-asset prewarming (perf/fast-first-paint).
 *
 * The URLs to warm are DERIVED from the backend catalog and the style
 * documents themselves — no hardcoded hosts or style lists: whatever
 * the catalog serves (mtk today, other providers tomorrow) warms the
 * same way. Everything here is best-effort cache warming: fetches are
 * fire-and-forget, failures are swallowed, each URL is warmed at most
 * once per session.
 */
import type { StyleSpecification } from 'maplibre-gl';
import { absolutizeStyleUrl, type MapCatalogLayer } from './map-catalog';

/** Session-wide dedupe — one warm fetch per URL, however many callers. */
const warmed = new Set<string>();

function warm(urls: Iterable<string>): void {
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    void fetch(url, { mode: 'cors' }).catch(() => undefined);
  }
}

/** Concrete endpoints a style document references: the TileJSON `url`
 *  of every source plus the sprite metadata variants MapLibre requests.
 *  Glyphs URLs are templates ({fontstack}/{range}) and tile URLs carry
 *  {z}/{x}/{y} — nothing concrete to warm for either. */
export function styleAssetUrls(style: StyleSpecification): string[] {
  const urls: string[] = [];
  for (const source of Object.values(style.sources ?? {})) {
    if (source && 'url' in source && typeof source.url === 'string') {
      urls.push(source.url);
    }
  }
  const spriteUrls =
    typeof style.sprite === 'string'
      ? [style.sprite]
      : (style.sprite ?? []).map(entry => entry?.url);
  for (const sprite of spriteUrls) {
    if (typeof sprite === 'string' && sprite) {
      urls.push(spriteVariantUrl(sprite, '.json'), spriteVariantUrl(sprite, '@2x.json'));
    }
  }
  return urls;
}

/** MapLibre loads `sprite.json` / `sprite@2x.json` — the suffix goes
 *  BEFORE any query string. Naive string concat (`${sprite}.json`)
 *  produced `sprite?v=hash.json`, a URL nobody serves (silent warm
 *  no-op / failed fetch for every versioned sprite URL). */
export function spriteVariantUrl(spriteUrl: string, suffix: string): string {
  const queryAt = spriteUrl.indexOf('?');
  if (queryAt === -1) return `${spriteUrl}${suffix}`;
  return `${spriteUrl.slice(0, queryAt)}${suffix}${spriteUrl.slice(queryAt)}`;
}

/** Warm the TileJSON/sprite endpoints a style document references.
 *  Call when the style object is already in hand (right after it was
 *  fetched) — the warm fetches then run concurrent with the serial
 *  style→assets chain the renderer would otherwise pay alone. */
export function prewarmStyleAssets(style: StyleSpecification | null | undefined): void {
  if (style) warm(styleAssetUrls(style));
}

/** Warm every catalog layer's STYLE DOCUMENT except the critical one:
 *  the selected-or-default basemap style stays alone on the boot
 *  critical path, everything else (basemaps and overlays alike — the
 *  switcher's per-style JSONs) warms the HTTP cache AFTER the map's
 *  first render settles (the caller schedules this on map 'idle' —
 *  firing it earlier starves the first render; the catalog compile
 *  later reads these as cache hits). */
export function prewarmCatalogStyles(layers: MapCatalogLayer[], exceptStyleUrl?: string): void {
  // Skip by BOTH the raw and the absolutized form: the persisted
  // selection and the catalog's style_url can differ in resolution
  // (root-relative vs absolute), and a miss meant the critical style
  // was fetched twice — once by this warm, once by the renderer.
  const skip = exceptStyleUrl
    ? new Set([exceptStyleUrl, absolutizeStyleUrl(exceptStyleUrl)])
    : undefined;
  const urls: string[] = [];
  for (const layer of layers) {
    if (!layer.style_url) continue;
    const url = absolutizeStyleUrl(layer.style_url);
    if (skip?.has(layer.style_url) || skip?.has(url)) continue;
    urls.push(url);
  }
  warm(urls);
}
