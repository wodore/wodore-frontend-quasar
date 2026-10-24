/**
 * Staged basemap loading (perf/staged-map-load).
 *
 * The outdoor basemap ships its terrain as style data: raster-DEM
 * sources (Mapterhorn via the terrainrgb TileJSON), hillshade and
 * color-relief layers, contour tiles, and large pattern-only sprite
 * sets (the ~2.3 MB maptoolkit nature sprite). Loading all of that
 * with the FIRST style apply puts ~3 MB of relief tiles and textures
 * on the critical path of the very first map render.
 *
 * Product guidance (owner, 2026-10): the first map render may start
 * minimal; enhancements may appear slightly later. This module splits
 * a style object into
 *
 *   initial — the base map (vector tiles, essential label icons)
 *   deferred — the terrain stack + pattern-only sprites
 *
 * The store applies `initial` first and re-attaches `deferred` once
 * the map has gone idle after that first render (basemap-store).
 *
 * Everything here is generic and data-driven: whatever a future style
 * declares is classified the same way — no hardcoded style or host
 * lists. Styles without deferrable parts stage as null (no-op).
 */
import type { LayerSpecification, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import { setupOutdoorContours } from './outdoorContours';

/** URL prefix of the client-side contour protocol (maplibre-contour). */
const DEM_CONTOUR_PROTOCOL = 'dem-contour://';

/** An icon-image reference only binds a sprite to the FIRST render when
 *  its layer can draw at the initial zoom: sprite entries whose icon
 *  references all live on deep-zoom layers (≥ this zoom — e.g. the z15
 *  tree symbols pulling the 2.3 MB nature sprite) load after the base
 *  map rendered. Above this zoom the map is in interactive hiking
 *  territory and enhancements have long attached. */
const SPRITE_ICON_DEFER_MINZOOM = 13;

/**
 * Layers that only exist to render relief/terrain. Deferred from the
 * initial style and re-added after the first render:
 *  - `hillshade` / `color-relief` layers (DEM consumers)
 *  - any layer whose id mentions contours (server or client contour lines)
 *  - raster relief underlays (hillshade server tiles, swisstopo relief
 *    raster) — raster layers whose id mentions relief
 */
export function isDeferredTerrainLayer(layer: LayerSpecification): boolean {
  if (layer.type === 'hillshade' || layer.type === 'color-relief') return true;
  if (/contour/i.test(layer.id)) return true;
  return layer.type === 'raster' && /relief/i.test(layer.id);
}

/** Sprite entries kept in the initial style when any of their icon-image
 *  references can draw at first-render zooms (the essential label/POI
 *  icons — `sdf:`, `wd-maps:`, …). Entries only used by paint patterns
 *  (fill-/line-pattern textures) or by deep-zoom icon layers (nature
 *  trees at z15) load after the first render — a pattern whose image is
 *  missing simply skips its texture layer until the sprite arrives (the
 *  plain fills beneath stay), and addSprite re-evaluates icon layers
 *  once its images registered. */
function isEssentialSprite(entry: { id?: string }, iconRefLayers: { minzoom?: number }[]): boolean {
  // the 'default' sprite carries bare icon names — always essential
  if (!entry.id || entry.id === 'default') return true;
  return iconRefLayers.some(l => (l.minzoom ?? 0) < SPRITE_ICON_DEFER_MINZOOM);
}

/** All URL-ish strings of a source (its TileJSON url + inline tiles). */
function sourceUrls(source: SourceSpecification): string[] {
  const urls: string[] = [];
  if ('url' in source && typeof source.url === 'string') urls.push(source.url);
  if ('tiles' in source && Array.isArray(source.tiles)) {
    for (const t of source.tiles) if (typeof t === 'string') urls.push(t);
  }
  return urls;
}

export interface DeferredTerrainLayer {
  layer: LayerSpecification;
  /** Re-insertion anchor: id of the first RETAINED layer that followed
   *  this one in the original layer order (undefined = was at the top). */
  beforeId?: string;
}

export interface StagedEnhancements {
  /** Sources dropped from the initial style (DEM, contour tiles). */
  sources: Record<string, SourceSpecification>;
  /** Layers dropped from the initial style, in original order, with
   *  their re-insertion anchors. */
  layers: DeferredTerrainLayer[];
  /** Sprite entries dropped from the initial style (pattern-only
   *  texture packs) — re-added with map.addSprite. */
  sprites: { id: string; url: string }[];
}

export interface StagedStyle {
  initial: StyleSpecification;
  deferred: StagedEnhancements;
}

/**
 * Split a style for staged loading. Returns null when there is nothing
 * worth deferring (satellite/topo/raster styles) — callers then apply
 * the style untouched. Non-mutating: the input may be frozen (MapLibre
 * freezes parsed styles).
 *
 * Registers the dem-contour:// protocol upfront if the style references
 * it anywhere (legacy Martin-served outdoor styles) — deferred or not,
 * the protocol must exist before MapLibre requests such tiles.
 */
export function stageStyleEnhancements(style: StyleSpecification): StagedStyle | null {
  const layers = style.layers ?? [];
  const sources = style.sources ?? {};

  const deferredLayers = layers.filter(isDeferredTerrainLayer);
  if (deferredLayers.length === 0) return null;

  // Sources referenced only by deferred layers (contour tilesets), plus
  // every raster-dem source (they only feed hillshade/color-relief).
  const retainedSourceIds = new Set(
    layers.filter(l => !isDeferredTerrainLayer(l)).map(l => ('source' in l ? l.source : undefined))
  );
  const deferredSourceIds = Object.keys(sources).filter(id => {
    if (sources[id]?.type === 'raster-dem') return true;
    if (retainedSourceIds.has(id)) return false;
    return deferredLayers.some(l => 'source' in l && l.source === id);
  });

  // 3D terrain safety (review B1): a top-level `style.terrain` pointing
  // at a raster-dem source would survive into the initial style with its
  // source deleted — MapLibre would error on the FIRST setStyle, on the
  // boot critical path. No served staging style declares `terrain` today
  // (wd-outdoor-base-* v8 verified), and country-fallback.ts propagates
  // it if one ever does — so bail out of staging entirely in that case:
  // the full style applies unsplit (no perf win, no breakage).
  if (style.terrain && deferredSourceIds.includes(style.terrain.source)) {
    return null;
  }

  // Re-insertion anchors: walk back-to-front, tracking the next
  // retained layer id after each deferred layer.
  const layersWithAnchors: DeferredTerrainLayer[] = [];
  let nextRetained: string | undefined;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (isDeferredTerrainLayer(layer)) {
      layersWithAnchors.push({ layer, beforeId: nextRetained });
    } else {
      nextRetained = layer.id;
    }
  }
  layersWithAnchors.reverse();

  // Sprites: keep what first-render icon layers need, defer pattern-only
  // packs and deep-zoom icon packs.
  const spriteArray = Array.isArray(style.sprite) ? style.sprite : null;
  const iconRefLayers = (prefix: string): { minzoom?: number }[] =>
    layers.filter(l =>
      (
        JSON.stringify((l.layout as Record<string, unknown> | undefined)?.['icon-image']) ?? ''
      ).includes(`"${prefix}:`)
    );
  const keptSprites: typeof spriteArray = [];
  const deferredSprites: StagedEnhancements['sprites'] = [];
  if (spriteArray) {
    for (const entry of spriteArray) {
      if (typeof entry === 'string') {
        keptSprites.push(entry);
        continue;
      }
      if (entry && isEssentialSprite(entry, iconRefLayers(entry.id))) {
        keptSprites.push(entry);
      } else if (entry) {
        deferredSprites.push({ id: entry.id, url: entry.url });
      }
    }
  }

  // dem-contour protocol: must be registered before MapLibre loads
  // tiles from such URLs (retained sources now, deferred ones later).
  const allSources = Object.values(sources);
  if (allSources.some(src => sourceUrls(src).some(u => u.startsWith(DEM_CONTOUR_PROTOCOL)))) {
    void setupOutdoorContours();
  }

  const initialSources = { ...sources };
  for (const id of deferredSourceIds) delete initialSources[id];

  const initial: StyleSpecification = {
    ...style,
    sources: initialSources,
    layers: layers.filter(l => !isDeferredTerrainLayer(l)),
    ...(spriteArray ? { sprite: keptSprites.length > 0 ? keptSprites : undefined } : {}),
  };

  return {
    initial,
    deferred: {
      sources: Object.fromEntries(deferredSourceIds.map(id => [id, sources[id]])),
      layers: layersWithAnchors,
      sprites: deferredSprites,
    },
  };
}

