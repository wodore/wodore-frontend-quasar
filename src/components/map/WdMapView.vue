<script setup lang="ts">
import {
  ref,
  inject,
  watchEffect,
  watch,
  onErrorCaptured,
  computed,
  defineAsyncComponent,
  onMounted,
  onScopeDispose,
} from 'vue';
import { useRoute } from 'vue-router';
import {
  useResizeObserver,
  useDebounceFn,
  useThrottleFn,
  useEventListener,
  useMediaQuery,
} from '@vueuse/core';
import { useQuasar } from 'quasar';
import { useBasemapStore, mapProfileForTier } from '@stores/map/basemap-store';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useMapCatalogStore } from '@stores/map/map-catalog-store';
import { startRevealLoop } from './reveal-scheduler';

// Non-WebGL fallback (POC): Leaflet + clustered hut dots, async-loaded
// so the Leaflet chunk never downloads for WebGL users.
const WdFallbackMapView = defineAsyncComponent(() => import('./WdFallbackMapView.vue'));
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { showErrorDialogPersistent, ErrorCode } from '@components/error';
import type { Map, PaddingOptions } from 'maplibre-gl';
import {
  LngLatLike,
  MapGeoJSONFeature,
  MapLayerEventType,
  Point,
  setMaxParallelImageRequests,
  setWorkerUrl,
} from 'maplibre-gl';
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
import { getEnv } from '@services/runtimeEnv';
import { storageGet } from '@services/storage';
import { clientWodore } from '@clients/index';
import { seedPlaceFromMap } from '@composables/usePlace';
import { setMapBootPending } from '@composables/useRequestProgress';
import { forcedGpuTier, GPU_TIER_FALLBACK, rendererProfile } from '@services/gpu-override';
import { MAP_MIN_ZOOM } from '@stores/map/utils/map-constants';
import { isBasemapStyleGone } from '@stores/map/utils/basemap-fallback';
import {
  derivedClaimedLayers,
  derivedInteractiveLayers,
  tapTargetsInteractiveLayer,
} from '@stores/map/utils/interactive-layers';
import { createWhatsHereGesture } from '@stores/map/utils/whats-here-gesture';
import { registerProjector } from '@selection/projector';
import { targetsFromFeatures, type RenderedFeatureLike } from '@selection/props-from-feature';
import {
  CLUSTER_ZOOM_STEP,
  clusterClickAction,
  clusterCountOf,
  clusterParamsFromTilesUrl,
  clusterTargetFromFeature,
  isClusterLayerId,
  isClusterProps,
  servedTileZoom,
  type ClusterClickContext,
} from '@selection/cluster-behavior';
import { amenityClusterEntry } from '@selection/entries/amenity-cluster';
import { fetchWhatsHere } from '@services/cluster-members';
import { entryForNearPlace, nearPlaceTarget } from '@selection/near-places';
import { useSelectionStore } from '@stores/map/selection-store';

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
// Disable map position hash sync in hash routing mode (previews):
// vue-maplibre-gl appends &map=zoom/lat/lng to the Vue Router hash,
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

// DOM that is NOT the map for tap/gesture purposes: MapLibre controls,
// popups, markers, Quasar sticky chrome, the focus toggle and the
// fallback-map (Leaflet) equivalents. Both the mobile focus-tap guard and
// the what's-here contextmenu probe must ignore gestures on these.
const NON_MAP_TAP_SELECTOR =
  '.maplibregl-ctrl, .maplibregl-popup, .maplibregl-marker, .q-page-sticky, .wd-focus-toggle, .leaflet-control, .leaflet-marker-icon, .leaflet-marker-cluster, .wd-fb-bm';

// Mobile map chrome lives below Quasar's md boundary. Keep the media
// query in ONE place — it drives the attribution chip swap (see
// syncAttributionChip) and tap-to-focus.
const MOBILE_MAP_QUERY = '(max-width: 769px)';
const isMobileMap = useMediaQuery(MOBILE_MAP_QUERY);

// Map layer IDs
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
const route = useRoute();
const basemapStore = useBasemapStore();
const overlayStore = useOverlayStore();
const mapRef = useMap();
const localPropertiesStore = useLocalPropertiesStore();
// Backend map catalog: swap catalog-compiled overlays in once the
// catalog answers (factory definitions render until then).
const mapCatalogStore = useMapCatalogStore();
void mapCatalogStore.initOverlays();

// ── Tier-adaptive render profile ────────────────────────────────────────
// Read the cached GPU tier synchronously (null on first visit).
// First visit: HIGH defaults — basemap tiles only load after gpuSpecReady
// resolves, so the high-spec window is ~nil. Subsequent visits: the
// cached tier gives correct constructor values immediately.
const _cachedGpuTier = storageGet('gpuTier') as { tier: number; gpu?: string | null } | null;
const initialMapProfile = mapProfileForTier(_cachedGpuTier);

// validateStyle: schema validation only in non-production envs
const validateStyle = getEnv('WODORE_ENV') !== 'production';

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
    // Left inset: the Quasar left-drawer offset (0 today — the menu docks
    // right). The floating content card needs NO inset: its max height
    // stops above the bottom-left chrome (scale + attribution), so those
    // stay visible in place (owner 2026-10).
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

// ── Loader reveal (owner spec, 2026-10) ─────────────────────────────────
// The branded loader (WdMapLoader) covers the map until the base
// basemap AND the overlays have rendered; then the map fades in.
// Signal: the first map 'idle' AFTER the overlay compile finished
// (catalog 'ready'; 'error' reveals too — the catalog row shows the
// error itself) AND with a real style applied (the initial style is
// empty — its idle must not reveal an empty map; a background-only
// style (<2 layers) is treated as not-yet). A safety timer never lets
// a never-settling map (slow/erroring tiles) hold the loader hostage.
const emit = defineEmits<{ (e: 'rendered'): void; (e: 'mapready'): void }>();
const mapRendered = ref(false);
/** Reveal timers (settled-class + chrome release) — tracked so a scope
 * dispose can cancel them (review N1: the dispose contract must hold
 * for EVERY reveal side effect, not just the scheduler's). */
const revealTimers: number[] = [];

function revealMap(_map?: Map): void {
  if (mapRendered.value) return;
  mapRendered.value = true;
  emit('rendered');
  // Blur-reveal cleanup: once the 900ms unblur transition has run,
  // drop the filter entirely (a standing blur(0) keeps the canvas
  // composited — see the reveal-choreography comment in the styles).
  revealTimers.push(
    window.setTimeout(() => mapDiv.value?.classList.add('wd-map-fill--settled'), 1000)
  );
  // Chrome entrance (owner brief): the page boots in map-focus mode
  // (index.html body class) so the topbar/controls stay hidden behind
  // the splash — releasing it here makes the chrome fly IN (existing
  // focus-mode transitions) staggered with the splash fade-out.
  // `wd-booting` must come off WITH the focus release, not before: an
  // overlay strip left open across a refresh must never flash the
  // zoom handle in (boot hides it via opacity 0; removing booting
  // while focus is still on would fade it in for 120ms only to tuck
  // it out again — owner report).
  document.documentElement.classList.remove('wd-map-focus', 'wd-booting');
  if (document.body.classList.contains('wd-map-focus')) {
    // Delay the release ~120ms so the 300ms chrome transitions LAND as
    // the splash surface clears — chrome settles onto the open stage,
    // not over a half-green one (design verdict fix #2).
    revealTimers.push(
      window.setTimeout(() => {
        document.body.classList.remove('wd-map-focus', 'wd-booting');
        mapFocus.value = false;
      }, 120)
    );
  } else {
    document.body.classList.remove('wd-booting');
  }
}

