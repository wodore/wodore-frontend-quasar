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

/** Dots render from this zoom up (owner: down to z7, ghosted — see
 *  markerOpacityFor; solid again from z9). */
const HUT_MIN_ZOOM = 7;
/** Dots upgrade to category symbols (mono SVG on a colored shield). */
const SYMBOL_MIN_ZOOM = 11;
/** Occupation status word appears from here (owner spec). */
const OCC_LABEL_MIN_ZOOM = 12;
/** Marker transparency ramp (owner spec): 50% opaque at z7, solid by
 *  z9 — z7 markers are ghost hints of where the huts cluster. */
function markerOpacityFor(zoom: number): number {
  return Math.min(0.5 + ((zoom - HUT_MIN_ZOOM) / 2) * 0.5, 1);
}
/** Current marker opacity — the canvas draw reads it synchronously
 *  (CSS var for the DOM cluster icons, module var for canvas). */
let markerOpacity = 1;
/** Canvas marker geometry. Shield size ramps 12px at z7 → 19px from z10
 *  (owner: z8-9 icons too large); the occupation disc is 1.56x the shield
 *  (owner: clearly visible behind the icon). Module vars — the canvas
 *  draw reads them synchronously, refreshed on camera settle. */
let shieldPx = 19;
const SHIELD_MAX_PX = 19;
const OCC_LABEL_FONT = '600 9px "Barlow Semi Condensed", "Barlow", sans-serif';

