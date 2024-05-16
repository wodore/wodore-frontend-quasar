import { StyleSpecification } from 'maplibre-gl';
import { PropertyValueSpecification } from 'maplibre-gl';

type LayerOptions = {
  before: string | undefined;
  opacity?: PropertyValueSpecification<number> | undefined;
};
type Layers = {
  ways: LayerOptions;
  background: LayerOptions;
};

export type LayerNames = 'ways' | 'background';

export type OpacitySpecification =
  | PropertyValueSpecification<number>
  | undefined
  | boolean;

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
  name: string;
  label: string;
  show?: boolean;
  active?: boolean;
  onLayer?: LayerNames;
  icon: string;
  style: StyleSpecification; //| string;
  opacity?: OpacitySpecification;
  //registerMapFn?: CallableFunction | undefined;
  //deregisterMapFn?: CallableFunction | undefined;
  //layerUpdateFn?: CallableFunction | undefined;
}
