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
import { absolutizeStyleUrl, styleVariantUrl, type MapCatalogLayer } from './map-catalog';

/** Session-wide dedupe — one warm fetch per URL, however many callers. */
const warmed = new Set<string>();

function warm(urls: Iterable<string>): void {
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    // Low priority: the warm-up must never contend with tiles or the
    // active style — browsers schedule 'low' fetches behind interactive
    // requests on the same connection pool.
    void fetch(url, { mode: 'cors', priority: 'low' }).catch(() => undefined);
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

/** Collect literal font-stack names from a style's symbol layers
 *  (text-font values — usually literal string arrays, occasionally
 *  buried in expressions; the recursive walk catches both). */
function styleFontStacks(style: StyleSpecification): Set<string> {
  const stacks = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      stacks.add(v);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    }
  };
  for (const layer of style.layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const layout = (layer as { layout?: Record<string, unknown> }).layout;
    walk(layout?.['text-font']);
  }
  return stacks;
}

/** Warm a style's glyph PBFs for the common 0-255 range (perf/map-boot,
 *  2026-10-31 profiling): MapLibre only requests a font stack when a
 *  symbol tile first RENDERS — tiles → first render → glyph fetch →
 *  re-render — and until those PBFs land, `isSourceLoaded()` stays false
 *  for every label-carrying source (symbol tiles count as loading while
 *  glyph dependencies pend). On a CDN-slow day that serialized font
 *  chain was the single longest reveal blocker. Warming the stacks at
 *  style-apply time loads the PBFs in parallel with the tile wave; the
 *  renderer's own requests then hit the HTTP cache. Best-effort: no
 *  stacks found or a template without {fontstack} is a no-op. */
export function prewarmStyleGlyphs(style: StyleSpecification | null | undefined): void {
  if (!style || typeof style.glyphs !== 'string') return;
  const template = style.glyphs;
  if (!template.includes('{fontstack}')) return;
  const urls: string[] = [];
  for (const stack of styleFontStacks(style)) {
    urls.push(
      template.replace('{fontstack}', encodeURIComponent(stack)).replace('{range}', '0-255')
    );
  }
  warm(urls);
}

/** Warm every catalog layer's STYLE DOCUMENT except the critical one:
 *  the selected-or-default basemap style stays alone on the boot
 *  critical path, everything else (basemaps and overlays alike — the
 *  switcher's per-style JSONs) warms the HTTP cache AFTER the map's
 *  first render settles (the caller schedules this on map 'idle' —
 *  firing it earlier starves the first render; the catalog compile
 *  later reads these as cache hits).
 *
 *  VARIANT MATCH (perf/map-boot, 2026-10-31 profiling): the catalog
 *  compile consumes parameterized overlays ONLY as their `mode=
 *  tokenized` variant (loadStyleBundle resolves tokens client-side) —
 *  warming the plain style_url for those layers bought a cache entry
 *  nobody ever reads while the compile still downloaded the tokenized
 *  sibling from the network (every parameterized overlay fetched
 *  twice per cold boot). Parameterized layers now warm the variant
 *  the compile will actually fetch. */
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
    // Only layers the user can actually select: hidden layers
    // (show=false — keyless fallbacks, retired variants, provider
    // alternates like maptiler-hybrid with an unresolved
    // {{env:…}} key template) are never compiled by the picker, so
    // warming them is pure waste. Measured on staging: 7 of the 21
    // catalog layers are hidden — the wave shrank from 20 style
    // fetches to the visible 11 overlays + 3 basemaps (minus the
    // active one).
    if (layer.show === false) continue;
    const tokenized = (layer.parameters?.length ?? 0) > 0;
    const url = styleVariantUrl(absolutizeStyleUrl(layer.style_url), { tokenized });
    if (skip?.has(layer.style_url) || skip?.has(url)) continue;
    urls.push(url);
  }
  warm(urls);
}
