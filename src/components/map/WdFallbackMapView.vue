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
 * - Availability: `GET /v1/huts/availability/{date}.geojson?days=1` for
 *   the SELECTED date (today when unset — same default as the header
 *   chip). Day 0 paints a larger background ring in the occupation
 *   status color (the same palette the MapLibre `wd-huts-occupation`
 *   layer uses).
 * - Clustering: TWO markercluster groups — huts WITH availability
 *   uncluster from z9, huts without from z10 (owner spec). Cluster
 *   bubbles are colored by the DOMINANT member type color.
 * - Click: seeds the place identity (seedPlaceFromMap) and routes to
 *   `map-hut` — the same content panel the MapLibre map opens.
 * - Viewport: shared with the main map (localPropertiesStore) AND
 *   mirrored into the URL as `#map=z/lat/lng` (maplibre hash format —
 *   local-properties-store parses it back on boot).
 * - Controls: zoom buttons top-right + the WdZoomSlider look (ported,
 *   Leaflet-driven, always visible via body.wd-fb-active), scale and
 *   attribution bottom-left — matching the MapLibre layout.
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
import { decodeTile } from '@maplibre/mlt';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { clientWodore } from '@clients/index';
import { currentLocale } from '@services/locale';
import { getEnv } from '@services/runtimeEnv';
import { publicApiBase } from '@services/apiBase';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { useHutsStore } from '@stores/huts-store';
import { seedPlaceFromMap } from '@composables/usePlace';

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

const fallbackEl = ref<HTMLDivElement>();

// ── Zoom model ───────────────────────────────────────────────────────────

/** Dots render from this zoom up (owner: one level earlier than z9). */
const HUT_MIN_ZOOM = 8;
/** Dots upgrade to category symbols (mono SVG on a colored shield). */
const SYMBOL_MIN_ZOOM = 11;
/** Huts WITH availability uncluster from here (owner spec). */
const AVAIL_UNCLUSTER_ZOOM = 9;
/** Huts WITHOUT availability one level later (owner spec). */
const PLAIN_UNCLUSTER_ZOOM = 10;
const MIN_ZOOM = 2; // MAP_MIN_ZOOM parity
const MAX_ZOOM = 19; // raster basemaps top out here
/** Martin `huts` source pyramid (martin.yaml minzoom/maxzoom) — above
 *  the max the fallback overzooms from z9 tiles (exact coords: a z9
 *  tile unit is ~0.15 m at the equator). */
const HUTS_TILE_MIN_ZOOM = 5;
const HUTS_TILE_MAX_ZOOM = 9;
/** Brand fallback when no type color is known for a hut. */
const DEFAULT_DOT_COLOR = '#346751'; // $primary

/** Day-0 occupation status → ring color. Same palette the MapLibre
 * `wd-huts-occupation` layer paints (live catalog style). */
const STATUS_COLORS: Record<string, string> = {
  empty: '#25BF5E',
  low: '#F6AD4B',
  medium: '#EA9A37',
  free_unknown: '#7FAB88',
  high: '#C3731F',
  full: '#961A17',
};

// ── Basemap set (hardcoded raster trio — catalog later) ─────────────────

const TILE_SERVER = getEnv('WODORE_TILE_SERVER_URL') ?? 'http://localhost:8075';
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const TOPO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> | <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA) | swisstopo | geoland.at';
const SAT_ATTR = 'Esri, Maxar, Earthstar Geographics';

interface FbBasemap {
  id: 'osm' | 'topo' | 'satellite';
  url: string;
  attribution: string;
  maxNativeZoom: number;
  thumb: string;
}

const assetUrl = (name: string) =>
  new URL(`/src/assets/wodore-design/map/switch/${name}`, import.meta.url).href;

