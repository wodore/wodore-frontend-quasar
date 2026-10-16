import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';
import { Notify } from 'quasar';
import { useEventListener } from '@vueuse/core';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
import { storageGet, storageSet } from '@services/storage';
import { getGPUTier } from '@pmndrs/detect-gpu';
import { useOverlayStore } from './overlay-store';
import { withOverlayMinZoom } from './utils/map-constants';
import {
  withCountryFallback,
  isCenterInBbox,
  COUNTRY_BASEMAP_MIN_ZOOM,
} from './utils/country-fallback';
import { StyleSpecification } from 'maplibre-gl';
import { i18n, currentLocale } from '@services/locale';
import { isOutdoorStyle, setupOutdoorContours } from '@services/outdoorContours';
import {
  absolutizeStyleUrl,
  clearMapCatalogCache,
  fetchMapCatalog,
  gpuSpec,
  loadPersistedLayers,
  type MapCatalogLayer,
  type MapSpecTier,
} from '@services/map-catalog';
import {
  LEGACY_BASEMAP_FALLBACKS,
  RENAMED_BASEMAP_SLUGS,
  mapCatalogBasemap,
} from './utils/catalog-mapping';

/** Compute absolute glyph/sprite URLs for a style, relative to the
 * style's own URL. With setStyle(..., { transformStyle }) MapLibre loses
 * the style-URL context — relative URLs then resolve against the PAGE
 * base and 404 under subpath deploys (PR previews), which silently
 * killed the settlement-dot sprite and left labels at the mercy of the
 * service-worker cache. Non-mutating: the parsed style object may be
 * frozen by MapLibre. */
function absoluteStyleAssets(
  style: { glyphs?: unknown; sprite?: unknown },
  styleUrl: string
): { glyphs?: unknown; sprite?: unknown } {
  let base: URL;
  try {
    base = new URL(styleUrl, document.baseURI);
  } catch {
    return {};
  }
  const abs = (url: string) => {
    try {
      // URL() percent-encodes the {fontstack}/{range} template tokens —
      // MapLibre's style validator requires them verbatim
      return new URL(url, base).href.replaceAll('%7B', '{').replaceAll('%7D', '}');
    } catch {
      return url;
    }
  };
  const out: { glyphs?: unknown; sprite?: unknown } = {};
  if (typeof style.glyphs === 'string') out.glyphs = abs(style.glyphs);
  if (typeof style.sprite === 'string') out.sprite = abs(style.sprite);
  else if (Array.isArray(style.sprite)) {
    out.sprite = style.sprite.map(entry =>
      typeof entry === 'string' ? abs(entry) : { ...entry, url: abs(entry.url) }
    );
  }
  return out;
}

/** Static Maptoolkit endpoints (immutable, CDN-cached) — prefetched at
 * boot so the first map load doesn't pay ~8 serial round-trips. */
const MTK_STATIC_URLS = [
  'https://tiles.maptoolkit.org/mtk.json',
  'https://tiles.maptoolkit.org/contours.json',
  'https://tiles.maptoolkit.org/raster_bathymetry.json',
  'https://tiles.maptoolkit.org/terrainrgb.json',
  'https://tiles.maptoolkit.org/naturalearth.json',
  'https://tiles.maptoolkit.org/rocks.json',
];

/** Probe a style URL's reachability (e.g. a MapTiler-hosted style with
 *  a possibly suspended key). Returns the response, or null on network
 *  errors — callers keep the configured basemap in that case. */
async function probeStyleUrl(styleUrl: string): Promise<Response | null> {
  try {
    return await fetch(styleUrl);
  } catch {
    return null;
  }
}

function prewarmOutdoorMtk(): void {
  for (const u of MTK_STATIC_URLS) void fetch(u, { mode: 'cors' }).catch(() => undefined);
}

/** Fetched default-basemap style object, shared by every country-basemap
 *  composition (cached for the session — the style changes at most when
 *  the backend bumps the layer's `modified`, which revalidates via ETag). */