/** Minimal MapLibre surface attachStagedEnhancements needs (unit tests
 *  stub this; the real Map satisfies it structurally). */
export interface StagingMapLike {
  getLayer(id: string): unknown;
  addLayer(layer: LayerSpecification, beforeId?: string): void;
  getSource(id: string): unknown;
  addSource(id: string, source: SourceSpecification): void;
  getSprite(): { id: string }[];
  addSprite(id: string, url: string): void;
}

/**
 * Re-attach deferred enhancements to a live map. Idempotent — safe to
 * call twice (idle + safety timer) and after a full re-apply (sources
 * already present are skipped). Aborts cleanly when the style changed
 * under us (a basemap switch removed the anchor layers) — in that case
 * the current basemap owns the style, the staged parts are stale.
 */
export function attachStagedEnhancements(
  map: StagingMapLike,
  deferred: StagedEnhancements
): boolean {
  // All anchors must exist — a missing anchor means the layer order we
  // captured no longer matches the live style (switch happened).
  for (const { beforeId } of deferred.layers) {
    if (beforeId !== undefined && !map.getLayer(beforeId)) return false;
  }

  // The dem-contour:// protocol must exist before its sources load.
  for (const source of Object.values(deferred.sources)) {
    if (sourceUrls(source).some(u => u.startsWith(DEM_CONTOUR_PROTOCOL))) {
      void setupOutdoorContours();
      break;
    }
  }

  for (const [id, source] of Object.entries(deferred.sources)) {
    if (!map.getSource(id)) map.addSource(id, source);
  }
  for (const { layer, beforeId } of deferred.layers) {
    if (!map.getLayer(layer.id)) map.addLayer(layer, beforeId);
  }
  return true;
}

/** Attach the deferred sprite packs (nature/water pattern icons — the
 *  ~2.3 MB @2x packs). Split from the terrain attach on purpose
 *  (owner, 2026-10): the first view never needs them — their icons only
 *  draw at deep zoom — so they load on demand (zoom ≥ 13) or after a
 *  long settle, never competing with the first renders or the first
 *  zoom gestures. */
export function attachStagedSprites(map: StagingMapLike, deferred: StagedEnhancements): void {
  const present = new Set((map.getSprite() ?? []).map(s => s.id));
  for (const sprite of deferred.sprites) {
    if (!present.has(sprite.id)) map.addSprite(sprite.id, sprite.url);
  }
}