/** Fallback map ready (Leaflet initialized): same reveal ladder as
 * the MapLibre path — release the splash/chrome and pre-signal the
 * loader (words fade out). */
function onFallbackReady(): void {
  revealMap();
  emit('mapready');
}

/** Fallback reveal safety ladder: the MapLibre path has one (8s/20s in
 *  scheduleReveal), the fallback path did NOT — a chunk-load failure or a
 *  component error (observed with stale vite optimized-deps in a long-
 *  lived tab) left the splash on the mono logo FOREVER. If `ready` has
 *  not arrived within 8s, reveal anyway — a blank-but-usable app beats
 *  an infinite splash — and say so in the console. */
function scheduleFallbackReveal(): void {
  revealTimers.push(
    window.setTimeout(() => {
      if (!mapRendered.value) {
        console.error(
          '[WdMapView] fallback map did not signal ready within 8s — revealing anyway ' +
            '(check the browser console for chunk-load or component errors; a hard ' +
            'reload clears stale dev-server chunks)'
        );
        revealMap();
      }
    }, 8000)
  );
}

// Reveal scheduling (progressive, owner 2026-10-31): arm as soon as the
// MAP INSTANCE exists — NOT on MapLibre's `load` event, which is
// idle-gated and idle waits for glyph PBFs (measured: `load` fired at
// ~2s on slow-font boots while the basemap had painted at ~0.5s — the
// splash scheduler was armed 1.5s late for no reason). The splash gate
// itself (style applied + tile content + a painted frame) makes arming
// early safe; the 8s safety ladder still bounds it.
watch(
  () => mapRef.map,
  map => {
    if (map) scheduleReveal(map);
  },
  { immediate: true }
);

