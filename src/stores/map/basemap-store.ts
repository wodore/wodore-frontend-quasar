import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import {
  getCompositeRasterStyle,
  getRasterStyle,
  withLayerMaxZoom,
  withLayerMinZoom,
} from '@stores/map/utils/raster';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Platform } from 'quasar';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';
import { getGPUTier } from '@pmndrs/detect-gpu';
import { useOverlayStore } from './overlay-store';
import { StyleSpecification } from 'maplibre-gl';
import { i18n, currentLocale } from '@services/locale';

const t = i18n.global.t;

const swissTopoRasterStyle = getRasterStyle({
  name: 'ch-swisstopo-raster',
  tiles: [
    'https://wmts0.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts1.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts2.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts3.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts4.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts5.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts6.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts7.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts8.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
    'https://wmts9.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
  ],
  attribution:
    '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> &#124; <a href="https://www.openstreetmap.org/copyright" target="_blank"> &copy; OpenStreetMap contributors</a> &#124; <a href="https://www.swisstopo.admin.ch/en/home.html" target="_blank">&copy; swisstopo</a>',
  suffix: '',
  tileSize: Platform.is.mobile ? 128 : 156,
  // tight bounds around Switzerland: swisstopo's 3857 grid RENDERS far
  // beyond the country (deep into FR/IT/AT), which would overwrite the
  // other layers — CH + small border margin only. East edge 10.55 keeps
  // the Engadin/Münstertal while minimizing overlap onto Vorarlberg
  // (covered by OpenTopoMap beneath).
  bounds: [5.95, 45.72, 10.55, 47.88],
});

const swissTopoLbmRasterStyle = getRasterStyle({
  name: 'ch-swisstopo-lbm',
  tiles: [
    'https://api.maptiler.com/maps/ch-swisstopo-lbm/{z}/{x}/{y}.png?key=' +
      process.env.WODORE_MAPTILER_API_KEY,
  ],
  attribution:
    '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank"> &copy; OpenStreetMap contributors</a> &#124; <a href="https://www.swisstopo.admin.ch/en/home.html" target="_blank">&copy; swisstopo</a>',
  suffix: '',
  //tileSize: Platform.is.mobile ? 128 : 156,
  tileSize: 512,
});

const oeLayer: 'geolandbasemap' | 'bmaphidpi' = 'bmaphidpi';
const oeExt: 'png' | 'jpeg' = 'jpeg';
const oeTopoRasterStyle = getRasterStyle({
  name: 'oe-raster',
  tiles: [
    // basemap.at moved their tile hosts: maps1-3.wien.gv.at no longer resolve,
    // current host is mapsneu.wien.gv.at (verified, serves the same paths)
    'https://mapsneu.wien.gv.at/basemap/' + oeLayer + '/normal/google3857/{z}/{y}/{x}.' + oeExt,
  ],
  attribution: 'basemap.at',
  tileSize: 512,
  // tight bounds around Austria (basemap.at's grid serves WHITE no-data
  // tiles well beyond its data, e.g. over eastern CH)
  bounds: [9.5, 46.36, 17.18, 49.02],
  // NOTE: in composites this style must always paint BELOW swisstopo.
});

// Clean minimal world fallback for zoomed-out views: the OpenFreeMap
// "positron" VECTOR style (free, keyless, unlimited) fetched at basemap
// init and locked to Europe. Keyless CARTO raster tiles are watermarked
// ("API KEY REQUIRED") since CARTO started requiring keys, so they are
// no longer an option.
const EUROPE_BOUNDS: [number, number, number, number] = [-11, 34, 32, 71];

// OpenTopoMap — zoomed-in topo fallback for everywhere outside CH
// (same recipe as skitourenguru's TOPO_OTM layer). OSM-based, worldwide,
// no white edges at borders. Community-hosted: attribution required,
// self-hosting recommended if traffic grows.
const openTopoStyle = getRasterStyle({
  name: 'opentopo',
  tiles: [
    'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
    'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
  ],
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA) &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  suffix: '',
  maxZoom: 17,
  bounds: EUROPE_BOUNDS,
});

// Raster backup if the OpenFreeMap style fetch fails (Esri gray zone,
// same source family skitourenguru uses as its world fallback).
const esriLightGrayStyle = getRasterStyle({
  name: 'esri-light-gray',
  tiles: [
    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  ],
  attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community',
  suffix: '',
  bounds: EUROPE_BOUNDS,
});

// OpenFreeMap vector style used as the zoomed-out base. Options:
// 'positron' (minimal light), 'liberty' (full OSM look), 'bright'
// (colorful OSM). https://openfreemap.org/quick_start/
const OFM_BASE_STYLE = 'liberty';

