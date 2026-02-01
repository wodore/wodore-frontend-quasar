<script setup lang="ts">
import { ref, inject, watchEffect, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useResizeObserver, useDebounceFn } from '@vueuse/core';
//import {
//  hutsLayerLayout,
//  hutsLayerPaint,
//  hutsOccupationLayerPaint,
//} from '../../stores/map/styles.ts.old';
import { useQuasar } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';
//import { useHutsStore } from '@stores/huts-store';
//import { Todo, Meta } from './models';
import type { Map } from 'maplibre-gl';
import {
  LngLatLike,
  MapGeoJSONFeature,
  MapLayerEventType,
  //GeoJSONSourceSpecification,
  Point,
} from 'maplibre-gl';
// https://indoorequal.github.io/vue-maplibre-gl/
import {
  MglMap,
  //MglGeoJsonSource,
  //MglCustomControl,
  MglNavigationControl,
  MglScaleControl,
  //MglSymbolLayer,
  //MglCircleLayer,
  MglEvent,
  //MglStyleSwitchControl,
  MglGeolocateControl,
  MglAttributionControl,
  useMap,
} from '@indoorequal/vue-maplibre-gl';

import mapDraw from '@services/draw';
import { clientWodore } from '@clients/index';

// import MglStyleSwitchControl from './styleSwitch.control';
const $q = useQuasar();
const router = useRouter();
const route = useRoute();
const basemapStore = useBasemapStore();
const mapRef = useMap();
//const hutStore = useHutsStore();

// Use a static ref for initial map style to prevent vue-maplibre-gl's reactive watcher
// from overriding our transformStyle callback when basemap changes
// After initial load, style switching is handled by basemapStore.setBasemap()
const initialMapStyle = ref(basemapStore.getBasemap()?.style);

// Reactive map center and zoom (set from defaults or API)
const mapCenter = ref<LngLatLike>([8.22, 46.7]);
const mapZoom = ref<number>(7.5);

type layoutType = {
  header: { size: number; offset: number; space: boolean };
  right: { size: number; offset: number; space: boolean };
  footer: { size: number; offset: number; space: boolean };
  left: { size: number; offset: number; space: boolean };
};
const $layout = inject<layoutType>('_q_l_');

const top = ref('0');
const right = ref('0');
const bottom = ref('0');
const left = ref('0');
if ($layout === undefined) {
  console.error('[WdMapView] MapView needs to be child of QLayout');
} else {
  watchEffect(() => {
    top.value = `${$layout.header.offset}px`;
    right.value = `${$layout.right.offset}px`;
    if (process.env.CLIENT && $layout.footer.offset < window.innerHeight - 250) {
      bottom.value = `${$layout.footer.offset}px`;
    }
    left.value = `${$layout.left.offset}px`;
    console.debug(
      '[WdMapView:watch] Layout offsets changed: (top, right, bottom, left): ',
      top.value,
      right.value,
      bottom.value,
      left.value
    );
  });
}

const mapDiv = ref(null);
const mapResize = useDebounceFn(() => {
  mapRef.map?.resize();
}, 50);

useResizeObserver(mapDiv, () => {
  mapResize();
});
//const hutjson = ref(
//  `${process.env.WODORE_API_HOST}/${process.env.WODORE_API_VERSION}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
//);

function onMapLoad(e: MglEvent<'load'>) {
  console.debug(`[onMapLoad] Maplibre version ${e.map.version} loaded`);

  e.map.scrollZoom.setWheelZoomRate(0.003);
  onMapStyledata(e as unknown as MglEvent<'styledata'>);
  e.map.on('mouseenter', 'wd-huts', onLayerEnter);
  e.map.on('mouseleave', 'wd-huts', onLayerLeave);
  e.map.on('click', 'wd-huts', onHutLayerClick);

  console.debug('Map controls added.', route.query.draw);
  if ('draw' in route.query) {
    e.map.addControl(mapDraw);
    // TODO: Add button for routing mode
    if (route.query.draw == 'route') {
      // @ts-expect-error missing custom mode TODO
      mapDraw.changeMode('custom_route');
    }
    // TODO: improve styling of routing, points, drag, delete, etc.
  }
}

const selectedHutFeature = ref<undefined | MapGeoJSONFeature>(undefined);

