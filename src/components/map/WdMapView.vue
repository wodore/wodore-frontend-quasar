<script setup lang="ts">
import { ref, inject, watchEffect, watch, onErrorCaptured, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  useResizeObserver,
  useDebounceFn,
  useThrottleFn,
  useEventListener,
  useMediaQuery,
} from '@vueuse/core';
import { useQuasar } from 'quasar';
import { useBasemapStore } from '@stores/map/basemap-store';
import type { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { showErrorDialogPersistent, ErrorCode } from '@components/error';
import type { Map, PaddingOptions } from 'maplibre-gl';
import { LngLatLike, MapGeoJSONFeature, MapLayerEventType, Point, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
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
import { currentLocale } from '@services/locale';
import { clientWodore } from '@clients/index';
import { GLOBE_SKY, MAP_MIN_ZOOM } from '@stores/map/utils/map-constants';
import { ensureWorldUnderlay } from '@stores/map/utils/world-underlay';

// MapLibre v6 resolves its web worker via import.meta.url, which breaks under
// Vite's dependency optimization: the rewritten worker URL 404s and vector
// tile sources (like the huts layer) silently never render. Point the library
// at the worker chunk emitted by Vite instead.
setWorkerUrl(maplibreWorkerUrl);

// ============================================================================
// Constants
// ============================================================================

const MOBILE_DANGER_MARGIN = 100;
const DESKTOP_DANGER_MARGIN = 150;
const MOBILE_DRAWER_MARGIN = -75;
const MIN_HUT_CLICK_ZOOM = 8;
// Disable map position hash sync in hash routing mode (previews):
// vue-maplibre-gl appends &p=zoom/lat/lng to the Vue Router hash,
// breaking route matching on refresh
const isHashMode = process.env.VUE_ROUTER_MODE !== 'history';
const MIN_FLY_ZOOM = 9;
const FLY_DURATION = 600; // ms
const INITIAL_ZOOM = 12;
const MOBILE_DRAWER_DEFAULT_RATIO = 0.5; // 50% of screen height
const MOBILE_DRAWER_TRACK_THRESHOLD = 100;

// Desktop drawer widths (matches MainLayout.vue desktopDrawerWidth; Quasar
// md boundary — $breakpoint-sm + 1 = 770px — is where the desktop drawer
// exists at all)
const DESKTOP_DRAWER_WIDTH_LARGE = 460;
const DESKTOP_DRAWER_WIDTH_MEDIUM = 380;

// Mobile map chrome lives below Quasar's md boundary. Keep the media
// query in ONE place — it drives the attribution chip swap (see
// syncAttributionChip) and tap-to-focus.
const MOBILE_MAP_QUERY = '(max-width: 769px)';
const isMobileMap = useMediaQuery(MOBILE_MAP_QUERY);

// Below these zooms the globe limb is exposed and the dark space
// backdrop fades in/out — hysteresis dead-band (ON ≤ 5.0, OFF ≥ 5.4)
// prevents class thrash while pinching at the boundary (advisor review)
const SPACE_BACKDROP_ZOOM_ON = 5.0;
const SPACE_BACKDROP_ZOOM_OFF = 5.4;

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
 * Matches MainLayout.vue desktopDrawerWidth
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
// IMPORTANT: pass an EMPTY style to MglMap — not the real style URL,
// and not undefined. undefined → "no style" errors from overlay stores
// that query the map before setBasemap() completes. The real style URL
// → loaded by the constructor WITHOUT our transformStyle (relative
// glyph/sprite URLs → 404s on F5 reload, see previous fix). An empty
// style object is valid, needs no URL pinning, and lets setBasemap()
// apply the real style through setStyle() with transformStyle.
const initialMapStyle = ref<import('maplibre-gl').StyleSpecification>({
  version: 8 as const,
  sources: {},
  layers: [],
});

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

const mapDiv = ref<HTMLElement | null>(null);
const mapResize = useDebounceFn(() => {
  mapRef.map?.resize();
}, 50);

useResizeObserver(mapDiv, () => {
  mapResize();
});
//const hutjson = ref(
//  `${getEnv('WODORE_API_HOST')}/${getEnv('WODORE_API_VERSION')}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
//);

function onMapLoad(e: MglEvent<'load'>) {
  collapseAutoExpandedAttribution();
  console.debug(`[onMapLoad] Maplibre version ${e.map.version} loaded`);

  // Globe projection: world coverage when zoomed out (the camera shows the
  // planet below ~z6 and smoothly transitions back to mercator around z12,
  // so local views render exactly as before). Basemap switches preserve it
  // via transformStyle, which injects the same projection into the style.
  e.map.setProjection({ type: 'globe' });

  // Atmosphere rim around the planet; fades out by z9 so tilted close-up
  // views keep a daylight horizon. The dark space BACKDROP is CSS (see
  // .maplibregl-canvas-container below). Basemap switches carry the sky
  // via transformStyle (GLOBE_SKY), same as the projection.
  e.map.setSky(GLOBE_SKY);

  // World underlay (cheap colored OSM raster) below the basemap layers —
  // regional basemaps (swisstopo/basemap.at raster) leave the rest of the
  // planet blank; the underlay shows through those gaps (basemap switches
  // get it via transformStyle / withWorldUnderlay)
  ensureWorldUnderlay(e.map);

  // Country basemap restored from a previous session: the raw initial
  // style carries no world fallback (composing it needs an async style
  // fetch) — re-apply the active basemap once, which merges the default
  // beneath the country layers (see setBasemap / country-fallback.ts)
  const activeBasemap = basemapStore.getBasemap();
  if (activeBasemap?.countryOnly) {
    void basemapStore.setBasemap(activeBasemap, true);
  }

  // Space backdrop gate: the dark backdrop (.wd-map-space — an opacity-
  // faded gradient layer, see SCSS below) only applies once the camera is
  // far enough out to expose the planet limb; during app/map load and at
  // normal zooms the wrapper keeps its light base color instead of
  // flashing black
  const updateSpaceBackdrop = () => {
    const container = e.map.getContainer();
    const zoom = e.map.getZoom();
    if (container.classList.contains('wd-map-space')) {
      if (zoom >= SPACE_BACKDROP_ZOOM_OFF) container.classList.remove('wd-map-space');
    } else if (zoom <= SPACE_BACKDROP_ZOOM_ON) {
      container.classList.add('wd-map-space');
    }
  };
  updateSpaceBackdrop();
  e.map.on('zoom', updateSpaceBackdrop);

  // Dev-only handle for debugging and e2e tests (map.project for exact
  // marker tap positions). Stripped from production behavior by the guard.
  if (process.env.DEV) {
    (window as unknown as Record<string, unknown>).__wodoreMap = e.map;
  }

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
  }, 1000); // Throttle to 1 second

  // Update location on map movements (only 'end' events to reduce redundant calls)
  e.map.on('moveend', updateLocation);
  e.map.on('zoomend', updateLocation);
  e.map.on('rotateend', updateLocation);
  e.map.on('pitchend', updateLocation);

  // Immediate update function (for visibility changes)
  const immediateUpdate = () => {
    if (!isPageVisible.value) return;

    const center = e.map.getCenter();
    const zoom = e.map.getZoom();

    localPropertiesStore.updateLocation({
      lat: center.lat,
      lng: center.lng,
      zoom: zoom,
      bearing: e.map.getBearing(),
      pitch: e.map.getPitch(),
    });
  };

  // Listen for visibility changes
  useEventListener(document, 'visibilitychange', () => {
    if (!document.hidden) {
      // Update location immediately when tab becomes visible
      immediateUpdate();
    } else {
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

  // vue-maplibre-gl wraps the native event: the MapLibre error lives at
  // e.event.error (bare e.error is undefined)
  const raw = e as { error?: unknown; event?: { error?: unknown } };
  const errorObj = (raw.error ?? raw.event?.error) as Record<string, unknown> | undefined;

  // Check if it's a WebGL error
  if (errorObj && typeof errorObj === 'object') {
    if (
      errorObj.type === 'webglcontextcreationerror' ||
      errorObj.message?.toString().includes('WebGL')
    ) {
      console.error('[onMapError] WebGL context creation failed:', errorObj);
      showErrorDialogPersistent(ErrorCode.WEBGL_NOT_SUPPORTED);
      return;
    }
  }

  // Basemap fallback: an auth failure from the tile/style host (e.g. a
  // suspended or exhausted MapTiler key) would otherwise leave a blank,
  // broken map. Silently switch once to the keyless OpenFreeMap Liberty
  // vector style (labels included — OpenFreeMap also serves the glyphs).
  // No user notification — the map simply keeps working. Weak-GPU devices
  // never get here: their raster variant is the keyless OSM raster.
  // `activeBasemapUsesMapTiler()` is the re-trigger guard: after a switch
  // the active basemap is the keyless Liberty (or OSM raster) style, so its
  // errors cannot re-arm the fallback. A previously used one-shot flag made
  // every LATER selection of a MapTiler basemap fail silently into "no
  // change" — the user must always be able to re-select and get the
  // graceful keyless fallback again.
  if (isTileAuthFailure(errorObj) && activeBasemapUsesMapTiler()) {
    const candidates = basemapStore.basemaps as BasemapSwitchItem[];
    const fallback = candidates.find(b => b.name === 'openfreemap-liberty');
    if (fallback) {
      console.warn(
        '[onMapError] Tile host rejected requests - falling back to OpenFreeMap Liberty'
      );
      // Not persisted: the next session retries the user's chosen basemap
      void basemapStore.setBasemap(fallback, true, false);
    }
    return;
  }

  // Maptoolkit fallback: the default outdoor basemap rides on the
  // Community-License tile service (best effort, fair-use limits). If
  // its tiles are rejected or throttled, silently switch to our own
  // keyless OpenFreeMap outdoor style — visually as close as possible.
  // Same re-trigger guard idea as above: once on outdoor-osm, its own
  // errors cannot re-arm this path.
  if (isMtkTileFailure(errorObj) && activeBasemapIsMtkOutdoor()) {
    const candidates = basemapStore.basemaps as BasemapSwitchItem[];
    const fallback = candidates.find(b => b.name === 'outdoor-osm');
    if (fallback) {
      console.warn(
        '[onMapError] Maptoolkit tiles unavailable - falling back to OpenFreeMap outdoor'
      );
      void basemapStore.setBasemap(fallback, true, false);
    }
    return;
  }

  // For other errors, show generic map error
  //console.error('[onMapError] Generic map error:', event.error);
  //showErrorDialog({ errorCode: ErrorCode.MAP_ERROR });
}

function isTileAuthFailure(errorObj: Record<string, unknown> | undefined): boolean {
  const status = errorObj?.status as number | undefined;
  const message = (errorObj?.message?.toString() ?? '').toLowerCase();
  // Only match TILE source auth failures — glyph 403s are non-critical
  // (MapLibre falls back to local font rendering). Checking for
  // "tile" in the error message distinguishes the two.
  const isTileError = message.includes('tile') || !message;
  return (
    isTileError &&
    (status === 403 ||
      status === 401 ||
      message.includes('403') ||
      message.includes('forbidden') ||
      message.includes('unauthorized'))
  );
}

function activeBasemapUsesMapTiler(): boolean {
  const active = basemapStore.getBasemap();
  if (!active) return false;
  const style = active.style as string | { sources?: Record<string, { tiles?: string[] }> };
  if (typeof style === 'string') {
    return style.includes('api.maptiler.com');
  }
  return Object.values(style.sources ?? {}).some(source =>
    (source.tiles ?? []).some(url => url.includes('api.maptiler.com'))
  );
}

/** Maptoolkit Community-License failures: rejected (401/403) or throttled (429). */
function isMtkTileFailure(errorObj: Record<string, unknown> | undefined): boolean {
  const status = errorObj?.status as number | undefined;
  const message = (errorObj?.message?.toString() ?? '').toLowerCase();
  const isTileError = message.includes('tile') || !message;
  return (
    isTileError &&
    (status === 401 ||
      status === 403 ||
      status === 429 ||
      message.includes('too many requests') ||
      message.includes('rate limit'))
  );
}

function activeBasemapIsMtkOutdoor(): boolean {
  return basemapStore.getBasemap()?.name === 'outdoor-mtk';
}

/**
 * WebGL support pre-check. When WebGL is unavailable the map fails with a
 * GPUInitializationError that is only console-logged, and every subsequent
 * map interaction throws generic TypeErrors — which the error-based
 * detection above cannot recognize (the map just stays white). Detecting it
 * up front lets us show the proper error dialog and skip mounting MglMap.
 */
const webglSupported = (() => {
  if (typeof document === 'undefined') return true; // SSR — decide on client
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
})();

if (!webglSupported) {
  console.error('[WdMapView] WebGL is not supported by this browser/device');
  showErrorDialogPersistent(ErrorCode.WEBGL_NOT_SUPPORTED);
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

// Clear the hut selection when the hut route is left (sheet dismissed by
// dragging, closed via the X button, or back navigation). Without this the
// marker stays selected and the next tap on the same hut is treated as a
// deselect-toggle (pushes back to the map) instead of re-opening its content.
watch(
  () => route.params.slug,
  slug => {
    if (slug === undefined && selectedHutFeature.value !== undefined) {
      const featureId = selectedHutFeature.value.id;
      selectedHutFeature.value = undefined;
      mapRef.map?.setFeatureState(
        { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: featureId },
        { selected: false }
      );
    }
  }
);

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
          query: { lang: currentLocale() },
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
          // Route moved on while polling - a newer hut selection takes over
          if (route.params.slug !== slug) {
            clearInterval(checkInterval);
            return;
          }
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
          query: { lang: currentLocale() },
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
            params: { path: { slug: newSlug }, query: { lang: currentLocale() } },
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

              // Route moved on while polling - stop selecting the old hut
              if (route.params.slug !== newSlug) {
                clearInterval(checkInterval);
                return;
              }

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

// ── Focus mode ─────────────────────────────────────────────────────────
// Mobile: tap empty map to hide floating chrome; desktop: button
const mapFocus = ref(false);
let focusTapTimer: ReturnType<typeof setTimeout> | null = null;
let lastFocusToggleAt = 0;
/** State before the current rapid-toggle pair — a double-tap reverts to it */
let focusPairOrigin: boolean | null = null;

function setMapFocus(on: boolean): void {
  if (focusTapTimer) {
    clearTimeout(focusTapTimer);
    focusTapTimer = null;
  }
  const now = Date.now();
  // Rapid pair (double-tap): the second toggle reverts to the ORIGINAL
  // state instead of flickering exit→enter (or enter→exit).
  if (now - lastFocusToggleAt < 700 && focusPairOrigin !== null && focusPairOrigin !== on) {
    mapFocus.value = focusPairOrigin;
    document.body.classList.toggle('wd-map-focus', focusPairOrigin);
    focusPairOrigin = null;
    lastFocusToggleAt = 0;
    return;
  }
  focusPairOrigin = mapFocus.value;
  mapFocus.value = on;
  document.body.classList.toggle('wd-map-focus', on);
  lastFocusToggleAt = now;
}

let lastMapTapAt = 0;

/**
 * Focus-mode activation: a DELIBERATE single tap on empty map only.
 *  - pan/drag: movement over 10px between down and up cancels
 *  - pinch-zoom: a second pointer or wheel cancels
 *  - taps on huts/markers/controls: ignored (cursor check + closest())
 *  - double-tap (zoom): the second tap inside 450ms cancels
 * The 500ms timer keeps the double-tap guard after a clean tap.
 */
const tapDown = { x: 0, y: 0, t: 0, active: false };

function cancelPendingTap(): void {
  tapDown.active = false;
  if (focusTapTimer) {
    clearTimeout(focusTapTimer);
    focusTapTimer = null;
  }
}

function onMapPointerDown(ev: MouseEvent): void {
  if (!isMobileMap.value) return;
  const pointerType = (ev as unknown as { pointerType?: string }).pointerType;
  if (pointerType !== 'touch') return; // desktop has the explicit button
  if (
    (ev.target as HTMLElement).closest(
      '.maplibregl-ctrl, .maplibregl-popup, .maplibregl-marker, .q-page-sticky, .wd-focus-toggle'
    )
  )
    return;
  // A tap that CLOSES an open panel (expanded overlay / basemap rail) is
  // consumed — it must not also enter focus mode.
  if (document.querySelector('.wd-ovl__box--expanded, .wd-bm__rail')) {
    cancelPendingTap();
    lastMapTapAt = 0;
    return;
  }
  const canvas = mapDiv.value?.querySelector('canvas');
  if (canvas && canvas.style.cursor === 'pointer') return;

  // second finger = pinch, not a tap
  if (tapDown.active) {
    cancelPendingTap();
    return;
  }
  tapDown.x = ev.clientX;
  tapDown.y = ev.clientY;
  tapDown.t = Date.now();
  tapDown.active = true;
}

function onMapPointerMove(ev: MouseEvent): void {
  if (!tapDown.active) return;
  if (Math.hypot(ev.clientX - tapDown.x, ev.clientY - tapDown.y) > 10) {
    cancelPendingTap(); // it's a pan
  }
}

/** True when a hut symbol renders at the point (canvas features — the
 *  cursor check only helps mouse; touch never hovers). Below the
 *  hut-click zoom the tap can never open a detail (onHutLayerClick's
 *  gate) — suppressing focus mode there produced dead taps (hit a hut
 *  symbol zoomed out → no detail AND no focus toggle). Same gate as
 *  onLayerEnter's cursor check: reserved-for-detail only above it. */
function tapHitsHut(x: number, y: number): boolean {
  const map = mapRef.map;
  if (!map) return false;
  if (map.getZoom() <= MIN_HUT_CLICK_ZOOM) return false;
  try {
    const hits = map.queryRenderedFeatures([x, y], {
      layers: [HUT_LAYER_ID, 'wd-bookings-huts'].filter(id => map.getLayer(id)),
    });
    return hits.length > 0;
  } catch {
    return false;
  }
}

function onMapPointerUp(): void {
  if (!tapDown.active) return;
  tapDown.active = false;
  const now = Date.now();
  // Taps on hut symbols open the detail — never focus mode
  if (tapHitsHut(tapDown.x, tapDown.y)) {
    lastMapTapAt = 0;
    cancelPendingTap();
    return;
  }
  // too slow = long-press, not a tap
  if (now - tapDown.t > 400) {
    cancelPendingTap();
    return;
  }

  if (now - lastMapTapAt < 350) {
    // Second tap of a double-tap (zoom intent):
    lastMapTapAt = 0;
    cancelPendingTap();
    if (mapFocus.value && now - lastFocusToggleAt < 900) {
      setMapFocus(false);
    }
    return;
  }
  lastMapTapAt = now;
  if (focusTapTimer) {
    clearTimeout(focusTapTimer);
    focusTapTimer = null;
  }
  focusTapTimer = setTimeout(() => {
    focusTapTimer = null;
    setMapFocus(!mapFocus.value);
  }, 250);
}

onMounted(() => {
  const el = mapDiv.value;
  if (!el) return;
  el.addEventListener('pointerdown', onMapPointerDown);
  el.addEventListener('pointermove', onMapPointerMove);
  el.addEventListener('pointerup', onMapPointerUp);
  el.addEventListener('pointercancel', cancelPendingTap);
  el.addEventListener('wheel', cancelPendingTap, { passive: true });
  // Safety net: if a dblclick DOES arrive, treat it the same way
  el.addEventListener('dblclick', () => {
    lastMapTapAt = 0;
    cancelPendingTap();
    if (mapFocus.value && Date.now() - lastFocusToggleAt < 900) {
      setMapFocus(false);
    }
  });
});

/** Mobile uses an OWNED attribution chip (`.wd-attrib`, appended to
 *  <body>) because MapLibre's markup is unreachable there — the PE-none
 *  control container skips fixed children in hit-testing and its own CSS
 *  fights ours. Desktop shows MapLibre's native chip.
 *  Runs at map load AND on every crossing of the mobile boundary, so a
 *  landscape-loaded phone picks the chip up when rotating to portrait
 *  (and drops it again back on desktop). Idempotent in all four states. */
function syncAttributionChip(): void {
  const chip = document.querySelector('.wd-attrib');
  const original = document.querySelector('.maplibregl-ctrl-attrib');
  if (isMobileMap.value) {
    if (!original) return;
    if (chip) {
      // Refresh the copy: MapLibre populates/updates the inner text on
      // style changes, so a chip created before the first styledata (or
      // before a basemap switch) would otherwise show empty/stale text.
      const text = chip.querySelector('.wd-attrib__text');
      const source = original.querySelector('.maplibregl-ctrl-attrib-inner');
      if (text && source) text.innerHTML = source.innerHTML;
      return;
    }
    (original as HTMLElement).style.display = 'none';
    const newChip = document.createElement('button');
    newChip.type = 'button';
    newChip.className = 'wd-attrib';
    newChip.setAttribute('aria-label', 'Attribution');
    // Icon: a plain italic "i" — the circle is the chip itself (CSS)
    newChip.innerHTML =
      '<span class="wd-attrib__i"><span class="wd-attrib__info">i</span><svg class="wd-attrib__close" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span>' +
      '<span class="wd-attrib__text">' +
      (original.querySelector('.maplibregl-ctrl-attrib-inner')?.innerHTML ?? '') +
      '</span>';
    newChip.addEventListener('click', ev => {
      ev.stopPropagation();
      newChip.classList.toggle('wd-attrib--open');
    });
    document.body.appendChild(newChip);
  } else if (chip) {
    chip.remove();
    if (original) (original as HTMLElement).style.display = '';
  }
}

// Keep the swap in sync across the boundary after load (rotation, window
// resize). Initial state comes from the map-load path below.
watch(isMobileMap, () => syncAttributionChip());

/** MapLibre mixes the <details> `open` ATTRIBUTE with its
 *  `maplibregl-compact-show` class — they desync (starts expanded, close
 *  taps stop working). We own the state: sync BOTH on every toggle.
 *  Taps never reach focus mode (the .maplibregl-ctrl guard matches). */
function collapseAutoExpandedAttribution(): void {
  window.setTimeout(() => {
    document.querySelectorAll('.maplibregl-ctrl-attrib').forEach(el => {
      const details = el as unknown as {
        open: boolean;
        removeAttribute: (n: string) => void;
      };
      // collapsed start — clear BOTH signals
      details.open = false;
      details.removeAttribute('open');
      el.classList.remove('maplibregl-compact-show');
    });
    syncAttributionChip();
  }, 800);
}

function onMapStyledata(e: MglEvent<'styledata'>) {
  //$q.loadingBar.start();
  console.debug('[onMapStyledata] Style data changed event', e);
}
</script>
<style lang="scss">
//@import 'vue-maplibre-gl/dist/vue-maplibre-gl.css';

// Space around the globe: the WebGL canvas is transparent outside the
// planet, so the map wrapper doubles as the sky. Design (advisor review:
// Google Earth / Apple Maps converge on the same): a static blue-black
// radial vignette anchored to the VIEWPORT — no stars (decoration, and
// paint cost on software GL), identical in day and night themes.
//
// Implementation notes:
// - The gradient lives on a ::before LAYER and fades via OPACITY:
//   background-color/background-image cannot tween between a flat color
//   and a gradient, opacity on a static layer is GPU-composited and
//   cheap. The pseudo-element paints below the canvas (preceding box in
//   the same stacking context).
// - The wrapper keeps a permanent light base color — that is what kills
//   the black flash while the app/map loads.
// - GATED by camera zoom (.wd-map-space toggled in onMapLoad, hysteresis
//   ON ≤ 5.0 / OFF ≥ 5.4): dark only once the planet limb is exposed.
.wd-map-fill .maplibregl-map {
  background-color: #f6f9f7;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 400ms ease;
    background-image: radial-gradient(
      ellipse 90% 90% at 50% 48%,
      #0b1726 0%,
      #060d16 55%,
      #02040a 100%
    );
  }

  &.wd-map-space::before {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wd-map-fill .maplibregl-map::before {
    transition-duration: 1ms;
  }
}

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
    transform $drawer-duration $drawer-transition,
    left $drawer-duration $drawer-transition,
    right $drawer-duration $drawer-transition,
    top $drawer-duration $drawer-transition,
    bottom $drawer-duration $drawer-transition !important;
}

//.maplibregl-ctrl-top-left {
//  pointer-events: all;
//}
</style>
<template>
  <!-- @map:render="onMapRender" -->
  <q-no-ssr>
    <div ref="mapDiv" class="wd-map-fill">
      <MglMap
        v-if="webglSupported"
        @map:load="onMapLoad"
        @map:error="onMapError"
        @map:styledata="onMapStyledata"
        :hash="isHashMode ? false : 'p'"
        :map-style="initialMapStyle"
        :zoom="mapZoom"
        :bearing-snap="15"
        :center="mapCenter"
        :attribution-control="false"
        :min-zoom="MAP_MIN_ZOOM"
        :max-tile-cache-size="400"
        :max-parallel-image-requests="32"
        :render-world-copies="false"
      >
        <!-- ── Map controls (v2 clean layout) ──────────────────────────── -->
        <!-- Bottom-right: overlay strip above basemap (basemap opens LEFT).
             pointer-events: none on the wrapper — interactive elements
             inside the controls opt back in, so map gestures pass through
             every empty pixel. -->
        <q-page-sticky position="bottom-right" :offset="[12, 14]" class="wd-map-ctl-sticky">
          <div class="wd-map-ctl-col">
            <WdOverlayControl />
            <WdBasemapControl />
          </div>
        </q-page-sticky>

        <!-- Zoom slider: focus mode only on mobile (left edge) -->
        <WdZoomSlider />

        <!-- Focus (fullscreen) toggle: desktop always visible below the
             top-right nav cluster; mobile only visible IN focus mode -->
        <button
          class="wd-focus-toggle"
          :class="{ 'wd-focus-toggle--active': mapFocus }"
          :aria-label="mapFocus ? 'Exit focus mode' : 'Focus mode'"
          @click.stop="setMapFocus(!mapFocus)"
        >
          <svg
            v-if="!mapFocus"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
          <svg
            v-else
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <!-- Top-right: GPS + compass (desktop zoom too) -->
        <MglGeolocateControl :position="isMobileView() ? 'bottom-left' : 'top-right'" />
        <MglNavigationControl
          :show-zoom="!isMobileView()"
          :position="isMobileView() ? 'bottom-left' : 'top-right'"
        />

        <!-- Scale: mobile top-center, desktop bottom-left -->
        <MglScaleControl :position="isMobileView() ? 'top-left' : 'bottom-left'" />

        <!-- Attribution: mobile compact ⓘ bottom-left above the GPS cluster;
             desktop full text bottom-left above the scale -->
        <MglAttributionControl v-if="isMobileView()" position="bottom-left" :compact="true" />
        <MglAttributionControl v-else position="bottom-left" :compact="false" />
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
      <!-- Translucent footer shade (native app): keeps the attribution
           zone readable over the map while the map stays visible
           through it. Rendered always, hidden outside capacitor via CSS. -->
      <div class="map-footer-shade" aria-hidden="true"></div>
    </div>
  </q-no-ssr>
</template>

<style lang="scss">
// Native app navigation bar zone overlay: a gradient that helps
// the nav bar icons read over map content. Uses BOTH the system
// theme media queries AND the app body classes as fallback (Samsung
// WebView doesn’t reliably support prefers-color-scheme).
body.capacitor .map-footer-shade {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
  height: calc(var(--q-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 12px);
  // Fallback: always show a dark gradient (works in both themes,
  // overridden by the media queries below when they match)
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.2) 50%, transparent);
}

// System dark: dark gradient
@media (prefers-color-scheme: dark) {
  body.capacitor .map-footer-shade {
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.3) 50%, transparent);
  }
}

// System light: light gradient
@media (prefers-color-scheme: light) {
  body.capacitor .map-footer-shade {
    background: linear-gradient(
      to top,
      rgba(255, 255, 255, 0.7),
      rgba(255, 255, 255, 0.3) 50%,
      transparent
    );
  }
}
</style>
