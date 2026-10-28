<script setup lang="ts">
/**
 * NON-WebGL fallback map — Leaflet + clustered hut dots + availability
 * rings (POC, second iteration).
 *
 * Mounted by WdMapView only when its WebGL pre-check fails (or the
 * `?gpuTier=-1` boot override is set): MapLibre GL cannot render at all
 * there — raster basemaps included, they still need a GL canvas.
 *
 * Stack:
 * - Basemap: switchable raster set mirroring the MapLibre basemap
 *   control (chip toggle + thumbnail rail): plain OSM, the mapproxy
 *   `world_topo` facade (OpenTopoMap + geoland.at + swisstopo, cached
 *   WebP) and `world_satellite` (ESRI). Hardcoded for the POC — later
 *   these should come from the same backend catalog layers.
 * - Huts: the SAME Martin vector source the MapLibre huts style
 *   fetches — `{TILE_SERVER}/huts/{z}/{x}/{y}.mlt` — decoded with
 *   @maplibre/mlt (maplibre-gl's own decoder, version-locked via the
 *   dependency tree). Same URLs ⇒ the browser HTTP-cache entries are
 *   literally shared between the WebGL map and this fallback. Tiles
 *   are tracked per z/x/y (dedup across the tile buffer), evicted when
 *   they leave the padded viewport, overzoomed from the source's
 *   maxzoom 9 — the same pyramid semantics MapLibre applies.
 *   Dots render from z8; from z11 they upgrade to the category SYMBOL:
 *   the mono SVG from `/v1/categories/symbol/mono/{type}.svg` (built
 *   with currentColor — recolored via CSS) on a rounded-rect shield in
 *   the category color (type_standard_color from the tile properties).
 * - Availability: the SAME Martin MLT tiles MapLibre renders
 *   the SELECTED date (today when unset — same default as the header
 *   chip). Day 0 paints a larger background ring in the occupation
 *   status color (the same palette the MapLibre `wd-huts-occupation`
 *   layer uses).
 * - Clustering: TWO markercluster groups — huts WITH availability
 *   uncluster from z10, huts without from z11 (owner spec, +1 vs the
 *   first cut after the zoom-sweep profile: ~1200 unclustered DOM
 *   markers at z10 dropped frames; ~500 stays 60fps). Cluster bubbles
 *   are colored by the DOMINANT member type color. Pans fully inside
 *   loaded tiles skip the marker rebuild; rebuilds also run only on
 *   tile-set, availability, selection or icon-band changes.
 * - Selection: the clicked hut's marker swaps to a wider gold border
 *   (route-driven — same toggle semantics as the MapLibre map).
 * - Date changes drive the SAME calendar spinner as the main map
 *   (map-catalog-store availabilityLoading) via the manual
 *   begin/settle API — settles when the new rings are rendered, with
 *   the shared 600ms minimum spin.
 * - Click: seeds the place identity (seedPlaceFromMap) and routes to
 *   `map-hut` — the same content panel the MapLibre map opens.
 * - Viewport: shared with the main map (localPropertiesStore) AND
 *   mirrored into the URL as `#map=z/lat/lng` (maplibre hash format —
 *   local-properties-store parses it back on boot).
 * - Controls (MapLibre parity): zoom buttons top-right on desktop /
 *   bottom-left on mobile with the ctrl-group look, the focus/fullscreen
 *   toggle top-right, scale bottom-left, and a MapLibre-style attribution
 *   (translucent bar on desktop, compact ⓘ pill on mobile).
 * - Reduced-mode notice: one-time dismissable toast (Quasar Notify),
 *   dismissal persisted — never shown again.
 *
 * Leaflet + markercluster ride this component's async chunk
 * (WdMapView async-imports it), so WebGL users never download them.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDebounceFn } from '@vueuse/core';
import { LocalStorage, Notify } from 'quasar';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { useHutsStore } from '@stores/huts-store';
import {
  beginAvailabilityLoadManual,
  settleAvailabilityLoadManual,
  setAvailabilityManualSettle,
  toIsoDate,
} from '@stores/map/availability-loading';
import {
  TILE_SERVER,
  useFallbackBasemaps,
  migrateBasemapId,
  type FbBasemap,
} from './fallback-basemaps';
import { seedPlaceFromMap } from '@composables/usePlace';
import { useOverlayStore } from '@stores/map/overlay-store';
import type { ClusteringConfig } from '@stores/map/overlay-configs/types';
import type { StyleSpecification } from 'maplibre-gl';
// ── Extracted fallback modules (Phase B rewiring) ───────────────────
import { viewportTileRange, tileXToLng, tileYToLat } from './fallback/tile-math';
import {
  STATUS_COLORS,
  DEFAULT_DOT_COLOR,
  HUT_MIN_ZOOM,
  OCC_LABEL_MIN_ZOOM,
  markerOpacityFor,
  shieldPxFor,
  parseStatusColors,
} from './fallback/status-colors';
import {
  loadSprite as loadSpriteModule,
  revokeSprite,
  spriteSpan,
  getSprite,
} from './fallback/sprite-sheet';
import { WdCanvasDot, setMarkerOpacity, setShieldPx } from './fallback/canvas-dot';
import { MltTileCache, findMltTable, type TileRange } from './fallback/mlt-tile-loader';
import {
  createFallbackOverlayAdapter,
  type FallbackOverlayAdapter,
} from './fallback/overlay-adapter';
import { AVAIL_BUCKET, PLAIN_BUCKET, orderLegacyBucketsFirst } from './fallback/cluster-groups';

const emit = defineEmits<{
  /** Map initialized + first paint requested — WdMapView runs its
   * reveal choreography on this (splash out, chrome in). */
  (e: 'ready'): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const localPropertiesStore = useLocalPropertiesStore();
const hutsStore = useHutsStore();
const overlayStore = useOverlayStore();

const fallbackEl = ref<HTMLDivElement>();

// ── Zoom model (ramps + palette live in ./fallback/status-colors) ──────
/** Push the zoom-ramped draw state everywhere it is read synchronously:
 *  the canvas-dot module vars (canvas shields) + the --wd-fb-o CSS var
 *  (DOM cluster icons). */
function syncDrawState(zoom: number): void {
  setMarkerOpacity(markerOpacityFor(zoom));
  setShieldPx(shieldPxFor(zoom));
  fallbackEl.value?.style.setProperty('--wd-fb-o', String(markerOpacityFor(zoom)));
}

// ── Served huts styling (backend #440) ──────────────────────────────
// The overlay store's compiled `huts` item carries BOTH served inputs:
// the resolved style (status palette: the wd-huts-occupation
// circle-color match expression) and config.clustering (markercluster
// parameters). Both keep their offline defaults until the catalog
// resolves — same resilience pattern as the fallback basemaps.

/** Status palette in use — seeded with the hardcoded copy, replaced by
 *  the served style's match expression once it arrives. */
const statusColors = ref<Record<string, string>>(STATUS_COLORS);

/** Clustering config from the served huts row; undefined = legacy
 *  dual-group behavior (hardcoded radius/uncluster zooms). */
const hutsClustering = ref<ClusteringConfig | undefined>(undefined);

function clusteringSignature(cfg: ClusteringConfig | undefined): string {
  return `${cfg?.groupByProperty ?? ''}|${cfg?.radius ?? ''}|${cfg?.maxZoom ?? ''}`;
}

/** Huts WITH availability uncluster from here (owner spec; +1 vs the
 *  first iteration — caps the unclustered marker count, see the profile
 *  note in the header). */
const AVAIL_UNCLUSTER_ZOOM = 10;
/** Huts WITHOUT availability one level later (owner spec). */
const PLAIN_UNCLUSTER_ZOOM = 11;
const MIN_ZOOM = 2; // MAP_MIN_ZOOM parity
const MAX_ZOOM = 19; // raster basemaps top out here
/** Martin `huts` source pyramid (martin.yaml minzoom/maxzoom) — above
 *  the max the fallback overzooms from z9 tiles (exact coords: a z9
 *  tile unit is ~0.15 m at the equator). */
const HUTS_TILE_MIN_ZOOM = 5;
const HUTS_TILE_MAX_ZOOM = 9;
/** Brand fallback when no type color is known for a hut — in
 *  ./fallback/status-colors (DEFAULT_DOT_COLOR). */

const BM_KEY = 'wodore:fallbackBasemap';
const NOTE_KEY = 'wodore:fallbackNoteDismissed';
/** Catalog-driven basemap list — seeded offline trio, upgraded to the
 *  backend catalog (same registry as MapLibre) when it resolves. */
const BASEMAPS = useFallbackBasemaps();
const bmOpen = ref(false);
/** Stored id, legacy POC ids migrated to catalog slugs on read. */
const activeBasemapId = ref(
  migrateBasemapId((LocalStorage.getItem(BM_KEY) as string | null) ?? 'osm')
);

function bmLabel(bm: FbBasemap): string {
  return bm.label ?? t(`map.fallbackBasemaps.${bm.id}`);
}

function selectBasemap(id: string): void {
  if (id === activeBasemapId.value) return;
  activeBasemapId.value = id;
  LocalStorage.set(BM_KEY, id);
  applyBasemap();
  if (attribInnerEl) attribInnerEl.innerHTML = attribHtml(id); // follows the basemap
}

