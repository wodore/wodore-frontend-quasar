<script setup lang="ts">
import { ref, inject, watchEffect, watch, onErrorCaptured, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useResizeObserver, useDebounceFn, useThrottleFn } from '@vueuse/core';
import { useQuasar } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { showErrorDialogPersistent, ErrorCode } from '@components/error';
import type { Map, PaddingOptions } from 'maplibre-gl';
import { LngLatLike, MapGeoJSONFeature, MapLayerEventType, Point } from 'maplibre-gl';
import {
  MglMap,
  MglNavigationControl,
  MglScaleControl,
  MglEvent,
  MglGeolocateControl,
  MglAttributionControl,
  useMap,
} from '@indoorequal/vue-maplibre-gl';

import mapDraw from '@services/draw';
import { clientWodore } from '@clients/index';

// ============================================================================
// Constants
// ============================================================================

const MOBILE_DANGER_MARGIN = 100;
const DESKTOP_DANGER_MARGIN = 150;
const MOBILE_DRAWER_MARGIN = -75;
const MIN_HUT_CLICK_ZOOM = 8;
const MIN_FLY_ZOOM = 9;
const FLY_DURATION = 600; // ms
const INITIAL_ZOOM = 12;
const MOBILE_DRAWER_DEFAULT_RATIO = 0.5; // 50% of screen height
const MOBILE_DRAWER_TRACK_THRESHOLD = 100;

// Desktop drawer widths (matches WdMapContent.vue:103)
const DESKTOP_DRAWER_WIDTH_LARGE = 460;
const DESKTOP_DRAWER_WIDTH_MEDIUM = 380;

// Map layer IDs
const HUT_LAYER_ID = 'wd-huts';
const HUT_SOURCE_ID = 'wd-huts';
const HUT_SOURCE_LAYER = 'huts';

// Debug flag
const DEBUG_MAP_POSITIONING = false;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper: Platform detection
 * @returns true if on mobile platform (screen width <= small)
 */
function isMobileView(): boolean {
  return !$q.screen.gt.sm;
}

/**
 * Helper: Get expected desktop drawer width based on screen size
 * Matches logic from WdMapContent.vue:103
 * @returns 460px for large screens, 380px for medium
 */
function getExpectedDesktopDrawerWidth(): number {
  return $q.screen.gt.md ? DESKTOP_DRAWER_WIDTH_LARGE : DESKTOP_DRAWER_WIDTH_MEDIUM;
}

/**
 * Helper: Get expected mobile drawer height
 * Uses last remembered height, or defaults to 50% of window height
 * @returns Expected drawer height in pixels
 */
function getExpectedMobileDrawerHeight(): number {
  const defaultHeight = process.env.CLIENT ? window.innerHeight * MOBILE_DRAWER_DEFAULT_RATIO : 400;
  return lastMobileDrawerHeight.value || defaultHeight;
}

/**
 * Helper: Debug logging wrapper
 * Only logs if DEBUG_MAP_POSITIONING is enabled
 */
function debugLog(message: string, ...args: unknown[]) {
  if (DEBUG_MAP_POSITIONING) {
    console.debug(message, ...args);
  }
}

/**
 * Helper: Get danger margin for current platform
 * @returns 100px for mobile, 150px for desktop
 */
function getDangerMargin(): number {
  return isMobileView() ? MOBILE_DANGER_MARGIN : DESKTOP_DANGER_MARGIN;
}

// ============================================================================
// Setup
// ============================================================================

const $q = useQuasar();
const router = useRouter();
const route = useRoute();
const basemapStore = useBasemapStore();
const mapRef = useMap();
const localPropertiesStore = useLocalPropertiesStore();

// Use a static ref for initial map style to prevent vue-maplibre-gl's reactive watcher
// from overriding our transformStyle callback when basemap changes
// After initial load, style switching is handled by basemapStore.setBasemap()
const initialMapStyle = ref(basemapStore.getBasemap()?.style);

