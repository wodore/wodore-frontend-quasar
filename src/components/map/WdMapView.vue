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
  Point,
  //GeoJSONSourceSpecification,
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

// Remember the last opened mobile drawer height for better predictions
const lastMobileDrawerHeight = ref(0);

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

    // Track mobile drawer height when it's open (> 100px)
    const currentBottom = parseInt(bottom.value) || 0;
    if (!$q.screen.gt.sm && currentBottom > 100) {
      lastMobileDrawerHeight.value = currentBottom;
    }

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
 * Get platform-specific padding for map viewport
 * Returns padding object with safe zone distances from edges
 * @param assumeDrawerOpen - For desktop, assume right drawer will be open (380px)
 */
function getMapPadding(assumeDrawerOpen: boolean = false): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const isMobile = !$q.screen.gt.sm; // Same detection as hut dialog

  if (isMobile) {
    // Mobile: drawer at bottom with dynamic height
    // Use last known drawer height, or default to 50% of window height
    const currentBottom = parseInt(bottom.value) || 0;
    const defaultHeight = process.env.CLIENT ? window.innerHeight * 0.5 : 400;
    const expectedDrawerHeight = assumeDrawerOpen
      ? Math.max(currentBottom, lastMobileDrawerHeight.value || defaultHeight)
      : currentBottom;

    // Add 100px margin above drawer so hut doesn't sit directly on it
    const bottomPadding = expectedDrawerHeight > 0 ? expectedDrawerHeight + 100 : 0;

    console.debug(
      `[getMapPadding] Mobile - assumeDrawerOpen: ${assumeDrawerOpen}, currentBottom: ${currentBottom}, lastHeight: ${lastMobileDrawerHeight.value}, expectedDrawerHeight: ${expectedDrawerHeight}, bottomPadding: ${bottomPadding}`
    );

    return {
      top: parseInt(top.value) || 50,
      bottom: bottomPadding, // Drawer height + 100px margin
      left: parseInt(left.value) || 0,
      right: parseInt(right.value) || 0,
    };
  } else {
    // Desktop: when selecting a hut, drawer will be open
    // Drawer width depends on screen size (same logic as WdMapContent.vue:103)
    // - 460px when screen > medium ($q.screen.gt.md)
    // - 380px otherwise
    const currentRight = parseInt(right.value) || 0;
    const expectedDrawerWidth = $q.screen.gt.md ? 460 : 380;
    const rightPadding = assumeDrawerOpen
      ? Math.max(currentRight, expectedDrawerWidth)
      : currentRight;

    console.debug(
      `[getMapPadding] Desktop - assumeDrawerOpen: ${assumeDrawerOpen}, currentRight: ${currentRight}, expectedDrawerWidth: ${expectedDrawerWidth}, using: ${rightPadding}`
    );

    return {
      top: parseInt(top.value) || 50,
      bottom: parseInt(bottom.value) || 31,
      left: parseInt(left.value) || 0,
      right: rightPadding, // Use expected drawer width or current value
    };
  }
}

/**
 * Check if a point is visible in the map viewport with padding
 * Checks all 4 edges for danger zones
 * @param map - MapLibre GL map instance
 * @param lngLat - Longitude and latitude to check
 * @param assumeDrawerOpen - If true, check against expected drawer width (for clicks)
 * @returns true if point is in safe zone (not in any danger zone)
 */
function isPointVisibleWithPadding(
  map: Map,
  lngLat: LngLatLike,
  assumeDrawerOpen: boolean = false
): boolean {
  const point = map.project(lngLat);
  const bounds = map.getCanvas().getBoundingClientRect();
  const padding = getMapPadding(assumeDrawerOpen);

  // Danger zone: 150px for desktop, 100px for mobile
  const isMobile = !$q.screen.gt.sm;
  const dangerMargin = isMobile ? 100 : 150;

  // Check if point is in safe zone (not too close to any edge)
  return (
    point.x >= padding.left + dangerMargin && // Not too close to left
    point.x <= bounds.width - padding.right - dangerMargin && // Not too close to right
    point.y >= padding.top + dangerMargin && // Not too close to top
    point.y <= bounds.height - padding.bottom - dangerMargin // Not too close to bottom
  );
}

/**
 * Smart fly to hut location
 * - Only moves as much as necessary to get hut into safe zone plus margin
 * - On initial load: centers hut in safe area using padding
 * - On click: moves hut just inside safe zone (minimal movement)
 * - Only zooms if zoomed out very far (< 9)
 *
 * @param map - MapLibre GL map instance
 * @param lngLat - Target longitude and latitude
 * @param isInitialLoad - Whether this is the initial page load from URL
 */
