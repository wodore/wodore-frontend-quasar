import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { getRasterStyle } from '@stores/map/utils/raster';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Platform } from 'quasar';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';
import { getGPUTier } from '@pmndrs/detect-gpu';
import { useOverlayStore } from './overlay-store';
import { StyleSpecification } from 'maplibre-gl';

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
     */
    //mapRef.map?.style.setState(s.style, {
    mapRef.map?.setStyle(s.style, {
      diff: true,
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
        // STEP 1: Preserve custom sources (wd- prefix)
        // ========================================
        const customSources = Object.fromEntries(
          Object.entries(previousStyle.sources || {}).filter(([key]) => {
            const isCustom = key.startsWith('wd-');
            if (isCustom) {
              console.debug(`[transformStyle] Preserving custom source: ${key}`);
            }
            return isCustom;
          })
        );
        console.debug(
          `[transformStyle] Preserved ${Object.keys(customSources).length} custom sources`
        );

        // ========================================
        // STEP 2: Preserve custom layers (wd- prefix) with visibility
        // ========================================
        // Handle case where layers might not be an array
        const previousLayers = Array.isArray(previousStyle.layers) ? previousStyle.layers : [];
        const customLayers = previousLayers.filter(layer => {
          const isCustom = layer.id.startsWith('wd-');
          if (isCustom) {
            console.debug(
              `[transformStyle] Preserving custom layer: ${layer.id} (type: ${layer.type})`
            );
          }
          return isCustom;
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

    // Debug: After setStyle completes, verify the layers/sources are present
    setTimeout(() => {
      if (!mapRef.map) {
        console.warn('[setBasemap] Map not available for debugging');
        return;
      }
      const style = mapRef.map.getStyle();
      const currentLayers = style?.layers?.filter(l => l.id.startsWith('wd-')) || [];
      const currentSources = Object.keys(style?.sources || {}).filter(s => s.startsWith('wd-'));
      console.debug(
        `[setBasemap] After setStyle completed: ${currentLayers.length} custom layers, ${currentSources.length} custom sources`
      );
      console.debug(
        `[setBasemap] Custom layer IDs:`,
        currentLayers.map(l => l.id)
      );
      console.debug(`[setBasemap] Custom source IDs:`, currentSources);
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

  // Flag to track if basemaps have been initialized
  let basemapsInitialized = false;

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
  async function initializeBasemaps() {
    if (basemapsInitialized) {
      return; // Already initialized
    }

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

    console.debug(
      'GPU Tier detected:',
      gpuTier.tier,
      'GPU:',
      gpuTier.gpu,
      'Using raster:',
      useRaster
    );

    // Populate basemaps array
    const basemapItems: BasemapSwitchItem[] = [
      {
        name: 'ch-swisstopo-light',
        label: 'Schweiz Topo Light',
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
        label: 'Schweiz Topo Raster',
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
        name: 'Satellite Hybrid',
        label: 'Satellite',
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
        label: 'Outdoor OSM',
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
        label: 'Östereich Topo Vector',
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
        label: 'Östereich Topo Raster',
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        basemapToSet = (basemaps as any[])[0];
      }
    } else {
      // No saved basemap, use first one as default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      basemapToSet = (basemaps as any[])[0];
    }

    // Set the active basemap
    if (basemapToSet) {
      setBasemap(basemapToSet);
    }

    basemapsInitialized = true;
  }

  // Call initialization immediately
  initializeBasemaps();

  return {
    basemaps,
    setBasemap,
    getBasemap,
    initializeBasemaps,
    //setEmitter,
  };
});