let defaultStylePromise: Promise<StyleSpecification | null> | null = null;

/** Fetch a style URL into an object (assets resolved against the URL).
 *  Returns null on failure — callers degrade to the unmerged style. */
async function loadStyleObject(styleUrl: string): Promise<StyleSpecification | null> {
  try {
    const res = await fetch(styleUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const styleObj = (await res.json()) as StyleSpecification;
    return {
      ...styleObj,
      ...absoluteStyleAssets(styleObj, styleUrl),
    } as StyleSpecification;
  } catch (error) {
    console.warn(`[basemap] Style fetch failed (${styleUrl}):`, error);
    return null;
  }
}

/** Late-bound accessor for the reactive basemap list (set by the store
 *  once the array exists — loadDefaultStyleObject below reads it). */
let activeBasemapList: () => BasemapSwitchItem[] = () => [];

/** The DEFAULT basemap's style object (wd-outdoor-base-mtk) — the world
 *  fallback merged beneath country basemaps (see country-fallback.ts).
 *  Prefers the active list's style URL (catalog-served after the backend
 *  cutover, Martin-served before it). */
function loadDefaultStyleObject(): Promise<StyleSpecification | null> {
  if (!defaultStylePromise) {
    const source = activeBasemapList().find(b => b.name === DEFAULT_BASEMAP_NAME)?.style;
    const url = typeof source === 'string' && source ? source : '';
    if (!url) return Promise.resolve(null);
    defaultStylePromise = loadStyleObject(url);
  }
  return defaultStylePromise;
}

const t = i18n.global.t;

/** The default world basemap — also the fallback composed beneath
 *  country basemaps (see country-fallback.ts). Backend PR #292 moved
 *  the default to the hill variant (client raster-dem relief, per
 *  user decision); the fallback is its OpenFreeMap twin. */
const DEFAULT_BASEMAP_NAME = 'wd-outdoor-base-mtk-hill';

// Keyless plain OSM raster (tile.openstreetmap.org) — style for the weak-GPU
// raster variant of "Switzerland Topo Light". Deliberately NOT MapTiler
// raster tiles: those are key-metered and exhausted the free quota —
// weak-GPU devices must never touch MapTiler.
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

  /** Resolve once the MglMap component has registered its MapLibre
   *  instance in the vue-maplibre-gl registry (mapRef.map). The store
   *  initializes during page setup — before MglMap mounts — so a startup
   *  setBasemap call would otherwise find no map and silently no-op:
   *  the default basemap stayed "selected" while the map kept the empty
   *  initial style (blank map until a manual basemap switch). */
  function waitForMap(timeoutMs = 15_000): Promise<boolean> {
    if (mapRef.map) return Promise.resolve(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    return new Promise(resolve => {
      const stop = watch(
        () => mapRef.map,
        map => {
          if (!map) return;
          if (timer !== undefined) clearTimeout(timer);
          stop();
          resolve(true);
        },
        { immediate: true }
      );
      timer = setTimeout(() => {
        stop();
        resolve(false);
      }, timeoutMs);
    });
  }

  // ── Country basemap bbox visibility ─────────────────────────────────
  // Layer ids of the ACTIVE merged country style; a moveend watcher flips
  // visibility between the country raster (inside the bbox at country
  // zoom) and the default world fallback (everything else). See
  // country-fallback.ts.
  let countryLayerIds: string[] = [];
  let fallbackLayerIds: string[] = [];
  let countryBbox: [number, number, number, number] | undefined;
  let countryMinZoom = COUNTRY_BASEMAP_MIN_ZOOM;
  let lastCountryVisible: boolean | undefined;
  let lastFallbackVisible: boolean | undefined;
  let countryWatcherRegistered = false;

  function registerCountryVisibilityWatcher(): void {
    if (countryWatcherRegistered) return;
    countryWatcherRegistered = true;
    mapRef.map?.on('moveend', syncCountryFallbackVisibility);
  }

  function syncCountryFallbackVisibility(): void {
    const map = mapRef.map;
    if (!map || countryBbox === undefined) return;
    if (countryLayerIds.length === 0 && fallbackLayerIds.length === 0) return;
    const center = map.getCenter();
    const inBbox = isCenterInBbox([center.lng, center.lat], countryBbox);
    const countryVisible = inBbox;
    const fallbackVisible = !inBbox || map.getZoom() < countryMinZoom;
    if (countryVisible !== lastCountryVisible) {
      for (const id of countryLayerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', countryVisible ? 'visible' : 'none');
        }
      }
      lastCountryVisible = countryVisible;
    }
    if (fallbackVisible !== lastFallbackVisible) {
      for (const id of fallbackLayerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', fallbackVisible ? 'visible' : 'none');
        }
      }
      lastFallbackVisible = fallbackVisible;
    }
  }

  /** Select a basemap. `persist=false` switches without saving the
   * selection — used by the automatic MapTiler-auth fallback so the next
   * session retries the user's chosen basemap instead of starting on the
   * fallback. */
  // Anchors of the basemap currently being applied — transformStyle runs
  // during setStyle, before the active flags flip, so getBasemap() would
  // still return the PREVIOUS basemap there (see setBasemap).
  let composingLayers: BasemapSwitchItem['layers'] | undefined;

  async function setBasemap(s: BasemapSwitchItem, force = false, persist = true): Promise<boolean> {
    const basemapStyle = getBasemap();
    if (basemapStyle !== undefined && s.name == basemapStyle.name && !force) {
      console.debug('Active baselayer is already set.');
      return false;
    }
    // Startup path: the map may not be mounted yet (the store initializes
    // before MglMap) — wait for it, otherwise every mapRef.map? call below
    // silently no-ops and the selected basemap never loads.
    if (!(await waitForMap())) {
      console.warn('[basemap-store] No map instance registered — basemap not applied:', s.name);
      return false;
    }
    // The outdoor basemap needs the dem-contour:// protocol registered
    // before MapLibre starts requesting contour tiles.
    if (isOutdoorStyle(s.style)) {
      setupOutdoorContours();
    }
    // Weak GPUs: drop the second ambient-occlusion pass after the style
    // loads (the heavy ao_max/dramatic passes are already removed from
    // the built style for everyone).
    if (s.name === DEFAULT_BASEMAP_NAME && weakGpu) {
      mapRef.map?.once('style.load', () => {
        mapRef.map?.setLayoutProperty('relief_hillshade_ao_med', 'visibility', 'none');
      });
    }

    // Country basemaps (CH/AT raster): compose the DEFAULT world basemap
    // beneath the country layers and gate the country layers by zoom +
    // bounding box — zooming out past country scale or panning outside
    // the bbox shows the default world map instead of blank space / open
    // ocean (see country-fallback.ts)
    let styleForMap: StyleSpecification | string = s.style;
    if (s.countryOnly) {
      const country = typeof s.style === 'string' ? await loadStyleObject(s.style) : s.style;
      const fallback = await loadDefaultStyleObject();
      if (country && fallback) {
        styleForMap = withCountryFallback(country, fallback, s.countryMinZoom);
        countryLayerIds = country.layers.map(l => l.id);
        fallbackLayerIds = fallback.layers.map(l => l.id);
        countryBbox = s.bbox;
        countryMinZoom = s.countryMinZoom ?? COUNTRY_BASEMAP_MIN_ZOOM;
        lastCountryVisible = undefined; // force re-apply after the swap
        lastFallbackVisible = undefined;
        registerCountryVisibilityWatcher();
        if (mapRef.map) {
          mapRef.map.once('style.load', syncCountryFallbackVisibility);
        }
      } else if (country) {
        // Fallback style unavailable (fetch failed) — country tiles alone
        styleForMap = country;
        countryLayerIds = [];
        fallbackLayerIds = [];
        countryBbox = undefined;
        countryMinZoom = COUNTRY_BASEMAP_MIN_ZOOM;
      }
    } else {
      countryLayerIds = [];
      fallbackLayerIds = [];
      countryBbox = undefined;
      countryMinZoom = COUNTRY_BASEMAP_MIN_ZOOM;
    }
    /*
     * Use transformStyle to preserve custom layers/sources when switching basemaps
     * @see https://github.com/maplibre/maplibre-gl-js/issues/2587
     * Solution from: https://github.com/maplibre/maplibre-gl-js/issues/2587#issuecomment-1996106037
     */
    // transformStyle runs DURING setStyle — before the active flags below
    // flip — so it must resolve anchors from the basemap being APPLIED,
    // not from getBasemap() (still the previous one at that moment).
    composingLayers = s.layers;
    //mapRef.map?.style.setState(s.style, {
    mapRef.map?.setStyle(styleForMap, {
      diff: true,
      transformStyle: (previousStyle, nextStyle) => {
        // The returned object loses MapLibre's style-URL context — pin
        // relative glyph/sprite URLs to the style's own URL on every
        // return path (spread: the parsed style object may be frozen)
        const pin = (
          styleObj: Record<string, unknown>
        ): import('maplibre-gl').StyleSpecification =>
          typeof s.style === 'string'
            ? ({
                ...styleObj,
                ...absoluteStyleAssets(styleObj, s.style),
              } as import('maplibre-gl').StyleSpecification)
            : (styleObj as import('maplibre-gl').StyleSpecification);
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
          return pin(nextStyle as Record<string, unknown>);
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

          // Far zoomed-out view: clamp overlay layers to the zoom floor (see
          // map-constants.ts — same clamp as addOverlayLayer at runtime)
          layer = withOverlayMinZoom(layer) as typeof layer;

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

        // Get current basemap to find insertion points. transformStyle
        // runs during setStyle, before the active flags flip — use the
        // basemap being applied when set.
        const activeBasemap = getBasemap();
        const currentBasemap: BasemapSwitchItem | undefined = composingLayers
          ? ({ ...(activeBasemap ?? {}), layers: composingLayers } as BasemapSwitchItem)
          : activeBasemap;
        if (!currentBasemap) {
          console.warn(
            '[transformStyle] No current basemap found, appending all custom layers at end'
          );
          // Same composition as the main path below (pinned asset
          // URLs) — this branch is the
          // FIRST-apply path during startup (no active flags yet), so it
          // must not diverge from later basemap switches. The DEFAULT
          // outdoor basemap is the world fallback; no raster underlay.
          const fallbackComposed: StyleSpecification = {
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
          // SAFETY: fallbackComposed is our own StyleSpecification-typed
          // object built above; the unknown hop only widens it to pin's
          // record shape (same as the main path below).
          return pin(fallbackComposed as unknown as Record<string, unknown>);
        }

        // Group custom layers by their onLayer property using overlay store
        // This is generic - reads from overlay definitions instead of hard-coded patterns
        const backgroundLayers: import('maplibre-gl').LayerSpecification[] = [];
        const routesLayers: import('maplibre-gl').LayerSpecification[] = [];
        const waysLayers: import('maplibre-gl').LayerSpecification[] = [];
        const placesLayers: import('maplibre-gl').LayerSpecification[] = [];
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
          } else if (onLayer === 'routes') {
            routesLayers.push(layer);
          } else if (onLayer === 'ways') {
            waysLayers.push(layer);
          } else if (onLayer === 'places') {
            placesLayers.push(layer);
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
        // Order: background layers → basemap layers → routes layers (under
        // ALL labels/POIs when the basemap declares an anchor) → ways
        // layers → places layers (under high-ranked town labels) → other
        // layers (always on top)
        insertLayersBefore(backgroundLayers, currentBasemap.layers.background.before, 'background');
        insertLayersBefore(routesLayers, currentBasemap.layers.routes?.before, 'routes');
        insertLayersBefore(waysLayers, currentBasemap.layers.ways.before, 'ways');
        insertLayersBefore(placesLayers, currentBasemap.layers.places?.before, 'places');
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

        // The DEFAULT outdoor basemap is the world fallback; country
        // basemaps compose it beneath their layers (country-fallback.ts).
        // No raster underlay — wd-outdoor is the single gap-filler.
        const transformedStyle: StyleSpecification = {
          ...nextStyle,
          sources: { ...nextStyle.sources, ...customSources },
          layers: orderedLayers,
          sprite: finalSprite,
        };
        console.debug(
          `[transformStyle] Returning transformed style with ${Object.keys(transformedStyle.sources).length} sources, ${transformedStyle.layers.length} layers`,
          transformedStyle
        );

        // SAFETY: transformedStyle is our own StyleSpecification-typed
        // object built above — the unknown hop only widens it to the
        // open record shape pin() spreads.
        return pin(transformedStyle as unknown as Record<string, unknown>);
      },
    });

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
    // Record the applied style source: refreshFromCatalog re-applies only
    // when it actually changes — a redundant setStyle at boot would
    // restart every tile load (mtk carries nine sources; on a slow link
    // that alone can exceed the interaction suite's map-idle budget).
    activeStyleUrl = s.style;
    if (persist) {
      storageSet('basemapName', s.name);
    }
    console.debug('[setBasemap] Map layer is set to ', s.label);
    return true;
  }

  // Initialize as empty reactive array
  const basemaps = reactive<Array<BasemapSwitchItem>>([]);
  // Bind the late-bound accessor (loadDefaultStyleObject reads the list).
  // SAFETY: basemaps is the reactive BasemapSwitchItem[] just declared;
  // the widened cast breaks the maplibre-style TS2589 recursion — reading
  // .name/.style only via the accessor.
  activeBasemapList = () => basemaps as unknown as BasemapSwitchItem[];

  // i18n keys per basemap name — labels are re-applied in place when the
  // UI language changes (styles depend on async GPU detection and are NOT
  // rebuilt, only the labels swap)
  const BASEMAP_LABEL_KEYS: Record<string, string> = {
    'ch-swisstopo-light': 'basemaps.swiss_light',
    'ch-swisstopo-full': 'basemaps.swiss_raster',
    'Satellite Hybrid': 'basemaps.satellite',
    'wd-outdoor-base-mtk': 'basemaps.outdoor',
    'outdoor-osm': 'basemaps.outdoor_ofm',
    // Catalog identities (renamed slugs — see RENAMED_BASEMAP_SLUGS)
    'wd-outdoor-base-ofm': 'basemaps.outdoor_ofm',
    'maptiler-hybrid': 'basemaps.satellite',
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

  watch(currentLocale, () => {
    applyBasemapLabels();
  });

  // Weak-GPU flag for style-level degradation (set during init)
  let weakGpu = false;

  /** Resolves once GPU detection settled, with the wanted catalog tier —
   *  the map-catalog store awaits it so overlays + basemaps share ONE
   *  layers fetch with the correct `?spec=` (no early high-spec fetch
   *  racing the detector on weak devices). */
  let resolveGpuSpec: (tier: MapSpecTier) => void = () => {};
  const gpuSpecReady = new Promise<MapSpecTier>(resolve => {
    resolveGpuSpec = resolve;
  });

  // Cached initialization promise - concurrent callers share one init run,
  // and a failed run resets the cache so the next call can retry
  let basemapInitPromise: Promise<void> | null = null;

  // Get saved basemap name from localStorage (not the full object),
  // normalized through the rename table (catalog identities: e.g. the
  // old 'outdoor-osm' selection is 'wd-outdoor-base-ofm' in the catalog).
  const savedBasemapName = (() => {
    const raw = storageGet('basemapName') as string | null;
    return raw ? (RENAMED_BASEMAP_SLUGS[raw] ?? raw) : null;
  })();

  /** Resolve a basemap by slug, accepting the pre-catalog alias names
   *  (factory 'outdoor-osm' vs catalog 'wd-outdoor-base-ofm'). */
  function findBasemapBySlug(slug: string): BasemapSwitchItem | undefined {
    const alias = RENAMED_BASEMAP_SLUGS[slug] ?? slug;
    // SAFETY: basemaps is the reactive BasemapSwitchItem[] populated during
    // init; the widened cast breaks the TS2589 recursion — reading .name only.
    return (
      (basemaps as unknown as BasemapSwitchItem[]).find(
        b => b.name === slug || b.name === alias || RENAMED_BASEMAP_SLUGS[b.name] === slug
      ) ?? undefined
    );
  }

  /** Resolve the auto-switch target for a failing basemap: its catalog
   *  `fallback` field first, then the legacy defaults. */
  function resolveFallbackBasemap(failingSlug: string): BasemapSwitchItem | undefined {
    const active = getBasemap();
    const target =
      active?.fallback ??
      LEGACY_BASEMAP_FALLBACKS[failingSlug] ??
      LEGACY_BASEMAP_FALLBACKS.maptiler;
    return findBasemapBySlug(target);
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
    return gpuTier.tier < 2; // tier 2+: full vector; tier 0-1: weak-GPU path (user call)
  }

  // Async function to initialize basemaps based on GPU tier

  /**
   * Compile the RESOLVED layers response (backend #331 `/v1/map/layers`)
   * into switch items: one basemap layer per slug, style URL = the
   * entry's `style_url` (served spec already embedded) absolutized
   * against the API origin — root-relative URLs must never resolve
   * against the page origin (#285). Hidden fallbacks (show=false) stay
   * in the list — the picker filters them, the fallback chain resolves
   * them. Keeps the ACTIVE selection; re-applies only when its style
   * URL changed; labels re-localize via applyBasemapLabels.
   */
  function refreshFromLayers(layers: MapCatalogLayer[]): void {
    const entries = layers
      .filter(layer => layer.role === 'basemap')
      .sort((a, b) => a.order - b.order);
    catalogDefaultSlug = entries.find(l => l.is_default)?.slug ?? DEFAULT_BASEMAP_NAME;
    const items = entries.map(layer =>
      mapCatalogBasemap(layer, layer.style_url ? absolutizeStyleUrl(layer.style_url) : '', slug =>
        localBasemapThumb(slug)
      )
    );
    // Keep the ACTIVE selection across the refresh (same slug stays on).
    const activeName = getBasemap()?.name;
    // SAFETY: basemaps is the reactive BasemapSwitchItem[] above; splice
    // keeps the array identity — the TS2589-breaking widened cast matches
    // the other casts in this file.
    (basemaps as unknown as BasemapSwitchItem[]).splice(0, basemaps.length, ...items);
    if (activeName) {
      // SAFETY: basemaps is the reactive BasemapSwitchItem[] spliced above;
      // the widened cast breaks the TS2589 recursion — reading .name/.style only.
      const active = (basemaps as unknown as BasemapSwitchItem[]).find(b => b.name === activeName);
      if (active) {
        active.active = true;
        // Style URL change (spec/variant switch) → re-apply so the map
        // renders the new document; metadata-only changes keep the map.
        if (active.style !== activeStyleUrl) {
          activeStyleUrl = active.style;
          void setBasemap(active, true);
        }
      }
    }
    applyBasemapLabels();
  }

  /** Style source of the currently applied basemap (refresh bookkeeping;
   *  catalog items carry URL strings — the union only matches
   *  BasemapSwitchItem['style']). */
  let activeStyleUrl: BasemapSwitchItem['style'] | undefined;

  /** The catalog's `is_default` basemap slug (set by refreshFromCatalog;
   *  backend PR #292 seed: wd-outdoor-base-mtk-hill). */
  let catalogDefaultSlug: string | undefined;

  /** Resolve the default basemap: the catalog's is_default entry, else
   *  the compile-time DEFAULT_BASEMAP_NAME. */
  function findDefaultBasemap(): BasemapSwitchItem | undefined {
    return findBasemapBySlug(catalogDefaultSlug ?? DEFAULT_BASEMAP_NAME);
  }

  /** Local thumbnails by slug (the seed carries no preview URLs yet). */
  function localBasemapThumb(slug: string): string | undefined {
    const thumbs: Record<string, string> = {
      'ch-swisstopo-light': getImageUrl('swiss-vector.png'),
      'ch-swisstopo-full': getImageUrl('swiss-raster.png'),
      'maptiler-hybrid': getImageUrl('satellite.png'),
      'wd-outdoor-base-mtk': getImageUrl('outdoor-v2.png'),
      'wd-outdoor-base-mtk-hill': getImageUrl('outdoor-v2.png'),
      'wd-outdoor-base-ofm': getImageUrl('outdoor-v2.png'),
      'wd-outdoor-base-ofm-hill': getImageUrl('outdoor-v2.png'),
      'mtk-outdoor': getImageUrl('outdoor-v2.png'),
      'openfreemap-liberty': getImageUrl('outdoor-v2.png'),
      'oe-raster': getImageUrl('oe-raster.png'),
      'world-topo': getImageUrl('swiss-raster.png'),
      'world-satellite-hybrid': getImageUrl('satellite.png'),
    };
    return thumbs[slug];
  }

  /** Fetch the RESOLVED layers catalog and rebuild the basemap list.
   *  Keeps the active selection; re-applies only when the style URL
   *  changed. `revalidate` drops the in-session promise cache first so
   *  the fetch is a true conditional GET (the browser revalidates the
   *  server ETag — cheap when unchanged). Failures log and keep current
   *  state. The service dedupes concurrent callers (overlay compile +
   *  picker) onto ONE request per (lang, spec). */
  async function refreshLayers(options: { revalidate?: boolean } = {}): Promise<MapCatalogLayer[]> {
    try {
      if (options.revalidate) clearMapCatalogCache();
      const { data } = await fetchMapCatalog(currentLocale(), gpuSpec(weakGpu));
      refreshFromLayers(data);
      return data;
    } catch (error) {
      console.warn('[basemap-store] basemap catalog refresh failed:', error);
      return [];
    }
  }

  async function runBasemapInit() {
    // Check if we have a cached GPU tier result (valid for 2 days)
    const cachedGpuTier = storageGet('gpuTier');
    const cachedGpuTierTime = storageGet('gpuTierTime') as number | null;
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
      storageSet('gpuTier', gpuTier);
      storageSet('gpuTierTime', now);
      console.debug('Detected and cached GPU tier:', gpuTier.tier);
    }

    const useRaster = shouldUseRaster(gpuTier);
    weakGpu = useRaster;
    // Unblocks the map-catalog store's layers fetch (one shared request
    // with the correct spec — see gpuSpecReady).
    resolveGpuSpec(gpuSpec(useRaster));

    // GPU + optimization status (user-facing console diagnostics)
    {
      const gl = document.createElement('canvas').getContext('webgl2');
      const renderer = gl?.getExtension('WEBGL_debug_renderer_info');
      const gpuName = renderer
        ? String(gl!.getParameter(renderer.UNMASKED_RENDERER_WEBGL))
        : gpuTier.gpu || 'unknown';
      console.info(
        `[perf] GPU: ${gpuName} | tier: ${gpuTier.tier} | fps: ${gpuTier.fps || 'n/a'} | ` +
          `weak: ${weakGpu} | ` +
          `optimizations: ${[
            'ao_max+dramatic removed (all)',
            weakGpu ? 'ao_med hidden (weak GPU)' : 'ao_med active',
            weakGpu ? 'raster basemap (weak GPU)' : 'vector basemap',
            'local glyphs/sprites (SW-cacheable)',
            'boot prefetch (style + TileJSONs)',
          ].join(', ')}`
      );
      if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }

    // Warm the HTTP cache for the default basemap's static assets
    prewarmOutdoorMtk();

    console.debug(
      'GPU Tier detected:',
      gpuTier.tier,
      'GPU:',
      gpuTier.gpu,
      'Using raster:',
      useRaster
    );

    // ── Backend map layers (backend #331 — resolved `/v1/map/layers`) ─
    // Cache-first: the persisted layers snapshot renders instantly; a
    // cold first run awaits the network (explicit loading state
    // upstream) — there are NO bundled factory basemaps anymore.
    const cachedLayers = loadPersistedLayers();
    if (cachedLayers) {
      refreshFromLayers(cachedLayers.data);
      // Warm boot: refresh in the background — the server ETag makes it
      // a cheap conditional GET; metadata/style changes flow through
      // (the active selection is kept; a changed style URL re-applies
      // with force). Dedupes with the overlay store's fetch.
      void refreshLayers();
    } else {
      // Cold first run: await the network so the map has a style at all.
      // (The map-catalog store persists the shared snapshot.)
      const layers = await refreshLayers();
      if (layers.length === 0) {
        console.error('[basemap-store] map layers unavailable — no basemaps');
        Notify.create({
          type: 'negative',
          position: 'bottom',
          message: t('basemaps.load_error'),
          timeout: 4000,
        });
        return;
      }
    }

    // Determine which basemap to use
    let basemapToSet: BasemapSwitchItem | undefined;

    if (savedBasemapName) {
      // Try to find the saved basemap by name (renames normalized above)
      basemapToSet = findBasemapBySlug(savedBasemapName);
      if (basemapToSet) {
        console.debug('Restoring saved basemap:', savedBasemapName);
      } else {
        console.debug('Saved basemap not found, using default');
        // Saved name unknown (e.g. renamed basemap) — use the catalog's
        // default flag, falling back to the compile-time default slug.
        basemapToSet = findDefaultBasemap();
      }
    } else {
      // No saved basemap: the catalog's is_default (backend PR #292 seed:
      // wd-outdoor-base-mtk-hill — client relief variant). The keyless
      // OpenFreeMap style is the hidden fallback for when Maptoolkit
      // tiles are unreachable.
      // SAFETY: basemaps is a reactive Pinia array of BasemapSwitchItem at
      // runtime; the `unknown` hop only sidesteps the reactive-proxy type
      // mismatch between the store's declaration and the switch API.
      basemapToSet = findDefaultBasemap() || (basemaps as unknown as Array<BasemapSwitchItem>)[0];
    }

    // A MapTiler-based basemap with a rejected key (suspended/exhausted)
    // would 403 during the FIRST style load — MapLibre then never fires its
    // 'load' event and the map stays blank; switching styles mid-load
    // dead-ends too. Probe the style URL up front and start directly on
    // the keyless fallback when the host rejects it.
    let sessionFallback = false;
    if (
      basemapToSet &&
      typeof basemapToSet.style === 'string' &&
      basemapToSet.style.includes('api.maptiler.com')
    ) {
      try {
        const probe = await probeStyleUrl(basemapToSet.style);
        if (probe && !probe.ok) {
          const fallback = findBasemapBySlug('openfreemap-liberty');
          if (fallback) {
            console.warn(
              `[basemap] Tile host rejected the style (HTTP ${probe.status}) - starting on OpenFreeMap Liberty`
            );
            basemapToSet = fallback;
            sessionFallback = true;
          }
        }
      } catch {
        // Network error: keep the configured basemap; the onMapError
        // fallback in WdMapView handles failures once the map is up
      }
    }

    // Set the active basemap. A startup fallback is session-only (not
    // persisted) so the next session retries the user's chosen basemap.
    if (basemapToSet) {
      void setBasemap(basemapToSet, false, !sessionFallback);
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

  // Long-lived tabs: the boot fetch's in-session promise would keep
  // serving stale data — one conditional GET per tab focus (the server
  // ETag makes it a 304 when nothing changed; the browser revalidates
  // automatically). Applies via the splice path, keeping the selection.
  useEventListener(document, 'visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!basemapInitPromise) return; // still booting — the init fetch is fresh
    void refreshLayers({ revalidate: true });
  });

  return {
    basemaps,
    setBasemap,
    getBasemap,
    initializeBasemaps,
    gpuSpecReady,
    findBasemapBySlug,
    resolveFallbackBasemap,
    //setEmitter,
  };
});
