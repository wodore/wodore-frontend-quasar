import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { getRasterStyle } from '@stores/map/utils/raster';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Platform } from 'quasar';
//import type { Emitter } from 'mitt';
import { storageGet, storageSet } from '@services/storage';
import { getGPUTier } from '@pmndrs/detect-gpu';
import { useOverlayStore } from './overlay-store';
import { StyleSpecification } from 'maplibre-gl';
import { i18n, currentLocale } from '@services/locale';
import { getEnv } from '@services/runtimeEnv';
import { OUTDOOR_STYLE_PATH, isOutdoorStyle, setupOutdoorContours } from '@services/outdoorContours';

function mtkStylePath(): string {
  // single style, local names only (a localized variant can return later)
  return 'styles/outdoor-mtk/style.json';
}

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
      return new URL(url, base)
        .href.replaceAll('%7B', '{')
        .replaceAll('%7D', '}');
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

function prewarmOutdoorMtk(): void {
  void fetch(mtkStylePath()).catch(() => undefined);
  for (const u of MTK_STATIC_URLS) void fetch(u, { mode: 'cors' }).catch(() => undefined);
}

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
});

// Keyless plain OSM raster (tile.openstreetmap.org) — style for the weak-GPU
// raster variant of "Switzerland Topo Light". Deliberately NOT MapTiler
// raster tiles: those are key-metered and exhausted the free quota —
// weak-GPU devices must never touch MapTiler.
const osmRasterStyle = getRasterStyle({
  name: 'osm-raster',
  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  attribution:
    '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
  suffix: '',
  // OSM tiles stop at z19 — source maxzoom lets MapLibre overzoom to the
  // app's z20 cap instead of requesting missing tiles
  sourceMaxZoom: 19,
});