function smartFlyToHut(map: Map, lngLat: LngLatLike, isInitialLoad: boolean = false): void {
  const currentZoom = map.getZoom();
  const minZoom = 9; // Only zoom if below this

  // For user clicks, assume drawer will be open (prevents double adjustment)
  const assumeDrawerOpen = !isInitialLoad;
  const padding = getMapPadding(assumeDrawerOpen);

  // Check if hut is currently visible with padding (using expected drawer width)
  const isVisible = isPointVisibleWithPadding(map, lngLat, assumeDrawerOpen);

  // Determine target zoom
  const targetZoom = currentZoom < minZoom ? 12 : currentZoom;
  const needsZoom = currentZoom < minZoom;

  // On initial load, center in safe area using padding
  if (isInitialLoad) {
    console.debug(`[smartFlyToHut] Initial load, centering in safe area`);
    console.debug(`[smartFlyToHut] Using padding:`, padding);

    map.flyTo({
      center: lngLat,
      padding: padding, // Center in safe area
      zoom: targetZoom,
      duration: 667, // 1.5x speed (1000 / 1.5)
      essential: true,
    });
    return;
  }

  // For user clicks: only move if not visible or needs zoom
  if (!isVisible || needsZoom) {
    const isMobile = !$q.screen.gt.sm;

    if (isMobile) {
      // Mobile: Use padding-based flyTo (centers hut in safe area)
      // This handles tall drawers correctly without conflict
      console.debug(`[smartFlyToHut] Mobile: flying to hut with padding`, padding);

      map.flyTo({
        center: lngLat,
        padding: padding,
        zoom: targetZoom,
        duration: 667,
        essential: true,
      });
      return;
    }

    // Desktop: Manual positioning (minimal movement to safe zone)
    const bounds = map.getCanvas().getBoundingClientRect();
    const point = map.project(lngLat);
    const dangerMargin = 150;

    // Calculate target position (check all 4 edges)
    let targetX = point.x;
    let targetY = point.y;
    let needsMove = false;

    // Check top edge
    if (point.y < padding.top + dangerMargin) {
      targetY = padding.top + dangerMargin;
      needsMove = true;
      console.debug(
        `[smartFlyToHut] Top danger zone: moving hut from y=${point.y} to y=${targetY}`
      );
    }

    // Check right edge
    if (point.x > bounds.width - padding.right - dangerMargin) {
      targetX = bounds.width - padding.right - dangerMargin;
      needsMove = true;
      console.debug(
        `[smartFlyToHut] Right danger zone: moving hut from x=${point.x} to x=${targetX}`
      );
    }

    // Check bottom edge
    if (point.y > bounds.height - padding.bottom - dangerMargin) {
      targetY = bounds.height - padding.bottom - dangerMargin;
      needsMove = true;
      console.debug(
        `[smartFlyToHut] Bottom danger zone: moving hut from y=${point.y} to y=${targetY}`
      );
    }

    // Check left edge
    if (point.x < padding.left + dangerMargin) {
      targetX = padding.left + dangerMargin;
      needsMove = true;
      console.debug(
        `[smartFlyToHut] Left danger zone: moving hut from x=${point.x} to x=${targetX}`
      );
    }

    if (needsMove || needsZoom) {
      // Calculate offset from current position to target position
      const offsetX = point.x - targetX;
      const offsetY = point.y - targetY;

      // Get current map center and apply offset
      const currentCenter = map.getCenter();
      const currentCenterPoint = map.project(currentCenter);
      const newCenterPoint = new Point(
        currentCenterPoint.x + offsetX,
        currentCenterPoint.y + offsetY
      );
      const targetCenter = map.unproject(newCenterPoint);

      console.debug(
        `[smartFlyToHut] Desktop: Moving hut from (${point.x}, ${point.y}) to (${targetX}, ${targetY})`
      );
      console.debug(
        `[smartFlyToHut] Desktop: Offset: (${offsetX}, ${offsetY}), needsZoom: ${needsZoom}`
      );

      map.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        duration: 667, // 1.5x speed (1000 / 1.5)
        essential: true,
      });
    }
  } else {
    console.debug(`[smartFlyToHut] No movement needed (hut is in safe zone)`);
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
              // Map is already loaded, use smartFlyToHut with padding
              smartFlyToHut(mapRef.map, lngLat, true);
              console.debug(`[route watch] Map loaded, flying to hut with padding`);
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