// Get initial location from store (handles URL hash, storage, defaults)
const initialLocation = localPropertiesStore.getInitialLocation();

// Reactive map center and zoom (initialized from store)
const mapCenter = ref<LngLatLike>([initialLocation.lng, initialLocation.lat]);
const mapZoom = ref<number>(initialLocation.zoom);

// Page visibility - only track location when tab is active
const isPageVisible = computed(() => !document.hidden);

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

    // Track mobile drawer height when it's open (> threshold)
    const currentBottom = parseInt(bottom.value) || 0;
    if (isMobileView() && currentBottom > MOBILE_DRAWER_TRACK_THRESHOLD) {
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
  e.map.on('mouseenter', HUT_LAYER_ID, onLayerEnter);
  e.map.on('mouseleave', HUT_LAYER_ID, onLayerLeave);
  e.map.on('click', HUT_LAYER_ID, onHutLayerClick);

  // Track location changes with throttling (updates every 1s max)
  // Only when tab is active
  const updateLocation = useThrottleFn(() => {
    // Only update location if this tab/page is visible
    if (!isPageVisible.value) {
      console.debug('[location] Skipping location update - page not visible');
      return;
    }

    const center = e.map.getCenter();
    const zoom = e.map.getZoom();

    localPropertiesStore.updateLocation({
      lat: center.lat,
      lng: center.lng,
      zoom: zoom,
      bearing: e.map.getBearing(),
      pitch: e.map.getPitch(),
    });

    console.debug('[location] Location updated:', {
      lat: center.lat.toFixed(4),
      lng: center.lng.toFixed(4),
      zoom: zoom.toFixed(1),
    });
  }, 1000); // Throttle to 1 second

  // Update location on map movements
  e.map.on('move', updateLocation);
  e.map.on('moveend', updateLocation);
  e.map.on('zoom', updateLocation);
  e.map.on('zoomend', updateLocation);
  e.map.on('rotate', updateLocation);
  e.map.on('rotateend', updateLocation);
  e.map.on('pitch', updateLocation);
  e.map.on('pitchend', updateLocation);

  // Listen for visibility changes to log when tracking resumes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.debug('[location] Page visible - location tracking resumed');
      // Update location immediately when tab becomes visible
      updateLocation();
    } else {
      console.debug('[location] Page hidden - location tracking paused');
      // Force save when tab becomes hidden
      localPropertiesStore.forceSave();
    }
  });

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

function onMapError(e: unknown) {
  console.error('[onMapError] Map error occurred:', e);

  // Check if it's a WebGL error
  const event = e as { error?: unknown; type?: string };
  if (event.error && typeof event.error === 'object') {
    const errorObj = event.error as Record<string, unknown>;

    if (
      errorObj.type === 'webglcontextcreationerror' ||
      errorObj.message?.toString().includes('WebGL')
    ) {
      console.error('[onMapError] WebGL context creation failed:', errorObj);
      showErrorDialogPersistent(ErrorCode.WEBGL_NOT_SUPPORTED);
      return;
    }
  }

  // For other errors, show generic map error
  //console.error('[onMapError] Generic map error:', event.error);
  //showErrorDialog({ errorCode: ErrorCode.MAP_ERROR });
}

// Capture errors from child components (like MglMap)
onErrorCaptured((err, instance, info) => {
  console.error('[onErrorCaptured] Error caught from child component:', err, info);

  // Check if it's a WebGL error
  const errorMessage = err instanceof Error ? err.message : String(err);

  if (
    errorMessage.includes('WebGL') ||
    errorMessage.includes('disabled by enterprise policy') ||
    errorMessage.includes('webglcontextcreationerror')
  ) {
    console.error('[onErrorCaptured] WebGL error detected, showing error dialog');
    showErrorDialogPersistent(ErrorCode.WEBGL_NOT_SUPPORTED);
    return false; // Prevent error from propagating further
  }

  // For other map errors, show general map error
  //console.error('[onErrorCaptured] Non-WebGL map error detected, showing error dialog');
  //showErrorDialog({ errorCode: ErrorCode.MAP_ERROR });
  return false; // Prevent error from propagating
});

