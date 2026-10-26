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
import { useMapCatalogStore } from '@stores/map/map-catalog-store';
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
const catalogStore = useMapCatalogStore();

const fallbackEl = ref<HTMLDivElement>();

// ── Zoom model ───────────────────────────────────────────────────────────

/** Dots render from this zoom up (owner: one level earlier than z9). */
const HUT_MIN_ZOOM = 8;
/** Dots upgrade to category symbols (mono SVG on a colored shield). */
const SYMBOL_MIN_ZOOM = 11;
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
  if (attribInnerEl) attribInnerEl.innerHTML = attribHtml(id); // follows the basemap
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
/** slug → live marker (selection icon swaps without a full rebuild). */
const markerBySlug = new Map<string, L.Marker>();
/** slug → hut (style inputs for selection icon swaps). */
const hutBySlug = new Map<string, FbHut>();
/** Currently selected hut slug (route-driven, same as the MapLibre map). */
const selectedSlug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : undefined
);
/** Last rendered zoom band — dot↔symbol icon swaps rebuild on band change. */
let lastRenderBand: 'none' | 'dot' | 'sym' | undefined;

// ── Focus (fullscreen) mode ────────────────────────────────────────────────
// Same body-class contract as the MapLibre map's setMapFocus: the global
// chrome CSS (map-controls/_layout.scss) keys off body.wd-map-focus. The
// shared .wd-focus-toggle class styles the button identically; the
// fallback's scoped override keeps it VISIBLE on mobile (the main map
// enters focus via empty-map tap there — the fallback has no such
// gesture, so the button is the only entry).
const focusOn = ref(false);

function toggleFocus(): void {
  focusOn.value = !focusOn.value;
  document.body.classList.toggle('wd-map-focus', focusOn.value);
}

// ── Attribution (MapLibre-style) ───────────────────────────────────────────
// Leaflet's stock attribution (bottom-right, always expanded) is replaced
// with a control mirroring maplibre's: desktop = translucent bar, mobile =
// compact ⓘ pill expanding on tap (same geometry/colors as
// .maplibregl-ctrl-attrib in maplibre-gl.css).
const ATTRIB_INFO_SVG =
  '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M4 10a6 6 0 1 0 12 0 6 6 0 1 0-12 0m5-3a1 1 0 1 0 2 0 1 1 0 1 0-2 0m0 3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0"/></svg>';

function attribHtml(bmId: FbBasemap['id']): string {
  const bm = BASEMAPS.find(b => b.id === bmId) ?? BASEMAPS[0]!;
  return bm.attribution;
}

let attribInnerEl: HTMLElement | undefined;

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
      btn.innerHTML = ATTRIB_INFO_SVG;
      L.DomEvent.on(btn, 'click', ev => {
        L.DomEvent.stop(ev);
        container.classList.toggle('wd-fb-attrib--open');
      });
    }
    return container;
  }
}

// ── Markers ──────────────────────────────────────────────────────────────

/** Finger-sized hit box; 13px dot below SYMBOL_MIN_ZOOM, mono SVG on
 *  a category-colored rounded shield above it. Optional status ring
 *  behind either variant. */
