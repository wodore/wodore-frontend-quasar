import { PropertyValueSpecification } from 'maplibre-gl';
import { getRasterStyle, getSwisstopoOverlay } from './raster';
import { OverlaySwitchItem } from './interfaces';
import { transportStyle } from './overlay-transport';

interface opacityLevelsArgs {
  zoomOut?: number;
  zoomMain?: number;
  zoomIn?: number;
}
export function opacityLevels({
  zoomOut = 0,
  zoomMain = 0.8,
  zoomIn = 0.3,
}: opacityLevelsArgs): PropertyValueSpecification<number> {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    zoomOut,
    11,
    zoomMain * 0.8,
    15,
    zoomMain,
    18,
    zoomIn,
  ];
}

export const skitouren = getSwisstopoOverlay({
  name: 'ch.swisstopo-karto.skitouren',
  label: 'Skitouren',
  icon: 'skitouren',
  opacity: opacityLevels({}),
  minZoom: 8,
});

export const snowshoes = getSwisstopoOverlay({
  name: 'ch.swisstopo.schneeschuhwandern',
  label: 'Schneeschuh',
  icon: 'snowshoeing',
  opacity: opacityLevels({}),
  minZoom: 8,
});

export const hillslope = getSwisstopoOverlay({
  name: 'ch.swisstopo.hangneigung-ueber_30',
  label: 'Hangneigung',
  icon: 'hillslopes',
  onLayer: 'background',
  //opacity: ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 0.2, 20, 0.4],
  opacity: opacityLevels({ zoomOut: 0.1, zoomMain: 0.2, zoomIn: 0.4 }),

  minZoom: 10,
});

export const skislopes: OverlaySwitchItem = {
  name: 'slopes',
  label: 'Skipisten',
  opacity: opacityLevels({ zoomMain: 0.6 }),
  icon: 'skislopes',
  show: true,
  style: getRasterStyle({
    name: 'slopes',
    tiles: ['https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png'],
    minZoom: 8,
  }),
};
export const hiking = getSwisstopoOverlay({
  name: 'ch.swisstopo.swisstlm3d-wanderwege',
  label: 'Wanderwege',
  icon: 'hiking',
  opacity: opacityLevels({ zoomOut: 0.4, zoomMain: 0.9, zoomIn: 0.7 }),
});

//const public_transport_stops = getSwisstopoOverlay({
//  name: 'ch.bav.haltestellen-oev',
//  label: 'Haltestellen',
//  icon: 'fa-solid fa-bus',
//  opacity: ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.8, 20, 0.85],
//});
export const cycling: OverlaySwitchItem = {
  name: 'cycling',
  label: 'Fahrrad',
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: 'cycling',
  show: true,
  style: getRasterStyle({
    name: 'cycling',
    tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
    minZoom: 10,
  }),
};
export const mtb: OverlaySwitchItem = {
  name: 'mtb',
  label: 'Mountainbike',
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: 'mtb',
  show: true,
  style: getRasterStyle({
    name: 'mtb',
    tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
    minZoom: 10,
  }),
};

// const huts: OverlayItem = {
//   name: 'huts-symbol-layer',
//   label: 'Huts', //$t('transport.travel_time'),
//   onLayer: 'ways',
//   show: true,
//   active: true,
//   icon: 'fa-solid fa-house',
//   opacity: false,
//   style: hutsStyle,
//   registerMapFn: hutsRegisterMap,
//   layerUpdateFn: hutsLayerUpdate,
// };

export const public_transport_stops: OverlaySwitchItem = {
  name: 'transport-stops',
  label: 'Haltestellen', //$t('transport.station'),
  onLayer: 'ways',
  show: true,
  active: false,
  icon: 'transport',
  opacity: false,
  style: transportStyle,
  //registerMapFn: transportStopsRegisterMap,
  //registerMapFn: hutsRegisterMap,
  //layerUpdateFn: hutsLayerUpdate,
};