const selectedHutFeature = ref<undefined | MapGeoJSONFeature>(undefined);

function onHutLayerClick(e: MapLayerEventType['click']) {
  console.debug('Hut layer clicked.');
  if (e.target.getZoom() > MIN_HUT_CLICK_ZOOM) {
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
          { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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
          { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: selectedHutFeature.value.id },
          { selected: false }
        );
      }

      // Select new hut
      e.target.setFeatureState(
        { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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

/**
 * Get platform-specific padding for map viewport
 * Returns padding object with safe zone distances from edges
 * @param assumeDrawerOpen - Predict drawer will be open (for user clicks)
 */
function getMapPadding(assumeDrawerOpen: boolean = false): PaddingOptions {
  const currentTop = parseInt(top.value) || 50;
  const currentLeft = parseInt(left.value) || 0;

  if (isMobileView()) {
    // Mobile: drawer at bottom with dynamic height
    const currentBottom = parseInt(bottom.value) || 0;
    const expectedDrawerHeight = assumeDrawerOpen
      ? Math.max(currentBottom, getExpectedMobileDrawerHeight())
      : currentBottom;

    // Add margin above drawer so hut doesn't sit directly on it
    const bottomPadding =
      expectedDrawerHeight > 0 ? expectedDrawerHeight + MOBILE_DRAWER_MARGIN : 0;

    debugLog(
      `[getMapPadding] Mobile - assumeDrawerOpen: ${assumeDrawerOpen}, currentBottom: ${currentBottom}, lastHeight: ${lastMobileDrawerHeight.value}, expectedDrawerHeight: ${expectedDrawerHeight}, bottomPadding: ${bottomPadding}`
    );

    return {
      top: currentTop,
      bottom: bottomPadding,
      left: currentLeft,
      right: parseInt(right.value) || 0,
    };
  } else {
    // Desktop: drawer opens on right side
    const currentRight = parseInt(right.value) || 0;
    const expectedDrawerWidth = getExpectedDesktopDrawerWidth();
    const rightPadding = assumeDrawerOpen
      ? Math.max(currentRight, expectedDrawerWidth)
      : currentRight;

    debugLog(
      `[getMapPadding] Desktop - assumeDrawerOpen: ${assumeDrawerOpen}, currentRight: ${currentRight}, expectedDrawerWidth: ${expectedDrawerWidth}, using: ${rightPadding}`
    );

    return {
      top: currentTop,
      bottom: parseInt(bottom.value) || 31,
      left: currentLeft,
      right: rightPadding,
    };
  }
}

/**
 * Check if a point is visible in the map viewport with padding
 * Checks all 4 edges for danger zones
 * @param map - MapLibre GL map instance
 * @param lngLat - Longitude and latitude to check
 * @param assumeDrawerOpen - If true, check against expected drawer size (for clicks)
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
  const dangerMargin = getDangerMargin();

  // Check if point is in safe zone (not too close to any edge)
  return (
    point.x >= (padding.left ?? 0) + dangerMargin && // Not too close to left
    point.x <= bounds.width - (padding.right ?? 0) - dangerMargin && // Not too close to right
    point.y >= (padding.top ?? 0) + dangerMargin && // Not too close to top
    point.y <= bounds.height - (padding.bottom ?? 0) - dangerMargin // Not too close to bottom
  );
}

/**
 * Smart fly to hut location
 * - Only moves as much as necessary to get hut into safe zone plus margin
 * - On initial load: centers hut in safe area using padding
 * - On click: moves hut just inside safe zone (minimal movement)
 * - Only zooms if zoomed out very far (< MIN_FLY_ZOOM)
 *
 * @param map - MapLibre GL map instance
 * @param lngLat - Target longitude and latitude
 * @param isInitialLoad - Whether this is the initial page load from URL
 */
function smartFlyToHut(map: Map, lngLat: LngLatLike, isInitialLoad: boolean = false): void {
  const currentZoom = map.getZoom();
  const assumeDrawerOpen = !isInitialLoad;
  const padding = getMapPadding(assumeDrawerOpen);
  const isVisible = isPointVisibleWithPadding(map, lngLat, assumeDrawerOpen);
  const targetZoom = currentZoom < MIN_FLY_ZOOM ? INITIAL_ZOOM : currentZoom;
  const needsZoom = currentZoom < MIN_FLY_ZOOM;

  // On initial load, center in safe area using padding
  if (isInitialLoad) {
    debugLog(`[smartFlyToHut] Initial load, centering in safe area`);
    debugLog(`[smartFlyToHut] Using padding:`, padding);

    map.flyTo({
      center: lngLat,
      padding: padding,
      zoom: targetZoom,
      duration: FLY_DURATION,
      essential: true,
    });
    return;
  }

  // For user clicks: only move if not visible or needs zoom
  if (!isVisible || needsZoom) {
    if (isMobileView()) {
      // Mobile: Use padding-based flyTo (centers hut in safe area)
      // This handles tall drawers correctly without conflict
      debugLog(`[smartFlyToHut] Mobile: flying to hut with padding`, padding);

      map.flyTo({
        center: lngLat,
        padding: padding,
        zoom: targetZoom,
        duration: FLY_DURATION,
        essential: true,
      });
      return;
    }

    // Desktop: Manual positioning (minimal movement to safe zone)
    flyToDesktopMinimal(map, lngLat, padding, targetZoom, needsZoom);
  } else {
    debugLog(`[smartFlyToHut] No movement needed (hut is in safe zone)`);
  }
}

/**
 * Desktop-specific flyTo with minimal movement
 * Moves hut just inside safe zone with 150px margin from edges
 * @param map - MapLibre GL map instance
 * @param lngLat - Target longitude and latitude
 * @param padding - Current map padding
 * @param targetZoom - Target zoom level
 * @param needsZoom - Whether zoom adjustment is needed
 */
function flyToDesktopMinimal(
  map: Map,
  lngLat: LngLatLike,
  padding: PaddingOptions,
  targetZoom: number,
  needsZoom: boolean
): void {
  const bounds = map.getCanvas().getBoundingClientRect();
  const point = map.project(lngLat);
  const dangerMargin = DESKTOP_DANGER_MARGIN;

  // Get padding values with defaults
  const paddingTop = padding.top ?? 0;
  const paddingRight = padding.right ?? 0;
  const paddingBottom = padding.bottom ?? 0;
  const paddingLeft = padding.left ?? 0;

  // Calculate target position (check all 4 edges)
  let targetX = point.x;
  let targetY = point.y;
  let needsMove = false;

  // Check top edge
  if (point.y < paddingTop + dangerMargin) {
    targetY = paddingTop + dangerMargin;
    needsMove = true;
    debugLog(`[smartFlyToHut] Top danger zone: moving hut from y=${point.y} to y=${targetY}`);
  }

  // Check right edge
  if (point.x > bounds.width - paddingRight - dangerMargin) {
    targetX = bounds.width - paddingRight - dangerMargin;
    needsMove = true;
    debugLog(`[smartFlyToHut] Right danger zone: moving hut from x=${point.x} to x=${targetX}`);
  }

  // Check bottom edge
  if (point.y > bounds.height - paddingBottom - dangerMargin) {
    targetY = bounds.height - paddingBottom - dangerMargin;
    needsMove = true;
    debugLog(`[smartFlyToHut] Bottom danger zone: moving hut from y=${point.y} to y=${targetY}`);
  }

  // Check left edge
  if (point.x < paddingLeft + dangerMargin) {
    targetX = paddingLeft + dangerMargin;
    needsMove = true;
    debugLog(`[smartFlyToHut] Left danger zone: moving hut from x=${point.x} to x=${targetX}`);
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

    debugLog(
      `[smartFlyToHut] Desktop: Moving hut from (${point.x}, ${point.y}) to (${targetX}, ${targetY})`
    );
    debugLog(`[smartFlyToHut] Desktop: Offset: (${offsetX}, ${offsetY}), needsZoom: ${needsZoom}`);

    map.flyTo({
      center: targetCenter,
      zoom: targetZoom,
      duration: FLY_DURATION,
      essential: true,
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
      { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: selectedHutFeature.value.id },
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
        mapZoom.value = INITIAL_ZOOM;

        console.debug(`[selectHutBySlug] Set map center/zoom to`, lngLat, mapZoom.value);

        // If map is already loaded, jump to the position
        if (mapRef.map) {
          mapRef.map.jumpTo({
            center: lngLat,
            zoom: INITIAL_ZOOM,
          });
          console.debug(`[selectHutBySlug] Jumped to map position`);
        }

        // Wait for source data to be loaded, then select the hut
        const checkInterval = setInterval(() => {
          const features = mapRef.map?.querySourceFeatures(HUT_SOURCE_ID, {
            sourceLayer: HUT_SOURCE_LAYER,
            filter: ['==', ['get', 'slug'], slug],
          });

          if (features && features.length > 0) {
            clearInterval(checkInterval);
            const feature = features[0];

            mapRef.map?.setFeatureState(
              { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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
  const features = mapRef.map.querySourceFeatures(HUT_SOURCE_ID, {
    sourceLayer: HUT_SOURCE_LAYER,
    filter: ['==', ['get', 'slug'], slug],
  });

  if (features.length > 0) {
    // Hut found in vector tiles
    const feature = features[0];

    // Select the hut
    mapRef.map.setFeatureState(
      { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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
          const retryFeatures = mapRef.map?.querySourceFeatures(HUT_SOURCE_ID, {
            sourceLayer: HUT_SOURCE_LAYER,
            filter: ['==', ['get', 'slug'], slug],
          });

          if (retryFeatures && retryFeatures.length > 0) {
            const feature = retryFeatures[0];
            mapRef.map?.setFeatureState(
              { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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
              mapZoom.value = INITIAL_ZOOM;
              console.debug(`[route watch] Map not loaded, set center/zoom to`, lngLat);
            }

            // Start polling for the hut feature to select it
            let attempts = 0;
            const maxAttempts = 20; // 10 seconds (20 * 500ms)

            const checkInterval = setInterval(() => {
              attempts++;

              const features = mapRef.map?.querySourceFeatures(HUT_SOURCE_ID, {
                sourceLayer: HUT_SOURCE_LAYER,
                filter: ['==', ['get', 'slug'], newSlug],
              });

              if (features && features.length > 0) {
                clearInterval(checkInterval);
                const feature = features[0];

                // Deselect previous hut
                if (selectedHutFeature.value) {
                  mapRef.map?.setFeatureState(
                    {
                      source: HUT_SOURCE_ID,
                      sourceLayer: HUT_SOURCE_LAYER,
                      id: selectedHutFeature.value.id,
                    },
                    { selected: false }
                  );
                }

                // Select new hut
                mapRef.map?.setFeatureState(
                  { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: feature.id },
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
          { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: selectedHutFeature.value.id },
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
  if (e.target.getZoom() > MIN_HUT_CLICK_ZOOM) {
    e.target.getCanvas().style.cursor = 'pointer';
  }
}

// Change it back to a pointer when it leaves.
function onLayerLeave(e: MapLayerEventType['mouseleave']) {
  if (e.target.getZoom() > MIN_HUT_CLICK_ZOOM) {
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
        @map:error="onMapError"
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
          :offset="[$q.platform.is.mobile ? 12 : 12, $q.platform.is.mobile ? 20 : 14]"
        />
        <WdOverlaySwitch
          position="top-left"
          direction="down"
          :offset="[$q.platform.is.mobile ? 12 : 12, $q.platform.is.mobile ? 12 : 68]"
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
