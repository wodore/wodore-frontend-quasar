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
