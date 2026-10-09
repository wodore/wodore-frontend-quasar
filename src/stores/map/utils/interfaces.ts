import { StyleSpecification } from 'maplibre-gl';
import { PropertyValueSpecification } from 'maplibre-gl';
import type { OverlayConfig } from '@stores/map/overlay-configs/types';

type LayerOptions = {
  before: string | undefined;
  opacity?: PropertyValueSpecification<number> | undefined;
};
type Layers = {
  ways: LayerOptions;
  background: LayerOptions;
};

export type LayerNames = 'ways' | 'background';

export type OpacitySpecification = PropertyValueSpecification<number> | undefined | boolean;

export interface BasemapSwitchItem {
  name: string;
  label: string;
  img: string;
  active?: boolean;
  show?: boolean;
  style: StyleSpecification | string;
  layers: Layers;
  /** Country-scale basemap: tiles only cover one country. When composed
   *  into the map, the DEFAULT basemap (wd-outdoor-base-mtk) is merged
   *  beneath and the country layers stop rendering below
   *  COUNTRY_BASEMAP_MIN_ZOOM (or `countryMinZoom`) or outside `bbox` —
   *  whichever hits first (see country-fallback.ts). */
  countryOnly?: boolean;
  /** Per-basemap zoom floor for the country layers — overrides
   *  COUNTRY_BASEMAP_MIN_ZOOM when the raster needs to hide earlier
   *  (e.g. swisstopo raster: 7). */
  countryMinZoom?: number;
  /** [west, south, east, north] — tile coverage of the country basemap
   *  (slightly padded beyond the border so border strips stay covered). */
  bbox?: [number, number, number, number];
}

export interface OverlaySwitchItem {
  // Map rendering
  name: string;
  label: string;
  show?: boolean;
  active?: boolean;
  onLayer: LayerNames;
  icon: string;
  style: StyleSpecification; //| string;
  opacity?: OpacitySpecification;

  // Overlay configuration (filters, settings, legend)
  config?: OverlayConfig;

  //registerMapFn?: CallableFunction | undefined;
  //deregisterMapFn?: CallableFunction | undefined;
  //layerUpdateFn?: CallableFunction | undefined;
}
