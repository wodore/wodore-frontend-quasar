import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { DrawCustomMode } from '@mapbox/mapbox-gl-draw';

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

// @ts-expect-error missing types
import * as MapboxDrawWaypoint from 'mapbox-gl-draw-waypoint';
import { IControl } from 'maplibre-gl';
import CustomRouteMode from './customRouteMode';

// drawing -- mapbox-gl-draw: https://github.com/mapbox/mapbox-gl-draw
// patch mode as waypoint -- https://github.com/zakjan/mapbox-gl-draw-waypoint
let modes = MapboxDraw.modes;
modes = MapboxDrawWaypoint.enable(modes);
// @ts-expect-error missing custom route mode
modes.custom_route = CustomRouteMode;

// set correct maplibre styles
(MapboxDraw.constants.classes.CONTROL_BASE as unknown) = 'maplibregl-ctrl';
(MapboxDraw.constants.classes.CONTROL_PREFIX as unknown) = 'maplibregl-ctrl-';
(MapboxDraw.constants.classes.CONTROL_GROUP as unknown) =
  'maplibregl-ctrl-group';
const LINE_COLOR = '#00F';
const POINT_COLOR = '#00A';
const mapDraw = new MapboxDraw({
  displayControlsDefault: false,
  clickBuffer: 10,
  //defaultMode: 'direct_select',
  modes: modes as unknown as {
    [modeKey: string]: DrawCustomMode<unknown, unknown>;
  },
  controls: {
    polygon: false,
    trash: true,
    line_string: true,
    point: true,
    // @ts-expect-error missing custom route mode
    custom_route: true,
  },

  styles: [
    // LINES (and polygon)
    // line active
    {
      id: 'gl-draw-line-active',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': LINE_COLOR,
        'line-dasharray': [0.2, 2],
        'line-width': 4,
      },
    },
    // line inactive
    {
      id: 'gl-draw-line-halo',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#FFF',
        'line-width': 8,
        'line-opacity': 0.4,
      },
    },
    {
      id: 'gl-draw-line',
      type: 'line',
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': LINE_COLOR,
        'line-width': 4,
        'line-opacity': 0.6,
      },
    },
    // points active
    // polygon mid points
    {
      id: 'gl-draw-polygon-midpoint-halo-active',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: {
        'circle-radius': 7,
        'circle-color': '#FFF',
        'circle-opacity': 0.6,
      },
    },
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: {
        'circle-radius': 5,
        'circle-color': LINE_COLOR,
        'circle-opacity': 0.6,
      },
    },
    // vertex point halos
    {
      id: 'gl-draw-polygon-and-line-vertex-halo-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: {
        'circle-radius': 9,
        'circle-color': '#FFF',
      },
    },
    // vertex points
    {
      id: 'gl-draw-polygon-and-line-vertex-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: {
        'circle-radius': 7,
        'circle-color': LINE_COLOR,
      },
    },
    // POINTS
    {
      id: 'points-circle-halo',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
      paint: {
        'circle-radius': 9,
        'circle-color': '#FFF',
        'circle-opacity': 0.6,
      },
    },
    {
      id: 'points-circle-active',
      type: 'circle',
      filter: [
        'all',
        ['==', '$type', 'Point'],
        ['==', 'meta', 'feature'],
        ['==', 'active', 'true'],
      ],
      paint: {
        'circle-radius': 7,
        'circle-color': POINT_COLOR,
      },
    },
    {
      id: 'points-circle-inactive',
      type: 'circle',
      filter: [
        'all',
        ['==', '$type', 'Point'],
        ['==', 'meta', 'feature'],
        ['==', 'active', 'false'],
      ],
      paint: {
        'circle-radius': 7,
        'circle-color': POINT_COLOR,
        'circle-opacity': 0.8,
      },
    },
  ],
});

export default mapDraw as unknown as IControl;