function onHutLayerClick(e: MapLayerEventType['click']) {
  console.debug('Hut layer clicked.');
  if (e.target.getZoom() > minHutClickZoom) {
    let feature = e.features?.[0];
    console.debug(
      '  Selected huts:',
      e.features?.map(v => v.properties.slug)
    );
    if (feature) {
      const slug = feature.properties.slug;

      // Check if clicking the same hut (toggle selection)
      if (selectedHutFeature.value?.id == feature.id) {
        // Deselect
        e.target.setFeatureState(
          { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
          { selected: false }
        );
        selectedHutFeature.value = undefined;

        // Update router to remove slug
        router.push({ name: 'map', hash: route.hash, query: route.query });
        return;
      }

      // Deselect previous hut
      if (selectedHutFeature.value !== undefined) {
        e.target.setFeatureState(
          { source: 'wd-huts', sourceLayer: 'huts', id: selectedHutFeature.value.id },
          { selected: false }
        );
      }

      // Select new hut
      e.target.setFeatureState(
        { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
        { selected: true }
      );
      selectedHutFeature.value = <MapGeoJSONFeature>(feature as unknown);

      // Smart fly to hut location
      if (feature.geometry.type === 'Point') {
        const coordinates = feature.geometry.coordinates as [number, number];
        smartFlyToHut(e.target, coordinates);
      }

      // Update router
      if (route.params.slug == slug) {
        router.push({ name: 'map', hash: route.hash, query: route.query });
      } else {
        router.push({
          name: 'map-hut',
          params: { slug: slug },
          hash: route.hash,
          query: route.query,
        });
      }
    }
  }
}

const minHutClickZoom = 8;

/**
 * Check if a point is visible in the map viewport with padding
 * @param map - MapLibre GL map instance
 * @param lngLat - Longitude and latitude to check
 * @returns true if point is visible, false otherwise
 */
function isPointVisibleWithPadding(map: Map, lngLat: LngLatLike): boolean {
  const point = map.project(lngLat);
  const bounds = map.getCanvas().getBoundingClientRect();

  // Platform-specific padding in pixels
  const isMobile = $q.platform.is.mobile;
  const padding = isMobile
    ? { top: 100, bottom: 400, left: 50, right: 50 }
    : { top: 100, bottom: 100, left: 100, right: 800 };

  // Check if point is outside padded area
  return (
    point.x >= padding.left &&
    point.x <= bounds.width - padding.right &&
    point.y >= padding.top &&
    point.y <= bounds.height - padding.bottom
  );
}

/**
 * Calculate safe position for hut to avoid being overlapped by menu
 * @param map - MapLibre GL map instance
 * @param lngLat - Target longitude and latitude
 * @param isInitialLoad - Whether this is the initial page load from URL
 * @returns Safe LngLat position
 */
function calculateSafePosition(
  map: Map,
  lngLat: LngLatLike,
  isInitialLoad: boolean = false
): LngLatLike {
  const bounds = map.getCanvas().getBoundingClientRect();
  const point = map.project(lngLat);

  // Platform-specific padding in pixels
  const isMobile = $q.platform.is.mobile;
  const padding = isMobile
    ? { top: 100, bottom: 400, left: 50, right: 50 }
    : { top: 100, bottom: 100, left: 100, right: 800 };

  if (isInitialLoad) {
    // On initial load from URL: center the hut in the safe area
    const safeWidth = bounds.width - padding.left - padding.right;
    const safeHeight = bounds.height - padding.top - padding.bottom;
    const centerX = padding.left + safeWidth / 2;
    const centerY = padding.top + safeHeight / 2;
    const newPoint = new Point(centerX, centerY);
    return map.unproject(newPoint);
  }

  // For user interactions: check if hut overlaps with menu area
  if (isMobile) {
    // Mobile: menu is at bottom, move up if needed
    if (point.y > bounds.height - padding.bottom) {
      const targetY = bounds.height - padding.bottom - 100; // 100px above bottom edge
      const newPoint = new Point(point.x, targetY);
      return map.unproject(newPoint);
    }
  } else {
    // Desktop: menu is on right, move left if needed
    if (point.x > bounds.width - padding.right) {
      const targetX = bounds.width - padding.right - 100; // 100px left of right edge
      const newPoint = new Point(targetX, point.y);
      return map.unproject(newPoint);
    }
  }

  return lngLat;
}

/**
 * Smart fly to hut location
 * - Only flies if hut is not visible or outside safe area
 * - Only zooms if zoomed out very far (< 9)
 * - Considers menu overlap for mobile/desktop
 * - On initial load: always center on hut location
 *
 * @param map - MapLibre GL map instance
 * @param lngLat - Target longitude and latitude
 * @param isInitialLoad - Whether this is the initial page load from URL
 */
function smartFlyToHut(map: Map, lngLat: LngLatLike, isInitialLoad: boolean = false): void {
  const currentZoom = map.getZoom();
  const minZoom = 9; // Only zoom if below this

  // Calculate safe position (centered on initial load, adjusted for interactions)
  const safePosition = calculateSafePosition(map, lngLat, isInitialLoad);

  // Convert to arrays for comparison (LngLatLike can be array, {lng, lat}, or {lon, lat})
  const lngLatArray = Array.isArray(lngLat)
    ? lngLat
    : 'lng' in lngLat
      ? [lngLat.lng, lngLat.lat]
      : [lngLat.lon, lngLat.lat];
  const safePositionArray = Array.isArray(safePosition)
    ? safePosition
    : 'lng' in safePosition
      ? [safePosition.lng, safePosition.lat]
      : [safePosition.lon, safePosition.lat];

  // On initial load, always move to center the hut
  // For interactions, only move if not visible or position changed
  let needsMove = isInitialLoad;
  if (!isInitialLoad) {
    const isVisible = isPointVisibleWithPadding(map, lngLat);
    needsMove =
      !isVisible ||
      safePositionArray[0] !== lngLatArray[0] ||
      safePositionArray[1] !== lngLatArray[1];
  }

  // Determine target zoom
  const targetZoom = currentZoom < minZoom ? Math.max(currentZoom, minZoom) : currentZoom;

  if (needsMove || currentZoom < minZoom) {
    map.flyTo({
      center: safePosition,
      zoom: targetZoom,
      duration: 1000,
      essential: true, // Ensure this animation cannot be filtered out
    });
  }
}

/**
 * Select a hut on the map by slug
 * @param slug - Hut slug to select
 * @param isInitialLoad - Whether this is the initial page load from URL
 */
async function selectHutBySlug(slug: string, isInitialLoad: boolean = false): Promise<void> {
  if (!mapRef.map) return;

  console.debug(`[selectHutBySlug] Selecting hut "${slug}" (initial: ${isInitialLoad})`);

  // Deselect previous hut
  if (selectedHutFeature.value) {
    mapRef.map.setFeatureState(
      { source: 'wd-huts', sourceLayer: 'huts', id: selectedHutFeature.value.id },
      { selected: false }
    );
  }

  // On initial load, always fetch from API to get accurate location
  // Set initial map center/zoom so map loads at correct position
  if (isInitialLoad) {
    console.debug(`[selectHutBySlug] Initial load, fetching from API to set initial map position`);

    try {
      const { data } = await clientWodore.GET('/v1/huts/{slug}', {
        params: {
          path: { slug },
        },
      });

      if (data?.location) {
        const lngLat: LngLatLike = [data.location.lon, data.location.lat];

        // Set reactive map center and zoom (for initial map render)
        mapCenter.value = lngLat;
        mapZoom.value = 12; // Good zoom level to see hut and surrounding area

        console.debug(`[selectHutBySlug] Set map center/zoom to`, lngLat, mapZoom.value);

        // If map is already loaded, jump to the position
        if (mapRef.map) {
          mapRef.map.jumpTo({
            center: lngLat,
            zoom: 12,
          });
          console.debug(`[selectHutBySlug] Jumped to map position`);
        }

        // Wait for source data to be loaded, then select the hut
        const checkInterval = setInterval(() => {
          const features = mapRef.map?.querySourceFeatures('wd-huts', {
            sourceLayer: 'huts',
            filter: ['==', ['get', 'slug'], slug],
          });

          if (features && features.length > 0) {
            clearInterval(checkInterval);
            const feature = features[0];

            mapRef.map?.setFeatureState(
              { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
              { selected: true }
            );
            selectedHutFeature.value = feature as MapGeoJSONFeature;
            console.debug(`[selectHutBySlug] Hut selected after initial load`);
          }
        }, 500); // Check every 500ms

        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkInterval), 10000);
        return;
      }
    } catch (error) {
      console.error(`[selectHutBySlug] Error fetching hut from API:`, error);
    }
  }

  // Try to find hut in map features (vector tiles)
  const features = mapRef.map.querySourceFeatures('wd-huts', {
    sourceLayer: 'huts',
    filter: ['==', ['get', 'slug'], slug],
  });

  if (features.length > 0) {
    // Hut found in vector tiles
    const feature = features[0];

    // Select the hut
    mapRef.map.setFeatureState(
      { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
      { selected: true }
    );
    selectedHutFeature.value = feature as MapGeoJSONFeature;

    // Smart fly to hut location (only for user interactions, not initial load)
    if (!isInitialLoad && feature.geometry.type === 'Point') {
      const coordinates = feature.geometry.coordinates as [number, number];
      smartFlyToHut(mapRef.map, coordinates, false);
    }

    console.debug(`[selectHutBySlug] Hut found in features, selected`);
  } else {
    // Hut not in vector tiles, fetch from API
    console.debug(`[selectHutBySlug] Hut not in features, fetching from API`);

    try {
      const { data } = await clientWodore.GET('/v1/huts/{slug}', {
        params: {
          path: { slug },
        },
      });

      if (data?.location) {
        const lngLat: LngLatLike = [data.location.lon, data.location.lat];

        // Fly to location (which will load tiles and feature)
        smartFlyToHut(mapRef.map, lngLat, false);

        // Wait for tiles to load, then select the feature
        // We'll retry after a short delay
        setTimeout(async () => {
          const retryFeatures = mapRef.map?.querySourceFeatures('wd-huts', {
            sourceLayer: 'huts',
            filter: ['==', ['get', 'slug'], slug],
          });

          if (retryFeatures && retryFeatures.length > 0) {
            const feature = retryFeatures[0];
            mapRef.map?.setFeatureState(
              { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
              { selected: true }
            );
            selectedHutFeature.value = feature as MapGeoJSONFeature;
            console.debug(`[selectHutBySlug] Hut selected after API fallback`);
          } else {
            console.warn(`[selectHutBySlug] Hut "${slug}" still not found after API fetch`);
            selectedHutFeature.value = undefined;
          }
        }, 1500); // Wait for tiles to load
      }
    } catch (error) {
      console.error(`[selectHutBySlug] Error fetching hut from API:`, error);
      selectedHutFeature.value = undefined;
    }
  }
}

// Watch route params for slug changes (e.g., direct URL navigation, back/forward)
watch(
  () => route.params.slug as string | undefined,
  (newSlug, oldSlug) => {
    if (newSlug) {
      // Determine if this is initial page load (no previous selection)
      const isInitialLoad = !oldSlug && !selectedHutFeature.value;

      // On initial load, fetch from API BEFORE map loads
      if (isInitialLoad) {
        console.debug(`[route watch] Initial load, fetching hut location before map loads`);

        // Fetch from API (non-blocking)
        clientWodore
          .GET('/v1/huts/{slug}', {
            params: { path: { slug: newSlug } },
          })
          .then(({ data }) => {
            if (!data?.location) return;

            const lngLat: LngLatLike = [data.location.lon, data.location.lat];

            if (mapRef.map) {
              // Map is already loaded, jump to position
              mapRef.map.jumpTo({ center: lngLat, zoom: 12 });
              console.debug(`[route watch] Map loaded, jumped to`, lngLat);
            } else {
              // Map not loaded yet, set reactive values
              mapCenter.value = lngLat;
              mapZoom.value = 12;
              console.debug(`[route watch] Map not loaded, set center/zoom to`, lngLat);
            }

            // Start polling for the hut feature to select it
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds (20 * 500ms)

            const checkInterval = setInterval(() => {
              attempts++;

              const features = mapRef.map?.querySourceFeatures('wd-huts', {
                sourceLayer: 'huts',
                filter: ['==', ['get', 'slug'], newSlug],
              });

              if (features && features.length > 0) {
                clearInterval(checkInterval);
                const feature = features[0];

                // Deselect previous hut
                if (selectedHutFeature.value) {
                  mapRef.map?.setFeatureState(
                    { source: 'wd-huts', sourceLayer: 'huts', id: selectedHutFeature.value.id },
                    { selected: false }
                  );
                }

                // Select new hut
                mapRef.map?.setFeatureState(
                  { source: 'wd-huts', sourceLayer: 'huts', id: feature.id },
                  { selected: true }
                );
                selectedHutFeature.value = feature as MapGeoJSONFeature;
                console.debug(`[route watch] Hut selected after initial load`);
              } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn(
                  `[route watch] Hut "${newSlug}" not found after ${maxAttempts} attempts`
                );
              }
            }, 500);
          })
          .catch(error => {
            console.error(`[route watch] Error fetching hut:`, error);
          });

        // Don't call selectHutBySlug for initial load, we handle it above
        return;
      }

      selectHutBySlug(newSlug, isInitialLoad);
    } else if (oldSlug && selectedHutFeature.value) {
      // Slug was removed, deselect hut
      if (mapRef.map) {
        mapRef.map.setFeatureState(
          { source: 'wd-huts', sourceLayer: 'huts', id: selectedHutFeature.value.id },
          { selected: false }
        );
      }
      selectedHutFeature.value = undefined;
    }
  },
  { immediate: true } // Run on component mount
);

// Change the cursor to a pointer
function onLayerEnter(e: MapLayerEventType['mouseenter']) {
  if (e.target.getZoom() > minHutClickZoom) {
    e.target.getCanvas().style.cursor = 'pointer';
  }
}

// Change it back to a pointer when it leaves.
function onLayerLeave(e: MapLayerEventType['mouseleave']) {
  if (e.target.getZoom() > minHutClickZoom) {
    e.target.getCanvas().style.cursor = '';
  }
}

function onMapStyledata(e: MglEvent<'styledata'>) {
  //$q.loadingBar.start();
  console.debug('[onMapStyledata] Style data changed event', e);
}
</script>
<style lang="scss">
//@import 'vue-maplibre-gl/dist/vue-maplibre-gl.css';

.maplibregl-control-container {
  // from https://github.com/quasarframework/quasar/blob/dev/ui/src/components/layout/QLayout.sass .q-body--layout-animate .q-page-sticky
  //@extend .q-body--layout-animate, .q-page-sticky; // not found
  position: fixed;
  top: v-bind(top);
  left: v-bind(left);
  bottom: v-bind(bottom);
  right: v-bind(right);
  pointer-events: none;
  transition:
    transform $drawer-duration $drawer-transistion,
    left $drawer-duration $drawer-transistion,
    right $drawer-duration $drawer-transistion,
    top $drawer-duration $drawer-transistion,
    bottom $drawer-duration $drawer-transistion !important;
}

//.maplibregl-ctrl-top-left {
//  pointer-events: all;
//}
</style>
<template>
  <!-- @map:render="onMapRender" -->
  <q-no-ssr>
    <div ref="mapDiv" style="height: 100vh">
      <MglMap
        @map:load="onMapLoad"
        @map:styledata="onMapStyledata"
        hash="p"
        :map-style="initialMapStyle"
        :zoom="mapZoom"
        :bearing-snap="15"
        :center="mapCenter"
        :attribution-control="false"
        :min-zoom="7"
        :max-zoom="20"
        :max-bounds="[3.6, 43, 18.7, 49.7]"
        :max-tile-cache-size="400"
        :render-world-copies="false"
      >
        <!-- <MglStyleSwitchControl :map-styles="basemapStore.basemaps" /> -->
        <!-- <MglCustomControl position="top-right" class=""> -->
        <WdBasemapSwitch
          :position="$q.platform.is.mobile ? 'bottom-right' : 'top-left'"
          :direction="$q.platform.is.mobile ? 'left' : 'right'"
          :offset="[$q.platform.is.mobile ? 14 : 14, $q.platform.is.mobile ? 20 : 14]"
        />
        <WdOverlaySwitch
          position="top-left"
          direction="down"
          :offset="[$q.platform.is.mobile ? 14 : 14, $q.platform.is.mobile ? 14 : 68]"
        />
        <!-- </MglCustomControl> -->
        <MglGeolocateControl />
        <!-- <MglNavigationControl :show-zoom="$q.platform.is.desktop" /> -->
        <MglNavigationControl :show-zoom="false" />
        <MglAttributionControl :position="$q.platform.is.mobile ? 'bottom-left' : 'bottom-right'" />
        <MglScaleControl />
        <!-- <MglGeoJsonSource
      source-id="wd-bookings"
      :data="hutStore.bookingsGeojson"
      :buffer="512"
      :tolerance="0.7"
      promote-id="slug"
    > -->
        <!-- <MglCircleLayer
        layer-id="wd-bookings-huts"
        :paint="hutsOccupationLayerPaint"
        before="wd-huts"
      ></MglCircleLayer> -->
        <!-- </MglGeoJsonSource> -->
        <!-- <MglGeoJsonSource
      source-id="wd-huts"
      :data="hutjson"
      :buffer="512"
      :tolerance="0.7"
      promote-id="slug"
    > -->
        <!-- <MglSymbolLayer
        @click.prevent="onHutLayerClick"
        @mouseenter="onLayerEnter"
        @mouseleave="onLayerLeave"
        :layout="hutsLayerLayout"
        :paint="hutsLayerPaint"
        layer-id="wd-huts"
        :before="basemapStore.getBasemap()?.layers.ways.before"
      ></MglSymbolLayer> -->
        <!-- </MglGeoJsonSource> -->
      </MglMap>
    </div>
  </q-no-ssr>
</template>
