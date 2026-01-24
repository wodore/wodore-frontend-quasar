import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { getRasterStyle } from '@stores/map/utils/raster';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Platform } from 'quasar';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';

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
    LocalStorage.set('basemapStyle', s);
    console.debug('Map layer is set to ', s.label);
    return true;
  }

  const basemaps = reactive<Array<BasemapSwitchItem>>([
    {
      name: 'ch-swisstopo-raster',
      label: 'Schweiz Topo Raster',
      show: true,
      active: true,
      img: getImageUrl('swiss-raster.png'),
      style: swissTopoRasterStyle,
      layers: {
        ways: { before: undefined },
        background: { before: undefined },
      },
    },
    {
      name: 'ch-swisstopo-lbm',
      label: 'Schweiz Topo LBM',
      show: true,
      active: true,
      img: getImageUrl('swiss-vector.png'),
      style: swissTopoLbmRasterStyle,
      layers: {
        ways: { before: undefined },
        background: { before: undefined },
      },
    },

    {
      name: 'CH swisstopo LBM Vivid',
      label: 'Schweiz Topo Vector',
      show: true,
      img: getImageUrl('swiss-vector.png'),
      style:
        'https://api.maptiler.com/maps/ch-swisstopo-lbm/style.json?key=' +
        process.env.WODORE_MAPTILER_API_KEY,
      layers: {
        ways: { before: 'Other place labels' },
        background: { before: 'Building line' },
      },
    },
    {
      name: 'Satellite Hybrid',
      label: 'Satellite',
      show: true,
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
      img: getImageUrl('outdoor-v2.png'),
      style:
        'https://api.maptiler.com/maps/outdoor-v2/style.json?key=' +
        process.env.WODORE_MAPTILER_API_KEY,
      layers: {
        background: { before: 'Contour index' },
        ways: { before: 'Park' },
      },
    },
    // Original does not work due to relativ paths
    // json from https://github.com/trafficon/basemap-at-maplibre/tree/main copied to public folder
    // original: https://www.data.gv.at/katalog/dataset/a73befc7-575f-48cb-8eb9-b05172a8c9e3#additional-info
    // TODO: somehow the huts are not shown anymore, try to update json files
    {
      name: 'oe-vector',
      label: 'Östereich Topo Vector',
      active: true,
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
      img: getImageUrl('oe-raster.png'),
      style: oeTopoRasterStyle,
      layers: {
        ways: { before: undefined },
        background: { before: undefined },
      },
    },
  ]);
  // get current base layer from local storage
  const savedBasemap: BasemapSwitchItem = LocalStorage.hasItem('basemapStyle')
    ? (LocalStorage.getItem('basemapStyle') as BasemapSwitchItem)
    : <BasemapSwitchItem>(basemaps[0] as unknown);
  setBasemap(savedBasemap);

  return {
    basemaps,
    setBasemap,
    getBasemap,
    //setEmitter,
  };
});