/**
 * Fetch the OpenFreeMap base style and lock its sources to Europe.
 * Returns undefined on any failure (network, timeout, bad payload) so
 * callers can fall back to the Esri raster base.
 */
async function fetchOfmVectorBase(): Promise<StyleSpecification | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://tiles.openfreemap.org/styles/${OFM_BASE_STYLE}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    const style = (await res.json()) as StyleSpecification;
    style.name = 'ofm-base';
    for (const source of Object.values(style.sources ?? {})) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (source as any).bounds = EUROPE_BOUNDS;
    }
    return style;
  } catch {
    return undefined;
  }
}

// --- National vector layering (swisstopo LBM + Plan IGN over OFM) ---
// Both services return EMPTY tiles outside their country (verified), so
// layering them over the OFM world base needs no clipping: the data
// boundary IS the border. Their schemas are incompatible with OMT — that
// is fine, one MapLibre style can style many schemas. What must be
// unified: glyphs (single URL per style → rewrite fonts to OFM's Noto)
// and sprites (multi-sprite object, icon references namespaced).

const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

/** Map any fontstack name onto the Noto stacks served by OpenFreeMap. */
function toNotoFont(font: string): string {
  const f = font.toLowerCase();
  if (f.includes('italic')) return 'Noto Sans Italic';
  if (f.includes('bold') || f.includes('semibold') || f.includes('medium'))
    return 'Noto Sans Bold';
  return 'Noto Sans Regular';
}

/**
 * Prefix icon-image references with the style namespace (multi-sprite
 * keys), expression-aware: only VALUE positions are prefixed (icon
 * names), never match/case labels, zoom inputs or stop values.
 */

// operators whose whole expression must stay untouched
const LEAF_OPS = new Set([
  'literal',
  'geometry-type',
  'zoom',
  'heatmap-density',
  'line-progress',
  'collator',
  'format',
  'image',
  'number',
]);

function prefixIconExpr(expr: unknown, ns: string): unknown {
  if (typeof expr === 'string') return `${ns}:${expr}`;
  if (!Array.isArray(expr)) return expr;
  const op = expr[0];
  if (typeof op !== 'string') return expr;
  switch (op) {
    // value-producing leaves: wrap the whole lookup with the prefix
    case 'get':
    case 'to-string':
    case 'coalesce':
      return ['concat', `${ns}:`, expr];
    case 'concat':
      return ['concat', `${ns}:`, ...expr.slice(1)];
    case 'case': {
      // [case, cond, value, cond, value, ..., fallback]: prefix values+fallback
      const out = ['case'];
      for (let i = 1; i < expr.length; i++) {
        const isValue = i % 2 === 0 || i === expr.length - 1;
        out.push(isValue ? prefixIconExpr(expr[i], ns) : expr[i]);
      }
      return out;
    }
    case 'match': {
      // [match, input, label, value, ..., fallback]: prefix values+fallback
      const out = ['match', expr[1]];
      for (let i = 2; i < expr.length; i++) {
        const isValue = i % 2 === 1 || i === expr.length - 1;
        out.push(isValue ? prefixIconExpr(expr[i], ns) : expr[i]);
      }
      return out;
    }
    case 'step': {
      // [step, input, v0, stop1, v1, ...]: prefix values at even idx >= 2
      const out = ['step', expr[1], prefixIconExpr(expr[2], ns)];
      for (let i = 3; i < expr.length; i++) {
        out.push(i % 2 === 1 ? expr[i] : prefixIconExpr(expr[i], ns));
      }
      return out;
    }
    case 'interpolate': {
      // [interpolate, method, input, stop1, v1, ...]: prefix values at odd idx >= 3
      const out = [expr[0], expr[1], expr[2]];
      for (let i = 3; i < expr.length; i++) {
        out.push(i % 2 === 0 ? prefixIconExpr(expr[i], ns) : expr[i]);
      }
      return out;
    }
    default:
      if (LEAF_OPS.has(op)) return expr;
      // unknown operator: prefix via concat unless it uses zoom internally
      if (JSON.stringify(expr).includes('"zoom"')) return expr;
      return ['concat', `${ns}:`, expr];
  }
}

function prefixIcons(style: StyleSpecification, ns: string): void {
  for (const layer of style.layers ?? []) {
    const layout = (layer as { layout?: Record<string, unknown> }).layout;
    if (!layout) continue;
    const icon = layout['icon-image'];
    if (icon === undefined) continue;
    layout['icon-image'] = prefixIconExpr(icon, ns);
  }
}

interface AdaptedNationalStyle {
  style: StyleSpecification;
  /** sprite URL of the original style (for the merged multi-sprite) */
  sprite?: StyleSpecification['sprite'];
}

/**
 * Adapt a fetched national vector style for layering: namespace, source
 * bounds, Noto fonts, namespaced icon references.
 */
