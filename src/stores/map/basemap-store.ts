import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { getRasterStyle } from '@stores/map/utils/raster';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Platform } from 'quasar';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';
import { getGPUTier } from 'detect-gpu';

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
  //let emitter: Emitter<MglEvents> | undefined = undefined;
  //function setEmitter(em: Emitter<MglEvents>) {
  //  emitter = em;
  //}

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
     * Skip diff as long as Maplibre-GL doesn't fie `style.load` correctly
     * @see https://github.com/maplibre/maplibre-gl-js/issues/2587
     */
    //mapRef.map?.setStyle(s.style, { diff: false });
    mapRef.map?.setStyle(s.style, {
      diff: true,
      // TODO: transformStyle does not work properly
      // Keep all sources and layers with wd- prefix
      // transformStyle: (previousStyle, nextStyle) => {
      //   //console.debug('setStyle (prev, next)', previousStyle, nextStyle);
      //   const custom_layers =
      //     previousStyle !== undefined
      //       ? previousStyle.layers.filter((layer) => {
      //           return layer.id.startsWith('wd-');
      //         })
      //       : [];
      //   const layers = nextStyle.layers.concat(custom_layers);
      //   //console.debug('updated layers', custom_layers, layers);

      //   const sources = nextStyle.sources;
      //   if (previousStyle !== undefined) {
      //     for (const [key, value] of Object.entries(previousStyle.sources)) {
      //       if (key.startsWith('wd-')) {
      //         sources[key] = value;
      //       }
      //     }
      //   }
      //   //console.debug('updated sources', sources);
      //   const newStyle = {
      //     ...nextStyle,
      //     sources: sources,
      //     layers: layers,
      //   };
      //   console.debug('new style', newStyle);
      //   return newStyle;
      // },
    });
    //const emitter = inject(emitterSymbol)!;
    for (const style of basemaps) {
      if (style.name == s.name) {
        style.active = true;
      } else {
        style.active = false;
      }
    }
    LocalStorage.set('basemapName', s.name);
    console.debug('Map layer is set to ', s.label);
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

    const useRaster = gpuTier.tier < 1;

    console.debug('GPU Tier detected:', gpuTier.tier, 'Using raster:', useRaster);

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