// Catalog upgrade landed: keep the selection on its slug, re-apply the
// (possibly re-pointed — CDN + versioned) tile URL. Stored ids not in
// the upgraded list fall back to OSM.
watch(BASEMAPS, list => {
  const kept = list.find(b => b.id === activeBasemapId.value);
  if (!kept) activeBasemapId.value = list[0]?.id ?? 'osm';
  LocalStorage.set(BM_KEY, activeBasemapId.value);
  applyBasemap();
  if (attribInnerEl) attribInnerEl.innerHTML = attribHtml(activeBasemapId.value);
});

const bmIconOpen = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch.svg',
  import.meta.url
).href;
const bmIconClose = new URL(
  '/src/assets/wodore-design/icons/export/basemap-switch-close.svg',
  import.meta.url
).href;

// ── Map state ────────────────────────────────────────────────────────────

/** Parsed hut from an MLT tile feature (marker + seeding needs). */
interface FbHut {
  slug: string;
  lat: number;
  lon: number;
  properties: Record<string, unknown>;
  typeSlug: string | null;
  /** type_standard_color from the tile properties. */
  typeColor: string | undefined;
}

/** Day statuses per hut (index 0 = the selected date). All four days
 *  are kept — the zoomed-in 4-day fan (maplibre's occupation-day chips)
 *  can build on this later. */
interface FbAvail {
  statuses: string[];
}

let map: L.Map | undefined;
let tileLayer: L.TileLayer | undefined;
let overlayAdapter: FallbackOverlayAdapter | undefined;
// ── Cluster groups (config-driven, backend #440 config.clustering) ──
// With the served config: one markercluster group per groupByProperty
// value (+ the null bucket for features without it), radius/maxZoom
// from the config — the dual avail/plain groups and their
// differentiated unclustering were dropped with it. Without the config
// (style still loading / pre-#440 backend), the legacy dual buckets
// keep today's exact behavior. Groups are created lazily per bucket —
// in a DETERMINISTIC order in legacy mode (orderLegacyBucketsFirst:
// plain before avail, so availability huts paint on top).
let clusterGroups = new Map<string | null, L.MarkerClusterGroup>();

function makeClusterGroup(unclusterZoom: number, radius: number): L.MarkerClusterGroup {
  return L.markerClusterGroup({
    showCoverageOnHover: false,
    chunkedLoading: true,
    maxClusterRadius: radius,
    disableClusteringAtZoom: unclusterZoom,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: clusterIcon,
  });
}

/** The marker's cluster bucket: the config's groupByProperty value
 *  (null bucket for features without it), or the legacy avail/plain
 *  split when no config is served. */
function clusterBucketFor(hut: FbHut): string | null {
  const prop = hutsClustering.value?.groupByProperty;
  if (prop) {
    const value = hut.properties[prop];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
  return availBySlug.has(hut.slug) ? AVAIL_BUCKET : PLAIN_BUCKET;
}

/** Lazily create + mount the bucket's cluster group. */
function clusterGroupFor(bucket: string | null): L.MarkerClusterGroup | undefined {
  if (!map) return undefined;
  let group = clusterGroups.get(bucket);
  if (!group) {
    const cfg = hutsClustering.value;
    const unclusterZoom = cfg
      ? (cfg.maxZoom ?? PLAIN_UNCLUSTER_ZOOM)
      : bucket === AVAIL_BUCKET
        ? AVAIL_UNCLUSTER_ZOOM
        : PLAIN_UNCLUSTER_ZOOM;
    group = makeClusterGroup(unclusterZoom, cfg?.radius ?? 48);
    clusterGroups.set(bucket, group);
    map.addLayer(group);
  }
  return group;
}

/** Drop every cluster group (config change / unmount) — markers are
 *  re-added by the next rebuildMarkers. */
function clearClusterGroups(): void {
  for (const group of clusterGroups.values()) map?.removeLayer(group);
  clusterGroups = new Map();
}
/**
 * Availability now comes from the SAME Martin source MapLibre renders
 * (wd-bookings): `{TILE_SERVER}/availability/{z}/{x}/{y}.mlt?date=…&days=4`
 * — MLT-decoded like the huts tiles. NOTE: the seeded maplibre style
 * currently serves the extension-less (MVT) form — a backend seed fix
 * is pending (owner is checking); the fallback already targets .mlt,
 * so both maps converge on the MLT URLs once the seed lands.
 */
const AVAIL_TILE_MIN_ZOOM = 5; // wd-bookings source pyramid (style minzoom)
const AVAIL_TILE_MAX_ZOOM = 9; // (style maxzoom)
/** The date the current availability tiles were fetched for (ISO). */
let availFetchedForDate: string | undefined;
/** slug → day-0 availability status. */
const availBySlug = new Map<string, FbAvail>();
/** Sprite pack lives in ./fallback/sprite-sheet — the component keeps
 *  only the CSS-var feed + marker rebuild (side-effects the module
 *  deliberately does not own). */
async function loadSprite(): Promise<void> {
  const ok = await loadSpriteModule(TILE_SERVER);
  if (!ok) return;
  const sheet = getSprite();
  if (!sheet) return;
  fallbackEl.value?.style.setProperty('--wd-fb-sheet', `url(${sheet.sheetImg.src})`);
  fallbackEl.value?.style.setProperty('--wd-fb-sheet-w', `${sheet.sheetW}px`);
  fallbackEl.value?.style.setProperty('--wd-fb-sheet-h', `${sheet.sheetH}px`);
  rebuildMarkers();
}
/** Marker scale — FIXED at all symbol zooms (owner: "at z12 they are
 *  very big, should always have around the same size"): shield ≈ 19px,
 *  glyph ≈ 14px, occupation disc ≈ 28px. The var stays so a future ramp
 *  is a one-line change. */
function glyphScale(_zoom: number): number {
  return 0.6;
}
/** Marker → its type color + identifier (cluster bubble styling). */
interface MarkerTypeInfo {
  color: string;
  identifier: string | undefined;
}
const markerTypeInfo = new WeakMap<L.Layer, MarkerTypeInfo>();
/** slug → live marker (selection swaps without a full rebuild). */
const markerBySlug = new Map<string, L.Layer>();
/** Shared canvas renderer for all dot markers. */
let dotRenderer: L.Canvas | undefined;
/** slug → hut (style inputs for selection icon swaps). */
const hutBySlug = new Map<string, FbHut>();
/** Currently selected hut slug (route-driven, same as the MapLibre map). */
const selectedSlug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : undefined
);
/** Last rendered zoom band — dot↔symbol icon swaps rebuild on band change. */
let lastRenderBand: 'none' | 'dot' | 'sym' | 'symlabel' | undefined;

// ── Zoom slider (owner re-request; LOW-SPEC tuned: 64px travel per
//  level — half the speed of the first cut) ────────────────────────────────
const PX_PER_LEVEL = 64;
const SLIDER_STEP = 1;
const sliderZoom = ref(10);
const dragging = ref(false);
let dragStartY = 0;
let dragStartZoom = 0;
let sliderTarget: number | null = null;
let sliderStepAt = 0;

const sliderClamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
const thumbPos = computed(() => 88 - ((sliderZoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 76);

function sliderApply(value: number): void {
  if (!map) return;
  const next = sliderClamp(value);
  sliderTarget = next;
  sliderStepAt = Date.now();
  sliderZoom.value = next;
  map.setZoom(next, {
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
}

function sliderStep(delta: number): void {
  if (!map) return;
  const chain =
    sliderTarget !== null && Date.now() - sliderStepAt <= 600 ? sliderTarget : map.getZoom();
  sliderApply(chain + delta);
}

function onSliderDown(e: PointerEvent): void {
  dragging.value = true;
  dragStartY = e.clientY;
  dragStartZoom = map ? map.getZoom() : sliderZoom.value;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* pointer inactive — handlers still work */
  }
}

function onSliderMove(e: PointerEvent): void {
  if (!dragging.value || !map) return;
  const dy = dragStartY - e.clientY; // up = zoom in
  const next = sliderClamp(dragStartZoom + dy / PX_PER_LEVEL);
  if (next !== sliderZoom.value) {
    sliderZoom.value = next;
    map.setZoom(next, { animate: false });
  }
}

function onSliderUp(): void {
  dragging.value = false;
}

function onSliderStepClick(e: MouseEvent, delta: number): void {
  if (e.detail === 0) sliderStep(delta); // keyboard activation
}

function onMapZoomSync(): void {
  if (!dragging.value && map) sliderZoom.value = map.getZoom();
}

// ── Locate (GPS) — MglGeolocateControl counterpart: one-shot fix,
//  maplibre-style blue dot + accuracy circle, fly-to. ─────────────────────
let locateDot: L.CircleMarker | undefined;
let locateAccuracy: L.Circle | undefined;

function onLocate(): void {
  if (!navigator.geolocation || !map) return;
  navigator.geolocation.getCurrentPosition(
    pos => {
      if (!map) return;
      const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
      if (!locateDot) {
        locateAccuracy = L.circle(ll, {
          radius: pos.coords.accuracy,
          weight: 1,
          color: '#1da1f2',
          fillColor: '#1da1f2',
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(map);
        locateDot = L.circleMarker(ll, {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: '#1da1f2',
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
      } else {
        locateDot.setLatLng(ll);
        locateAccuracy?.setLatLng(ll);
      }
      map.flyTo(ll, Math.max(map.getZoom(), 13), { duration: 1.2 });
    },
    () => undefined,
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

// ── Focus (fullscreen) mode ────────────────────────────────────────────────
// Same body-class contract as the MapLibre map's setMapFocus: the global
// chrome CSS (map-controls/_layout.scss) keys off body.wd-map-focus. The
// shared .wd-focus-toggle class styles the button identically; the
// fallback's scoped override keeps it VISIBLE on mobile (the main map
// enters focus via empty-map tap there — the fallback has no such
// gesture, so the button is the only entry).
const focusOn = ref(false);

function toggleFocus(): void {
  // VETO: a control was clicked in the last 400ms — do not toggle.
  // This catches ALL control interactions regardless of how events
  // propagate (pointer capture, synthetic clicks, touch → click
  // conversion, etc.).
  if (Date.now() - controlVetoAt < 400) return;
  focusOn.value = !focusOn.value;
  document.body.classList.toggle('wd-map-focus', focusOn.value);
}

/** Empty-map tap → enter focus mode (mobile entry point — the focus
 *  button is hidden outside focus mode on mobile; this mirrors the
 *  MapLibre map's tap-to-focus gesture). Guarded: only fires on
 *  deliberate taps (no drag), not on marker/cluster/control clicks. */
let lastTapAt = 0;
let tapStart = { x: 0, y: 0, t: 0 };
/** Veto timestamp — set by ANY control click; toggleFocus checks it.
 *  More robust than pointer-event target checking on touch devices. */
let controlVetoAt = 0;

function vetoFocus(): void {
  controlVetoAt = Date.now();
}

function onContainerPointerDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse') return;
  tapStart = { x: e.clientX, y: e.clientY, t: Date.now() };
}

function onContainerPointerUp(e: PointerEvent): void {
  if (e.pointerType === 'mouse') return;
  const dt = Date.now() - tapStart.t;
  const dist = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
  if (dt > 400 || dist > 10) return;

  // SIMPLEST exclusion: what element is ACTUALLY at the tap position?
  // document.elementFromPoint returns the topmost element regardless of
  // event propagation, pointer capture, or synthetic event targets.
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el?.closest('.leaflet-control, .wd-fb-bm, .wd-focus-toggle, .q-page-sticky')) {
    return; // tap is on a control — do NOT toggle focus
  }

  // A tap that closes an open basemap rail is consumed
  if (document.querySelector('.wd-fb-bm__rail')) {
    lastTapAt = Date.now();
    return;
  }

  const now = Date.now();
  if (now - lastTapAt > 350 && !focusOn.value) {
    setTimeout(() => {
      // Double-check the veto (set by the delegated click listener)
      if (Date.now() - controlVetoAt < 400) return;
      toggleFocus();
    }, 100);
  }
  lastTapAt = now;
}

// ── Attribution (MapLibre-style) ───────────────────────────────────────────
// Leaflet's stock attribution (bottom-right, always expanded) is replaced
// with a control mirroring maplibre's: desktop = translucent bar, mobile =
// compact ⓘ pill expanding on tap (same geometry/colors as
// .maplibregl-ctrl-attrib in maplibre-gl.css).
const ATTRIB_CLOSE_SVG =
  '<svg class="wd-fb-attrib__close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

function attribHtml(bmId: string): string {
  const bm = BASEMAPS.value.find(b => b.id === bmId) ?? BASEMAPS.value[0]!;
  return bm.attribution;
}

let attribInnerEl: HTMLElement | undefined;

/** Geolocate glyph — maplibre's geolocate path (same SVG the stock
 *  control draws), currentColor so it rides the theme tokens. */
const LOCATE_SVG =
  '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 0 0 3.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7"/><circle cx="10" cy="10" r="2"/></svg>';

/** Mobile merged control bar: locate row on top of the +/− zoom rows,
 *  ONE .leaflet-bar box (maplibre ctrl-group parity). A single bordered
 *  box cannot develop a seam, width drift, or border mismatch between
 *  the rows — and the locate row sits inside .leaflet-control, so every
 *  focus-tap exclusion list covers it. */
class WdMobileZoomBarControl extends L.Control {
  private locateBtn: HTMLElement | undefined;
  private zoomInAnchor: HTMLElement | undefined;
  private zoomOutAnchor: HTMLElement | undefined;
  private readonly handlers: Array<[HTMLElement, string, (ev: Event) => void]> = [];

  onAdd(): HTMLElement {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control-zoom');
    L.DomEvent.disableClickPropagation(container);

    const locate = L.DomUtil.create('button', 'wd-fb-locate-row', container) as HTMLElement & {
      type: string;
    };
    locate.type = 'button';
    locate.setAttribute('aria-label', 'Locate');
    locate.innerHTML = LOCATE_SVG;
    const onLocateClick = () => onLocate();
    this.handlers.push([locate, 'click', onLocateClick]);
    L.DomEvent.on(locate, 'click', onLocateClick);
    this.locateBtn = locate;

    const zoomIn = L.DomUtil.create('a', 'leaflet-control-zoom-in', container) as HTMLElement & {
      href: string;
    };
    zoomIn.href = '#';
    zoomIn.setAttribute('role', 'button');
    zoomIn.textContent = '+';
    const onZoomIn = (ev: Event) => {
      L.DomEvent.stop(ev);
      map?.zoomIn();
    };
    this.handlers.push([zoomIn, 'click', onZoomIn]);
    L.DomEvent.on(zoomIn, 'click', onZoomIn);
    this.zoomInAnchor = zoomIn;

    const zoomOut = L.DomUtil.create('a', 'leaflet-control-zoom-out', container) as HTMLElement & {
      href: string;
    };
    zoomOut.href = '#';
    zoomOut.setAttribute('role', 'button');
    zoomOut.textContent = '\u2212';
    const onZoomOut = (ev: Event) => {
      L.DomEvent.stop(ev);
      map?.zoomOut();
    };
    this.handlers.push([zoomOut, 'click', onZoomOut]);
    L.DomEvent.on(zoomOut, 'click', onZoomOut);
    this.zoomOutAnchor = zoomOut;
    return container;
  }

  onRemove(): void {
    // Symmetric teardown (Opus review #4) — map.remove() discards the
    // container anyway, but explicit off keeps the lifecycle honest.
    for (const [el, type, fn] of this.handlers) L.DomEvent.off(el, type, fn);
    this.handlers.length = 0;
    this.locateBtn = this.zoomInAnchor = this.zoomOutAnchor = undefined;
  }
}

class WdAttributionControl extends L.Control {
  onAdd(): HTMLElement {
    const container = L.DomUtil.create('div', 'wd-fb-attrib') as HTMLElement;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    container.classList.add(mobile ? 'wd-fb-attrib--compact' : 'wd-fb-attrib--full');
    attribInnerEl = L.DomUtil.create('div', 'wd-fb-attrib__inner', container);
    attribInnerEl.innerHTML = attribHtml(activeBasemapId.value);
    if (mobile) {
      const btn = L.DomUtil.create('button', 'wd-fb-attrib__btn', container);
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Attribution');
      btn.innerHTML = '<span class="wd-fb-attrib__i">i</span>' + ATTRIB_CLOSE_SVG;
      L.DomEvent.on(btn, 'click', ev => {
        L.DomEvent.stop(ev);
        container.classList.toggle('wd-fb-attrib--open');
      });
    }
    return container;
  }
}

// ── Markers ──────────────────────────────────────────────────────────────

/** WdCanvasDot lives in ./fallback/canvas-dot (single-path canvas
 *  marker: availability disc + type-colored shield + white sprite icon
 *  + optional status label; LOW-SPEC — no DOM nodes at all). */
interface MarkerStyle {
  typeColor: string;
  status: string | undefined;
  /** type_standard_identifier — the sprite glyph key (maplibre parity). */
  identifier: string | undefined;
}

function markerStyleFor(hut: FbHut): MarkerStyle {
  return {
    typeColor: hut.typeColor ?? DEFAULT_DOT_COLOR,
    status: availBySlug.get(hut.slug)?.statuses[0],
    identifier:
      typeof hut.properties.type_standard_identifier === 'string'
        ? hut.properties.type_standard_identifier
        : undefined,
  };
}

function applySelection(layer: L.Layer, selected: boolean): void {
  // Canvas shield: merge + redraw (custom fields ride along in options)
  (layer as WdCanvasDot).setStyle({ selected } as L.CircleMarkerOptions);
}

/** Cluster bubble: small circle in the dominant member type color
 *  with the dominant type's sprite GLYPH inside (owner: "show the icon
 *  in the circle, less interested in the number" — the count rides
 *  along as a tiny badge). */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const counts = new Map<string, number>(); // key: color|identifier
  const infoByKey = new Map<string, MarkerTypeInfo>();
  for (const marker of cluster.getAllChildMarkers()) {
    const info = markerTypeInfo.get(marker) ?? { color: DEFAULT_DOT_COLOR, identifier: undefined };
    const key = `${info.color}|${info.identifier ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    infoByKey.set(key, info);
  }
  let dominantKey = '';
  let best = 0;
  for (const [key, n] of counts) {
    if (n > best) {
      dominantKey = key;
      best = n;
    }
  }
  const rawInfo = infoByKey.get(dominantKey) ?? {
    color: DEFAULT_DOT_COLOR,
    identifier: undefined,
  };
  // Opus review #6: the color lands in a divIcon's inline style via
  // innerHTML — validate it's a CSS hex before interpolating (fallback
  // to the brand color on anything else).
  const info = {
    ...rawInfo,
    color: /^#[0-9a-fA-F]{3,8}$/.test(rawInfo.color) ? rawInfo.color : DEFAULT_DOT_COLOR,
  };
  const scale0 = Math.min(0.8 + ((cluster.getChildCount() - 2) / 38) * 0.45, 1.25);
  const glyph = getSprite()
    ? spriteSpan(
        `mono/${info.identifier ?? 'accommodation.unknown'}`,
        'mono/accommodation.unknown',
        'wd-fb-cluster__icon',
        '--wd-fb-c',
        Math.round(16 * scale0)
      )
    : '';
  // Member-count sizing (owner spec): 0.8x at 2 members growing to a
  // REDUCED max of 1.25x at 40+; base 24px keeps bubbles a bit larger
  // than the 19px shields (owner spec).
  const count = cluster.getChildCount();
  const scale = Math.min(0.8 + ((count - 2) / 38) * 0.45, 1.25);
  const discPx = Math.round(28 * scale);
  return L.divIcon({
    // Icon-only bubble (owner: "less interested in the number") — the
    // count was a tiny badge that drowned the glyph; dropped.
    html: `<div class="wd-fb-cluster" style="--c:${info.color};width:${discPx}px;height:${discPx}px">${glyph}<span class="wd-fb-cluster__count">${count}</span></div>`,
    className: 'wd-fb-cluster-icon',
    iconSize: [discPx, discPx],
    iconAnchor: [discPx / 2, discPx / 2],
  });
}

function rebuildMarkers(): void {
  if (!map) return;
  for (const group of clusterGroups.values()) group.clearLayers();
  markerBySlug.clear();
  hutBySlug.clear();
  if (map.getZoom() < HUT_MIN_ZOOM) {
    lastRenderBand = 'none';
    return;
  }
  const showLabel = map.getZoom() >= OCC_LABEL_MIN_ZOOM;
  lastRenderBand = showLabel ? 'symlabel' : 'sym';
  // Dedupe by slug — buffer features repeat across neighboring tiles.
  const huts = new Map<string, FbHut>();
  for (const tileHuts of hutCache.tiles.values()) {
    for (const hut of tileHuts) if (!huts.has(hut.slug)) huts.set(hut.slug, hut);
  }
  const markersByBucket = new Map<string | null, WdCanvasDot[]>();
  const rebuildStart = window.performance.now();
  for (const hut of huts.values()) {
    const style = markerStyleFor(hut);
    const selected = selectedSlug.value === hut.slug;
    const status = style.status && style.status !== 'unknown' ? style.status : undefined;
    // LOW-SPEC: ONE canvas tier — every hut is a canvas-drawn shield
    // (cached white sprite bitmap on a type-colored rounded rect); the
    // plain dot only renders before the sprite sheet arrives.
    const layer = new WdCanvasDot([hut.lat, hut.lon], {
      renderer: dotRenderer,
      dotRadius: 6.5, // pre-sprite fallback dot only
      ringColor: status ? statusColors.value[status] : undefined,
      fillColor: style.typeColor,
      typeColor: style.typeColor,
      identifier: style.identifier,
      occLabel: status && showLabel ? t(`availability.glance.${status}`) : undefined,
      selected,
      // SAFETY: the custom fields ride along in options — the cast only
      // satisfies Leaflet's CircleMarkerOptions typing.
    } as L.CircleMarkerOptions);
    markerTypeInfo.set(layer, { color: style.typeColor, identifier: style.identifier });
    markerBySlug.set(hut.slug, layer);
    hutBySlug.set(hut.slug, hut);
    layer.on('click', () => selectHut(hut));
    // Hover: shield grows (drawn via options.hovered in _updatePath).
    layer.on('mouseover', () => layer.setStyle({ hovered: true } as L.CircleMarkerOptions));
    layer.on('mouseout', () => layer.setStyle({ hovered: false } as L.CircleMarkerOptions));
    const bucket = clusterBucketFor(hut);
    const list = markersByBucket.get(bucket) ?? [];
    list.push(layer);
    markersByBucket.set(bucket, list);
  }
  for (const [bucket, markers] of orderLegacyBucketsFirst([...markersByBucket])) {
    const group = clusterGroupFor(bucket);
    if (group) group.addLayers(markers); // bulk: no per-marker animation
  }
  // Diagnostics for the zoom-sweep profiler (harmless in prod).
  window.performance.measure('wd-fb:rebuild', { start: rebuildStart });
}

// ── Served huts item: status palette + clustering config ────────────
// The compiled `huts` overlay item arrives asynchronously (metadata-
// first placeholders carry an empty style — parseStatusColors returns
// undefined for those and the offline palette stays). A CHANGED
// clustering signature rebuilds the cluster groups (e.g. the config
// landing after boot replaced the legacy dual buckets).
type HutsOverlayItem =
  | { style?: StyleSpecification; config?: { clustering?: ClusteringConfig } }
  | undefined;

const hutsItem = computed<HutsOverlayItem>(() =>
  (
    overlayStore.overlays as unknown as Array<{
      name: string;
      style?: StyleSpecification;
      config?: { clustering?: ClusteringConfig };
    }>
  ).find(o => o.name === 'huts')
);

watch(
  hutsItem,
  item => {
    const parsed = parseStatusColors(item?.style);
    if (parsed) statusColors.value = parsed;
    const next = item?.config?.clustering;
    const usable = next && next.enabled !== false ? next : undefined;
    if (clusteringSignature(usable) !== clusteringSignature(hutsClustering.value)) {
      hutsClustering.value = usable;
      clearClusterGroups();
      rebuildMarkers();
    } else {
      hutsClustering.value = usable;
    }
  },
  { immediate: true }
);

/** Selection follows the route (same toggle semantics as the MapLibre
 *  map): swap ONLY the two affected markers' icons — no full rebuild. */
watch(selectedSlug, (slug, previous) => {
  if (!map) return;
  for (const [slugKey, sel] of [
    [previous, false],
    [slug, true],
  ] as Array<[string | undefined, boolean]>) {
    if (!slugKey) continue;
    const layer = markerBySlug.get(slugKey);
    if (layer) applySelection(layer, sel);
  }
});

/** Control-exclusion selector for the delegated veto listener (module
 *  scope so the unmount can remove the same function reference). */
const CONTROL_SELECTOR = '.leaflet-control, .wd-fb-bm, .q-page-sticky';
const onVetoClick = (e: Event): void => {
  if ((e.target as HTMLElement)?.closest(CONTROL_SELECTOR)) vetoFocus();
};

// ── Data fetching (Martin MLT tiles — same URLs as the MapLibre map) ──
// The fetch → decode → cache → evict → generation-guard loop lives in
// ./fallback/mlt-tile-loader (one MltTileCache per source — the loop
// was the same algorithm twice inline). Only source-specific parsing
// and the component side-effects (rebuild, spinner) stay here.

/** Hut tiles: MLT `huts` table → FbHut list (tile-local coords scaled
 *  by the table extent, converted to lng/lat at fetch time so the
 *  rebuild pass never re-parses). */
const hutCache = new MltTileCache<FbHut[]>({
  buildUrl: (z, x, y) => `${TILE_SERVER}/huts/${z}/${x}/${y}.mlt`,
  emptyValue: [],
  parseTile: (buf, z, x, y) => {
    const huts: FbHut[] = [];
    const table = findMltTable(buf, 'huts');
    if (!table) return huts;
    const extent = table.extent || 4096;
    for (const feature of table.getFeatures()) {
      const point = feature.geometry?.coordinates?.[0]?.[0];
      const properties = feature.properties as Record<string, unknown> | null;
      if (!point || !properties?.slug) continue;
      huts.push({
        slug: String(properties.slug),
        lat: tileYToLat(y + point.y / extent, z),
        lon: tileXToLng(x + point.x / extent, z),
        properties,
        typeSlug:
          typeof properties.type_standard_slug === 'string' ? properties.type_standard_slug : null,
        typeColor:
          typeof properties.type_standard_color === 'string'
            ? properties.type_standard_color
            : undefined,
      });
    }
    return huts;
  },
});

/** Availability tiles: MLT `availability` table → slug → day-0 status.
 *  buildUrl reads the CURRENT date (set before loadViewport) so a date
 *  change swaps every URL — the cache is cleared for a full reload. */
const availCache = new MltTileCache<Map<string, string>>({
  buildUrl: (z, x, y) =>
    `${TILE_SERVER}/availability/${z}/${x}/${y}.mlt?date=${availFetchedForDate}&days=4`,
  emptyValue: new Map(),
  parseTile: buf => {
    const statuses = new Map<string, string>();
    const table = findMltTable(buf, 'availability');
    if (!table) return statuses;
    for (const feature of table.getFeatures()) {
      const properties = feature.properties as { slug?: unknown; d0_status?: unknown } | null;
      if (!properties?.slug) continue;
      statuses.set(String(properties.slug), String(properties.d0_status ?? 'unknown'));
    }
    return statuses;
  },
});

/** Fetch the tiles covering the padded viewport (overzoomed from the
 *  source's maxzoom), evict stale ones, rebuild markers once. */
async function refreshTiles(): Promise<void> {
  const activeMap = map;
  if (!activeMap) return;
  if (activeMap.getZoom() < HUT_MIN_ZOOM) {
    if (hutCache.tiles.size > 0) {
      hutCache.clear();
      rebuildMarkers();
    }
    return;
  }
  const range: TileRange = viewportTileRange(
    activeMap.getBounds(),
    0.25,
    activeMap.getZoom(),
    HUTS_TILE_MIN_ZOOM,
    HUTS_TILE_MAX_ZOOM
  );
  const { fetched, evicted, superseded } = await hutCache.loadViewport(range);
  // Perf: a pan fully inside already-loaded tiles changes NOTHING — skip
  // the clearLayers/addLayers rebuild (the 1200-marker rebuild frame was
  // the worst jank in the profile sweep).
  if (!superseded && map && (fetched > 0 || evicted > 0)) rebuildMarkers();
}

const refreshTilesDebounced = useDebounceFn(() => void refreshTiles(), 400);

/** Day-0 availability from the wd-bookings MLT tiles (viewport-scoped,
 *  like the huts tiles). The spinner runs from begin to RENDERED-settle;
 *  the store's 600ms minimum spin still applies. */
let firstAvailLoad = true;

async function refreshAvailTiles(picked: string): Promise<void> {
  const dateISO = toIsoDate(picked);
  if (!dateISO) return;
  const activeMap = map;
  if (!activeMap) return;
  // No markers below the floor — skip fetching entirely (Opus review
  // #3: at world view this computed tileZoom=5 over the global bounds
  // and fired a fetch storm against the tile router).
  if (activeMap.getZoom() < HUT_MIN_ZOOM) return;
  // Opus review #2: spinner only on DATE CHANGE — viewport top-ups are
  // silent (every pan was driving the calendar glyph through a spin).
  const dateChanged = availFetchedForDate !== dateISO;
  const spin = dateChanged && !firstAvailLoad;
  firstAvailLoad = false;
  if (spin) beginAvailabilityLoadManual();
  // Date change ⇒ new URLs ⇒ full swap; same date ⇒ viewport top-up.
  if (dateChanged) {
    availCache.clear();
    availFetchedForDate = dateISO;
  }
  const range: TileRange = viewportTileRange(
    activeMap.getBounds(),
    0.25,
    activeMap.getZoom(),
    AVAIL_TILE_MIN_ZOOM,
    AVAIL_TILE_MAX_ZOOM
  );
  try {
    const { superseded } = await availCache.loadViewport(range);
    // Rebuild only on the newest call (Opus review #1: a superseded
    // date-change load must still settle ITS spin — a viewport top-up
    // that supersedes it has spin=false and never settles. The settle
    // itself is gen-guarded in availability-loading, so an extra settle
    // after a newer begin is ignored.)
    if (!superseded) applyAvailTiles();
  } finally {
    if (spin) settleAvailabilityLoadManual();
  }
}

/** Fold the decoded tiles into availBySlug and recolor the markers. */
function applyAvailTiles(): void {
  availBySlug.clear();
  for (const tile of availCache.tiles.values()) {
    for (const [slug, status] of tile) {
      if (!availBySlug.has(slug)) availBySlug.set(slug, { statuses: [status] });
    }
  }
  rebuildMarkers(); // recolor rings + labels
}

const refreshAvailTilesDebounced = useDebounceFn(
  (date: string) => void refreshAvailTiles(date),
  400
);

/** "Zoom in to see availabilities" hint: shown while a DATE is selected
 *  and the camera is at z <= 9 (below the marker floor — nothing is
 *  visible there); dismissed from z > 10. The gap is deliberate
 *  hysteresis so a pan around z8.5 cannot flicker it. Persistent toast
 *  (timeout 0) + close button; re-shows when conditions return. */
const ZOOM_HINT_SHOW_AT = 9; // owner: visible at z <= 9
const ZOOM_HINT_HIDE_AT = 10;
let zoomHintDismiss: (() => void) | undefined;
/** Reduced-mode toast handle — dismissed on unmount (Opus review:
 * the handle was discarded, letting the toast linger over the next
 * view if the component unmounts within its 10s window). */
let reducedModeToast: (() => void) | undefined;

function updateZoomHint(): void {
  const zoom = map?.getZoom() ?? 99;
  const wanted = Boolean(hutsStore.selectedDate) && zoom <= ZOOM_HINT_SHOW_AT;
  if (wanted && !zoomHintDismiss) {
    zoomHintDismiss = Notify.create({
      message: t('map.fallbackZoomHint'),
      position: 'bottom',
      timeout: 0,
      color: 'dark',
      actions: [{ label: t('close'), color: 'accent' }],
      onDismiss: () => {
        zoomHintDismiss = undefined;
      },
    });
  } else if (!wanted && zoom > ZOOM_HINT_HIDE_AT && zoomHintDismiss) {
    zoomHintDismiss();
  }
}

// Date picker drives the ring date (today when unset — the header chip's
// default); 'now' is the backend's alias for today.
watch(
  () => hutsStore.selectedDate,
  date => {
    // Owner spec: resetting the date REMOVES the availability display
    // (same date-gating as the MapLibre occupation layers) — no rings,
    // labels or zoom hint until a date is picked again.
    if (toIsoDate(date) === undefined) {
      availBySlug.clear();
      availCache.clear();
      availFetchedForDate = undefined;
      rebuildMarkers();
      updateZoomHint();
    } else if (date !== undefined) {
      void refreshAvailTiles(date);
      updateZoomHint();
    }
  },
  { immediate: true }
);

// ── Selection ────────────────────────────────────────────────────────────

/** Same open-details flow as the MapLibre hut layer click: seed the
 * panel identity from the feature properties, then route — the place
 * content panel (`map-hut`) is shared with the main map. */
function selectHut(hut: FbHut): void {
  const slug = hut.slug;
  seedPlaceFromMap(slug, hut.properties, { lat: hut.lat, lon: hut.lon });
  if (route.params.slug === slug) {
    router.push({ name: 'map', hash: route.hash, query: route.query });
  } else {
    router.push({
      name: 'map-hut',
      params: { slug },
      hash: route.hash,
      query: route.query,
    });
  }
}

// ── Viewport sync (store + #map hash, maplibre format) ──────────────────

/** `#map=zoom/lat/lng` — the exact format parseLocationFromHash reads
 * (and maplibre's own hash writes). replaceState: no history spam, no
 * router interference (hash-only change never fires hashchange). */
function syncHash(): void {
  if (!map || typeof window === 'undefined') return;
  const center = map.getCenter().wrap(); // stay within ±180 in the URL
  const hash = `#map=${map.getZoom().toFixed(2)}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash}`
    );
  }
}

function onMoveEnd(): void {
  if (!map) return;
  updateZoomHint(); // zoom-hysteresis check on every camera settle
  // Icon band change (none/dot/sym) — rebuild; markercluster itself
  // re-clusters on zoom without any rebuild.
  // Same vocabulary as rebuildMarkers: 'none' below the marker floor,
  // 'sym' up to the label zoom, 'symlabel' above (Opus review #1 — the
  // old 'dot' case never matched what rebuildMarkers stored, causing a
  // full rebuild on EVERY pan at z7-10 and z>=12).
  const band =
    map.getZoom() < HUT_MIN_ZOOM
      ? 'none'
      : map.getZoom() >= OCC_LABEL_MIN_ZOOM
        ? 'symlabel'
        : 'sym';
  if (band !== lastRenderBand) rebuildMarkers();
  localPropertiesStore.updateLocation({
    lat: map.getCenter().lat,
    lng: map.getCenter().lng,
    zoom: map.getZoom(),
    bearing: 0,
  });
  syncHash();
  const pickedDate = hutsStore.selectedDate;
  if (pickedDate) refreshAvailTilesDebounced(pickedDate);
  syncDrawState(map.getZoom());
  refreshTilesDebounced();
}

// ── Basemap application ──────────────────────────────────────────────────

function applyBasemap(): void {
  if (!map) return;
  const bm = BASEMAPS.value.find(b => b.id === activeBasemapId.value) ?? BASEMAPS.value[0]!;
  if (tileLayer) map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(bm.url, {
    maxNativeZoom: bm.maxNativeZoom,
    maxZoom: MAX_ZOOM,
    attribution: bm.attribution,
  });
  tileLayer.addTo(map);
}

// ── Lifecycle ────────────────────────────────────────────────────────────

onMounted(() => {
  const el = fallbackEl.value;
  if (!el) return;
  setAvailabilityManualSettle(true); // we own the spinner settle

  const initial = localPropertiesStore.getInitialLocation();
  // Defensive wrap: an out-of-range seed lng (mangled deep link) must
  // never park the camera on an unwrapped off-world copy — markers exist
  // only on copy 0 and would vanish (owner bug report).
  const initialCenter = L.latLng(initial.lat, initial.lng).wrap();
  map = L.map(el, {
    zoomControl: false,
    attributionControl: false, // replaced by the MapLibre-style control below
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    // LOW-SPEC: integer zoom snap — with zoomSnap: 0 every wheel tick
    // triggered a full canvas re-projection of all markers (the
    // profile showed 16-31fps during wheel zoom vs 60fps idle). Snapping
    // to integer levels means one redraw per level change instead of
    // dozens per gesture. The zoom slider compensates for the loss of
    // fractional smoothness.
    zoomSnap: 1,
    doubleClickZoom: false, // prevents zoom on the focus-cancel double-tap
    // Default 60px/level felt twitchy — a bit more travel per level.
    wheelPxPerZoomLevel: 100,
  });
  map.setView(initialCenter, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initial.zoom)));
  applyBasemap();

  // Controls — same layout as the MapLibre map: zoom top-right on desktop
  // / bottom-left on mobile (matching MglNavigationControl), attribution +
  // scale bottom-left (attribution above the scale).
  const isMobileView = window.matchMedia('(max-width: 768px)').matches;
  if (isMobileView) {
    // ONE merged bar (locate row above +/−): a single bordered box has no
    // seam/width/border drift between the rows (owner report — two stacked
    // boxes rendered a light seam + 1-2px width mismatch at fractional
    // DPR), and the in-bar locate sits inside .leaflet-control so the
    // focus-tap exclusion lists cover it for free.
    new WdMobileZoomBarControl({ position: 'bottomleft' }).addTo(map);
  } else {
    L.control.zoom({ position: 'topright' }).addTo(map);
  }
  new WdAttributionControl({ position: 'bottomleft' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(map);

  dotRenderer = L.canvas({ padding: 0.5 }); // one canvas for all hut dots

  // Shared overlay menu wiring: the hoisted WdOverlayControl (WdMapView)
  // mutates the shared overlay store — this adapter mirrors the
  // raster overlays onto the Leaflet map (fallback/overlay-adapter).
  overlayAdapter = createFallbackOverlayAdapter(map);

  // Cluster groups are created LAZILY per bucket on the first marker
  // rebuild (clusterGroupFor) — driven by config.clustering when the
  // catalog resolved, legacy dual buckets otherwise (see
  // clusterBucketFor). Z-order note (owner: huts with availability
  // should never be covered by others) applies to the legacy mode via
  // stable insertion order: buckets are created in first-hut-seen
  // order, later groups paint above earlier ones.

  map.on('moveend zoomend', onMoveEnd);
  const container = map.getContainer();
  container.addEventListener('pointerdown', onContainerPointerDown, { passive: true });
  container.addEventListener('pointerup', onContainerPointerUp, { passive: true });

  // VETO: delegated listener on the container — catches clicks on ANY
  // element inside a Leaflet control (the actual target might be a span,
  // text node, or pseudo-element wrapper inside the button, not the <a>
  // itself). This is the robust approach.
  // NOTE: .wd-focus-toggle is deliberately NOT in the selector — its
  // touchend fires BEFORE its own click, so vetoing it would block the
  // button's own exit handler (exit taps did nothing). The button is
  // invisible+dead when focus is off (the only state the container's
  // delayed toggle runs in), so it never needs vetoing.
  container.addEventListener('click', onVetoClick, { passive: true });
  container.addEventListener('touchend', onVetoClick, { passive: true });
  map.on('zoom', onMapZoomSync);
  document.body.classList.add('wd-fb-active'); // slider visibility gate
  sliderZoom.value = map.getZoom();
  fallbackEl.value?.style.setProperty('--wd-fb-g', String(glyphScale(map.getZoom())));
  syncDrawState(map.getZoom());
  updateZoomHint();
  void loadSprite();

  // Dev-only debugging/profiling hook (the map instance lives in this
  // component's closure otherwise; window.__wdFbDebug.map exposes e.g.
  // latLngToContainerPoint for exact click tests). Never in prod builds.
  // clusterGroups is a GETTER — clearClusterGroups() reassigns the
  // binding, a captured reference would go stale on the first config
  // arrival.
  if (import.meta.env.DEV) {
    (window as unknown as { __wdFbDebug?: unknown }).__wdFbDebug = {
      map,
      get clusterGroups() {
        return clusterGroups;
      },
      hutCache,
      markerBySlug,
      selectHut,
    };
  }

  map.whenReady(() => {
    emit('ready');
    void refreshTiles();
  });

  // Reduced-mode notice — dismissable toast, dismissal persisted, shown
  // exactly once per browser (localStorage flag).
  if (!LocalStorage.getItem(NOTE_KEY)) {
    reducedModeToast = Notify.create({
      message: t('map.fallbackNote'),
      position: 'bottom', // same as the app's staging notifiers
      timeout: 10000,
      progress: true,
      multiLine: true,
      color: 'dark',
      actions: [
        {
          label: t('close'),
          color: 'accent',
          handler: () => LocalStorage.set(NOTE_KEY, true),
        },
      ],
    });
  }
});

onBeforeUnmount(() => {
  hutCache.clear(); // in-flight loads land in a superseded generation
  availCache.clear();
  setAvailabilityManualSettle(false);
  document.body.classList.remove('wd-fb-active');
  zoomHintDismiss?.();
  reducedModeToast?.();
  if (focusOn.value) document.body.classList.remove('wd-map-focus');
  revokeSprite(); // blob URL cleanup (Opus #5)
  if (map) {
    const c = map.getContainer();
    c.removeEventListener('pointerdown', onContainerPointerDown);
    c.removeEventListener('pointerup', onContainerPointerUp);
    c.removeEventListener('click', onVetoClick);
    c.removeEventListener('touchend', onVetoClick);
  }
  // Teardown order (adapter contract): stop the overlay adapter BEFORE
  // map.remove() — destroy() removes its layers and unbinds watchers
  // against a live map; after remove() the calls only survive by
  // Leaflet's forgiving no-ops.
  overlayAdapter?.destroy();
  overlayAdapter = undefined;
  map?.remove(); // tears down layers + listeners
  map = undefined;
  clusterGroups = new Map();
});
</script>

<template>
  <div ref="fallbackEl" class="wd-fallback-map" role="application" :aria-label="t('map.loading')">
    <!-- Basemap switch — mirrors the MapLibre control (chip toggle +
         thumbnail rail), raster-only trio. -->
    <div class="wd-fb-bm">
      <Transition name="wd-fb-bm-rail">
        <div v-if="bmOpen" class="wd-fb-bm__rail" role="group" :aria-label="t('map.layers')">
          <button
            v-for="bm in BASEMAPS"
            :key="bm.id"
            class="wd-fb-bm__btn"
            :class="{ 'wd-fb-bm__btn--active': activeBasemapId === bm.id }"
            :aria-label="bmLabel(bm)"
            :aria-pressed="activeBasemapId === bm.id"
            @click="selectBasemap(bm.id)"
          >
            <img :src="bm.thumb" :alt="bmLabel(bm)" class="wd-fb-bm__thumb" />
          </button>
        </div>
      </Transition>
      <button
        class="wd-fb-bm__toggle"
        :aria-label="t('map.layers')"
        :aria-expanded="bmOpen"
        @click="bmOpen = !bmOpen"
      >
        <img :src="bmOpen ? bmIconClose : bmIconOpen" alt="" class="wd-fb-bm__toggle-img" />
      </button>
    </div>

    <!-- Locate (GPS): maplibre ctrl-group style, top-right under the
         focus toggle on desktop, above the bottom-left zoom on mobile. -->
    <button
      class="wd-fb-locate"
      type="button"
      :aria-label="t('map.fallbackLocate')"
      @click.stop="onLocate"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          d="M10 4C9 4 9 5 9 5v.1A5 5 0 0 0 5.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 0 0 9 14.9v.1s0 1 1 1 1-1 1-1v-.1A5 5 0 0 0 14.9 11h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0 0 11 5.1V5s0-1-1-1m0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7"
        />
        <circle cx="10" cy="10" r="2" />
      </svg>
    </button>

    <!-- Zoom slider (owner re-request) — same dock as the MapLibre map. -->
    <div
      class="wd-zoom"
      :class="{ 'wd-zoom--dragging': dragging }"
      role="slider"
      :aria-label="t('map.zoom')"
      :aria-valuemin="MIN_ZOOM"
      :aria-valuemax="MAX_ZOOM"
      :aria-valuenow="Math.round(sliderZoom * 10) / 10"
      tabindex="0"
      @pointerdown="onSliderDown"
      @pointermove="onSliderMove"
      @pointerup="onSliderUp"
      @pointercancel="onSliderUp"
      @lostpointercapture="onSliderUp"
    >
      <div class="wd-zoom__pill">
        <button
          class="wd-zoom__step"
          :aria-label="t('map.zoomIn')"
          @click="onSliderStepClick($event, SLIDER_STEP)"
        >
          <q-icon name="wd-plus" size="14px" />
        </button>
        <div class="wd-zoom__track">
          <div class="wd-zoom__thumb" :style="{ top: thumbPos + '%' }" />
        </div>
        <button
          class="wd-zoom__step"
          :aria-label="t('map.zoomOut')"
          @click="onSliderStepClick($event, -SLIDER_STEP)"
        >
          <q-icon name="wd-minus" size="14px" />
        </button>
      </div>
    </div>

    <!-- Focus (fullscreen) toggle — same global class and position as the
         MapLibre map's button (desktop top-right; scoped override keeps it
         tappable on mobile where the fallback has no tap-to-focus). -->
    <button
      class="wd-focus-toggle"
      :class="{ 'wd-focus-toggle--active': focusOn }"
      :aria-label="focusOn ? t('map.fallbackExitFocus') : t('map.fallbackFocus')"
      @click.stop="toggleFocus"
    >
      <svg
        v-if="!focusOn"
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
  </div>
</template>

<style lang="scss" scoped>
@use '../../css/map-controls/chip' as chip;
// Shared zoom-slider pill visuals — the SAME partial WdZoomSlider uses
// (MapLibre renderer): one source of truth for both maps.
@use '../../css/map-controls/zoom-slider-pill';

@include zoom-slider-pill.pill;
$ease: cubic-bezier(0.2, 0, 0, 1);

.wd-fallback-map {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #f6f9f7; // same base the MapLibre canvas paints over
}

// ── Basemap switch (mirror of WdBasemapControl's wd-bm) ────────────────
.wd-fb-bm {
  position: absolute;
  right: 12px;
  bottom: 14px;
  z-index: 1100; // above leaflet controls (1000)
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  pointer-events: none; // map gestures pass through

  *:focus {
    outline: none;
  }
}

.wd-fb-bm__rail {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  box-shadow: var(--wd-ctl-shadow);
  pointer-events: auto;
}

.wd-fb-bm__btn {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--wd-ctl-border);
  background: var(--wd-ctl-bg);
  cursor: pointer;
  overflow: hidden;
  flex: none;
  transition:
    border-color 0.15s $ease,
    transform 0.1s $ease;

  &:active {
    transform: scale(0.95);
  }

  &--active {
    border: 2px solid $wd-gold; // gold selection ring (app language)
  }
}

.wd-fb-bm__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wd-fb-bm__toggle {
  @include chip.control; // 48px recipe — same as the MapLibre controls
  pointer-events: auto;
  padding: 8px;
}

.wd-fb-bm__toggle-img {
  position: absolute;
  inset: 8px;
  width: calc(100% - 16px);
  height: calc(100% - 16px);
  object-fit: contain;
}

.wd-fb-bm-rail-enter-active,
.wd-fb-bm-rail-leave-active {
  transition:
    opacity 0.22s $ease,
    transform 0.22s $ease;
}

.wd-fb-bm-rail-enter-from,
.wd-fb-bm-rail-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

// ── Focus toggle: keep it reachable on mobile ──────────────────────────
// The global _layout.scss hides the button outside focus mode on mobile
// (the main map enters via empty-map tap, which the fallback lacks) —
// here the button is the only entry, so it stays visible everywhere.
// Focus toggle on mobile: hidden outside focus mode (global
// _layout.scss handles this). Mobile users enter focus via the
// tap-to-focus handler above — the button only appears IN focus mode
</style>

<!-- UNSCOPED: Leaflet renders marker/cluster/control DOM at runtime (no
     Vue scope attributes reach it), and the zoom-slider visibility
     override keys off a body class set by this component. -->
<style lang="scss">
// ── Hut markers: 36px hit box, 13px type-colored dot, status ring ──────
.wd-fb-cluster-icon {
  // z7 ghost ramp (owner spec) — 50% at z7, solid by z9. The transition
  // prevents the solid→transparent FLICKER on first load at z7-z9.
  opacity: var(--wd-fb-o, 1);
  transition: opacity 0.35s ease;
}

// Count badge: small circle at the bottom-right in the hut/category
// color, white text (owner spec — restored after the icon-only round).
.wd-fb-cluster__count {
  position: absolute;
  right: -5px;
  bottom: -5px;
  z-index: 2;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--c, #346751);
  color: #ffffff;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  box-shadow: 0 0 0 2px #ffffff;
}

// Icons above clusters (owner spec): hut shields live on the CANVAS
// (overlay pane, z 400) while cluster bubbles are DOM markers (z 600) —
// lift the overlay pane above the marker pane so shields paint over
// bubbles at their shared edges.
.wd-fallback-map .leaflet-overlay-pane {
  z-index: 650;
}

// ── Shared overlay strip (hoisted out of the MapLibre slot) ──────────
// The sticky is position:fixed WITHOUT its own z-index — in MapLibre
// mode tree order wins its ties. The Leaflet panes paint at 200-1000,
// so in fallback mode the strip needs the same lift the fallback's own
// chrome uses (.wd-fb-bm is 1100, above leaflet controls).
body.wd-fb-active .wd-map-ctl-sticky {
  z-index: 1100;
}

// Catalog raster overlays (fallback/overlay-adapter) sit in a pane
// between the basemap tiles and the hut-dot canvas — declared here so
// the stacking contract lives with the rest of the pane table above
// (Leaflet names panes `leaflet-<name>-pane`; the adapter also sets
// the z-index inline).
.wd-fallback-map .leaflet-wdOverlay-pane {
  z-index: 250;
}

// ── Locate button: maplibre ctrl-group language (29px white square,
//    shadow ring, #333 icon) ────────────────────────────────────────────
.wd-fb-locate {
  position: absolute;
  top: 72px; // main-map GPS: 58px container push + 14px child margin
  right: 14px;
  z-index: 1001;
  width: 48px; // 48 outer = maplibre ctrl-group (46 button + 2px border)
  height: 48px;
  padding: 6px; // 48 - 2 border - 12 = 34px glyph (maplibre ctrl-icon size)
  border: 1px solid var(--wd-ctl-border, #dde7e0);
  border-radius: 8px; // main-map ctrl-group radius
  background: var(--wd-ctl-bg, #fdfefd);
  box-shadow: var(--wd-ctl-shadow, 0 1px 3px rgba(10, 20, 15, 0.2));
  color: var(--wd-ctl-ink, #224e3b); // SVG uses currentColor — flips with the theme
  cursor: pointer;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  // Solid hover/active — a translucent rgba here would REPLACE the
  // token background (the "transparent on hover" bug); MapLibre's
  // ctrl-group hover layers over a solid group bg. Same formula as the
  // zoom bar so the flush mobile stack hovers as one.
  &:hover,
  &:active {
    background: color-mix(in srgb, var(--wd-ctl-bg, #fdfefd) 92%, var(--wd-ctl-ink, #333));
  }

  &:focus-visible {
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.1),
      0 0 2px 2px #0096ff;
    outline: none;
  }
}

// Mobile: above the bottom-left zoom stack (GPS parity with the main map)
@media (max-width: 768px) {
  .wd-fb-locate {
    top: auto;
    // Stack above the zoom bar: zoom at ~76px (2×46px + margins),
    // locate directly above it at ~62px (46px + 16px from zoom's top)
    bottom: 76px;
    left: 12px;
    right: auto;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }
}

// ── Focus mode: the basemap switch is APP CHROME — same slide-away the
//    main map gives .wd-map-ctl-sticky/.wd-map-ctl-col. Map instruments
//    (zoom, slider, locate, attribution) stay, like MapLibre controls. ──

// Owner spec: in focus mode, slide away ALL floating chrome — the
// basemap switch, zoom bar, locate, attribution and scale. Same motion
// language as the main map (.wd-map-ctl-sticky: fade + 80px slide).
// Focus mode (desktop): basemap switch and locate slide away (app
// chrome). Scale and attribution STAY (MapLibre keeps both — they're
// map instruments, not chrome). The zoom bar also stays.
body.wd-map-focus {
  .wd-fb-bm,
  .wd-fb-locate {
    opacity: 0;
    pointer-events: none;
    transform: translateX(80px);
    transition:
      opacity 0.3s cubic-bezier(0.2, 0, 0, 1),
      transform 0.3s cubic-bezier(0.2, 0, 0, 1);
  }
}

// Focus mode on mobile — per MapLibre _layout.scss:132-134:
// - Scale STAYS, slides UP from 66px to 12px+inset
// - GPS/zoom bottom-left flies OUT (translateX(-60px), opacity 0)
// - Attribution STAYS (not explicitly hidden in MapLibre)
// - Focus toggle stays as the exit button
@media (max-width: 768px) {
  body.wd-map-focus .wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-scale {
    top: calc(12px + env(safe-area-inset-top, 0px)) !important;
  }
  body.wd-map-focus .wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-zoom,
  body.wd-map-focus .wd-fb-locate {
    opacity: 0;
    transform: translateX(-60px);
    transition:
      opacity 0.3s cubic-bezier(0.2, 0, 0, 1),
      transform 0.3s cubic-bezier(0.2, 0, 0, 1);
  }
  // Attribution follows the stack's vacated corner (wd-attrib parity)
  body.wd-map-focus .wd-fallback-map .wd-fb-attrib {
    left: calc(12px + env(safe-area-inset-left, 0px));
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  }
}

// Zoom slider: ALWAYS visible in fallback mode (the global gating only
// knows the MapLibre focus/overlay states).
// Owner spec: zoom slider ONLY on mobile (desktop uses the zoom
// buttons). The global _zoom-slider.scss gating already handles mobile
// (visible when the overlay strip is closed); we only need to ensure
// desktop NEVER shows it in the fallback, overriding the global rules.
@media (min-width: #{$breakpoint-sm + 1}) {
  body.wd-fb-active .wd-zoom {
    display: none !important;
  }
}

// ── Cluster bubbles: dominant type color ───────────────────────────────
.wd-fb-cluster-icon {
  /* hit box sized per-cluster by iconSize */
}

// Small cluster bubble: white disc, dominant-type color ring, the type's
// sprite glyph inside; the count demoted to a tiny edge badge (owner:
// "show the icon in the circle, less interested in the number").
.wd-fb-cluster {
  position: relative; // width/height inline (member-count sizing)
  border-radius: 50%;
  border: 2px solid var(--c, #346751);
  background: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.wd-fb-cluster__icon {
  --wd-fb-c: 1; // fixed (inline geometry is pre-normalized)
  position: relative;
  z-index: 1;
  // GRAY silhouette (owner: black or better gray) — visible on white.
  filter: brightness(0) opacity(0.8);
  background-repeat: no-repeat;
  background-image: var(--wd-fb-sheet);
  image-rendering: auto;
  display: block;
}

// ── Controls: MapLibre parity ─────────────────────────────────────────────
// Geometry/colors copied from maplibre-gl.css (.maplibregl-ctrl-*):
// the zoom group is a shadow-ringed white square like .maplibregl-ctrl-group
// and sits at the SAME offsets the main map gives its top-right cluster
// (14px inset, pushed below the focus toggle — css/maplibre-gl.scss).

// Zoom bar: maplibre ctrl-group look. The background override is
// REQUIRED: leaflet's own .leaflet-bar sets background:#fff — without
// this the white bar bg bleeds at every removed/merged border edge
// (the "white seam line" at fractional DPR).
.wd-fallback-map .leaflet-bar {
  border: 1px solid var(--wd-ctl-border, #dde7e0);
  border-radius: 8px; // main-map ctrl-group radius
  background: var(--wd-ctl-bg, #fdfefd);
  box-shadow: var(--wd-ctl-shadow, 0 1px 3px rgba(10, 20, 15, 0.2));
  overflow: hidden;

  a,
  a:hover {
    width: 46px; // main-map button size
    height: 46px;
    line-height: 46px;
    font-size: 22px;
    font-weight: 600;
    color: var(--wd-ctl-ink, #333333);
    background: var(--wd-ctl-bg, #fdfefd);
    border-bottom: none;
    text-decoration: none;
  }

  // In-bar locate row (mobile merged bar): same button box as the +/−
  // anchors — one frame, one hover language, no seam possible.
  .wd-fb-locate-row {
    width: 46px;
    height: 46px;
    padding: 6px; // 34px glyph (maplibre ctrl-icon size)
    display: grid;
    place-items: center;
    border: none;
    background: var(--wd-ctl-bg, #fdfefd);
    color: var(--wd-ctl-ink, #224e3b);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  }

  a:hover,
  .wd-fb-locate-row:hover,
  .wd-fb-locate-row:active {
    background: color-mix(in srgb, var(--wd-ctl-bg, #fdfefd) 92%, var(--wd-ctl-ink, #333));
  }

  // Divider between rows (leaflet's a+a rule only matches anchors)
  .wd-fb-locate-row + a {
    border-top: 1px solid var(--wd-ctl-border, #dde7e0);
  }

  a:hover {
    background: color-mix(in srgb, var(--wd-ctl-bg, #fdfefd) 92%, var(--wd-ctl-ink, #333));
  }

  a:focus-visible,
  .wd-fb-locate-row:focus-visible {
    outline: 2px solid #333333;
    outline-offset: -2px;
  }

  a + a {
    border-top: 1px solid var(--wd-ctl-border, #dde7e0);
  }
}

// Desktop: zoom below the focus toggle, 14px inset (main map parity)
@media (min-width: 769px) {
  .wd-fallback-map .leaflet-top.leaflet-right .leaflet-control-zoom {
    margin: 134px 14px 0 0; /* below the 46px locate at y72 + 14px gap */
    float: right;
  }
}

// Mobile: zoom+locate merged bar bottom-left (MglNavigationControl parity)
@media (max-width: 768px) {
  .wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-zoom {
    margin: 0 0 14px 12px;
    // full 8px radius — the locate row lives INSIDE the bar now
  }
}

// Scale: maplibre .maplibregl-ctrl-scale values (readable ink on a
// translucent bar with the 2px baseline)
.wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-scale {
  margin: 0 0 14px 12px; // main-map bottom-left inset (maplibre-gl.scss:49-55)
}

// ── Mobile layout: scale at top-center (below the topbar), zoom slider
//    hidden, locate + zoom stacked at bottom-left, attribution visible above
//    the stack. Mirrors the MapLibre mobile control layout.
@media (max-width: 768px) {
  // Scale: FIXED top-center below the topbar — MapLibre mobile exact
  // (maplibre-gl.scss:367-372: position fixed, top 66px+inset, centered)
  .wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-scale {
    position: fixed;
    bottom: auto;
    top: calc(66px + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    z-index: 500;
  }

  // Zoom slider: HIDDEN on mobile (owner: "does not really work in
  // leaflet") — needs body-level specificity to override the global
  // _zoom-slider.scss mobile rule (display:flex !important)
  body .wd-fallback-map .wd-zoom,
  body.wd-fb-active .wd-fallback-map .wd-zoom,
  body:not(.wd-ovl-strip-open) .wd-fallback-map .wd-zoom {
    display: none !important;
  }

  // Locate: the template button is DESKTOP-only — on mobile the locate
  // row lives inside the merged zoom bar (WdMobileZoomBarControl).
  .wd-fb-locate {
    display: none;
  }

  // Attribution: MapLibre parity — the round ⓘ chip BESIDE the control
  // stack (left 68 = 12 + 48 stack + 8 gap), bottom-aligned with it
  // (_attribution.scss .wd-attrib geometry — NOT above the stack).
  .wd-fallback-map .wd-fb-attrib {
    position: absolute;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    left: calc(68px + env(safe-area-inset-left, 0px));
    margin: 0;
    z-index: 1001;
  }
}

// Actual MapLibre scale values (maplibre-gl.scss:276-303) — NOT the
// transparent/2px I originally described. The MapLibre scale uses a
// gradient white fade + text-shadow halo for legibility on any basemap.
.wd-fallback-map .leaflet-control-scale-line {
  position: relative;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  color: #333333;
  border-color: #333333;
  border-style: none solid solid;
  border-width: medium 3px 3px;
  padding: 0 5px;
  box-sizing: border-box;
  background: linear-gradient(to bottom, transparent 70%, rgba(255, 255, 255, 0.85) 100%);
  text-shadow:
    1px 0 0 rgba(255, 255, 255, 0.7),
    -1px 0 0 rgba(255, 255, 255, 0.7),
    0 1px 0 rgba(255, 255, 255, 0.7),
    0 -1px 0 rgba(255, 255, 255, 0.7);
}

// ── Attribution: maplibre .maplibregl-ctrl-attrib parity ──────────────
// Desktop = translucent expanded bar; mobile = compact ⓘ pill that
// expands on tap (same geometry as maplibre's compact control).
.wd-fb-attrib {
  margin-left: 12px;
  font-size: 12px;

  a {
    color: var(--wd-ctl-ink, #333333);
    text-decoration: none;

    &:hover {
      color: inherit;
      text-decoration: underline;
    }
  }
}

.wd-fb-attrib--full .wd-fb-attrib__inner {
  padding: 1px 8px;
  font-size: 10px;
  line-height: 16px;
  border-radius: 4px;
  background: var(--wd-ctl-bg, #fdfefd);
  border: 1px solid var(--wd-ctl-border, #dde7e0);
  color: var(--wd-ctl-ink, #333333);
}

// Compact ⓘ — a twin of the main map's owned chip (_attribution.scss
// .wd-attrib): round 28px serif-i chip that expands into a text card
// with the i becoming a 32px close button (taps were hitting links).
.wd-fb-attrib--compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-height: 0;
  padding: 0;
  border: 1px solid var(--wd-ctl-border, #dde7e0);
  border-radius: 999px; // round ⓘ
  background: color-mix(in srgb, var(--wd-ctl-bg, #fdfefd) 88%, transparent);
  color: var(--wd-ctl-ink, #224e3b);
  box-sizing: border-box;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    width 0.15s cubic-bezier(0.2, 0, 0, 1),
    min-width 0.15s cubic-bezier(0.2, 0, 0, 1),
    border-radius 0.15s cubic-bezier(0.2, 0, 0, 1),
    padding 0.15s cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden; // clip during the size morph

  .wd-fb-attrib__inner {
    display: none;
    flex: 1;
    min-width: 0;
    text-align: left;
    font-size: 10px;
    line-height: 1.5;
    white-space: normal;
    color: var(--wd-ctl-ink, #224e3b);

    a {
      color: var(--wd-ctl-ink, #224e3b);
      text-decoration: underline;
      opacity: 0.8;
    }
  }

  &.wd-fb-attrib--open {
    width: auto;
    min-width: 190px;
    max-width: min(66vw, 320px);
    height: auto;
    padding: 7px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--wd-ctl-bg, #fdfefd) 92%, transparent);
    justify-content: flex-start;
    gap: 8px;

    .wd-fb-attrib__inner {
      display: block;
    }
  }
}

// The chip button: collapsed = serif italic "i" centered in the round
// chip (the chip IS the circle); open = 32px round close button.
.wd-fb-attrib__btn {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;

  .wd-fb-attrib__close {
    display: none;
    width: 13px;
    height: 13px;
  }
}

.wd-fb-attrib--open .wd-fb-attrib__btn {
  position: static;
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 999px;
  background: rgba(128, 145, 135, 0.14);

  .wd-fb-attrib__i {
    display: none;
  }

  .wd-fb-attrib__close {
    display: block;
  }
}
</style>
