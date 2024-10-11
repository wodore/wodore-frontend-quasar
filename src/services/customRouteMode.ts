/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { DrawCustomMode } from '@mapbox/mapbox-gl-draw';
import axios from 'axios';
import {
  Feature,
  LineString,
  Point,
  FeatureCollection,
  GeoJSON,
} from 'geojson';
import polyline from '@mapbox/polyline';
import { Map } from 'maplibre-gl'; // or 'mapbox-gl' if using Mapbox

async function getRouteValhalla(coordinates: [number, number][]) {
  try {
    const response = await axios.post(
      'https://valhalla1.openstreetmap.de/route',
      {
        locations: coordinates.map((coord) => ({
          lat: coord[1],
          lon: coord[0],
          type: 'through',
        })),
        costing: 'pedestrian',
        costing_options: {
          pedestrian: {
            walking_speed: 5.1, // walking speed in km/h
            use_hills: 0.9,
            use_ferry: 0, // avoid ferry routes
            max_hiking_difficulty: 6, // hiking difficulty level
          },
        },
        elevation_interval: 30,
        units: 'kilometers',
        shape_format: 'polyline6', // request polyline6 format
        directions_type: 'none',
      },
    );
    const route = response.data;
    return route;
  } catch (error) {
    console.error('Error fetching route from Valhalla:', error);
  }
}
function displayRoute(route: any, map: Map) {
  const allCoordinates: [number, number][] = [];
  //const elevations: number[] = [];

  // Iterate over all legs and decode each leg's shape
  route.trip.legs.forEach((leg: any) => {
    const decodedCoordinates = polyline.decode(leg.shape, 6);
    //console.log('DECODED COORDINATES');
    //console.log(decodedCoordinates);
    decodedCoordinates.forEach((coord: [number, number]) => {
      allCoordinates.push([coord[1], coord[0]]); // flip lat/lon to lon/lat
      //elevations.push(coord[2]); // extract elevation
    });
  });

  const routeGeoJSON: Feature<LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: allCoordinates,
    },
    properties: {
      //elevations: elevations,
    },
  };

  if (map.getSource('route')) {
    (map.getSource('route') as any).setData(routeGeoJSON);
  } else {
    map.addSource('route', {
      type: 'geojson',
      data: routeGeoJSON,
    });
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#007cbf',
        'line-width': 4,
      },
    });
  }
}
function updatePointFeatures(state: CustomRouteState, map: Map) {
  const pointGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: state.pointFeatures,
  };

  if (map.getSource('points')) {
    (map.getSource('points') as any).setData(pointGeoJSON);
  } else {
    map.addSource('points', {
      type: 'geojson',
      data: pointGeoJSON,
    });
    map.addLayer({
      id: 'points',
      type: 'circle',
      source: 'points',
      paint: {
        'circle-radius': 7,
        'circle-color': '#00A',
      },
    });

    // // Make points draggable
    // map.on('mousedown', 'points', (e) => {
    //   if (e.features && e.features.length) {
    //     const feature = e.features[0];
    //     map.on('mousemove', onMove);
    //     map.once('mouseup', onUp);

    //     const onMove = (event) => {
    //       const coords = event.lngLat;
    //       feature.geometry.coordinates = [coords.lng, coords.lat];
    //       (map.getSource('points') as any).setData(pointGeoJSON);
    //     };

    //     const onUp = () => {
    //       map.off('mousemove', onMove);
    //       this.updateRouteFromPoints(state);
    //     };
    //   }
    // });

    // // Allow deletion of points using the trash button
    // map.on('draw.delete', () => {
    //   if (state.selectedPointId) {
    //     const index = state.pointFeatures.findIndex(
    //       (point) => point.properties?.id === state.selectedPointId,
    //     );
    //     if (index !== -1) {
    //       state.pointFeatures.splice(index, 1);
    //       this.updatePointFeatures(state);
    //       this.updateRouteFromPoints(state);
    //       state.selectedPointId = null;
    //     }
    //   }
    // });
  }
}

interface CustomRouteState {
  coordinates: [number, number][];
  pointFeatures: Feature<Point>[];
  selectedPointId: string | null;
}

const CustomRouteMode: DrawCustomMode<CustomRouteState> = {
  onSetup() {
    const state: CustomRouteState = {
      coordinates: [],
      pointFeatures: [],
      selectedPointId: null,
    };
    return state;
  },
  onClick(state, e) {
    if (e.lngLat) {
      // const tolerance = 10; // Increase tolerance for selecting existing points
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: ['points'],
        filter: ['==', '$type', 'Point'],
      });

      if (features.length > 0) {
        // Select existing point
        const feature = features[0];
        state.selectedPointId = feature.properties?.id || null;
        this.updateUIClasses({ mouse: 'move' });
      } else {
        // Add new point
        const newPoint: Feature<Point> = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [e.lngLat.lng, e.lngLat.lat],
          },
          properties: {
            id: String(Date.now()), // unique id for each point
          },
        };

        state.coordinates.push([e.lngLat.lng, e.lngLat.lat]);
        state.pointFeatures.push(newPoint);

        this.updateUIClasses({ mouse: 'add' });
        this.activateUIButton('custom_route');
        (this.map as unknown as Map).fire('draw.custom_route.update', {
          coordinates: state.coordinates,
        });

        updatePointFeatures(state, this.map as unknown as Map);

        if (state.coordinates.length > 1) {
          getRouteValhalla(state.coordinates).then((route) => {
            displayRoute(route, this.map as unknown as Map);
          });
          //this.getRoute(state.coordinates);
        }
      }
    }
  },
  toDisplayFeatures(
    state: CustomRouteState,
    geojson: GeoJSON,
    //display: (geojson: GeoJSON),
  ) {
    console.log('Add geo json: ' + geojson);
  },
  //updateRouteFromPoints(state: CustomRouteState) {
  //  const coordinates = state.pointFeatures.map(
  //    (feature) => feature.geometry.coordinates as [number, number],
  //  );
  //  getRouteValhalla(state.coordinates).then((route) => {
  //    displayRoute(route, this.map as unknown as Map);
  //  });
  //},
  onStop(state) {
    this.updateUIClasses({ mouse: 'none' });
    this.activateUIButton();
    if (state.coordinates.length > 0) {
      (this.map as unknown as Map).fire('draw.custom_route.complete', {
        coordinates: state.coordinates,
      });
    }
  },
};

export default CustomRouteMode;