const BASEMAPS: FbBasemap[] = [
  {
    id: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('outdoor-v2.png'),
  },
  {
    id: 'topo',
    // mapproxy world_topo facade behind the tile-router (OpenTopoMap +
    // geoland.at + swisstopo merged, cached WebP)
    url: `${TILE_SERVER}/raster/tiles/world_topo/webmercator/{z}/{x}/{y}.webp`,
    attribution: TOPO_ATTR,
    maxNativeZoom: 16,
    thumb: assetUrl('swiss-raster.png'),
  },
  {
    id: 'satellite',
    url: `${TILE_SERVER}/raster/tiles/world_satellite/webmercator/{z}/{x}/{y}.webp`,
    attribution: SAT_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('satellite.png'),
  },
];

const BM_KEY = 'wodore:fallbackBasemap';
const NOTE_KEY = 'wodore:fallbackNoteDismissed';
const bmOpen = ref(false);
const activeBasemapId = ref((LocalStorage.getItem(BM_KEY) as FbBasemap['id'] | null) ?? 'osm');

function bmLabel(bm: FbBasemap): string {
  return t(`map.fallbackBasemaps.${bm.id}`);
}

function selectBasemap(id: FbBasemap['id']): void {
  if (id === activeBasemapId.value) return;
  activeBasemapId.value = id;
  LocalStorage.set(BM_KEY, id);
  applyBasemap();
}

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

/** Day-0 availability per hut (from the availability GeoJSON). */
interface FbAvail {
  status: string | undefined;
}

let map: L.Map | undefined;
let tileLayer: L.TileLayer | undefined;
let clusterAvail: L.MarkerClusterGroup | undefined;
let clusterPlain: L.MarkerClusterGroup | undefined;
/** Latest-wins guards — SEPARATE per fetch family: a tile response must
 *  never invalidate a concurrent availability response (the shared
 *  counter dropped every availability payload while tiles loaded). */
let tileGeneration = 0;
let availGeneration = 0;
/** Loaded hut tiles, keyed `z/x/y` (buffer features dedup by slug at
 *  rebuild). Evicted when outside the padded viewport. */
const hutTiles = new Map<string, FbHut[]>();
const fetchingTiles = new Set<string>();
/** slug → day-0 availability status. */
const availBySlug = new Map<string, FbAvail>();
/** Mono symbol SVG per type slug (null = fetched, unavailable). */
const symbolBySlug = new Map<string, string | null>();
/** Marker → its type color (cluster bubble coloring). */
const markerTypeColor = new WeakMap<L.Marker, string>();

// ── Zoom slider (ported WdZoomSlider, Leaflet-driven) ───────────────────

const PX_PER_LEVEL = 32;
const STEP = 0.75;
const PAGE_STEP = 3;
const MOVE_THRESHOLD = 5;
const STEP_CHAIN_MS = 600;

