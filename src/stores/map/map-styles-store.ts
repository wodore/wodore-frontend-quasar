import { defineStore } from 'pinia';

import { ref } from 'vue';
import { getRasterStyle, StyleSwitchItem } from '@components/map/styles';

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

function getImageUrl(name: string): string {
  return new URL(
    `/src/assets/wodore-design/map/switch/${name}`,
    import.meta.url,
  ).href;
}
export const useMapStylesStore = defineStore('map-styles', () => {
  function setActiveStyle(name: string) {
    for (const style of styles.value) {
      if (style.name == name) {
        style.active = true;
      } else {
        style.active = false;
      }
    }
    return undefined;
  }
  const styles = ref<Array<StyleSwitchItem>>([
    {
      name: 'swiss-vector',
      label: 'Topo Vector',
      // icon : { path: mdiRoad },
      active: true,
      img: getImageUrl('swiss-vector.png'),
      style:
        'https://api.maptiler.com/maps/ch-swisstopo-lbm-vivid/style.json?key=yYYuZy3hwmMjY087FDvY',
    },
    {
      name: 'swiss-raster',
      label: 'Topo Raster',
      // icon : { path: mdiRoad },
      img: getImageUrl('swiss-raster.png'),
      style: swissTopoRasterStyle,
    },
    {
      name: 'satellite',
      label: 'Satellite',
      img: getImageUrl('satellite.png'),
      style:
        'https://api.maptiler.com/maps/hybrid/style.json?key=cQX2iET1gmOW38bedbUh',
    },
    {
      name: 'outdoor-osm',
      label: 'Outdoor OSM',
      img: getImageUrl('outdoor-v2.png'),
      style:
        'https://api.maptiler.com/maps/outdoor-v2/style.json?key=yYYuZy3hwmMjY087FDvY',
    },
  ]);
  return { styles, setActiveStyle };
});