function makeIcon(
  typeColor: string,
  status: string | undefined,
  symbol: string | null,
  selected = false
): L.DivIcon {
  const ringColor = status ? STATUS_COLORS[status] : undefined;
  const ring = ringColor ? `<span class="wd-fb-ring" style="background:${ringColor}"></span>` : '';
  const fg = symbol
    ? `<span class="wd-fb-sym" style="--c:${typeColor}">${symbol}</span>`
    : `<span class="wd-fb-dot" style="background:${typeColor}"></span>`;
  const classes = ['wd-fb-marker'];
  if (symbol) classes.push('wd-fb-marker--sym');
  if (selected) classes.push('wd-fb-marker--sel');
  return L.divIcon({
    html: `${ring}${fg}`,
    className: classes.join(' '),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/** The marker's full icon inputs — lets setIcon rebuild any variant. */
interface MarkerStyle {
  typeColor: string;
  status: string | undefined;
  symbol: string | null;
}

function markerStyleFor(hut: FbHut, useSymbols: boolean): MarkerStyle {
  let symbol: string | null = null;
  if (useSymbols && hut.typeSlug) {
    symbol = symbolBySlug.get(hut.typeSlug) ?? null;
    if (!symbolBySlug.has(hut.typeSlug)) {
      symbolBySlug.set(hut.typeSlug, null); // pending sentinel
      void fetchSymbol(hut.typeSlug).then(svg => {
        symbolBySlug.set(hut.typeSlug!, svg);
        rebuildMarkers();
      });
    }
  }
  return {
    typeColor: hut.typeColor ?? DEFAULT_DOT_COLOR,
    status: availBySlug.get(hut.slug)?.status,
    symbol,
  };
}

function applyIcon(marker: L.Marker, style: MarkerStyle, selected: boolean): void {
  marker.setIcon(makeIcon(style.typeColor, style.status, style.symbol, selected));
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
  markerBySlug.clear();
  hutBySlug.clear();
  if (!map || map.getZoom() < HUT_MIN_ZOOM) {
    lastRenderBand = 'none';
    return;
  }
  const useSymbols = map.getZoom() >= SYMBOL_MIN_ZOOM;
  lastRenderBand = useSymbols ? 'sym' : 'dot';
  // Dedupe by slug — buffer features repeat across neighboring tiles.
  const huts = new Map<string, FbHut>();
  for (const tileHuts of hutTiles.values()) {
    for (const hut of tileHuts) if (!huts.has(hut.slug)) huts.set(hut.slug, hut);
  }
  const availMarkers: L.Marker[] = [];
  const plainMarkers: L.Marker[] = [];
  for (const hut of huts.values()) {
    const style = markerStyleFor(hut, useSymbols);
    const marker = L.marker([hut.lat, hut.lon], {
      icon: makeIcon(style.typeColor, style.status, style.symbol, selectedSlug.value === hut.slug),
      keyboard: false,
      // NOTE: no riseOnHover — the z-index churn on hundreds of markers
      // showed up as dropped frames in the pan profile.
      title: String(hut.properties.name ?? hut.slug), // hover tooltip
    });
    markerTypeColor.set(marker, style.typeColor);
    markerBySlug.set(hut.slug, marker);
    hutBySlug.set(hut.slug, hut);
    marker.on('click', () => selectHut(hut));
    (availBySlug.has(hut.slug) ? availMarkers : plainMarkers).push(marker);
  }
  clusterAvail.addLayers(availMarkers); // bulk: no per-marker animation
  clusterPlain.addLayers(plainMarkers);
}

/** Selection follows the route (same toggle semantics as the MapLibre
 *  map): swap ONLY the two affected markers' icons — no full rebuild. */
watch(selectedSlug, (slug, previous) => {
  if (!map) return;
  const useSymbols = map.getZoom() >= SYMBOL_MIN_ZOOM;
  for (const [slugKey, sel] of [
    [previous, false],
    [slug, true],
  ] as Array<[string | undefined, boolean]>) {
    if (!slugKey) continue;
    const marker = markerBySlug.get(slugKey);
    const hut = hutBySlug.get(slugKey);
    if (marker && hut) applyIcon(marker, markerStyleFor(hut, useSymbols), sel);
  }
});

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
  let evicted = 0;
  for (const key of hutTiles.keys()) {
    if (!needed.has(key)) {
      hutTiles.delete(key);
      evicted++;
    }
  }
  await Promise.all(jobs);
  // Perf: a pan fully inside already-loaded tiles changes NOTHING — skip
  // the clearLayers/addLayers rebuild (the 1200-marker rebuild frame was
  // the worst jank in the profile sweep).
  if (generation === tileGeneration && map && (jobs.length > 0 || evicted > 0)) {
    rebuildMarkers();
  }
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

/** Day-0 availability for the effective date (status colors the ring).
 *  The calendar-icon spinner (map-catalog-store availabilityLoading — the
 *  same signal the MapLibre map drives via sourcedata) runs from begin to
 *  RENDERED-settle here; the store's 600ms minimum spin still applies.
 *  The boot fetch ('now') does not spin — same as the main map, where the
 *  spinner belongs to the date PICK, not the initial load. */
let firstAvailLoad = true;

async function loadAvailability(dateISO: string): Promise<void> {
  const generation = ++availGeneration;
  const spin = !firstAvailLoad;
  firstAvailLoad = false;
  if (spin) catalogStore.beginAvailabilityLoadManual();
  try {
    const { data, error } = await clientWodore.GET('/v1/huts/availability/{date}.geojson', {
      params: {
        path: { date: dateISO },
        query: { days: 1, lang: currentLocale() },
      },
    });
    if (!error && data && 'features' in data && generation === availGeneration) {
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
      rebuildMarkers(); // recolor rings — settle AFTER the new render
    }
  } finally {
    if (spin) catalogStore.settleAvailabilityLoadManual();
  }
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
  // Icon band change (none/dot/sym) — rebuild; markercluster itself
  // re-clusters on zoom without any rebuild.
  const band =
    map.getZoom() < HUT_MIN_ZOOM ? 'none' : map.getZoom() >= SYMBOL_MIN_ZOOM ? 'sym' : 'dot';
  if (band !== lastRenderBand) rebuildMarkers();
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
  catalogStore.setAvailabilityManualSettle(true); // we own the spinner settle

  const initial = localPropertiesStore.getInitialLocation();
  map = L.map(el, {
    zoomControl: false,
    attributionControl: false, // replaced by the MapLibre-style control below
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0, // continuous wheel zoom
  });
  map.setView([initial.lat, initial.lng], Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initial.zoom)));
  applyBasemap();

  // Controls — same layout as the MapLibre map: zoom top-right on desktop
  // / bottom-left on mobile (matching MglNavigationControl), attribution +
  // scale bottom-left (attribution above the scale).
  const isMobileView = window.matchMedia('(max-width: 768px)').matches;
  L.control.zoom({ position: isMobileView ? 'bottomleft' : 'topright' }).addTo(map);
  new WdAttributionControl({ position: 'bottomleft' }).addTo(map);
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
  catalogStore.setAvailabilityManualSettle(false);
  if (focusOn.value) document.body.classList.remove('wd-map-focus');
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

    <!-- Focus (fullscreen) toggle — same global class and position as the
         MapLibre map's button (desktop top-right; scoped override keeps it
         tappable on mobile where the fallback has no tap-to-focus). -->
    <button
      class="wd-focus-toggle"
      :class="{ 'wd-focus-toggle--active': focusOn }"
      :aria-label="focusOn ? 'Exit focus mode' : 'Focus mode'"
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
@media (max-width: #{$breakpoint-sm}) {
  .wd-fallback-map .wd-focus-toggle {
    position: absolute;
    top: calc(11px + env(safe-area-inset-top, 0px));
    right: 12px;
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
</style>

<!-- UNSCOPED: Leaflet renders marker/cluster/control DOM at runtime (no
     Vue scope attributes reach it), and the zoom-slider visibility
     override keys off a body class set by this component. -->
<style lang="scss">
// ── Hut markers: 36px hit box, 13px type-colored dot, status ring ──────
.wd-fb-marker {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
  // Perf: layout/style containment on hundreds of markers keeps pan-time
  // recalculation local (measured in the zoom-sweep profile).
  contain: layout style;
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
  width: 40px; // peeks around the square shield
  height: 40px;
}

.wd-fb-sym {
  position: relative;
  width: 34px;
  height: 34px; // quadratic shield (owner spec)
  border-radius: 9px;
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

// ── Selection: gold — the app's selection color (chips, zoom thumb) ────
.wd-fb-marker--sel .wd-fb-sym {
  border: 3px solid $wd-gold;
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.9),
    0 2px 8px rgba(0, 0, 0, 0.45);
}

.wd-fb-marker--sel .wd-fb-dot {
  border: 3px solid $wd-gold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
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

// ── Controls: MapLibre parity ─────────────────────────────────────────────
// Geometry/colors copied from maplibre-gl.css (.maplibregl-ctrl-*):
// the zoom group is a shadow-ringed white square like .maplibregl-ctrl-group
// and sits at the SAME offsets the main map gives its top-right cluster
// (14px inset, pushed below the focus toggle — css/maplibre-gl.scss).

// Zoom bar: maplibre ctrl-group look
.wd-fallback-map .leaflet-bar {
  border: none;
  border-radius: 4px;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  a,
  a:hover {
    width: 29px;
    height: 29px;
    line-height: 29px;
    font-size: 19px;
    font-weight: 600;
    color: #333333;
    background: #ffffff;
    border-bottom: none;
    text-decoration: none;
  }

  a:hover {
    background: #f4f4f4;
  }

  a:focus-visible {
    outline: 2px solid #333333;
    outline-offset: -2px;
  }

  a + a {
    border-top: 2px solid rgba(0, 0, 0, 0.1);
  }
}

// Desktop: zoom below the focus toggle, 14px inset (main map parity)
@media (min-width: 769px) {
  .wd-fallback-map .leaflet-top.leaflet-right .leaflet-control-zoom {
    margin: 58px 14px 0 0;
    float: right;
  }
}

// Mobile: zoom bottom-left (MglNavigationControl parity)
@media (max-width: 768px) {
  .wd-fallback-map .leaflet-bottom.leaflet-left .leaflet-control-zoom {
    margin: 0 0 10px 10px;
  }
}

// Scale: maplibre .maplibregl-ctrl-scale values (readable ink on a
// translucent bar with the 2px baseline)
.wd-fallback-map .leaflet-control-scale-line {
  background-color: rgba(255, 255, 255, 0.75);
  font-size: 10px;
  white-space: nowrap;
  border: none;
  border-right: 2px solid #333333;
  border-bottom: 2px solid #333333;
  padding: 0 5px;
  color: #333333;
  box-sizing: border-box;
}

// ── Attribution: maplibre .maplibregl-ctrl-attrib parity ──────────────
// Desktop = translucent expanded bar; mobile = compact ⓘ pill that
// expands on tap (same geometry as maplibre's compact control).
.wd-fb-attrib {
  font-size: 12px;

  a {
    color: rgba(0, 0, 0, 0.75);
    text-decoration: none;

    &:hover {
      color: inherit;
      text-decoration: underline;
    }
  }
}

.wd-fb-attrib--full .wd-fb-attrib__inner {
  padding: 0 5px;
  background-color: rgba(255, 255, 255, 0.5);
}

.wd-fb-attrib--compact {
  position: relative;
  margin: 10px;
  min-height: 20px;
  background-color: #ffffff;
  color: #000000;
  border-radius: 12px;
  padding: 2px 0 2px 24px;
  box-sizing: content-box;
  transition: width 0.15s ease;

  .wd-fb-attrib__inner {
    display: none;
    white-space: nowrap;
    line-height: 20px;
  }

  &.wd-fb-attrib--open {
    padding: 2px 8px 2px 28px;

    .wd-fb-attrib__inner {
      display: block;
    }
  }
}

.wd-fb-attrib__btn {
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: rgba(0, 0, 0, 0.75);
  cursor: pointer;

  svg {
    width: 20px;
    height: 20px;
    display: block;
    margin: 2px auto;
  }
}
</style>