function shieldPxFor(zoom: number): number {
  return Math.min(12 + (zoom - HUT_MIN_ZOOM) * 2.4, SHIELD_MAX_PX);
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

/** Day statuses per hut (index 0 = the selected date). All four days
 *  are kept — the zoomed-in 4-day fan (maplibre's occupation-day chips)
 *  can build on this later. */
interface FbAvail {
  statuses: string[];
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
/** Martin sprite pack (accommodation,availability) — the SAME icons the
 *  MapLibre huts style renders: `primitive/{type_standard_identifier}`
 *  for hut glyphs, `color/availability.{status}` for the day chips. */
/** Structural stand-ins: the project ESLint env lacks the DOM interface
 *  names — these carry exactly the members the draw path uses. */
interface SheetImage {
  src: string;
  decode(): Promise<void>;
}
interface IconBitmap {
  width: number;
  height: number;
}
let availSprite: {
  icons: Record<string, { x: number; y: number; width: number; height: number }>;
  sheetW: number;
  sheetH: number;
  sheetImg: SheetImage;
} | null = null;
/** WHITE-tinted icon bitmaps for the canvas shields, cached per type
 *  (identifier → offscreen canvas; LOW-SPEC: one drawImage per hut on
 *  the shared canvas — no DOM markers, no per-draw SVG rasterization). */
const whiteIconCache = new Map<string, IconBitmap | null>();

function whiteIconFor(identifier: string | undefined): IconBitmap | null {
  const sprite = availSprite;
  const key = identifier ?? 'accommodation.unknown';
  if (whiteIconCache.has(key)) return whiteIconCache.get(key) ?? null;
  let canvas: IconBitmap | null = null;
  const entry = sprite?.icons[`mono/${key}`] ?? sprite?.icons['mono/accommodation.unknown'];
  if (sprite && entry) {
    // Tint to white: draw the mono cell, then source-in a white fill.
    const sheet = document.createElement('canvas');
    sheet.width = entry.width;
    sheet.height = entry.height;
    canvas = sheet;
    const c2d = sheet.getContext('2d');
    if (c2d) {
      // SAFETY: sheetImg is a real <img> (created via createElement);
      // the structural SheetImage type just hides the DOM interface
      // from the linter — the runtime value satisfies drawImage.
      c2d.drawImage(
        sprite.sheetImg as unknown as Parameters<typeof c2d.drawImage>[0],
        entry.x,
        entry.y,
        entry.width,
        entry.height,
        0,
        0,
        entry.width,
        entry.height
      );
      c2d.globalCompositeOperation = 'source-in';
      c2d.fillStyle = '#ffffff';
      c2d.fillRect(0, 0, entry.width, entry.height);
    }
  }
  whiteIconCache.set(key, canvas);
  return canvas;
}

/** Load the sprite sheet once; markers rebuild when it arrives. */
async function loadSprite(): Promise<void> {
  if (availSprite) return;
  try {
    const base = `${TILE_SERVER}/sprite/accommodation,availability`;
    const [meta, png] = await Promise.all([fetch(`${base}.json`), fetch(`${base}.png`)]);
    if (!meta.ok || !png.ok) return;
    const icons = (await meta.json()) as Record<
      string,
      { x: number; y: number; width: number; height: number }
    >;
    // Sheet extent from the entries (the JSON carries no canvas size).
    let sheetW = 0;
    let sheetH = 0;
    for (const e of Object.values(icons)) {
      sheetW = Math.max(sheetW, e.x + e.width);
      sheetH = Math.max(sheetH, e.y + e.height);
    }
    const url = URL.createObjectURL(await png.blob());
    const sheetImg = document.createElement('img') as unknown as SheetImage;
    sheetImg.src = url;
    await sheetImg.decode().catch(() => undefined); // broken image → dots stay
    availSprite = { icons, sheetW, sheetH, sheetImg };
    whiteIconCache.clear();
    // Feed the sheet to the CSS (spans position into it via --wd-fb-s).
    fallbackEl.value?.style.setProperty('--wd-fb-sheet', `url(${url})`);
    fallbackEl.value?.style.setProperty('--wd-fb-sheet-w', `${sheetW}px`);
    fallbackEl.value?.style.setProperty('--wd-fb-sheet-h', `${sheetH}px`);
    rebuildMarkers();
  } catch {
    /* no sprite — the CSS shield + mono SVG fallback keeps rendering */
  }
}

/** Sprite-backed span, NORMALIZED: every icon renders into the same
 *  refPx box regardless of its source size (the pack mixes 24px and
 *  48px entries — raw scaling produced the "different sizes" bug),
 *  scaled by the given CSS var (zoom factor). All geometry inline —
 *  no dependence on class-level background-size. */
function spriteSpan(
  key: string,
  fallbackKey: string,
  className: string,
  cssVar: string,
  refPx: number
): string {
  const sprite = availSprite;
  if (!sprite) return '';
  const entry = sprite.icons[key] ?? sprite.icons[fallbackKey];
  if (!entry) return '';
  // Entry → refPx normalization factor (calc handles var × number × number).
  const k = refPx / entry.width;
  const pos = `background-position:calc(${-entry.x}px * var(${cssVar}) * ${k}) calc(${-entry.y}px * var(${cssVar}) * ${k});`;
  const size = `width:calc(${refPx}px * var(${cssVar}));height:calc(${refPx}px * var(${cssVar}));`;
  const bg = `background-size:calc(var(--wd-fb-sheet-w, 432px) * var(${cssVar}) * ${k}) calc(var(--wd-fb-sheet-h, 480px) * var(${cssVar}) * ${k});`;
  return `<span class="${className}" style="${pos}${size}${bg}"></span>`;
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

/** Canvas-rendered hut dot (below symbol zoom): the status ring and the
 *  type-colored dot are drawn as ONE canvas path — two DOM nodes per hut
 *  (ring + dot spans) were the dominant cost at 500+ markers. Shields
 *  (symbol zoom) stay DOM markers: few huts, richer visuals.
 *  TS note: Leaflet's _point/_renderer privates are accessed through a
 *  structural cast — the draw pass leaves the renderer's transform set,
 *  so plain arc() calls land correctly (same as L.Canvas._updateCircle). */
interface CanvasDotCtx {
  arc(x: number, y: number, r: number, a: number, b: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  beginPath(): void;
  closePath(): void;
  drawImage(img: IconBitmap, dx: number, dy: number, dw: number, dh: number): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  font: string;
  globalAlpha: number;
  lineTo(x: number, y: number): void;
  lineWidth: number;
  moveTo(x: number, y: number): void;
  stroke(): void;
  strokeStyle: string;
  strokeText(text: string, x: number, y: number): void;
  textAlign: string;
}
interface CanvasDotInternals {
  _point?: L.Point;
  _radius?: number;
  _renderer?: { _ctx: CanvasDotCtx | null };
}

class WdCanvasDot extends L.CircleMarker {
  private internals(): CanvasDotInternals & WdCanvasDot {
    return this as unknown as CanvasDotInternals & WdCanvasDot;
  }

  /** Rounded-rect path helper (canvas roundRect is not everywhere). */
  private static shieldPath(
    ctx: CanvasDotCtx,
    cx: number,
    cy: number,
    w: number,
    h: number,
    r: number
  ): void {
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _updatePath(): void {
    const self = this.internals();
    const ctx = self._renderer?._ctx;
    const point = self._point;
    if (!ctx || !point) return;
    const options = this.options as {
      ringColor?: string;
      identifier?: string;
      typeColor: string;
      occLabel?: string;
      selected?: boolean;
      hovered?: boolean;
      dotRadius: number;
      ringRadius: number;
      fillColor: string;
    };
    // Occupation disc behind everything (status color, ghost ramp) —
    // sized RELATIVE to the shield so it always peeks clearly.
    const baseSize = shieldPx;
    const discR = baseSize * 0.78;
    if (options.ringColor) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, discR, 0, Math.PI * 2);
      ctx.globalAlpha = 0.85 * markerOpacity;
      ctx.fillStyle = options.ringColor;
      ctx.fill();
      ctx.globalAlpha = markerOpacity;
    }
    const icon = whiteIconFor(options.identifier);
    if (icon) {
      // LOW-SPEC canvas shield: rounded rect + cached white bitmap —
      // one fill, one stroke, one drawImage per hut.
      const size = options.hovered ? baseSize * 1.15 : baseSize;
      WdCanvasDot.shieldPath(ctx, point.x, point.y, size, size, size * 0.22);
      ctx.fillStyle = options.typeColor;
      ctx.fill();
      ctx.lineWidth = options.selected ? 3 : 2;
      ctx.strokeStyle = options.selected ? '#BFAB25' : '#ffffff'; // gold = selection
      ctx.stroke();
      const iconPx = size * 0.72;
      ctx.drawImage(icon, point.x - iconPx / 2, point.y - iconPx / 2, iconPx, iconPx);
      if (options.occLabel) {
        ctx.font = OCC_LABEL_FONT;
        ctx.textAlign = 'center';
        const labelY = point.y + discR + 11;
        ctx.globalAlpha = 0.95 * markerOpacity;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(options.occLabel, point.x, labelY);
        ctx.fillStyle = '#29626b'; // glacier-turquoise-deep (design token)
        ctx.fillText(options.occLabel, point.x, labelY);
        ctx.globalAlpha = markerOpacity;
      }
    } else {
      // Pre-sprite fallback: plain colored dot with white/gold stroke.
      ctx.beginPath();
      ctx.arc(point.x, point.y, options.dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = options.fillColor;
      ctx.fill();
      ctx.lineWidth = options.selected ? 3 : 2;
      ctx.strokeStyle = options.selected ? '#BFAB25' : '#ffffff';
      ctx.stroke();
    }
  }

  /** Finger-sized hit area regardless of the small visual shield. */
  _containsPoint(p: L.Point): boolean {
    const self = this.internals();
    return !!self._point && p.distanceTo(self._point) <= Math.max(self._radius ?? 0, 13);
  }
}

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
  const info = infoByKey.get(dominantKey) ?? {
    color: DEFAULT_DOT_COLOR,
    identifier: undefined,
  };
  const scale0 = Math.min(0.8 + ((cluster.getChildCount() - 2) / 38) * 0.45, 1.25);
  const glyph = availSprite
    ? spriteSpan(
        `mono/${info.identifier ?? 'accommodation.unknown'}`,
        'mono/accommodation.unknown',
        'wd-fb-cluster__icon',
        '--wd-fb-c',
        Math.round(15 * scale0)
      )
    : '';
  // Member-count sizing (owner spec): 0.8x at 2 members growing to a
  // REDUCED max of 1.25x at 40+; base 24px keeps bubbles a bit larger
  // than the 19px shields (owner spec).
  const count = cluster.getChildCount();
  const scale = Math.min(0.8 + ((count - 2) / 38) * 0.45, 1.25);
  const discPx = Math.round(24 * scale);
  return L.divIcon({
    // Icon-only bubble (owner: "less interested in the number") — the
    // count was a tiny badge that drowned the glyph; dropped.
    html: `<div class="wd-fb-cluster" style="--c:${info.color};width:${discPx}px;height:${discPx}px">${glyph}</div>`,
    className: 'wd-fb-cluster-icon',
    iconSize: [discPx, discPx],
    iconAnchor: [discPx / 2, discPx / 2],
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
  const showLabel = map.getZoom() >= OCC_LABEL_MIN_ZOOM;
  lastRenderBand = showLabel ? 'symlabel' : 'sym';
  // Dedupe by slug — buffer features repeat across neighboring tiles.
  const huts = new Map<string, FbHut>();
  for (const tileHuts of hutTiles.values()) {
    for (const hut of tileHuts) if (!huts.has(hut.slug)) huts.set(hut.slug, hut);
  }
  const availMarkers: WdCanvasDot[] = [];
  const plainMarkers: WdCanvasDot[] = [];
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
      ringColor: status ? STATUS_COLORS[status] : undefined,
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
    (availBySlug.has(hut.slug) ? availMarkers : plainMarkers).push(layer);
  }
  clusterAvail.addLayers(availMarkers); // bulk: no per-marker animation
  clusterPlain.addLayers(plainMarkers);
  // Diagnostics for the zoom-sweep profiler (harmless in prod).
  window.performance.measure('wd-fb:rebuild', { start: rebuildStart });
}

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
        // days=4 matches the MapLibre wd-bookings source — same request
        // shape, shared browser-cache entry with the main map's fetches.
        query: { days: 4, lang: currentLocale() },
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
          statuses: (properties.data ?? []).map(day => day.occupancy_status ?? 'unknown'),
        });
      }
      rebuildMarkers(); // recolor rings — settle AFTER the new render
    }
  } finally {
    if (spin) catalogStore.settleAvailabilityLoadManual();
  }
}