function scheduleReveal(map: Map): void {
  if (mapRendered.value) return;
  // Reveal logic lives in reveal-scheduler.ts (unit-tested for both
  // catalog-vs-idle orderings + the safety ladder; the original
  // inline version had a TDZ crash on the synchronous path — see
  // tests/unit/reveal-scheduler.spec.ts). Safety: at 8 s the splash
  // drops only if the map has PAINTED (style + visible tiles) — the
  // catalog-stuck case reveals a basemap-only map, while a cold start
  // with slow tiles keeps the branded splash instead of flashing a
  // white canvas. Absolute hard cap 20 s: a partial/empty map still
  // beats an infinite splash; overlays attach whenever they arrive.
  //
  // CRITICAL-set gating (perf/map-boot, 2026-10-31 profiling): the old
  // `painted()` used the GLOBAL `areTilesLoaded()` — it waited for every
  // source on the map, including deliberately staged-out terrain/contour
  // sources (outdoor-staging.ts attaches them only after the first
  // render), deep-zoom pattern sprites, and erroring stragglers (a 404
  // sprite), delaying the reveal by seconds after the map the user
  // actually sees was done. "Painted" now means: every source referenced
  // by a VISIBLE layer has loaded — generic across basemaps/overlays, no
  // layer-name knowledge. Glyphs (font stacks) are deliberately NOT
  // required (owner 2026-10: labels may stream in after the reveal —
  // MapLibre's `idle` waits for symbol glyph dependencies, so the
  // trigger below fires on a rendered frame instead of on idle).
  const glyphGraceFirstFalse = new globalThis.Map<string, number>();
  const SOURCE_LOAD_GRACE_MS = 1200;
  const invalidateVisibleSources = () => {
    visibleSetsCache = null;
    // Reset the grace clock too (review finding: a basemap switch that
    // reuses a source ID would see the stale first-false timestamp as
    // already past the grace — bypassing it for a source that may
    // still be loading, and releasing the topbar bar too early).
    glyphGraceFirstFalse.clear();
  };
  map.on('styledata', invalidateVisibleSources);
  /** Sources of every visible layer (visibility !== 'none'), split into
   *  the BASEMAP set and the overlay-owned set: the progressive reveal
   *  (owner 2026-10-31) drops the splash on the basemap set alone, while
   *  the full-ready milestone (topbar bar) waits for both. Memoized per
   *  styledata event; overlay ownership comes from the overlay store —
   *  no layer names hardcoded. */
  const overlayOwnedLayerIds = (): Set<string> => {
    const ids = new Set<string>();
    for (const o of overlayStore.overlays as unknown as Array<{
      active?: boolean;
      style?: { layers?: Array<{ id: string }> };
    }>) {
      for (const l of o.style?.layers ?? []) ids.add(l.id);
    }
    return ids;
  };
  /** Visible-layer source sets + the count of visible NON-overlay
   *  layers — baseLayerCount > 0 is the "a real basemap style is
   *  applied" signal (slow-4G investigation 2026-10-31: overlay layers
   * on the empty boot style satisfied the old `layers >= 2` check while
   * the basemap style was still fetching, an EMPTY base set made the
   * every-source-loaded check vacuously true, and the splash released
   * onto a map with no basemap at all — white). */
  interface VisibleSets {
    all: Set<string>;
    base: Set<string>;
    baseLayerCount: number;
  }
  let visibleSetsCache: VisibleSets | null = null;
  const visibleSourceSets = (): VisibleSets => {
    if (!visibleSetsCache) {
      const overlayIds = overlayOwnedLayerIds();
      const all = new Set<string>();
      const base = new Set<string>();
      let baseLayerCount = 0;
      for (const layer of map.getStyle()?.layers ?? []) {
        const layout = layer.layout as Record<string, unknown> | undefined;
        if (layout?.visibility === 'none') continue;
        const isOverlayLayer = overlayIds.has(layer.id);
        if (!isOverlayLayer) baseLayerCount++;
        if (!('source' in layer) || typeof layer.source !== 'string') continue;
        all.add(layer.source);
        if (!isOverlayLayer) base.add(layer.source);
      }
      visibleSetsCache = { all, base, baseLayerCount };
    }
    return visibleSetsCache;
  };
  const criticalLoaded = (
    sources: Set<string>,
    graceMs: number = SOURCE_LOAD_GRACE_MS
  ): boolean => {
    const now = Date.now();
    let allLoaded = true;
    for (const id of sources) {
      if (map.isSourceLoaded(id)) {
        glyphGraceFirstFalse.delete(id);
        continue;
      }
      // Not loaded: symbol-tile sources stay "loading" while their GLYPH
      // PBFs pend (fonts are explicitly NOT reveal-blocking — owner
      // 2026-10). Give every source a short grace from its first
      // not-loaded observation; past it, a glyph-pending (or genuinely
      // stuck) source stops holding the splash — the map renders, labels
      // stream in when the fonts land. Real tile slowness on the FIRST
      // observation still waits the full grace.
      const first = glyphGraceFirstFalse.get(id);
      if (first === undefined) {
        glyphGraceFirstFalse.set(id, now);
        allLoaded = false;
        continue;
      }
      if (now - first < graceMs) allLoaded = false;
    }
    return allLoaded;
  };
  /** One-shot "settled" arm: fires on the EARLIER of (a) a rendered
   *  frame after the given source set loaded — reveal without waiting
   *  for glyph-dependent `idle` — or (b) plain map `idle` (backstop;
   *  covers a map that already settled before arming). Both are guarded
   *  by one `fired` flag; the sourcedata listener unbinds itself. */
  const armSettledOnce = (cb: () => void, sources: () => Set<string>): void => {
    let fired = false;
    let graceTimer: number | undefined;
    const fire = () => {
      if (fired) return;
      fired = true;
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      map.off('sourcedata', onSourceData);
      cb();
    };
    const evaluate = () => {
      if (fired) return;
      if (criticalLoaded(sources())) {
        map.once('render', fire);
        return;
      }
      // Not critical yet — re-check at the grace horizon: glyph-pending
      // sources go quiet (no sourcedata events once tiles are in), so
      // without a timer the grace would only be noticed by the idle
      // backstop seconds later.
      if (graceTimer === undefined) {
        graceTimer = window.setTimeout(evaluate, SOURCE_LOAD_GRACE_MS);
      }
    };
    const onSourceData = () => evaluate();
    map.once('idle', fire);
    map.on('sourcedata', onSourceData);
    evaluate();
  };
  /** The ACTIVE overlays' compiled layers must be MOUNTED before the
   *  style counts as reveal-ready (perf/map-boot, 2026-10-31): the
   *  render-based trigger below can fire while a catalog swap is still
   *  parked behind a busy style — revealing then would drop the splash
   *  onto a map whose overlay layers are not on it yet (the user must
   *  see the overlay, not a basemap-only view). No layer names are
   *  hardcoded: the required set is read from the overlay store's
   *  ACTIVE items (placeholders contribute no layers; dropped rows are
   *  already out of the list — neither can block).
   */
  const activeOverlayLayersMounted = (): boolean => {
    const overlays = overlayStore.overlays as unknown as Array<{
      active?: boolean;
      style?: { layers?: Array<{ id: string }> };
    }>;
    const required: string[] = [];
    for (const o of overlays) {
      if (!o.active) continue;
      for (const l of o.style?.layers ?? []) required.push(l.id);
    }
    if (required.length === 0) return true;
    const present = map.getStyle()?.layers;
    if (!present) return false;
    const ids = new Set(present.map(l => l.id));
    for (const id of required) {
      if (!ids.has(id)) return false;
    }
    return true;
  };
  /** PROGRESSIVE REVEAL (owner 2026-10-31): the splash drops on the
   *  FIRST PAINTED FRAME — style applied (≥2 layers), catalog settled
   *  (notifyOverlaysDone), at least one tile-content event seen, and a
   *  rendered frame after that. No per-source loading checks on this
   *  path at all: label fonts and straggler tiles no longer hold the
   *  splash (they held it through isSourceLoaded's glyph dependency —
   *  measured 1.1-2s). The old, stricter milestone (active overlays
   *  mounted + ALL visible sources loaded + a frame) stays as the
   *  FULL-ready signal: it no longer holds the splash, it releases the
   *  topbar loading bar instead (setMapBootPending — the bar rides the
   *  topbar pill, debounced in useRequestProgress, so an overlay wave
   *  that lands within 150 ms of the reveal never flashes it). */
  let layersFullyReady = false;
  const markLayersFullyReady = () => {
    layersFullyReady = true;
    setMapBootPending(false);
  };
  /** Splash gate as a POLL (perf/map-boot, 2026-10-31): the boot's event
   *  choreography defeated every once-listener formulation — the EMPTY
   * boot style fires `idle` unconditionally (~0.9s), style swaps orphan
   * armed listeners, and the busy catalog apply suppresses render
   * events for seconds. A 50 ms poll over two trivial checks (style
   * applied + tile content seen) is immune to all of it; the 8 s/20 s
   * ladder is just elapsed time in the same poll. */
  const SPLASH_LADDER_MS = 8000;
  const SPLASH_HARD_CAP_MS = 20000;
  /** PIXEL TRUTH (owner report 2026-10-31, confirmed in headed Brave on
   *  a cold profile: EVERY event-based cut — content events, time
   *  graces — revealed onto a WHITE canvas, because the worker can have
   *  data long before the first painted pixel, especially with a cold
   *  GL cache). The splash gate requires the basemap sources to be
   *  ACTUALLY loaded (`isSourceLoaded`, NO time grace — a grace passes
   *  tiles that are merely slow = white) AND a render frame after that.
   *  Fonts ride along with the basemap's symbol tiles (cached fonts
   *  make this fast; slow fonts hold the splash — accepted: white is
   *  worse than slow). Overlay/GeoJSON sources are excluded via the
   *  base set. */
  /** Sources that ERRORED (tile fetch failures do not retry — such a
   *  source will never load, and holding the splash for it forever is
   *  the infinite-splash hostage the original hard cap existed for).
   *  Loaded-or-errored is the gate: an errored source releases it. */
  const erroredSources = new globalThis.Set<string>();
  const onMapError = (e: unknown) => {
    // MapErrorEvent carries sourceId for tile/source failures (not in
    // the DOM ErrorEvent typings — narrow locally).
    const sid = (e as { sourceId?: unknown }).sourceId;
    if (typeof sid === 'string') erroredSources.add(sid);
  };
  map.on('error', onMapError);
  const SPLASH_SETTLE_MS = 150;
  /** Basemap APPLIED + its sources settled. The baseLayerCount > 0
   *  guard is load-bearing (see VisibleSets): without it, overlay
   *  layers alone on the empty boot style made this vacuously true and
   *  released a basemap-less (white) map. */
  const basemapSourcesLoaded = (): boolean => {
    const sets = visibleSourceSets();
    if (sets.baseLayerCount < 1) return false;
    for (const id of sets.base) {
      if (!map.isSourceLoaded(id) && !erroredSources.has(id)) return false;
    }
    return true;
  };
  let lastRenderAt = 0;
  const onSplashRender = () => {
    lastRenderAt = window.performance.now();
  };
  map.on('render', onSplashRender);
  const splashStartedAt = Date.now();
  let basemapContentCompleteAt: number | undefined;
  const splashPoll = window.setInterval(() => {
    if (mapRendered.value) {
      window.clearInterval(splashPoll);
      return;
    }
    const layers = map.getStyle()?.layers?.length ?? 0;
    const elapsed = Date.now() - splashStartedAt;
    // NO-WHITE rule, final form (owner 2026-10-31, Fast/Slow 4G +
    // cold cache): NO release path may ever show an unloaded basemap.
    // The 8s ladder and the 20s cap are backups for suppressed render
    // signals — both require the basemap loaded-or-errored. A
    // slow-but-working network keeps the animated splash for as long
    // as its tiles need (verified: painted reveal at ~27s Fast 4G); a
    // base source that ERRORED counts as settled (it will never load);
    // only a fully dead network holds the splash indefinitely — a
    // white map is never the better outcome.
    const baseSettled = basemapSourcesLoaded();
    const allBaseSourcesLoaded = layers >= 2 && baseSettled;
    // The 20s cap is UNCONDITIONAL (review finding: gating it on
    // baseSettled meant a silently-empty basemap style → baseLayerCount
    // 0 → both ladder AND cap permanently false → infinite splash with
    // no escape. The original hard-cap intent was an unconditional
    // last resort — a partial map always beats a branded splash after
    // 20s, even if the only alternative is white).
    const laddered = elapsed >= SPLASH_LADDER_MS && baseSettled;
    const capped = elapsed >= SPLASH_HARD_CAP_MS;
    if (allBaseSourcesLoaded && basemapContentCompleteAt === undefined) {
      basemapContentCompleteAt = window.performance.now();
    }
    if (!allBaseSourcesLoaded) basemapContentCompleteAt = undefined;
    const settled =
      basemapContentCompleteAt !== undefined &&
      window.performance.now() - basemapContentCompleteAt >= SPLASH_SETTLE_MS;
    const paintedAfterData =
      basemapContentCompleteAt !== undefined && lastRenderAt > basemapContentCompleteAt;
    if (layers >= 2 && ((settled && paintedAfterData) || laddered || capped)) {
      window.clearInterval(splashPoll);
      map.off('render', onSplashRender);
      revealMap(map);
      // Bridge the bar from HERE (map visible, layers maybe not) to the
      // full-ready milestone. If full-ready already landed (fast boot)
      // the debounce swallows the flash and no bar shows at all.
      setMapBootPending(!layersFullyReady);
    }
  }, 50);
  const stopSplashPoll = () => window.clearInterval(splashPoll);
  const fullReadyScheduler = startRevealLoop(
    {
      styleReady: () => (map.getStyle()?.layers?.length ?? 0) >= 2 && activeOverlayLayersMounted(),
      painted: () =>
        (map.getStyle()?.layers?.length ?? 0) >= 2 && criticalLoaded(visibleSourceSets().all),
      onIdleOnce: cb => armSettledOnce(cb, () => visibleSourceSets().all),
    },
    markLayersFullyReady
  );
  revealDisposers.push(() => {
    map.off('styledata', invalidateVisibleSources);
    map.off('error', onMapError);
    map.off('render', onSplashRender);
    stopSplashPoll();
    fullReadyScheduler.dispose();
    setMapBootPending(false);
    for (const t of revealTimers) clearTimeout(t);
    revealTimers.length = 0;
  });
  // notifyOverlaysDone is idempotent — no need to stop this watcher
  // from inside its own callback (that exact pattern was the TDZ
  // regression); the scope dispose cleans it up.
  //
  // Reveal gate (perf/map-boot): `mapStylesReady` flips once every ACTIVE
  // overlay's boot bundle settled (resolved or skipped) — INACTIVE
  // overlays' styles are menu data fetched in the background and must
  // never hold the splash (owner decision 2026-10). A whole-catalog
  // failure still releases via `status === 'error'`.
  // The SPLASH gate is fully decoupled from the catalog: its poll
  // reveals the painted basemap immediately (owner 2026-10-31
  // progressive decision). The catalog-settled watcher below only feeds
  // the FULL-ready scheduler (the one that releases the topbar bar).
  let stopStatusWatch: (() => void) | undefined;
  stopStatusWatch = watch(
    () => mapCatalogStore.mapStylesReady || mapCatalogStore.status === 'error',
    overlaysDone => {
      if (!overlaysDone) return;
      fullReadyScheduler.notifyOverlaysDone();
      // One-shot: stop the watcher once it fired (idempotent anyway, but
      // no reason to keep tracking catalog changes — review N4).
      stopStatusWatch?.();
      stopStatusWatch = undefined;
    },
    { immediate: true }
  );
  revealDisposers.push(() => stopStatusWatch?.());
  revealDisposers.push(() => {
    unregisterMapProjector?.();
    applyFeatureHighlights([]); // engine teardown clears all highlights
  });
}