function adaptNationalVectorStyle(
  raw: StyleSpecification,
  ns: string,
  bounds: [number, number, number, number]
): AdaptedNationalStyle {
  const sprite = raw.sprite;
  raw.name = ns;
  for (const source of Object.values(raw.sources ?? {})) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (source as any).bounds = bounds;
  }
  for (const layer of raw.layers ?? []) {
    const layout = (layer as { layout?: Record<string, unknown> }).layout;
    if (!layout) continue;
    const font = layout['text-font'];
    if (!Array.isArray(font) || font.length === 0) continue;
    const FONT_EXPR_OPS = new Set(['match', 'case', 'step', 'interpolate', 'coalesce', 'concat', 'let', 'var']);
    const isExpression = typeof font[0] === 'string' && FONT_EXPR_OPS.has(font[0]);
    if (!isExpression) {
      // literal fontstack list → Noto
      layout['text-font'] = font.map(f => (typeof f === 'string' ? toNotoFont(f) : f));
    } else {
      // conditional font expressions (match/case) would keep referencing
      // national fontstacks — flatten to Regular instead
      layout['text-font'] = ['Noto Sans Regular'];
    }
  }
  prefixIcons(raw, ns);
  return { style: raw, sprite };
}

/** Fetch a style JSON with a timeout; undefined on any failure. */
async function fetchJsonStyle(url: string): Promise<StyleSpecification | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return undefined;
    return (await res.json()) as StyleSpecification;
  } catch {
    return undefined;
  }
}

/** swisstopo Leichte Basiskarte vector tiles (empty tiles outside CH+border). */
async function fetchSwisstopoLbm(): Promise<AdaptedNationalStyle | undefined> {
  const raw = await fetchJsonStyle(
    'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json'
  );
  return raw ? adaptNationalVectorStyle(raw, 'stg-lbm', [5.85, 45.72, 10.65, 47.9]) : undefined;
}

/** Plan IGN vector tiles (empty tiles outside France). */
async function fetchPlanIgn(): Promise<AdaptedNationalStyle | undefined> {
  const raw = await fetchJsonStyle(
    'https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/standard.json'
  );
  return raw ? adaptNationalVectorStyle(raw, 'plan-ign', [-5.2, 41.3, 9.7, 51.2]) : undefined;
}

