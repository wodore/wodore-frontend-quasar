import { StyleSpecification } from 'maplibre-gl';
import { PropertyValueSpecification } from 'maplibre-gl';
import type { OverlayConfig } from '@stores/map/overlay-configs/types';
import type { MapLayerParameter } from '@services/map-catalog';

type LayerOptions = {
  before: string | undefined;
  opacity?: PropertyValueSpecification<number> | undefined;
};
type Layers = {
  ways: LayerOptions;
  background: LayerOptions;
  /** Data overlays (huts) that sit below high-ranked town labels. */
  places?: LayerOptions;
  /** Route overlays (hiking/cycling lines) — above the basemap's ways,
   * below every label/POI layer, below the ways-anchored overlays. */
  routes?: LayerOptions;
};

export type LayerNames = 'ways' | 'background' | 'places' | 'routes';

export type OpacitySpecification = PropertyValueSpecification<number> | undefined | boolean;

export interface BasemapSwitchItem {
  name: string;
  label: string;
  img: string;
  active?: boolean;
  show?: boolean;
  style: StyleSpecification | string;
  layers: Layers;
  /** Auto-switch target on tile/style host failure (catalog `fallback`
   *  field): the slug of the basemap to switch to when this one's host
   *  rejects requests — see WdMapView onMapError. */
  fallback?: string;
  /** Country-scale basemap: tiles only cover one country. When composed
   *  into the map, the DEFAULT basemap (wd-outdoor-base-mtk) is merged
   *  beneath and the country layers stop rendering below
   *  COUNTRY_BASEMAP_MIN_ZOOM (or `countryMinZoom`) or outside `bbox` —
   *  whichever hits first (see country-fallback.ts). Compiled from the
   *  catalog `coverage_bbox` when the layer comes from the backend. */
  countryOnly?: boolean;
  /** Per-basemap zoom floor for the country layers — overrides
   *  COUNTRY_BASEMAP_MIN_ZOOM when the raster needs to hide earlier
   *  (e.g. swisstopo raster: 7). Catalog `fallback_min_zoom`. */
  countryMinZoom?: number;
  /** [west, south, east, north] — tile coverage of the country basemap
   *  (slightly padded beyond the border so border strips stay covered).
   *  Catalog `coverage_bbox`. */
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

  // Backend map catalog (see services/map-catalog.ts): parameter
  // schemas + the tokenized style kept for client-side re-resolution
  // when the user overrides parameters. `catalogSlug` is the backend
  // identity (differs from `name` for aliased slugs). `profile` is the
  // served variant's capability profile ('full' | 'subset', backend
  // #440) — subset rows are Leaflet-servable, full-only rows never
  // render on the fallback map.
  parameters?: MapLayerParameter[];
  tokenizedStyle?: StyleSpecification;
  catalogSlug?: string;
  profile?: string;
  /** Catalog `style_url` the style was compiled from — the LIVE-REFRESH
   *  diff key: the URL is content-versioned (`&v=` token, backend #434),
   *  so an unchanged URL means an unchanged document and a tab-focus
   *  revalidation must NOT re-add the layer (map-catalog-store). */
  styleUrl?: string;

  //registerMapFn?: CallableFunction | undefined;
  //deregisterMapFn?: CallableFunction | undefined;
  //layerUpdateFn?: CallableFunction | undefined;
}