const mapResize = useDebounceFn(() => {
  mapRef.map?.resize();
}, 50);

useResizeObserver(mapDiv, () => {
  mapResize();
});
//const hutjson = ref(
//  `${getEnv('WODORE_API_HOST')}/${getEnv('WODORE_API_VERSION')}/huts/huts.geojson?lang=de&limit=5000&embed_all=false&embed_type=true&embed_owner=false&embed_capacity=false&embed_sources=false&include_elevation=false&include_name=true&flat=true`,
//);

let unregisterMapProjector: (() => void) | null = null;

// scheduleReveal runs from a watch callback (async scheduler job,
// activeEffectScope === null) — its onScopeDispose calls would be
// DROPPED by Vue. Collect them here; the setup-level drain below runs
// reliably (GLM review F3 — this also restores the projector-unregister
// teardown contract and removes 3 boot console warnings).
const revealDisposers: Array<() => void> = [];
onScopeDispose(() => {
  for (const dispose of revealDisposers) dispose();
  revealDisposers.length = 0;
});

function onMapLoad(e: MglEvent<'load'>) {
  collapseAutoExpandedAttribution();
  console.debug(`[onMapLoad] Maplibre version ${e.map.version} loaded`);
  // MapLibre READY (style + first render done — the "painting" stage
  // begins): the splash ends its words immediately and blocks new
  // hills (owner stage spec).
  emit('mapready');

  // ── Projector registration (place-popup): the MapLibre adapter
  // returns VIEWPORT px (canvas rect folded in — the popup teleports to
  // body) and forwards CONTINUOUS move events (flyTo glue). The
  // unregister path clears this adapter's highlight (engine teardown).
  unregisterMapProjector?.();
  // GLM review F8: the canvas rect is pan-invariant — cache it at
  // registration and refresh on resize (per-frame getBoundingClientRect
  // forces a synchronous layout every anchored rAF frame).
  let canvasRect = e.map.getCanvas().getBoundingClientRect();
  const onResize = () => {
    canvasRect = e.map.getCanvas().getBoundingClientRect();
  };
  e.map.on('resize', onResize);
  unregisterMapProjector = registerProjector({
    engine: 'maplibre',
    project(lngLat) {
      const p = e.map.project([lngLat.lon, lngLat.lat]);
      return { x: canvasRect.left + p.x, y: canvasRect.top + p.y };
    },
    onMove(cb) {
      e.map.on('move', cb);
      return () => e.map.off('move', cb);
    },
  });
  revealDisposers.push(() => e.map.off('resize', onResize));

  // Country basemap restored from a previous session: the raw initial
  // style carries no world fallback (composing it needs an async style
  // fetch) — re-apply the active basemap once, which merges the default
  // beneath the country layers (see setBasemap / country-fallback.ts)
  const activeBasemap = basemapStore.getBasemap();
  if (activeBasemap?.countryOnly) {
    void basemapStore.setBasemap(activeBasemap, true);
  }

  // Dev-only handle for debugging and e2e tests (map.project for exact
  // marker tap positions). Stripped from production behavior by the guard.
  if (process.env.DEV) {
    (window as unknown as Record<string, unknown>).__wodoreMap = e.map;
  }

  e.map.scrollZoom.setWheelZoomRate(0.003);
  onMapStyledata(e as unknown as MglEvent<'styledata'>);
  // Interactive layers: DERIVED from the presentation registry's layer
  // claims (see interactive-layers.ts). ONE global click handler queries
  // at click time — safe across catalog epoch bumps (per-layer bindings
  // would go stale when applyCatalogOverlays re-adds layers). The focus
  // tap guard consults the same derived list.
  for (const { id, minZoom } of derivedInteractiveLayers()) {
    e.map.on('mouseenter', id, ev => onLayerEnter(ev, minZoom));
    e.map.on('mouseleave', id, ev => onLayerLeave(ev, minZoom));
  }
  e.map.on('click', onMapClick);
  // WHAT'S HERE is a deliberate gesture (owner 2026-11): MapLibre fires
  // ONE `contextmenu` map event for mouse right-click AND touch
  // long-press — the only paths that probe for places the active layers
  // do not render. A plain click never probes.
  e.map.on('contextmenu', onMapContextMenu);

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

  // Apply tier-dependent setters once GPU detection has settled.
  // gpuSpecReady resolves after detect-gpu (fast from localStorage cache on
  // revisits); real basemap tiles only start loading after it, so the
  // first-visit window with HIGH defaults is effectively zero.
  void basemapStore.gpuSpecReady.then(() => {
    const detectedTier = storageGet('gpuTier') as { tier: number; gpu?: string | null } | null;
    const profile = mapProfileForTier(detectedTier);
    e.map.setPixelRatio(profile.pixelRatio);
    setMaxParallelImageRequests(profile.maxParallelImageRequests);
  });
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

  // Basemap style 404/410: the ACTIVE basemap's own style document was
  // rejected definitively (e.g. the backend deactivated the layer while
  // the persisted layers snapshot still carried it — staging 2026-10:
  // "No active map layer with slug 'wd-outdoor-base-mtk'"). No style
  // means no tiles are ever requested, so the tile fallbacks below
  // cannot fire and the map would stay blank until a reload. Switch
  // once down the fallback chain: the active basemap's catalog
  // `fallback` field, then the legacy chain, ending at the catalog
  // default. The name guard keeps a dead-end chain (target === the
  // failing basemap itself) from looping.
  const styleFailureSource = basemapStore.getBasemap();
  if (
    styleFailureSource &&
    typeof styleFailureSource.style === 'string' &&
    isBasemapStyleGone(errorObj, styleFailureSource.style)
  ) {
    const fallback = basemapStore.resolveFallbackBasemap(styleFailureSource.name);
    if (fallback && fallback.name !== styleFailureSource.name) {
      console.warn(
        `[onMapError] Basemap style unavailable (HTTP ${String(errorObj?.status)}) - switching from '${styleFailureSource.name}' to '${fallback.name}'`
      );
      // Session-only (not persisted): the next session retries the
      // user's selection — the background catalog refresh rewrites the
      // persisted layers snapshot, so a removed layer resolves to the
      // default at boot anyway.
      void basemapStore.setBasemap(fallback, true, false);
    }
    return;
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
    // Target: the active basemap's catalog `fallback` field first, legacy
    // default (keyless Liberty) when absent.
    const active = basemapStore.getBasemap();
    const fallback = active ? basemapStore.resolveFallbackBasemap(active.name) : undefined;
    if (fallback && fallback.name !== active?.name) {
      console.warn(
        '[onMapError] Tile host rejected requests - falling back to the keyless fallback basemap'
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
  // Same re-trigger guard idea as above: once on the ofm fallback, its
  // own errors cannot re-arm this path.
  if (isMtkTileFailure(errorObj) && activeBasemapIsMtkOutdoor()) {
    // Target: the active basemap's catalog `fallback` field (the seeded
    // mtk entries name their ofm twins), legacy chain otherwise.
    const active = basemapStore.getBasemap();
    const fallback = active ? basemapStore.resolveFallbackBasemap(active.name) : undefined;
    if (fallback && fallback.name !== active?.name) {
      console.warn(
        '[onMapError] Maptoolkit tiles unavailable - falling back to the keyless outdoor basemap'
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
  // Both Maptoolkit-based outdoor variants — the plain entry and the
  // client-relief hill twin (the default since backend PR #292).
  const name = basemapStore.getBasemap()?.name;
  return name === 'wd-outdoor-base-mtk' || name === 'wd-outdoor-base-mtk-hill';
}

/**
 * WebGL support pre-check. When WebGL is unavailable the map fails with a
 * GPUInitializationError that is only console-logged, and every subsequent
 * map interaction throws generic TypeErrors — which the error-based
 * detection above cannot recognize (the map just stays white). Detecting it
 * up front lets us skip mounting MglMap — the Leaflet fallback mounts
 * instead.
 *
 * `?gpuTier=-1` (services/gpu-override.ts) forces the same path on
 * capable machines — the test/QA knob for the fallback map.
 */
const webglSupported = rendererProfile() !== 'subset';

if (!webglSupported) {
  if (forcedGpuTier() === GPU_TIER_FALLBACK) {
    console.info('[WdMapView] ?gpuTier=-1 override — Leaflet fallback forced');
  } else {
    console.error('[WdMapView] WebGL is not supported by this browser/device');
  }
  // Reveal safety ladder — a failed fallback chunk/error must never hold
  // the splash hostage (see scheduleFallbackReveal).
  scheduleFallbackReveal();
  // POC fallback: no dead-end dialog — the Leaflet fallback map mounts
  // (v-else below) and reveals through the same choreography. The
  // persistent dialog stays wired for RUNTIME GL loss (onMapError /
  // onErrorCaptured), which only fires once MapLibre exists.
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

// ── Generic click pipeline (OpenSpec place-interactions, PR2) ────────
// Claim-based resolution: features of claimed layers → deduplicated
// {target, entry} items → the selection store (surfaces, D12 toggle,
// candidates). Highlight is controller-owned: the store's highlightRef
// drives this adapter's feature-state via ONE writer.
const selectionStore = useSelectionStore();

/** What's-here gesture state: which clicks are the release tail of a
 *  touch long-press whose contextmenu already ran the probe (those get
 *  swallowed — see onMapContextMenu / whats-here-gesture.ts). */
const whatsHereGesture = createWhatsHereGesture();

/** Single feature-state writer — also clears the legacy deep-link
 *  selection (selectHutBySlug) so the two paths never double-highlight. */
type FeatureHandle = { source?: string; sourceLayer?: string; id?: unknown };

let appliedHandles: FeatureHandle[] = [];

function applyFeatureHighlights(handles: FeatureHandle[]): void {
  const map = mapRef.map;
  if (!map) return;
  // Clear handles that are no longer active
  for (const prev of appliedHandles) {
    if (!prev.source) continue; // no source — nothing to clear
    if (!handles.some(h => h.id === prev.id && h.source === prev.source)) {
      try {
        map.setFeatureState(
          {
            source: prev.source,
            sourceLayer: prev.sourceLayer,
            id: prev.id as string | number, // SAFETY: numeric feature id
          },
          { selected: false, active: false }
        );
      } catch {
        // feature gone (tile unloaded)
      }
    }
  }
  // Clear the legacy deep-link selection
  if (selectedHutFeature.value !== undefined) {
    map.setFeatureState(
      { source: HUT_SOURCE_ID, sourceLayer: HUT_SOURCE_LAYER, id: selectedHutFeature.value.id },
      { selected: false }
    );
    selectedHutFeature.value = undefined;
  }
  // Apply new handles
  for (const handle of handles) {
    if (
      handle?.source &&
      handle.id !== undefined &&
      handle.id !== null &&
      // Empty-string ids are PLACEHOLDERS, not identities: cluster
      // features carry slug='' (promoteId), so ''-id state writes hit
      // EVERY cluster in the source at once (mass selection halos).
      handle.id !== ''
    ) {
      try {
        map.setFeatureState(
          {
            source: handle.source,
            sourceLayer: handle.sourceLayer,
            id: handle.id as string | number, // SAFETY: numeric feature id
          },
          { selected: true, active: true }
        );
      } catch {
        // source not ready
      }
    }
  }
  appliedHandles = handles;
}

// Controller-owned highlights: the store exposes an ARRAY (detail +
// popup — the hut stays highlighted while its detail route is open,
// even when a popup opens on top). Apply/clear all handles.
watch(
  () => selectionStore.highlightRef,
  refs => {
    const handles = (refs as Array<{ engine?: string; handle?: FeatureHandle }>)
      .map(r => r?.handle ?? null)
      .filter(Boolean) as FeatureHandle[];
    applyFeatureHighlights(handles);
  }
);

// ── POI selection plate (backend `*-selected` circle + `*-selected-icon`
// twin): the styles read feature-state { selected, color } and the
// selected-icon layer's filter names the selected slug. One selection
// at a time, cleared on popup close / new selection / empty tap.
let selectedPoiState: { source: string; sourceLayer?: string; id: string | number } | null = null;

function clearSelectedPoi(map: Pick<Map, 'setFeatureState' | 'getLayer' | 'setFilter'>): void {
  if (!selectedPoiState) return;
  const prev = selectedPoiState;
  selectedPoiState = null;
  try {
    map.setFeatureState({ ...prev } as never, { selected: false, color: null });
  } catch {
    /* source gone (overlay toggled off) */
  }
  const prevLayer = `${prev.source}-selected-icon`;
  if (map.getLayer(prevLayer)) {
    map.setFilter(prevLayer, ['==', ['get', 'slug'], '']);
  }
}

function setSelectedPoi(
  map: Pick<Map, 'setFeatureState' | 'getLayer' | 'setFilter'>,
  feature: {
    source?: string;
    layer?: { source?: string };
    sourceLayer?: string;
    id?: string | number;
    properties?: Record<string, unknown>;
  } | null
): void {
  clearSelectedPoi(map);
  if (!feature || feature.id === undefined || feature.id === null) return;
  const source = String(feature.source ?? feature.layer?.source ?? '');
  const state = { source, sourceLayer: feature.sourceLayer ?? undefined, id: feature.id };
  const props = feature.properties ?? {};
  try {
    map.setFeatureState({ ...state } as never, {
      selected: true,
      color: typeof props.color === 'string' ? props.color : null,
    });
  } catch {
    return;
  }
  const layer = `${source}-selected-icon`;
  if (map.getLayer(layer)) {
    map.setFilter(layer, ['==', ['get', 'slug'], String(props.slug ?? '')]);
  }
  selectedPoiState = state;
}

/** ONE global click handler — queries the derived claim layers at click
 *  time (safe across catalog epoch bumps; per-layer bindings go stale). */
function onMapClick(e: MapLayerEventType['click']): void {
  // Release tail of a touch long-press (its contextmenu already ran the
  // probe): drop it — it would close what the probe just opened.
  if (whatsHereGesture.consumeClick()) return;
  const map = e.target;
  const claims = derivedClaimedLayers();
  if (claims.length === 0) return;
  const claimsForPipeline = claims.map(c => ({
    layer: c.id,
    source: c.entry.match.source,
    idProp: c.idProp,
    minZoom: c.minZoom,
    entry: c.entry,
  }));
  // Query only claim layers that exist on the current style; keep the
  // style-not-loaded guard (same class as the tap guard).
  const ids = claims.map(c => c.id).filter(id => map.getLayer(id));
  if (ids.length === 0) return;
  let features: readonly RenderedFeatureLike[];
  try {
    // PRECISION-FIRST (owner 2026-10-31): an exact-point hit wins — a
    // click inside one dot must open exactly that stop, never a
    // disambiguation list. Only when the point misses does the ±10px
    // tolerance BOX rescue the tap (dots are ~5px circles; symbol
    // layers don't render on staging — sprite 404s). Both preserve
    // render order (topmost first).
    const t = 10;
    const box: [[number, number], [number, number]] = [
      [e.point.x - t, e.point.y - t],
      [e.point.x + t, e.point.y + t],
    ];
    const pointHits = map.queryRenderedFeatures(e.point, { layers: ids });
    features = ((pointHits.length > 0
      ? pointHits
      : map.queryRenderedFeatures(box, { layers: ids })) ??
      []) as unknown as readonly RenderedFeatureLike[];
  } catch {
    return; // style not loaded / mid-basemap-switch
  }
  if (features.length === 0) {
    // Click on empty map (NOT a drag — MapLibre's click event only fires
    // on genuine clicks): dismiss an open popup (owner 2026-10-31) and
    // clear the selection plate. NO what's-here probe on a plain tap
    // (owner 2026-11): details of places whose layers are not active are
    // the deliberate gesture — right-click / long-press — and the tap
    // falls through to focus mode exactly as before the probe existed.
    if (selectionStore.popupTarget) selectionStore.closePopup();
    clearSelectedPoi(map as never);
    return;
  }
  // SERVER-SIDE CLUSTERS first (amenity overlays): a `count > 1` feature
  // on a claimed cluster layer has no slug — it can never produce an
  // individual target. Small clusters open the member-list popup
  // (members fetched from the near endpoint); big ones zoom in to break
  // apart. Features keep render order — an individual symbol drawn on
  // top of a cluster circle wins before this check sees the cluster.
  const clusterFeature = features.find(
    f => isClusterLayerId(f.layer?.id) && isClusterProps(f.properties)
  );
  if (clusterFeature && clusterFeature.layer) {
    // The tap guard's exact-point check may have missed the cluster
    // circle (the ±10px box rescued it) — cancel any pending focus-mode
    // timer, same as a resolved target below.
    cancelPendingTap();
    // Cluster features carry no slug/id — the plate cannot name one.
    clearSelectedPoi(map as never);
    handleClusterClick(map, clusterFeature);
    return;
  }
  const items = targetsFromFeatures(features, claimsForPipeline, map.getZoom());
  // Cancel any pending focus-mode timer from the tap guard — the
  // click found a target the exact-point guard missed (±10px box;
  // owner: "sometimes focus mode still changes on clicks of dots").
  if (items.length > 0) cancelPendingTap();
  if (items.length === 0) {
    // Features under the cursor but none produced a target (missing id,
    // zoom gate) — still dismiss the popup, the click "went somewhere".
    if (selectionStore.popupTarget) selectionStore.closePopup();
    return;
  }
  const first = items[0];

  // Legacy identity-seed parity (owner 2026-10): tile props + click
  // geometry paint the panel header before the details request resolves.
  seedPlaceFromMap(first.target.id, first.target.props, first.target.location);

  // Legacy fly-to parity — only when a DETAIL will open (not the D12
  // toggle-close; popup surfaces get popup-aware padding with the
  // WdMapPopup spike instead).
  const caps = first.entry?.capabilities;
  const detailOnly = !caps || (caps.includes('detail') && !caps.includes('popup'));
  const willToggleClose =
    selectionStore.detailOpen && selectionStore.detailSlug === first.target.id;
  if (detailOnly && !willToggleClose && first.target.location) {
    smartFlyToHut(map, [first.target.location.lon, first.target.location.lat]);
  }

  selectionStore.openFromMap(items);
  // Selection plate: the feature that produced the winning target (ids
  // are unique across the geoplaces sources — match by target id).
  const idProps = ['slug', 'id'];
  const winner = features.find(f => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    return idProps.some(prop => String(p[prop] ?? '') === String(first.target.id));
  });
  setSelectedPoi(map as never, (winner ?? null) as never);
}

/** WHAT'S HERE gesture (owner 2026-11): right-click / long-press —
 *  MapLibre synthesizes one `contextmenu` map event for both (a single
 *  touch held 500 ms fires it while the finger is still down). Probes
 *  the surroundings for places the ACTIVE layers do not render and
 *  opens them through the same framework as icon clicks. Empty/failed
 *  probe → silent no-op (never a focus-mode toggle: the gesture is
 *  deliberate, and no focus timer can be pending — touch: finger still
 *  down; mouse: no tap path). */
function onMapContextMenu(e: MapLayerEventType['contextmenu']): void {
  // Long-press / right-click on controls, popups, markers or menu
  // chrome: not a map probe.
  const target = e.originalEvent?.target as HTMLElement | null;
  if (target?.closest(NON_MAP_TAP_SELECTOR)) return;
  // A touch long-press (a touch gesture is still pressed — any
  // viewport width) releases into a click: swallow exactly that
  // trailing click. Mouse right-clicks never produce one — a
  // left-click right after must stay live.
  whatsHereGesture.contextmenu(touchGestureActive);
  void whatsHereLookup(e.lngLat);
}

/**
 * Server-side cluster click (amenity overlays): small clusters
 * (count < 6) open the member-list popup — a synthetic `cluster`-source
 * target carrying count/subtree/colors + the served TILE zoom (the near
 * query snaps to that tile's grid); big ones zoom one notch in to break
 * the cluster apart. Re-clicking the same cluster toggles the popup
 * closed (the store's open() toggle, keyed by target key).
 */
function handleClusterClick(map: Map, feature: RenderedFeatureLike): void {
  const count = clusterCountOf(feature.properties);
  if (clusterClickAction(count) === 'zoom') {
    if (feature.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)) {
      const [lon, lat] = feature.geometry.coordinates as number[];
      if (Number.isFinite(lon) && Number.isFinite(lat)) {
        map.easeTo({ center: [lon, lat], zoom: map.getZoom() + CLUSTER_ZOOM_STEP });
      }
    }
    return;
  }
  const target = clusterTargetFromFeature(feature, clusterClickContext(map, feature));
  if (!target) return; // no usable anchor geometry — nothing to open
  void selectionStore.open(target, { via: 'map', entry: amenityClusterEntry });
}

/** Near-query context for a clicked cluster, read from the overlay's
 *  style source: the served TILE zoom (integer floor of the camera zoom,
 *  capped at the source's declared maxzoom — MapLibre overzoom; the grid
 *  snap needs the zoom the tile was BUILT for) and the forwardable
 *  cluster params off the tile URL (the same cluster configuration the
 *  tiles were built with). Defensive — mid-style-swap reads degrade to
 *  floor(zoom) + no forwarded params. */
function clusterClickContext(map: Map, feature: RenderedFeatureLike): ClusterClickContext {
  let sourceMaxZoom: number | undefined;
  let nearParams: ClusterClickContext['nearParams'] = {};
  const sourceId = feature.source;
  if (typeof sourceId === 'string') {
    try {
      const source = map.getStyle()?.sources?.[sourceId] as
        | { maxzoom?: number; tiles?: unknown }
        | undefined;
      const declared = source?.maxzoom;
      if (typeof declared === 'number' && Number.isFinite(declared)) sourceMaxZoom = declared;
      const tiles = source?.tiles;
      const tilesUrl = Array.isArray(tiles) && typeof tiles[0] === 'string' ? tiles[0] : null;
      nearParams = clusterParamsFromTilesUrl(tilesUrl);
    } catch {
      // style not readable (mid-swap) — floor(zoom) is still a sane grid
    }
  }
  return { tileZoom: servedTileZoom(map.getZoom(), sourceMaxZoom), nearParams };
}

// ── What's here (2026-11): deliberate gesture → proximity lookup ─────
// Right-click / long-press (onMapContextMenu) probes the immediate
// surroundings (near, ~50 m, no category) for places the ACTIVE layers
// do not render: results open through the place framework (one → its
// detail flow, several → the candidate list); an empty or failed probe
// is a silent no-op. The focus-mode deferral below is defensive only —
// the contextmenu gesture never has a pending focus timer (touch: the
// finger is still down; mouse: no tap path) — kept so any future call
// site stays coordinated through the SAME timer variable (double-tap /
// pan / wheel cancels keep working unchanged).
let whatsHereController: AbortController | null = null;

async function whatsHereLookup(lngLat: { lat: number; lng: number }): Promise<void> {
  // Single flight, latest wins: a rapid second tap aborts the first probe.
  if (whatsHereController) whatsHereController.abort();
  // A focus toggle pending from this tap's pointerup: hold it while the
  // probe runs (results would open a popup on top of focus mode).
  const focusPending = focusTapTimer !== null;
  if (focusPending) cancelPendingTap();
  // Gesture guard for the re-arm: a pointerdown newer than this click
  // (rapid second tap) owns its own focus decision — never defer ours.
  const clickAt = Date.now();
  const mayDeferFocus = (): boolean => tapDown.t <= clickAt && !tapDown.active;
  const controller = new AbortController();
  whatsHereController = controller;
  try {
    const { places } = await fetchWhatsHere({
      lat: lngLat.lat,
      lon: lngLat.lng,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return; // superseded by a newer tap
    if (places.length === 0) {
      if (focusPending && mayDeferFocus()) deferFocusToggle(); // focus mode, as before
      return;
    }
    // Results: open through the framework exactly like symbol clicks —
    // one row opens directly, several arm the candidate switcher.
    const anchor = { lat: lngLat.lat, lon: lngLat.lng };
    selectionStore.openFromMap(
      places.map(place => ({
        target: nearPlaceTarget(place, anchor),
        entry: entryForNearPlace(place),
      }))
    );
  } catch {
    // Offline / endpoint hiccup: behave like an empty probe — focus
    // mode falls through, no error surface for a background lookup.
    if (!controller.signal.aborted && focusPending && mayDeferFocus()) deferFocusToggle();
  } finally {
    if (whatsHereController === controller) whatsHereController = null;
  }
}

/** Re-arm the focus-mode toggle the tap guard scheduled — same delayed
 *  toggle and same timer slot as onMapPointerUp, so cancelPendingTap
 *  (double-tap, pan, wheel, second finger) still defuses it. */
function deferFocusToggle(): void {
  if (focusTapTimer) clearTimeout(focusTapTimer);
  focusTapTimer = setTimeout(() => {
    focusTapTimer = null;
    setMapFocus(!mapFocus.value);
  }, 250);
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
    // Desktop: content drawer docks on the LEFT side (mirrored layout —
    // menu right, details left, owner 2026-10)
    const currentLeftInset = parseInt(left.value) || 0;
    const expectedDrawerWidth = getExpectedDesktopDrawerWidth();
    const leftPadding = assumeDrawerOpen
      ? Math.max(currentLeftInset, expectedDrawerWidth)
      : currentLeftInset;

    debugLog(
      `[getMapPadding] Desktop - assumeDrawerOpen: ${assumeDrawerOpen}, currentLeft: ${currentLeftInset}, expectedDrawerWidth: ${expectedDrawerWidth}, using: ${leftPadding}`
    );

    return {
      top: currentTop,
      bottom: parseInt(bottom.value) || 31,
      left: leftPadding,
      right: parseInt(right.value) || 0,
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

    // Instant identity seed (tile properties + geometry) — same as the
    // click path (owner 2026-10)
    if (feature.geometry.type === 'Point') {
      const [lon, lat] = feature.geometry.coordinates as [number, number];
      seedPlaceFromMap(slug, { ...feature.properties }, { lat, lon });
    } else {
      seedPlaceFromMap(slug, { ...feature.properties });
    }

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

/** Currently hovered feature's state key (source + sourceLayer + id) —
 *  cleared when the pointer leaves the layer or moves to another
 *  feature. The backend style reads ["feature-state", "hovered"] in
 *  its paint expressions for the visual response. */
let hoveredFeature: {
  source: string;
  sourceLayer?: string;
  id: number | string;
} | null = null;

function clearHoveredFeature(map: Map): void {
  if (!hoveredFeature) return;
  try {
    map.setFeatureState({ ...hoveredFeature } as never, { hovered: false });
  } catch {
    // feature gone (tile unloaded) — nothing to clear
  }
  hoveredFeature = null;
}

/** Pointer cursor + hovered feature-state while the pointer is over a
 *  registered interactive layer (above its zoom gate). The backend
 *  style's paint expressions branch on ["feature-state", "hovered"]
 *  for the visual enlargement/stroke — the frontend only sets state. */
function onLayerEnter(e: MapLayerEventType['mouseenter'], minZoom?: number) {
  if (minZoom === undefined || e.target.getZoom() > minZoom) {
    e.target.getCanvas().style.cursor = 'pointer';

    // Set hovered feature-state for the paint response
    const feature = e.features?.[0];
    if (feature && feature.id !== undefined && feature.id !== null) {
      clearHoveredFeature(e.target);
      hoveredFeature = {
        source: String(feature.source ?? feature.layer?.source ?? ''),
        sourceLayer: feature.sourceLayer ?? undefined,
        id: feature.id,
      };
      try {
        e.target.setFeatureState({ ...hoveredFeature } as never, { hovered: true });
      } catch {
        // source not ready — skip silently
      }
    }
  }
}

/** Clear cursor + hovered feature-state when the pointer leaves. */
function onLayerLeave(e: MapLayerEventType['mouseleave'], minZoom?: number) {
  if (minZoom === undefined || e.target.getZoom() > minZoom) {
    e.target.getCanvas().style.cursor = '';
    clearHoveredFeature(e.target);
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

/** A touch gesture is currently pressed — ANY viewport width (unlike
 *  the focus-tap tracker `tapDown`, which arms only in mobile chrome).
 *  The long-press contextmenu reads it to know a trailing release
 *  click is coming (see onMapContextMenu). */
let touchGestureActive = false;

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
  touchGestureActive = false; // covers pointercancel / gesture morphs
  tapDown.active = false;
  if (focusTapTimer) {
    clearTimeout(focusTapTimer);
    focusTapTimer = null;
  }
}

function onMapPointerDown(ev: MouseEvent): void {
  // Any new gesture expires a pending long-press click-swallow first,
  // on EVERY pointer type (desktop mouse included) — a long-press
  // cancelled into a drag never releases its click, and the next click
  // belongs to a new gesture.
  whatsHereGesture.pointerDown();
  const pointerType = (ev as unknown as { pointerType?: string }).pointerType;
  // Touch-alive tracking at ANY width (the swallow discriminator below)
  // comes before the mobile-only focus-tap tracking.
  touchGestureActive = pointerType === 'touch';
  if (!isMobileMap.value) return;
  if (pointerType !== 'touch') return; // desktop has the explicit button
  if ((ev.target as HTMLElement).closest(NON_MAP_TAP_SELECTOR)) return;
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

/** True when an INTERACTIVE layer claims the tap at the point (canvas
 *  features — the cursor check only helps mouse; touch never hovers).
 *  Consults the interactive-layer registry with the same per-layer zoom
 *  gates as the click handlers: a tap no layer will handle falls through
 *  and toggles focus mode instead (no dead taps, e.g. hitting a hut
 *  symbol zoomed out). */
function tapHitsInteractiveLayer(x: number, y: number): boolean {
  const map = mapRef.map;
  if (!map) return false;
  return tapTargetsInteractiveLayer(map, x, y);
}

function onMapPointerUp(): void {
  touchGestureActive = false;
  if (!tapDown.active) return;
  tapDown.active = false;
  const now = Date.now();
  // Taps an interactive layer will handle — never focus mode
  if (tapHitsInteractiveLayer(tapDown.x, tapDown.y)) {
    lastMapTapAt = 0;
    cancelPendingTap();
    return;
  }
  // Popup open: a non-interactive tap only closes the popup (owner
  // 2026-11-01: "when open and i click outside it should only close the
  // popup, not toggle the focus mode"). The click handler's ±10px
  // tolerance box can find a target the exact-point guard misses — so
  // ANY tap while a popup is open suppresses the focus-mode toggle.
  if (selectionStore.popupTarget) {
    lastMapTapAt = 0;
    cancelPendingTap();
    return; // the click handler will fire and close the popup
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

// Map wrapper backdrop: fills any area not covered by map tiles (e.g.
// while the first style loads) so the map never flashes transparent.
.wd-map-fill .maplibregl-map {
  background-color: #f6f9f7;
}

// Non-WebGL fallback: the Leaflet container (the fallback component's
// root div — Leaflet adds .leaflet-container to it) rides the same
// reveal choreography as the MapLibre canvas above.
.wd-map-fill .wd-fallback-map {
  background-color: #f6f9f7;
  opacity: 0;
  filter: blur(14px);
  transition:
    opacity 0.32s ease-out,
    filter 0.9s cubic-bezier(0.25, 1, 0.5, 1);
}

.wd-map-fill--rendered .wd-fallback-map {
  opacity: 1;
  filter: blur(0);
}

.wd-map-fill--settled .wd-fallback-map {
  filter: none;
  transition: none;
}

// Reveal choreography (owner spec, ~900ms total):
//   1. map fades in while BLURRED (opacity 0→1 over 320ms)
//   2. the blur resolves (blur(14px)→0 over 900ms)
//   3. the splash clears last (surface gone by ~900ms, see WdMapLoader)
// The map MUST reach opacity 1 BEFORE the splash starts fading
// (splash fade is delayed to match): two half-transparent layers
// stacked let the white page bleed through — visible behind the hut
// sheet's corner radius on mobile (owner-reported).
.wd-map-fill .maplibregl-map {
  opacity: 0;
  filter: blur(14px);
  transition:
    opacity 0.32s ease-out,
    filter 0.9s cubic-bezier(0.25, 1, 0.5, 1);
}

.wd-map-fill--rendered .maplibregl-map {
  opacity: 1;
  filter: blur(0);
}

.wd-map-fill--settled .maplibregl-map {
  filter: none;
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .wd-map-fill .maplibregl-map {
    filter: none;
    transition: opacity 0.3s ease-out;
  }

  .wd-map-fill .wd-fallback-map {
    filter: none;
    transition: opacity 0.3s ease-out;
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
    <div ref="mapDiv" class="wd-map-fill" :class="{ 'wd-map-fill--rendered': mapRendered }">
      <MglMap
        v-if="webglSupported"
        @map:load="onMapLoad"
        @map:error="onMapError"
        @map:styledata="onMapStyledata"
        :hash="isHashMode ? false : 'map'"
        :map-style="initialMapStyle"
        :zoom="mapZoom"
        :bearing-snap="15"
        :center="mapCenter"
        :attribution-control="false"
        :min-zoom="MAP_MIN_ZOOM"
        :render-world-copies="false"
        :max-pitch="0"
        :pitch-with-rotate="false"
        :touch-pitch="false"
        :validate-style="validateStyle"
        :pixel-ratio="initialMapProfile.pixelRatio"
        :fade-duration="initialMapProfile.fadeDuration"
        :max-tile-cache-size="initialMapProfile.maxTileCacheSize"
        :max-parallel-image-requests="initialMapProfile.maxParallelImageRequests"
      >
        <!-- ── Map controls (v2 clean layout) ──────────────────────────── -->
        <!-- Overlay strip lives OUTSIDE the maplibre-only subtree (after
             the renderer branches below): BOTH maps share ONE overlay
             menu + basemap rail. See the shared <q-page-sticky> after
             WdFallbackMapView. -->

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
      <!-- Non-WebGL fallback (POC): Leaflet + clustered hut dots. Reveals
           through the same choreography (splash out, chrome in) once the
           fallback map is initialized. -->
      <WdFallbackMapView v-else @ready="onFallbackReady" />

      <!-- ── Shared control strip (hoisted out of the MglMap slot) ──────
           Renders in BOTH modes so the Leaflet fallback gets THE SAME
           overlay menu (one component, not a twin). The basemap control
           stays MapLibre-only — the fallback ships its own raster
           basemap switch (.wd-fb-bm, same corner). In fallback mode the
           strip is lifted above that chip (48px + 4px column gap),
           mirroring the maplibre column's overlay-above-basemap layout.
           Focus-mode CSS (body.wd-map-focus .wd-map-ctl-sticky) applies
           unchanged in both modes; the sticky is position:fixed, so its
           tree position only affects stacking — it follows the map
           containers in DOM order and wins ties. -->
      <q-page-sticky
        position="bottom-right"
        :offset="webglSupported ? [12, 14] : [12, 66]"
        class="wd-map-ctl-sticky"
      >
        <div class="wd-map-ctl-col">
          <WdOverlayControl :renderer-profile="webglSupported ? 'full' : 'subset'" />
          <WdBasemapControl v-if="webglSupported" />
        </div>
      </q-page-sticky>
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