/** "Zoom in to see availabilities" hint: shown while a DATE is selected
 *  and the camera is at z <= 9 (below the marker floor — nothing is
 *  visible there); dismissed from z > 10. The gap is deliberate
 *  hysteresis so a pan around z8.5 cannot flicker it. Persistent toast
 *  (timeout 0) + close button; re-shows when conditions return. */
const ZOOM_HINT_SHOW_AT = 9; // owner: visible at z <= 9
const ZOOM_HINT_HIDE_AT = 10;
let zoomHintDismiss: (() => void) | undefined;

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
    if (date === undefined) {
      availBySlug.clear();
      rebuildMarkers();
      updateZoomHint();
    } else {
      void loadAvailability(date);
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
  markerOpacity = markerOpacityFor(map.getZoom());
  shieldPx = shieldPxFor(map.getZoom());
  fallbackEl.value?.style.setProperty('--wd-fb-o', String(markerOpacity));
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
  // Defensive wrap: an out-of-range seed lng (mangled deep link) must
  // never park the camera on an unwrapped off-world copy — markers exist
  // only on copy 0 and would vanish (owner bug report).
  const initialCenter = L.latLng(initial.lat, initial.lng).wrap();
  map = L.map(el, {
    zoomControl: false,
    attributionControl: false, // replaced by the MapLibre-style control below
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomSnap: 0, // continuous wheel zoom
    // Default 60px/level felt twitchy — a bit more travel per level.
    wheelPxPerZoomLevel: 100,
  });
  map.setView(initialCenter, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initial.zoom)));
  applyBasemap();

  // Controls — same layout as the MapLibre map: zoom top-right on desktop
  // / bottom-left on mobile (matching MglNavigationControl), attribution +
  // scale bottom-left (attribution above the scale).
  const isMobileView = window.matchMedia('(max-width: 768px)').matches;
  L.control.zoom({ position: isMobileView ? 'bottomleft' : 'topright' }).addTo(map);
  new WdAttributionControl({ position: 'bottomleft' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 100 }).addTo(map);

  dotRenderer = L.canvas({ padding: 0.5 }); // one canvas for all hut dots

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
  document.body.classList.add('wd-fb-active'); // slider visibility gate
  sliderZoom.value = map.getZoom();
  fallbackEl.value?.style.setProperty('--wd-fb-g', String(glyphScale(map.getZoom())));
  markerOpacity = markerOpacityFor(map.getZoom());
  shieldPx = shieldPxFor(map.getZoom());
  fallbackEl.value?.style.setProperty('--wd-fb-o', String(markerOpacity));
  updateZoomHint();
  void loadSprite();

  // Dev-only debugging/profiling hook (the map instance lives in this
  // component's closure otherwise; window.__wdFbDebug.map exposes e.g.
  // latLngToContainerPoint for exact click tests). Never in prod builds.
  if (import.meta.env.DEV) {
    (window as unknown as { __wdFbDebug?: unknown }).__wdFbDebug = {
      map,
      clusterAvail,
      clusterPlain,
      hutTiles,
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
  document.body.classList.remove('wd-fb-active');
  zoomHintDismiss?.();
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

    <!-- Locate (GPS): maplibre ctrl-group style, top-right under the
         focus toggle on desktop, above the bottom-left zoom on mobile. -->
    <button class="wd-fb-locate" type="button" aria-label="Show my location" @click.stop="onLocate">
      <svg viewBox="0 0 20 20" fill="#333" aria-hidden="true">
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
.wd-fb-cluster-icon {
  // z7 ghost ramp (owner spec) — 50% at z7, solid by z9.
  opacity: var(--wd-fb-o, 1);
}

// Icons above clusters (owner spec): hut shields live on the CANVAS
// (overlay pane, z 400) while cluster bubbles are DOM markers (z 600) —
// lift the overlay pane above the marker pane so shields paint over
// bubbles at their shared edges.
.wd-fallback-map .leaflet-overlay-pane {
  z-index: 650;
}

// ── Locate button: maplibre ctrl-group language (29px white square,
//    shadow ring, #333 icon) ────────────────────────────────────────────
.wd-fb-locate {
  position: absolute;
  top: 58px;
  right: 14px;
  z-index: 1001;
  width: 29px;
  height: 29px;
  padding: 3px;
  border: none;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
  cursor: pointer;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.05);
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
    bottom: 84px;
    left: 10px;
    right: auto;
  }
}

// ── Focus mode: the basemap switch is APP CHROME — same slide-away the
//    main map gives .wd-map-ctl-sticky/.wd-map-ctl-col. Map instruments
//    (zoom, slider, locate, attribution) stay, like MapLibre controls. ──
body.wd-map-focus .wd-fb-bm {
  opacity: 0;
  pointer-events: none;
  transform: translateX(80px);
  transition:
    opacity 0.3s cubic-bezier(0.2, 0, 0, 1),
    transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

// Zoom slider: ALWAYS visible in fallback mode (the global gating only
// knows the MapLibre focus/overlay states).
body.wd-fb-active .wd-zoom {
  display: flex !important;

  .wd-zoom__pill {
    opacity: 1;
    transform: none;
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