// Border-merged raster from the local MapProxy example stack
// (docker/mapproxy-eu-topo). Demo URL — point it at your VPS in production.
const mapproxyTopoStyle = getRasterStyle({
  name: 'mapproxy-topo',
  tiles: ['http://localhost:8090/mapproxy/tiles/europe_topo/webmercator/{z}/{x}/{y}.png'],
  attribution:
    '&copy; swisstopo &copy; basemap.at &copy; OpenTopoMap (CC-BY-SA) &copy; OpenStreetMap contributors',
  suffix: '',
  maxZoom: 17,
});
function getImageUrl(name: string): string {
  return new URL(`/src/assets/wodore-design/map/switch/${name}`, import.meta.url).href;
}
export const useBasemapStore = defineStore('basemap', () => {
  const mapRef = useMap();
  const overlayStore = useOverlayStore(); // Import overlay store to get layer metadata

  function getBasemap(): BasemapSwitchItem | undefined {
    for (const basemapItem of basemaps) {
      if (basemapItem.active) {
        return <BasemapSwitchItem>(basemapItem as unknown);
      }
    }
    return undefined;
  }

  function setBasemap(s: BasemapSwitchItem, force: boolean = false): boolean {
    const basemapStyle = getBasemap();
    if (basemapStyle !== undefined && s.name == basemapStyle.name && !force) {
      console.debug('Active baselayer is already set.');
      return false;
    }
    /*
     * Use transformStyle to preserve custom layers/sources when switching basemaps
     * @see https://github.com/maplibre/maplibre-gl-js/issues/2587
     * Solution from: https://github.com/maplibre/maplibre-gl-js/issues/2587#issuecomment-1996106037
     *
     * diff:false — MapLibre 6.x silently ABORTS style changes in setStyle({diff:true})
     * between complex composite styles (observed: sprite/layer diffs leave the map
     * on the old style or blank). Full replacement works reliably; overlays are
     * still preserved via transformStyle.
     */
    const applyBasemapStyle = () => {
    //mapRef.map?.style.setState(s.style, {
    mapRef.map?.setStyle(s.style, {
      diff: false,
      transformStyle: (previousStyle, nextStyle) => {
        // Debug input types
        console.debug('[transformStyle] Called with:', {
          previousStyleType: typeof previousStyle,
          nextStyleType: typeof nextStyle,
          previousStyleName: previousStyle?.name,
          nextStyleName: nextStyle?.name,
          nextStyleLayersType: typeof nextStyle?.layers,
          nextStyleLayersIsArray: Array.isArray(nextStyle?.layers),
          nextStyleLayers: Array.isArray(nextStyle?.layers) ? nextStyle.layers.length : 'not-array',
          nextStyleSources: Object.keys(nextStyle?.sources || {}).length,
        });

        // If no previous style, return as-is (first load)
        if (!previousStyle) {
          console.debug('[transformStyle] No previous style, returning nextStyle as-is');
          return nextStyle;
        }

        // If nextStyle is a string (URL), we can't transform it - MapLibre should fetch it first
        // This shouldn't happen, but handle it gracefully
        if (typeof nextStyle === 'string') {
          console.error(
            '[transformStyle] nextStyle is a string URL, cannot transform. Returning as-is.'
          );
          return nextStyle;
        }

        console.debug(
          `[transformStyle] Transforming style for basemap from '${previousStyle?.name}' to '${nextStyle?.name}'`
        );

        // ========================================
        // STEP 1: Preserve custom sources from overlays
        // ========================================
        // Build lookup sets from overlay store to identify overlay layers and sources
        const overlayLayerIds = new Set<string>();
        const overlaySourceIds = new Set<string>();

        for (const overlay of overlayStore.overlays) {
          // Collect layer IDs
          for (const layer of overlay.style.layers) {
            overlayLayerIds.add(layer.id);
            // Also collect sources referenced by layers
            if ('source' in layer && layer.source) {
              overlaySourceIds.add(layer.source as string);
            }
          }
          // Collect source IDs from overlay sources
          for (const sourceId in overlay.style.sources) {
            overlaySourceIds.add(sourceId);
          }
        }

        const customSources = Object.fromEntries(
          Object.entries(previousStyle.sources || {}).filter(([key]) => {
            const isOverlaySource = overlaySourceIds.has(key);
            if (isOverlaySource) {
              console.debug(`[transformStyle] Preserving overlay source: ${key}`);
            }
            return isOverlaySource;
          })
        );
        console.debug(
          `[transformStyle] Preserved ${Object.keys(customSources).length} overlay sources`
        );

        // ========================================
        // STEP 2: Preserve overlay layers (identified from overlay store)
        // ========================================
        // Handle case where layers might not be an array
        const previousLayers = Array.isArray(previousStyle.layers) ? previousStyle.layers : [];
        const customLayers = previousLayers.filter(layer => {
          const isOverlay = overlayLayerIds.has(layer.id);
          if (isOverlay) {
            console.debug(
              `[transformStyle] Preserving overlay layer: ${layer.id} (type: ${layer.type})`
            );
          }
          return isOverlay;
        });

        // Build a simple layer-to-overlay lookup map to avoid type recursion issues
        const layerVisibilityMap: Record<string, 'visible' | 'none'> = {};
        for (const o of overlayStore.overlays) {
          const visibility = o.active ? 'visible' : 'none';
          for (const l of o.style.layers) {
            layerVisibilityMap[l.id] = visibility;
          }
        }

        // Set initial visibility based on overlay store state (deep clone to avoid mutations)
        const customLayersWithVisibility = customLayers.map(layer => {
          const visibility = layerVisibilityMap[layer.id];

          if (visibility !== undefined) {
            console.debug(`[transformStyle] Layer '${layer.id}' visibility set to '${visibility}'`);
            return {
              ...layer,
              layout: {
                ...(layer.layout || {}),
                visibility: visibility as 'visible' | 'none',
              },
            } as import('maplibre-gl').LayerSpecification;
          } else {
            console.warn(
              `[transformStyle] Layer '${layer.id}' not found in any overlay, defaulting to visible`
            );
            return {
              ...layer,
              layout: {
                ...(layer.layout || {}),
                visibility: 'visible' as const,
              },
            } as import('maplibre-gl').LayerSpecification;
          }
        });

        console.debug(
          `[transformStyle] Preserved ${customLayersWithVisibility.length} custom layers`
        );

        // ========================================
        // STEP 3: Preserve sprites
        // ========================================
        // Normalize sprite format to array for easier handling
        type SpriteArrayItem = { id: string; url: string };
        const normalizeSprites = (
          style: import('maplibre-gl').StyleSpecification
        ): SpriteArrayItem[] => {
          if (!style.sprite) return [];
          if (Array.isArray(style.sprite)) {
            return style.sprite;
          }
          // Single string URL becomes default sprite
          return [{ id: 'default', url: style.sprite }];
        };

        const nextSprites = normalizeSprites(nextStyle);
        const previousSprites = normalizeSprites(previousStyle);

        // Filter out sprites that exist in next style (avoid duplicates)
        const customSprites = previousSprites.filter(prevSprite => {
          const isNew = !nextSprites.some(nextSprite => nextSprite.id === prevSprite.id);
          if (isNew) {
            console.debug(
              `[transformStyle] Preserving custom sprite: ${prevSprite.id} from ${prevSprite.url}`
            );
          }
          return isNew;
        });
        console.debug(`[transformStyle] Preserved ${customSprites.length} custom sprites`);

        // ========================================
        // STEP 4: Insert custom layers at correct positions
        // ========================================
        // Build ordered layer array based on basemap's layer configuration
        // Handle case where nextStyle.layers might not be iterable
        const nextLayers = Array.isArray(nextStyle.layers) ? nextStyle.layers : [];
        const orderedLayers = [...nextLayers];

        // Helper to insert layers before a specific layer ID
        function insertLayersBefore(
          layersToInsert: import('maplibre-gl').LayerSpecification[],
          beforeId: string | undefined,
          positionName: string
        ) {
          if (!beforeId) {
            // No insertion point → append at end
            console.debug(
              `[transformStyle] Inserting ${layersToInsert.length} '${positionName}' layers at end (no beforeId)`
            );
            orderedLayers.push(...layersToInsert);
            return;
          }

          const insertIndex = orderedLayers.findIndex(l => l.id === beforeId);
          if (insertIndex === -1) {
            // Layer not found → append at end with warning
            console.warn(
              `[transformStyle] WARNING: Layer '${beforeId}' not found in new style for '${positionName}', appending ${layersToInsert.length} layers at end`
            );
            orderedLayers.push(...layersToInsert);
          } else {
            // Insert at correct position
            console.debug(
              `[transformStyle] Inserting ${layersToInsert.length} '${positionName}' layers before '${beforeId}' (index ${insertIndex})`
            );
            orderedLayers.splice(insertIndex, 0, ...layersToInsert);
          }
        }

        // Get current basemap to find insertion points
        const currentBasemap = getBasemap();
        if (!currentBasemap) {
          console.warn(
            '[transformStyle] No current basemap found, appending all custom layers at end'
          );
          return {
            ...nextStyle,
            sources: { ...nextStyle.sources, ...customSources },
            layers: [...nextStyle.layers, ...customLayers],
            sprite: nextStyle.sprite
              ? [
                  ...(Array.isArray(nextStyle.sprite)
                    ? nextStyle.sprite
                    : [{ id: 'default', url: nextStyle.sprite }]),
                  ...customSprites,
                ]
              : customSprites.length > 0
                ? customSprites
                : undefined,
          };
        }

        // Group custom layers by their onLayer property using overlay store
        // This is generic - reads from overlay definitions instead of hard-coded patterns
        const backgroundLayers: import('maplibre-gl').LayerSpecification[] = [];
        const waysLayers: import('maplibre-gl').LayerSpecification[] = [];
        const otherLayers: import('maplibre-gl').LayerSpecification[] = [];

        // Build a simple layer-to-onLayer lookup map to avoid type recursion issues
        const layerOnLayerMap: Record<string, string> = {};
        for (const o of overlayStore.overlays) {
          for (const l of o.style.layers) {
            layerOnLayerMap[l.id] = o.onLayer || 'other';
          }
        }

        // Use customLayersWithVisibility (already deep-cloned) for layer grouping
        customLayersWithVisibility.forEach(layer => {
          const onLayer = layerOnLayerMap[layer.id];

          if (onLayer === 'background') {
            backgroundLayers.push(layer);
          } else if (onLayer === 'ways') {
            waysLayers.push(layer);
          } else if (onLayer) {
            console.warn(
              `[transformStyle] Unknown onLayer '${onLayer}' for layer '${layer.id}', adding to 'other' group`
            );
            otherLayers.push(layer);
          } else {
            console.warn(
              `[transformStyle] Layer '${layer.id}' not found in any overlay, adding to 'other' group`
            );
            otherLayers.push(layer);
          }
        });

        console.debug(
          `[transformStyle] Layer groups: background=${backgroundLayers.length}, ways=${waysLayers.length}, other=${otherLayers.length}`
        );

        // Insert layers in correct order based on basemap configuration
        // Order: background layers → basemap layers → ways layers → other layers
        insertLayersBefore(backgroundLayers, currentBasemap.layers.background.before, 'background');
        insertLayersBefore(waysLayers, currentBasemap.layers.ways.before, 'ways');
        insertLayersBefore(otherLayers, undefined, 'other');

        // Combine sprites
        const combinedSprites = [...nextSprites, ...customSprites];
        const finalSprite =
          combinedSprites.length > 0
            ? combinedSprites.length === 1 && combinedSprites[0].id === 'default'
              ? combinedSprites[0].url // Single default sprite as string
              : combinedSprites // Multiple sprites as array
            : undefined;

        console.debug(
          `[transformStyle] Style transformation complete: ${orderedLayers.length} layers total, ${Object.keys(customSources).length} custom sources, ${customSprites.length} custom sprites`
        );

        const transformedStyle = <StyleSpecification>{
          ...nextStyle,
          sources: { ...nextStyle.sources, ...customSources },
          layers: orderedLayers,
          sprite: finalSprite,
        };
        console.debug(
          `[transformStyle] Returning transformed style with ${Object.keys(transformedStyle.sources).length} sources, ${transformedStyle.layers.length} layers`,
          transformedStyle
        );

        return transformedStyle;
      },
    });
    };

    if (mapRef.map?.loaded()) {
      applyBasemapStyle();
    } else {
      console.debug('[setBasemap] map not loaded yet — deferring style application to load event');
      mapRef.map?.once('load', applyBasemapStyle);
    }

    // MapLibre 6.x race: a style applied during a pending transition can be
    // dropped silently (map left with an empty/old stylesheet, no error
    // event) — observed intermittently with composite object styles.
    // Verify after 3s and re-apply once if it did not take.
    const expectedStyleName = typeof s.style === 'object' ? s.style.name : undefined;
    setTimeout(() => {
      if (!mapRef.map || !expectedStyleName) return;
      const current = mapRef.map.getStyle();
      // a dropped style can keep its name with ZERO layers — check both
      const ok = current?.name === expectedStyleName && (current?.layers?.length ?? 0) > 0;
      if (ok) return;
      console.warn(
        `[setBasemap] style '${expectedStyleName}' not active (map has '${current?.name}' with ${current?.layers?.length ?? 0} layers) — re-applying once`
      );
      applyBasemapStyle();
    }, 3000);

    // Debug: After setStyle completes, verify the layers/sources are present
    setTimeout(() => {
      if (!mapRef.map) {
        console.warn('[setBasemap] Map not available for debugging');
        return;
      }
      const style = mapRef.map.getStyle();

      // Build lookup set from overlay store for debugging
      const expectedOverlayLayerIds = new Set<string>();
      for (const overlay of overlayStore.overlays) {
        for (const layer of overlay.style.layers) {
          expectedOverlayLayerIds.add(layer.id);
        }
      }

      const overlayLayers = style?.layers?.filter(l => expectedOverlayLayerIds.has(l.id)) || [];

      // Get sources used by overlay layers
      const overlaySourceIds = new Set<string>();
      for (const layer of overlayLayers) {
        if ('source' in layer && layer.source) {
          overlaySourceIds.add(layer.source as string);
        }
      }

      console.debug(
        `[setBasemap] After setStyle completed: ${overlayLayers.length} overlay layers, ${overlaySourceIds.size} overlay sources`
      );
      console.debug(
        `[setBasemap] Overlay layer IDs:`,
        overlayLayers.map(l => l.id)
      );
      console.debug(`[setBasemap] Overlay source IDs:`, Array.from(overlaySourceIds));
    }, 100);

    //const emitter = inject(emitterSymbol)!;
    for (const style of basemaps) {
      if (style.name == s.name) {
        style.active = true;
      } else {
        style.active = false;
      }
    }
    LocalStorage.set('basemapName', s.name);
    console.debug('[setBasemap] Map layer is set to ', s.label);
    return true;
  }

  // Initialize as empty reactive array
  const basemaps = reactive<Array<BasemapSwitchItem>>([]);

  // i18n keys per basemap name — labels are re-applied in place when the
  // UI language changes (styles depend on async GPU detection and are NOT
  // rebuilt, only the labels swap)
  const BASEMAP_LABEL_KEYS: Record<string, string> = {
    'ch-swisstopo-light': 'basemaps.swiss_light',
    'ch-swisstopo-full': 'basemaps.swiss_raster',
    'europe-topo': 'basemaps.europe_topo',
    'europe-vector': 'basemaps.europe_vector',
    'europe-topo-proxy': 'basemaps.europe_topo_proxy',
    'Satellite Hybrid': 'basemaps.satellite',
    'outdoor-osm': 'basemaps.outdoor',
    'oe-vector': 'basemaps.austria_vector',
    'oe-raster': 'basemaps.austria_raster',
  };

  const applyBasemapLabels = () => {
    for (const basemap of basemaps) {
      const key = BASEMAP_LABEL_KEYS[basemap.name];
      if (key) {
        basemap.label = t(key);
      }
    }
  };

  watch(currentLocale, applyBasemapLabels);

  // Cached initialization promise - concurrent callers share one init run,
  // and a failed run resets the cache so the next call can retry
  let basemapInitPromise: Promise<void> | null = null;

  // Get saved basemap name from localStorage (not the full object)
  const savedBasemapName = LocalStorage.getItem('basemapName') as string | null;

  // Helper to get basemap by name
  function getBasemapByName(name: string): BasemapSwitchItem | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const basemap of basemaps as any[]) {
      if (basemap.name === name) {
        return basemap;
      }
    }
    return undefined;
  }

  // Helper to determine if we should use raster basemaps based on GPU capabilities
  function shouldUseRaster(gpuTier: Awaited<ReturnType<typeof getGPUTier>>): boolean {
    if (!gpuTier.gpu) {
      // No GPU info → assume low capability
      return true;
    }

    const gpuName = gpuTier.gpu.toLowerCase();

    // Software / VM renderers → raster
    if (
      gpuName.includes('swiftshader') ||
      gpuName.includes('llvmpipe') ||
      gpuName.includes('software') ||
      gpuName.includes('mesa offscreen') ||
      gpuName.includes('softpipe')
    ) {
      return true;
    }

    // Use raster if tier is less than 1 (tier 0)
    return gpuTier.tier < 1;
  }

  // Async function to initialize basemaps based on GPU tier
  async function runBasemapInit() {
    // Check if we have a cached GPU tier result (valid for 2 days)
    const cachedGpuTier = LocalStorage.getItem('gpuTier');
    const cachedGpuTierTime = LocalStorage.getItem('gpuTierTime') as number | null;
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let gpuTier: Awaited<ReturnType<typeof getGPUTier>>;

    if (cachedGpuTier && cachedGpuTierTime && now - cachedGpuTierTime < twoDaysInMs) {
      // Use cached result
      console.debug('Using cached GPU tier:', cachedGpuTier);
      gpuTier = cachedGpuTier as Awaited<ReturnType<typeof getGPUTier>>;
    } else {
      // Run GPU detection
      gpuTier = await getGPUTier();
      // Cache the result
      LocalStorage.set('gpuTier', gpuTier);
      LocalStorage.set('gpuTierTime', now);
      console.debug('Detected and cached GPU tier:', gpuTier.tier);
    }

    const useRaster = shouldUseRaster(gpuTier);

    // World fallback base: OpenFreeMap vector style (preferred)
    // with the Esri light-gray raster as backup.
    const ofmBase = await fetchOfmVectorBase();

    // Europe topo composite, mirroring skitourenguru's topo mode:
    // clean world base below zoom 8 (positron vector style, Europe-
    // locked), OpenTopoMap as zoomed-in world fallback (z≥8) and
    // swisstopo pixelkarte on top within CH. basemap.at is deliberately
    // NOT part of the composite: its grid serves white no-data tiles
    // over neighboring countries (it blanked eastern CH and hid the
    // fallback at AT's edges) — skitourenguru's topo mode has no
    // basemap.at layer either. Austria is covered by OpenTopoMap.
    const europeTopoStyle = getCompositeRasterStyle({
      name: 'europe-topo',
      styles: [
        // base only below z8 — the national raster layers take over at z8
        // and the base's sources stop fetching (no double loading)
        withLayerMaxZoom(ofmBase ?? esriLightGrayStyle, 8),
        withLayerMinZoom(openTopoStyle, 8),
        withLayerMinZoom(swissTopoRasterStyle, 8),
      ],
    });

    // National vector styles, fetched in parallel
    const [lbm, planIgn] = await Promise.all([fetchSwisstopoLbm(), fetchPlanIgn()]);

    // Vector composite: OFM world base with swisstopo LBM (CH) and
    // Plan IGN (FR) layered on top. No clipping needed — both national
    // services serve EMPTY tiles outside their country (verified); the
    // data boundary is the border. Heterogeneous schemas are styled in
    // one style: single glyphs URL (OFM Noto, fonts rewritten) +
    // multi-sprite object with namespaced icon references.
    const vectorLayers: StyleSpecification[] = [];
    const vectorSprites: { id: string; url: string }[] = [];
    if (ofmBase) {
      prefixIcons(ofmBase, 'ofm-base');
      vectorLayers.push(ofmBase);
      if (typeof ofmBase.sprite === 'string') vectorSprites.push({ id: 'ofm-base', url: ofmBase.sprite });
    }
    for (const adapted of [lbm, planIgn]) {
      if (!adapted) continue;
      vectorLayers.push(adapted.style);
      if (typeof adapted.sprite === 'string')
        vectorSprites.push({ id: adapted.style.name ?? 'ns', url: adapted.sprite });
    }
    const europeVectorStyle =
      vectorLayers.length > 1
        ? getCompositeRasterStyle({
            name: 'europe-vector',
            styles: vectorLayers,
            glyphs: OFM_GLYPHS,
            sprite: vectorSprites,
          })
        : undefined;

    // Raster version of the same idea, but border-MERGED server-side by
    // the MapProxy stack (docker/mapproxy-eu-topo) — polygon-cut national
    // raster maps in one tile source. Single source of tiles: the vector
    // base only serves below z10, from z10 the proxy is the ONLY thing
    // loading.
    const europeTopoProxyStyle = getCompositeRasterStyle({
      name: 'europe-topo-proxy',
      styles: [
        withLayerMaxZoom(ofmBase ?? esriLightGrayStyle, 10),
        withLayerMinZoom(mapproxyTopoStyle, 10),
      ],
    });

    console.debug(
      'GPU Tier detected:',
      gpuTier.tier,
      'GPU:',
      gpuTier.gpu,
      'Using raster:',
      useRaster
    );

    // Populate basemaps array (labels resolved via i18n — see applyBasemapLabels)
    const basemapItems: BasemapSwitchItem[] = [
      {
        name: 'ch-swisstopo-light',
        label: t('basemaps.swiss_light'),
        show: true,
        active: false,
        img: getImageUrl('swiss-vector.png'),
        style: useRaster
          ? swissTopoLbmRasterStyle
          : 'https://api.maptiler.com/maps/ch-swisstopo-lbm/style.json?key=' +
            process.env.WODORE_MAPTILER_API_KEY,
        layers: {
          ways: { before: useRaster ? undefined : 'Other place labels' },
          background: { before: useRaster ? undefined : 'Building line' },
        },
      },
      {
        name: 'ch-swisstopo-full',
        label: t('basemaps.swiss_raster'),
        show: true,
        active: false,
        img: getImageUrl('swiss-raster.png'),
        style: swissTopoRasterStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'europe-topo',
        label: t('basemaps.europe_topo'),
        show: true,
        active: false,
        img: getImageUrl('swiss-raster.png'),
        style: europeTopoStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'europe-vector',
        label: t('basemaps.europe_vector'),
        show: europeVectorStyle !== undefined,
        active: false,
        img: getImageUrl('swiss-vector.png'),
        style: europeVectorStyle ?? esriLightGrayStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'europe-topo-proxy',
        label: t('basemaps.europe_topo_proxy'),
        show: true,
        active: false,
        img: getImageUrl('swiss-raster.png'),
        style: europeTopoProxyStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'Satellite Hybrid',
        label: t('basemaps.satellite'),
        show: true,
        active: false,
        img: getImageUrl('satellite.png'),
        style:
          'https://api.maptiler.com/maps/hybrid/style.json?key=' +
          process.env.WODORE_MAPTILER_API_KEY,
        layers: {
          ways: { before: 'Tunnel' },
          background: { before: 'State labels' },
        },
      },
      {
        name: 'outdoor-osm',
        label: t('basemaps.outdoor'),
        show: false,
        active: false,
        img: getImageUrl('outdoor-v2.png'),
        style:
          'https://api.maptiler.com/maps/outdoor-v2/style.json?key=' +
          process.env.WODORE_MAPTILER_API_KEY,
        layers: {
          background: { before: 'Contour index' },
          ways: { before: 'Park' },
        },
      },
      {
        name: 'oe-vector',
        label: t('basemaps.austria_vector'),
        active: false,
        show: false,
        img: getImageUrl('swiss-vector.png'),
        style: 'styles/basemapv-bmapv-3857-resources-styles-root.json',
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'oe-raster',
        label: t('basemaps.austria_raster'),
        show: false,
        active: false,
        img: getImageUrl('oe-raster.png'),
        style: oeTopoRasterStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
    ];

    // Add all items to the reactive array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (basemaps as any).push(...basemapItems);

    // Determine which basemap to use
    let basemapToSet: BasemapSwitchItem | undefined;

    if (savedBasemapName) {
      // Try to find the saved basemap by name
      basemapToSet = getBasemapByName(savedBasemapName);
      if (basemapToSet) {
        console.debug('Restoring saved basemap:', savedBasemapName);
      } else {
        console.debug('Saved basemap not found, using default');
        // default to the keyless Europe Topo composite — the MapTiler-based
        // first entry breaks the whole session when the API quota is used up
        // (style/tiles/fonts all 403 and later basemap switches render blank)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        basemapToSet = getBasemapByName('europe-topo') ?? (basemaps as any[])[0];
      }
    } else {
      // No saved basemap: same keyless default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      basemapToSet = getBasemapByName('europe-topo') ?? (basemaps as any[])[0];
    }

    // Set the active basemap
    if (basemapToSet) {
      setBasemap(basemapToSet);
    }
  }

  // Share one initialization run across concurrent callers. The catch keeps
  // the returned promise from rejecting unhandled and resets the cache so a
  // failed initialization is retried on the next call.
  function initializeBasemaps(): Promise<void> {
    if (!basemapInitPromise) {
      basemapInitPromise = runBasemapInit().catch(error => {
        basemapInitPromise = null;
        console.error('[basemap-store] Basemap initialization failed:', error);
      });
    }
    return basemapInitPromise;
  }

  // Call initialization immediately
  void initializeBasemaps();

  return {
    basemaps,
    setBasemap,
    getBasemap,
    initializeBasemaps,
    //setEmitter,
  };
});