const sliderZoom = ref(10);
const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let dragStartZoom = 0;
let downStep = 0;
let didDrag = false;
let targetZoom: number | null = null;
let lastStepAt = 0;

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
const thumbPos = computed(() => 88 - ((sliderZoom.value - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 76);

function applyZoom(value: number): void {
  if (!map) return;
  const next = clamp(value);
  targetZoom = next;
  lastStepAt = Date.now();
  sliderZoom.value = next;
  map.setZoom(next, {
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
}

function stepZoom(delta: number): void {
  if (!map) return;
  const now = Date.now();
  const chain =
    targetZoom !== null && now - lastStepAt <= STEP_CHAIN_MS ? targetZoom : map.getZoom();
  applyZoom(chain + delta);
}

function onKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      e.preventDefault();
      stepZoom(STEP);
      break;
    case 'ArrowDown':
    case 'ArrowLeft':
      e.preventDefault();
      stepZoom(-STEP);
      break;
    case 'PageUp':
      e.preventDefault();
      stepZoom(PAGE_STEP);
      break;
    case 'PageDown':
      e.preventDefault();
      stepZoom(-PAGE_STEP);
      break;
    case 'Home':
      e.preventDefault();
      applyZoom(MIN_ZOOM);
      break;
    case 'End':
      e.preventDefault();
      applyZoom(MAX_ZOOM);
      break;
  }
}

function onSliderPointerDown(e: PointerEvent): void {
  if (dragging.value) return;
  downStep =
    Number(
      (e.target as HTMLElement | null)?.closest('[data-zoom-step]')?.getAttribute('data-zoom-step')
    ) || 0;
  dragging.value = true;
  didDrag = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartZoom = map ? map.getZoom() : sliderZoom.value;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* pointer already inactive — band-level handlers still work */
  }
}

function onSliderPointerMove(e: PointerEvent): void {
  if (!dragging.value || !map) return;
  const dx = e.clientX - dragStartX;
  const dy = dragStartY - e.clientY; // up = zoom in
  if (Math.abs(dy) > MOVE_THRESHOLD || Math.abs(dx) > MOVE_THRESHOLD) didDrag = true;
  const next = clamp(dragStartZoom + dy / PX_PER_LEVEL);
  if (next !== sliderZoom.value) {
    sliderZoom.value = next;
    map.setZoom(next, { animate: false });
  }
}

function onSliderPointerUp(e: PointerEvent): void {
  finishDrag(e);
}

function onSliderPointerCancel(): void {
  finishDrag();
}

function finishDrag(tap?: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  if (tap && !didDrag) {
    if (downStep !== 0) {
      stepZoom(downStep);
    } else if (tap.currentTarget instanceof HTMLElement) {
      const rect = tap.currentTarget.getBoundingClientRect();
      stepZoom(tap.clientY < rect.top + rect.height / 2 ? STEP : -STEP);
    }
  }
  downStep = 0;
}

function onStepClick(e: MouseEvent, delta: number): void {
  if (e.detail === 0) stepZoom(delta); // keyboard activation
}

function onMapZoomSync(): void {
  if (!dragging.value && map) sliderZoom.value = map.getZoom();
}

// ── Markers ──────────────────────────────────────────────────────────────

/** Finger-sized hit box; 13px dot below SYMBOL_MIN_ZOOM, mono SVG on
 *  a category-colored rounded shield above it. Optional status ring
 *  behind either variant. */
function makeIcon(typeColor: string, status: string | undefined, symbol: string | null): L.DivIcon {
  const ringColor = status ? STATUS_COLORS[status] : undefined;
  const ring = ringColor ? `<span class="wd-fb-ring" style="background:${ringColor}"></span>` : '';
  const fg = symbol
    ? `<span class="wd-fb-sym" style="--c:${typeColor}">${symbol}</span>`
    : `<span class="wd-fb-dot" style="background:${typeColor}"></span>`;
  return L.divIcon({
    html: `${ring}${fg}`,
    className: symbol ? 'wd-fb-marker wd-fb-marker--sym' : 'wd-fb-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** Cluster bubble in the DOMINANT member type color. */
function clusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const counts = new Map<string, number>();
  for (const marker of cluster.getAllChildMarkers()) {
    const color = markerTypeColor.get(marker) ?? DEFAULT_DOT_COLOR;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let dominant = DEFAULT_DOT_COLOR;
  let best = 0;
  for (const [color, n] of counts) {
    if (n > best) {
      dominant = color;
      best = n;
    }
  }
  return L.divIcon({
    html: `<div class="wd-fb-cluster" style="--c:${dominant}"><span>${cluster.getChildCount()}</span></div>`,
    className: 'wd-fb-cluster-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function rebuildMarkers(): void {
  if (!clusterAvail || !clusterPlain) return;
  clusterAvail.clearLayers();
  clusterPlain.clearLayers();
  if (!map || map.getZoom() < HUT_MIN_ZOOM) return;
  const useSymbols = map.getZoom() >= SYMBOL_MIN_ZOOM;
  // Dedupe by slug — buffer features repeat across neighboring tiles.
  const huts = new Map<string, FbHut>();
  for (const tileHuts of hutTiles.values()) {
    for (const hut of tileHuts) if (!huts.has(hut.slug)) huts.set(hut.slug, hut);
  }
  const availMarkers: L.Marker[] = [];
  const plainMarkers: L.Marker[] = [];
  for (const hut of huts.values()) {
    const avail = availBySlug.get(hut.slug);
    const typeColor = hut.typeColor ?? DEFAULT_DOT_COLOR;
    let symbol: string | null = null;
    if (useSymbols && hut.typeSlug) {
      symbol = symbolBySlug.get(hut.typeSlug) ?? null;
      if (!symbolBySlug.has(hut.typeSlug)) {
        // Kick the fetch; ONE extra rebuild when it lands (the has()-
        // guard above breaks the rebuild cycle).
        symbolBySlug.set(hut.typeSlug, null); // pending sentinel
        void fetchSymbol(hut.typeSlug).then(svg => {
          symbolBySlug.set(hut.typeSlug!, svg);
          rebuildMarkers();
        });
      }
    }
    const marker = L.marker([hut.lat, hut.lon], {
      icon: makeIcon(typeColor, avail?.status, symbol),
      keyboard: false,
      riseOnHover: true,
      title: String(hut.properties.name ?? hut.slug), // hover tooltip
    });
    markerTypeColor.set(marker, typeColor);
    marker.on('click', () => selectHut(hut));
    (avail ? availMarkers : plainMarkers).push(marker);
  }
  clusterAvail.addLayers(availMarkers); // bulk: no per-marker animation
  clusterPlain.addLayers(plainMarkers);
}

/** Mono category symbol — currentColor SVG, recolored via CSS. */
async function fetchSymbol(typeSlug: string): Promise<string | null> {
  const base = publicApiBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/v1/categories/symbol/mono/${typeSlug}.svg`);
    if (!res.ok) return null;
    const svg = await res.text();
    return svg.includes('<svg') ? svg : null;
  } catch {
    return null; // cached as unavailable — dots keep rendering
  }
}

// ── Data fetching (Martin MLT tiles — same URLs as the MapLibre map) ──

const lngToTileX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
const latToTileY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};
const tileXToLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileYToLat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180) / Math.PI;
};

/** Fetch the tiles covering the padded viewport (overzoomed from the
 *  source's maxzoom), evict stale ones, rebuild markers once. */
async function refreshTiles(): Promise<void> {
  const activeMap = map;
  if (!activeMap) return;
  if (activeMap.getZoom() < HUT_MIN_ZOOM) {
    if (hutTiles.size > 0) {
      hutTiles.clear();
      rebuildMarkers();
    }
    return;
  }
  const generation = ++tileGeneration;
  const tileZoom = Math.min(
    HUTS_TILE_MAX_ZOOM,
    Math.max(HUTS_TILE_MIN_ZOOM, Math.round(activeMap.getZoom()))
  );
  const bounds = activeMap.getBounds().pad(0.25);
  const n = 2 ** tileZoom;
  const x1 = Math.floor(lngToTileX(bounds.getWest(), tileZoom));
  const x2 = Math.floor(lngToTileX(bounds.getEast(), tileZoom));
  const y1 = Math.floor(latToTileY(bounds.getNorth(), tileZoom));
  const y2 = Math.floor(latToTileY(bounds.getSouth(), tileZoom));
  const needed = new Set<string>();
  const jobs: Array<Promise<void>> = [];
  for (let x = x1; x <= x2; x++) {
    for (let y = y1; y <= y2; y++) {
      if (y < 0 || y >= n) continue;
      const wrappedX = ((x % n) + n) % n; // globe wrap
      const key = `${tileZoom}/${wrappedX}/${y}`;
      needed.add(key);
      if (!hutTiles.has(key) && !fetchingTiles.has(key)) {
        jobs.push(fetchHutTile(key, tileZoom, wrappedX, y, generation));
      }
    }
  }
  for (const key of hutTiles.keys()) {
    if (!needed.has(key)) hutTiles.delete(key);
  }
  await Promise.all(jobs);
  if (generation === tileGeneration && map) rebuildMarkers();
}

/** Fetch + decode one MLT tile. Failures leave the tile absent (the
 *  next move retries); empty bodies cache as empty tile lists. */
async function fetchHutTile(
  key: string,
  z: number,
  x: number,
  y: number,
  generation: number
): Promise<void> {
  fetchingTiles.add(key);
  try {
    // Same URL the MapLibre huts style fetches (`.mlt`) — the browser
    // cache entry is literally shared with the WebGL map. decodeTile is
    // maplibre-gl's own decoder (@maplibre/mlt), version-locked via the
    // dependency tree.
    const res = await fetch(`${TILE_SERVER}/huts/${z}/${x}/${y}.mlt`);
    if (!res.ok) return; // 404/204 = empty region; transient errors retry later
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 2) {
      if (generation === tileGeneration) hutTiles.set(key, []);
      return;
    }
    const huts: FbHut[] = [];
    for (const table of decodeTile(buf)) {
      if (table.name !== 'huts') continue;
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
            typeof properties.type_standard_slug === 'string'
              ? properties.type_standard_slug
              : null,
          typeColor:
            typeof properties.type_standard_color === 'string'
              ? properties.type_standard_color
              : undefined,
        });
      }
    }
    if (generation === tileGeneration) hutTiles.set(key, huts);
  } catch {
    /* decode/network failure — tile stays absent (next move retries) */
  } finally {
    fetchingTiles.delete(key);
  }
}

const refreshTilesDebounced = useDebounceFn(() => void refreshTiles(), 400);

/** Day-0 availability for the effective date (status colors the ring). */
async function loadAvailability(dateISO: string): Promise<void> {
  const generation = ++availGeneration;
  const { data, error } = await clientWodore.GET('/v1/huts/availability/{date}.geojson', {
    params: {
      path: { date: dateISO },
      query: { days: 1, lang: currentLocale() },
    },
  });
  if (error || !data || !('features' in data) || generation !== availGeneration) return;
  availBySlug.clear();
  for (const feature of data.features ?? []) {
    const properties = feature.properties as {
      slug?: string;
      data?: Array<{ occupancy_status?: string | null }> | null;
    } | null;
    if (!properties?.slug) continue;
    availBySlug.set(properties.slug, {
      status: properties.data?.[0]?.occupancy_status ?? undefined,
    });
  }
  rebuildMarkers(); // recolor rings
}

// Date picker drives the ring date (today when unset — the header chip's
// default); 'now' is the backend's alias for today.
watch(
  () => hutsStore.selectedDate,
  date => void loadAvailability(date ?? 'now'),
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
  const center = map.getCenter();
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
  localPropertiesStore.updateLocation({
    lat: map.getCenter().lat,
    lng: map.getCenter().lng,
    zoom: map.getZoom(),
    bearing: 0,
  });
  syncHash();
  refreshTilesDebounced();
}

// ── Basemap application ──────────────────────────────────────────────────

function applyBasemap(): void {
  if (!map) return;
  const bm = BASEMAPS.find(b => b.id === activeBasemapId.value) ?? BASEMAPS[0]!;
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
  document.body.classList.add('wd-fb-active'); // zoom-slider visibility

  const initial = localPropertiesStore.getInitialLocation();
  map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0, // fractional zoom — slider + wheel stay continuous
  });
  map.setView([initial.lat, initial.lng], Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initial.zoom)));
  applyBasemap();

  // Controls — same positions as the MapLibre layout: zoom top-right,
  // scale + attribution bottom-left.
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(map);

  // Dual cluster groups: availability huts uncluster one level earlier.
  clusterAvail = L.markerClusterGroup({
    showCoverageOnHover: false,
    chunkedLoading: true,
    maxClusterRadius: 48,
    disableClusteringAtZoom: AVAIL_UNCLUSTER_ZOOM,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: clusterIcon,
  });
  clusterPlain = L.markerClusterGroup({
    showCoverageOnHover: false,
    chunkedLoading: true,
    maxClusterRadius: 48,
    disableClusteringAtZoom: PLAIN_UNCLUSTER_ZOOM,
    spiderfyOnMaxZoom: false,
    iconCreateFunction: clusterIcon,
  });
  map.addLayer(clusterAvail);
  map.addLayer(clusterPlain);

  map.on('moveend zoomend', onMoveEnd);
  map.on('zoom', onMapZoomSync);
  sliderZoom.value = map.getZoom();

  map.whenReady(() => {
    emit('ready');
    void refreshTiles();
  });

  // Reduced-mode notice — dismissable toast, dismissal persisted, shown
  // exactly once per browser (localStorage flag).
  if (!LocalStorage.getItem(NOTE_KEY)) {
    Notify.create({
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
  tileGeneration++; // invalidate any in-flight tile/symbol callbacks
  availGeneration++;
  fetchingTiles.clear();
  document.body.classList.remove('wd-fb-active');
  map?.remove(); // tears down layers + listeners
  map = undefined;
  clusterAvail = undefined;
  clusterPlain = undefined;
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

    <!-- Zoom slider — WdZoomSlider port (Leaflet-driven, always visible
         in fallback mode via body.wd-fb-active). -->
    <div
      class="wd-zoom"
      :class="{ 'wd-zoom--dragging': dragging }"
      role="slider"
      :aria-label="t('map.zoom')"
      :aria-valuemin="MIN_ZOOM"
      :aria-valuemax="MAX_ZOOM"
      :aria-valuenow="Math.round(sliderZoom * 10) / 10"
      :aria-valuetext="Math.round(((sliderZoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100) + '%'"
      tabindex="0"
      @keydown="onKeydown"
      @pointerdown="onSliderPointerDown"
      @pointermove="onSliderPointerMove"
      @pointerup="onSliderPointerUp"
      @pointercancel="onSliderPointerCancel"
      @lostpointercapture="onSliderPointerCancel"
    >
      <div class="wd-zoom__pill">
        <button
          class="wd-zoom__step"
          data-zoom-step="0.75"
          :aria-label="t('map.zoomIn')"
          @click="onStepClick($event, STEP)"
        >
          <q-icon name="wd-plus" size="14px" />
        </button>
        <div class="wd-zoom__track">
          <div class="wd-zoom__thumb" :style="{ top: thumbPos + '%' }" />
        </div>
        <button
          class="wd-zoom__step"
          data-zoom-step="-0.75"
          :aria-label="t('map.zoomOut')"
          @click="onStepClick($event, -STEP)"
        >
          <q-icon name="wd-minus" size="14px" />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../css/map-controls/chip' as chip;
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

// ── Zoom slider pill (ported visuals from WdZoomSlider) ────────────────
.wd-zoom {
  position: fixed;
  right: 0;
  top: 50%;
  z-index: 2010;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  width: calc(44px + env(safe-area-inset-right, 0px));
  min-height: 120px;
  padding-right: env(safe-area-inset-right, 0px);
  background: transparent;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transform: translateY(-50%);

  &--dragging {
    cursor: grabbing;
  }

  *:focus {
    outline: none;
  }

  &:focus-visible,
  .wd-zoom__step:focus-visible {
    outline: 2px solid var(--wd-ctl-ink);
    outline-offset: -2px;
  }
}

.wd-zoom__pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 18px;
  padding: 3px 0;
  border: 1px solid var(--wd-ctl-border);
  border-right: none;
  border-radius: 999px 0 0 999px;
  background: color-mix(in srgb, var(--wd-ctl-bg) 68%, transparent);
  color: var(--wd-ctl-ink);
}

.wd-zoom__step {
  display: grid;
  place-items: center;
  position: relative;
  width: 30px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  cursor: pointer;
  flex: none;
  transition: color 0.12s ease;

  &::before {
    content: '';
    position: absolute;
    top: -9px;
    bottom: -9px;
    left: -20px;
    right: -6px;
  }

  @media (min-width: #{$breakpoint-sm + 1}) {
    &:hover {
      color: var(--wd-ctl-ink);
    }
  }
}

.wd-zoom__track {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 36px;
  margin: 2px 0;
  pointer-events: none;
}

.wd-zoom__thumb {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 10px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: var(--wd-ctl-ink);
  opacity: 0.78;
  box-shadow: 0 0 0 2px var(--wd-ctl-bg);
}
</style>

<!-- UNSCOPED: Leaflet renders marker/cluster/control DOM at runtime (no
     Vue scope attributes reach it), and the zoom-slider visibility
     override keys off a body class set by this component. -->
<style lang="scss">
// Zoom slider: ALWAYS visible in fallback mode (the global _zoom-slider
// gating only knows the MapLibre focus/overlay states).
body.wd-fb-active .wd-zoom {
  display: flex !important;

  .wd-zoom__pill {
    opacity: 1;
    transform: none;
  }
}

// ── Hut markers: 36px hit box, 13px type-colored dot, status ring ──────
.wd-fb-marker {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.wd-fb-dot {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  z-index: 2;
}

// ── Symbol shield (z11+): mono category SVG on a rounded rect in the
//    category color — the mono SVGs are built with currentColor, so the
//    CSS color recolors them. ────────────────────────────────────────
.wd-fb-marker--sym .wd-fb-ring {
  width: 34px;
  height: 34px;
}

.wd-fb-sym {
  position: relative;
  width: 36px;
  height: 30px;
  border-radius: 8px;
  background: var(--c, #346751);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  color: #ffffff; // mono glyph ink (currentColor)
  z-index: 2;

  svg {
    width: 20px;
    height: 20px;
    display: block;
  }
}

.wd-fb-ring {
  position: absolute;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  opacity: 0.9;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

// ── Cluster bubbles: dominant type color ───────────────────────────────
.wd-fb-cluster-icon {
  width: 40px;
  height: 40px;
}

.wd-fb-cluster {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  background: var(--c, #346751);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  display: grid;
  place-items: center;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);

  span {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }
}

// ── Leaflet controls styled like the MapLibre layout ───────────────────
.wd-fallback-map .leaflet-bar {
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  box-shadow: var(--wd-ctl-shadow);
  overflow: hidden;

  a {
    width: 34px;
    height: 34px;
    line-height: 34px;
    font-size: 18px;
    color: var(--wd-ctl-ink);
    background: var(--wd-ctl-bg);
    border-bottom-color: var(--wd-ctl-border);

    &:hover {
      background: color-mix(in srgb, var(--wd-ctl-bg) 88%, var(--wd-ctl-ink));
      color: var(--wd-ctl-ink);
    }

    &:focus-visible {
      outline: 2px solid var(--wd-ctl-ink);
      outline-offset: -2px;
    }
  }

  a:first-child {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  a:last-child {
    border-bottom-left-radius: 7px;
    border-bottom-right-radius: 7px;
    border-bottom: none;
  }
}

.wd-fallback-map .leaflet-control-attribution {
  font-size: 10px;
  background: color-mix(in srgb, var(--wd-ctl-bg) 82%, transparent);
  color: var(--wd-ctl-ink-soft);
  border-radius: 6px 6px 0 0;
  padding: 1px 6px;

  a {
    color: var(--wd-ctl-ink-soft);
  }
}

.wd-fallback-map .leaflet-control-scale-line {
  border-color: var(--wd-ctl-ink-soft);
  color: var(--wd-ctl-ink);
  background: color-mix(in srgb, var(--wd-ctl-bg) 82%, transparent);
  font-size: 10px;
}
</style>
