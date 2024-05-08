import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { getRasterStyle, BasemapSwitchItem } from '@stores/map/styles';
import { useMap } from 'vue-maplibre-gl';
import { LocalStorage } from 'quasar';

const swissTopoRasterStyle = getRasterStyle({
  name: 'swiss-raster',
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
    '<a href="https://www.swisstopo.admin.ch/" target="_blank">&copy; swisstop</a>',
});
const oeLayer: 'geolandbasemap' | 'bmaphidpi' = 'bmaphidpi';
const oeExt: 'png' | 'jpeg' = 'jpeg';
const oeTopoRasterStyle = getRasterStyle({
  name: 'oe-raster',
  tiles: [
    'https://maps1.wien.gv.at/basemap/' +
      oeLayer +
      '/normal/google3857/{z}/{y}/{x}.' +
      oeExt,
    'https://maps2.wien.gv.at/basemap/' +
      oeLayer +
      '/normal/google3857/{z}/{y}/{x}.' +
      oeExt,
    'https://maps3.wien.gv.at/basemap/' +
      oeLayer +
      '/normal/google3857/{z}/{y}/{x}.' +
      oeExt,
  ],
  attribution:
    '<a href="https://www.swisstopo.admin.ch/" target="_blank">&copy; swisstop</a>',
  tileSize: 512,
});
function getImageUrl(name: string): string {
  return new URL(
    `/src/assets/wodore-design/map/switch/${name}`,
    import.meta.url,
  ).href;
}
export const useBasemapStore = defineStore('basemap', () => {
  const mapRef = useMap();

  function getBasemap(): BasemapSwitchItem | undefined {
    for (const style of basemaps) {
      if (style.active) {
        return style as BasemapSwitchItem;
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
    mapRef.map?.setStyle(s.style, { diff: false });
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
      name: 'swiss-vector',
      label: 'Schweiz Topo Vector',
      active: true,
      show: true,
      img: getImageUrl('swiss-vector.png'),
      style:
        'https://api.maptiler.com/maps/ch-swisstopo-lbm-vivid/style.json?key=yYYuZy3hwmMjY087FDvY',
    },
    {
      name: 'swiss-raster',
      label: 'Schweiz Topo Raster',
      show: true,
      img: getImageUrl('swiss-raster.png'),
      style: swissTopoRasterStyle,
    },
    {
      name: 'satellite',
      label: 'Satellite',
      show: true,
      img: getImageUrl('satellite.png'),
      style:
        'https://api.maptiler.com/maps/hybrid/style.json?key=cQX2iET1gmOW38bedbUh',
    },
    {
      name: 'outdoor-osm',
      label: 'Outdoor OSM',
      show: false,
      img: getImageUrl('outdoor-v2.png'),
      style:
        'https://api.maptiler.com/maps/outdoor-v2/style.json?key=yYYuZy3hwmMjY087FDvY',
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
    },
    {
      name: 'oe-raster',
      label: 'Östereich Topo Raster',
      show: true,
      img: getImageUrl('oe-raster.png'),
      style: oeTopoRasterStyle,
    },
  ]);
  // get current base layer from local storage
  const savedBasemap: BasemapSwitchItem = LocalStorage.hasItem('basemapStyle')
    ? (LocalStorage.getItem('basemapStyle') as BasemapSwitchItem)
    : (basemaps[0] as BasemapSwitchItem);
  setBasemap(savedBasemap);

  return {
    basemaps,
    setBasemap,
    getBasemap,
  };
});