const oeLayer: 'geolandbasemap' | 'bmaphidpi' = 'bmaphidpi';
const oeExt: 'png' | 'jpeg' = 'jpeg';
const oeTopoRasterStyle = getRasterStyle({
  name: 'oe-raster',
  tiles: [
    'https://maps1.wien.gv.at/basemap/' + oeLayer + '/normal/google3857/{z}/{y}/{x}.' + oeExt,
    'https://maps2.wien.gv.at/basemap/' + oeLayer + '/normal/google3857/{z}/{y}/{x}.' + oeExt,
    'https://maps3.wien.gv.at/basemap/' + oeLayer + '/normal/google3857/{z}/{y}/{x}.' + oeExt,
  ],
  attribution: 'basemap.at',
  tileSize: 512,
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

  /** Select a basemap. `persist=false` switches without saving the
   * selection — used by the automatic MapTiler-auth fallback so the next
   * session retries the user's chosen basemap instead of starting on the
   * fallback. */
  function setBasemap(s: BasemapSwitchItem, force = false, persist = true): boolean {
    const basemapStyle = getBasemap();
    if (basemapStyle !== undefined && s.name == basemapStyle.name && !force) {
      console.debug('Active baselayer is already set.');
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
    if (s.name === 'outdoor-mtk' && weakGpu) {
      mapRef.map?.once('style.load', () => {
        mapRef.map?.setLayoutProperty('relief_hillshade_ao_med', 'visibility', 'none');
      });
    }
    /*
     * Use transformStyle to preserve custom layers/sources when switching basemaps
     * @see https://github.com/maplibre/maplibre-gl-js/issues/2587
     * Solution from: https://github.com/maplibre/maplibre-gl-js/issues/2587#issuecomment-1996106037
     */
    //mapRef.map?.style.setState(s.style, {
    mapRef.map?.setStyle(s.style, {
      diff: true,
      transformStyle: (previousStyle, nextStyle) => {
        // The returned object loses MapLibre's style-URL context — pin
        // relative glyph/sprite URLs to the style's own URL on every
        // return path (spread: the parsed style object may be frozen)
        const pin = (styleObj: Record<string, unknown>): import('maplibre-gl').StyleSpecification =>
          typeof s.style === 'string'
            ? ({ ...styleObj, ...absoluteStyleAssets(styleObj, s.style) } as import('maplibre-gl').StyleSpecification)
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
    if (persist) {
      storageSet('basemapName', s.name);
    }
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
    'Satellite Hybrid': 'basemaps.satellite',
    'outdoor-mtk': 'basemaps.outdoor',
    'outdoor-osm': 'basemaps.outdoor_ofm',
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

  watch(currentLocale, () => {
  applyBasemapLabels();
});

  // Weak-GPU flag for style-level degradation (set during init)
  let weakGpu = false;

  // Cached initialization promise - concurrent callers share one init run,
  // and a failed run resets the cache so the next call can retry
  let basemapInitPromise: Promise<void> | null = null;

  // Get saved basemap name from localStorage (not the full object)
  const savedBasemapName = storageGet('basemapName') as string | null;

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

    // Populate basemaps array (labels resolved via i18n — see applyBasemapLabels)
    const basemapItems: BasemapSwitchItem[] = [
      {
        // Official free swisstopo Light Base Map (vector) — the visual
        // reference for our outdoor style; also handy as a comparison
        // basemap. No API key, CORS-open tiles/fonts/sprite.
        name: 'ch-swisstopo-light',
        label: t('basemaps.swiss_light'),
        show: true,
        active: false,
        img: getImageUrl('swiss-vector.png'),
        // Weak-GPU raster variant: keyless OSM raster (the vector style
        // needs WebGL anyway; raster fallback keeps weak devices usable)
        style: useRaster
          ? osmRasterStyle
          : 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json',
        layers: {
          ways: { before: useRaster ? undefined : 'Other place labels' },
          background: { before: useRaster ? undefined : 'Building line' },
        },
      },
      {
        name: 'ch-swisstopo-full',
        label: t('basemaps.swiss_raster'),
        show: true, // raster topo stays selectable alongside the outdoor default
        active: false,
        img: getImageUrl('swiss-raster.png'),
        style: swissTopoRasterStyle,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        name: 'Satellite Hybrid',
        label: t('basemaps.satellite'),
        show: true, // raster topo stays selectable alongside the outdoor default
        active: false,
        img: getImageUrl('satellite.png'),
        style:
          'https://api.maptiler.com/maps/hybrid/style.json?key=' +
          getEnv('WODORE_MAPTILER_API_KEY'),
        layers: {
          ways: { before: 'Tunnel' },
          background: { before: 'State labels' },
        },
      },
      {
        // DEFAULT outdoor basemap: Maptoolkit hiking style fork
        // (routes + shields, sac_scale/via ferrata, rock drawing, server
        // contours, bathymetry, AO hillshade). Community License: <= EUR 1M
        // revenue & < 10 FTE — attribution + logo required, no
        // pre-fetch/offline/print use (that's the OFM fallback's job).
        // Built by scripts/style/build-mtk-style.mjs.
        name: 'outdoor-mtk',
        label: t('basemaps.outdoor'),
        show: true,
        active: false,
        img: getImageUrl('outdoor-v2.png'),
        get style() {
          return mtkStylePath();
        },
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
        },
      },
      {
        // Keyless OpenFreeMap outdoor style — the unrestricted fallback
        // (auto-selected when Maptoolkit tiles fail; also the right tiles
        // for any future offline/print feature). Built by
        // scripts/style/build-outdoor-style.mjs — fine-tune in Maputnik
        // and port changes back to the build script.
        name: 'outdoor-osm',
        label: t('basemaps.outdoor_ofm'),
        show: false, // picker: only outdoor default (kept as hidden OFM fallback)
        active: false,
        img: getImageUrl('outdoor-v2.png'),
        style: OUTDOOR_STYLE_PATH,
        layers: {
          ways: { before: undefined },
          background: { before: undefined },
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
      {
        // Keyless OpenFreeMap vector basemap (openfreemap.org). Hidden
        // from the picker — it is the automatic fallback when MapTiler-based
        // basemaps are rejected (suspended/rotated/exhausted key).
        // Liberty style: full-featured vector cartography with labels;
        // glyphs are served keylessly by OpenFreeMap itself
        // (https://tiles.openfreemap.org/fonts/...).
        name: 'openfreemap-liberty',
        label: 'OpenFreeMap Liberty',
        show: false,
        active: false,
        img: getImageUrl('outdoor-v2.png'),
        style: 'https://tiles.openfreemap.org/styles/liberty',
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
        // Saved name unknown (e.g. renamed basemap) — use the fresh-install
        // default too, not the first array entry (which needs a MapTiler key)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        basemapToSet = (basemaps as any[]).find(b => b.name === 'outdoor-mtk');
      }
    } else {
      // No saved basemap: default to the Maptoolkit-based outdoor style
      // (routes/sac/rock/contours). The keyless OpenFreeMap style is the
      // hidden fallback for when Maptoolkit tiles are unreachable.
      // SAFETY: basemaps is a reactive Pinia array of BasemapSwitchItem at
      // runtime; the `unknown` hop only sidesteps the reactive-proxy type
      // mismatch between the store's declaration and the switch API.
      basemapToSet =
        (basemaps as unknown as Array<BasemapSwitchItem>).find(
          b => b.name === 'outdoor-mtk'
        ) || (basemaps as unknown as Array<BasemapSwitchItem>)[0];
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
        const probe = await fetch(basemapToSet.style);
        if (!probe.ok) {
          const fallback = getBasemapByName('openfreemap-liberty');
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
      setBasemap(basemapToSet, false, !sessionFallback);
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
