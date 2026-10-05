<template>
  <!--
    Native MapLibre map (@capawesome/capacitor-maplibre) — Capacitor only.
    Renders a native map view BEHIND the WebView: the map div must stay
    empty and body/#q-app/.q-layout/.q-page/.wd-map-fill are made
    transparent via the body class toggled below. Siblings (switches,
    footer shade) float above the map as usual.

    Style strategy: the app's basemaps and overlays are MapLibre style
    fragments already — compose them into one full style JSON and
    setStyle() whenever the basemap or overlay toggles change. The huts
    overlay (vector source + sprite symbols) renders natively as-is.
  -->
  <div class="wd-native-map-root">
    <div :id="mapElementId" class="wd-native-map-div"></div>

    <!-- Map controls as DOM overlays (QPageSticky-based, work over the
         native map): basemap switch + overlay switch. Geolocate /
         navigation / scale / attribution controls are web-only for now. -->
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

    <div class="map-footer-shade" aria-hidden="true"></div>

    <!-- Scale bar (DOM overlay — MapLibre Native has no scale widget
         exposed through the plugin; computed from the camera) -->
    <div v-if="scaleLabel" class="native-scale" :style="{ width: scaleWidth + 'px' }">
      <span class="native-scale-label">{{ scaleLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { MapLibre } from '@capawesome/capacitor-maplibre';
import type { PluginListenerHandle } from '@capacitor/core';
import { useBasemapStore } from '@stores/map/basemap-store';
import type { BasemapSwitchItem } from '@stores/map/utils/interfaces';
import type { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { useHutsStore } from '@stores/huts-store';
import { clientWodore } from '@clients/index';
import axios from 'axios';
import openfreemapBrightStyle from '@assets/map-styles/openfreemap-bright.json';
import type { Feature, FeatureCollection, Point } from 'geojson';
import WdBasemapSwitch from './WdBasemapSwitch.vue';
import WdOverlaySwitch from './WdOverlaySwitch.vue';

const MAP_ID = 'wd-native-map';
const mapElementId = 'wd-native-map-element';
const MIN_HUT_CLICK_ZOOM = 8;
const SELECT_ZOOM = 12;
const MIN_FLY_ZOOM = 9;

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const basemapStore = useBasemapStore();
const overlayStore = useOverlayStore();
const localPropertiesStore = useLocalPropertiesStore();
const hutsStore = useHutsStore();

// basemaps is a reactive() array whose element type deep-unwraps into the
// recursive StyleSpecification union — calling Array.find on it directly
// trips TS2589 (excessively deep instantiation). Cast to the plain item
// type first (same dodge the store itself uses in getBasemapByName).
function findBasemapByName(name: string): BasemapSwitchItem | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (basemapStore.basemaps as any[]).find(b => b.name === name);
}

const scaleWidth = ref(80);
const scaleLabel = ref('');
let scalePollTimer: number | null = null;

const styleEpoch = ref(0); // guards async setStyle races
const listeners: PluginListenerHandle[] = [];

// Fetched URL styles — cached. The OpenFreeMap bright style is ALSO
// bundled (src/assets/map-styles/openfreemap-bright.json) as a static
// copy: some devices' WebViews cannot fetch tiles.openfreemap.org at
// all (network error even though CORS is fine), while the NATIVE side
// fetches tiles/sprites/glyphs fine via OkHttp. The bundle removes
// the WebView from the critical path.
const OPENFREEMAP_BRIGHT_URL = 'https://tiles.openfreemap.org/styles/bright';
const remoteStyleCache = new Map<string, StyleSpecification>();

// MapTiler reachability probe: inline raster styles (e.g.
// swissTopoLbmRasterStyle on low-GPU tiers) carry api.maptiler.com TILE
// urls — no style-URL fetch happens, so the URL fallback can't catch a
// dead key. Probe one tile once per app run; 4xx/network failure means
// every MapTiler tile will fail -> use the fallback chain.
let maptilerProbe: Promise<boolean> | undefined;
function probeMaptiler(): Promise<boolean> {
  maptilerProbe ??= axios
    .get('https://api.maptiler.com/maps/ch-swisstopo-lbm/1/1/0.png', {
      timeout: 8000,
      responseType: 'arraybuffer',
      validateStatus: () => true,
    })
    .then(res => {
      const ok = res.status < 400;
      console.debug(
        `[WdNativeMapView] MapTiler probe: ${res.status} -> ${ok ? 'usable' : 'dead key'}`
      );
      return ok;
    })
    .catch(e => {
      console.debug('[WdNativeMapView] MapTiler probe: network failure', e?.message);
      return false;
    });
  return maptilerProbe;
}

async function resolveBasemapStyle(): Promise<StyleSpecification> {
  const resolved = await resolveBasemapStyleInner();
  // Inline styles can still depend on MapTiler tiles — probe and fall
  // back the same way as for MapTiler style URLs.
  if (JSON.stringify(resolved).includes('api.maptiler.com')) {
    if (!(await probeMaptiler())) {
      console.warn(
        '[WdNativeMapView] Basemap uses MapTiler tiles but the key is dead — falling back'
      );
      const ofm = findBasemapByName('openfreemap-bright');
      if (ofm) {
        console.debug('[WdNativeMapView] resolve: fallback -> openfreemap-bright (bundled)');
        basemapStore.setBasemap(ofm);
        return JSON.parse(JSON.stringify(openfreemapBrightStyle));
      }
      const full = findBasemapByName('ch-swisstopo-full');
      if (full && typeof full.style !== 'string') {
        console.debug('[WdNativeMapView] resolve: fallback -> ch-swisstopo-full');
        basemapStore.setBasemap(full);
        return JSON.parse(JSON.stringify(full.style));
      }
    }
  }
  return resolved;
}

async function resolveBasemapStyleInner(): Promise<StyleSpecification> {
  const basemap = basemapStore.getBasemap();
  const style = basemap?.style as StyleSpecification | string | undefined;
  if (typeof style !== 'string') {
    // Inline style object — deep-clone: the fragments are reactive
    // module singletons and setStyle must not see them mutate.
    return JSON.parse(JSON.stringify(style ?? {}));
  }
  // URL style (e.g. https://tiles.openfreemap.org/styles/bright)
  let cached = remoteStyleCache.get(style);
  if (!cached) {
    if (style === OPENFREEMAP_BRIGHT_URL) {
      // Serve the bundled snapshot directly — no WebView fetch needed
      cached = openfreemapBrightStyle as unknown as StyleSpecification;
      console.debug('[WdNativeMapView] resolve: bundled OpenFreeMap bright');
      remoteStyleCache.set(style, cached);
      return JSON.parse(JSON.stringify(cached));
    }
    try {
      const res = await axios.get<StyleSpecification>(style, {
        headers: { Accept: 'application/json' },
      });
      cached = res.data;
    } catch (e) {
      // MapTiler-hosted styles 403 when the API key is suspended —
      // the web flow falls back via map error events which don't fire
      // natively. Fall back to the keyless OpenFreeMap vector style
      // (the store's designated fallback), then swisstopo-full raster.
      console.warn(`[WdNativeMapView] resolve: fetch failed (${style})`, e);
      const ofm = findBasemapByName('openfreemap-bright');
      if (ofm) {
        // Bundled style — works even when the WebView cannot fetch it
        console.debug('[WdNativeMapView] resolve: fallback -> openfreemap-bright (bundled)');
        basemapStore.setBasemap(ofm);
        return JSON.parse(JSON.stringify(openfreemapBrightStyle));
      }
      const full = findBasemapByName('ch-swisstopo-full');
      if (full && typeof full.style !== 'string') {
        console.debug('[WdNativeMapView] resolve: fallback -> ch-swisstopo-full');
        basemapStore.setBasemap(full);
        return JSON.parse(JSON.stringify(full.style));
      }
      throw e;
    }
    remoteStyleCache.set(style, cached);
    console.debug(`[WdNativeMapView] Fetched remote style: ${style}`);
  }
  return JSON.parse(JSON.stringify(cached));
}

// Huts for tap hit-testing (native mapClick carries no features)
type HutFeature = Feature<Point> & { properties: { slug: string; name?: string } };
let hutFeatures: HutFeature[] = [];
let selectedHutSlug: string | undefined;

async function loadHuts() {
  try {
    const { data, error } = await clientWodore.GET('/v1/huts/huts.geojson', {
      params: { query: { lang: 'en' } },
    });
    if (!error && data) {
      const fc = data as unknown as FeatureCollection;
      hutFeatures = (fc.features as HutFeature[]).filter(
        f => f?.geometry?.type === 'Point' && f.properties?.slug
      );
      console.debug(`[WdNativeMapView] Loaded ${hutFeatures.length} huts for hit-testing`);
    }
  } catch (e) {
    console.warn('[WdNativeMapView] huts.geojson fetch failed', e);
  }
}

/**
 * Compose the full map style: current basemap + all active overlays.
 * Mirrors the web flow (WdOverlaySwitch addSource/addLayer and
 * basemap-store transformStyle) by merging the same style fragments.
 */
const OPACITY_BY_TYPE: Record<string, string[]> = {
  fill: ['fill-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity'],
  raster: ['raster-opacity'],
  heatmap: ['heatmap-opacity'],
  hillshade: ['hillshade-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
};
const DEFAULT_OVERLAY_OPACITY = ['interpolate', ['linear'], ['zoom'], 8, 0.9, 14, 0.6, 22, 0.5];

/**
 * Apply the overlay's opacity like the web addOverlayLayer does: the
 * overlay items carry an opacity expression (zoom-interpolated) that
 * the web injects into the layer paint at addLayer time. Without this
 * the raster overlays render fully opaque on native.
 *
 * `zero` (two-phase reveal): force flat 0 opacity while the overlay's
 * tiles pre-load — a visible layer with opacity 0 still fetches its
 * tiles, so the ugly stretched parent tile never shows; the final
 * style pass swaps in the real opacity once tiles are in (~300ms).
 */
function applyOverlayOpacity(
  layer: LayerSpecification,
  overlay: { opacity?: unknown },
  zero = false
) {
  const props = OPACITY_BY_TYPE[layer.type] ?? [];
  if (props.length === 0) return;
  const paint = (layer.paint ?? {}) as Record<string, unknown>;
  const nextPaint: Record<string, unknown> = { ...paint };
  if (zero) {
    for (const p of props) nextPaint[p] = 0;
  } else {
    const hasOwn = props.some(p => paint[p] !== undefined);
    if (hasOwn) return;
    const opacity = (overlay.opacity ?? DEFAULT_OVERLAY_OPACITY) as unknown;
    for (const p of props) nextPaint[p] = opacity;
  }
  (layer as { paint?: Record<string, unknown> }).paint = nextPaint;
}

async function composeStyle(revealZero?: Set<string>): Promise<StyleSpecification> {
  const style = await resolveBasemapStyle();
  style.sources = { ...(style.sources ?? {}) };
  style.layers = [...(style.layers ?? [])];

  // Merge sprites: basemap sprite (string | array) + overlay sprites
  const sprites: Array<{ id: string; url: string }> = [];
  if (typeof style.sprite === 'string') {
    sprites.push({ id: 'default', url: style.sprite });
  } else if (Array.isArray(style.sprite)) {
    sprites.push(...style.sprite);
  }

  // Glyphs: keep each basemap style's OWN glyph server — the blanket
  // fonts.openmaptiles.org override served Noto PBFs that MapLibre
  // Native cannot parse ("unknown pbf field type" -> every basemap
  // label dies). OpenFreeMap serves its own Noto fonts which pair
  // with the style; the swisstopo raster styles use openmaptiles for
  // the overlay fonts (Open Sans), which parse fine. When composing
  // over OpenFreeMap, remap overlay fonts it does not serve.
  const glyphsUrl = typeof style.glyphs === 'string' ? style.glyphs : '';
  const remapFonts = glyphsUrl.includes('tiles.openfreemap.org');
  const FONT_REMAP: Record<string, string> = {
    'Open Sans Semibold': 'Noto Sans Regular',
  };

  for (const overlay of overlayStore.overlays) {
    if (!overlay.active || !overlay.style) continue;
    for (const [id, source] of Object.entries(overlay.style.sources)) {
      if (!(id in style.sources!)) {
        style.sources![id] = JSON.parse(JSON.stringify(source));
      }
    }
    for (const layer of overlay.style.layers) {
      const cloned: LayerSpecification = JSON.parse(JSON.stringify(layer));
      applyOverlayOpacity(cloned, overlay, revealZero?.has(overlay.name));
      if (remapFonts) {
        const layout = (cloned.layout ?? {}) as Record<string, unknown>;
        const font = layout['text-font'];
        if (Array.isArray(font)) {
          layout['text-font'] = font.map(
            (f: unknown) => (typeof f === 'string' && FONT_REMAP[f]) || f
          );
          (cloned as { layout?: Record<string, unknown> }).layout = layout;
        }
      }
      style.layers!.push(cloned);
    }
    const os = overlay.style.sprite;
    if (os) {
      if (Array.isArray(os)) sprites.push(...(os as Array<{ id: string; url: string }>));
      else if (typeof os === 'object') sprites.push(os as { id: string; url: string });
    }
  }
  if (sprites.length > 0) style.sprite = sprites;

  // Selection highlight: the plugin bridge has no setFeatureState, so
  // the selected hut lives in its own GeoJSON source updated via
  // updateGeoJsonSourceById (no map rebuild needed). Styling mirrors
  // the web hutsLayerSelectedPaint.
  style.sources!['wd-selection'] = {
    type: 'geojson',
    data: selectionData(),
  };
  style.layers!.push({
    id: 'wd-selection',
    type: 'circle',
    source: 'wd-selection',
    paint: {
      'circle-color': '#2673bf',
      'circle-opacity': 0.7,
      'circle-blur': 0.7,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 10, 15, 40],
    },
  });
  // Selection halo renders BELOW the hut symbols: move it before the
  // first hut layer instead of leaving it on top.
  const selIdx = style.layers!.findIndex(l => l.id === 'wd-selection');
  const firstHutIdx = style.layers!.findIndex(l => (l.id ?? '').startsWith('wd-huts'));
  if (firstHutIdx !== -1 && firstHutIdx < selIdx) {
    style.layers!.splice(firstHutIdx, 0, style.layers!.splice(selIdx, 1)[0]);
  }

  // MapLibre Native does not support the icon-overlap/text-overlap
  // layout enums (maplibre-native#251) and drops the layer on parse —
  // strip them; the -allow-overlap booleans carry the same meaning.
  for (const layer of style.layers!) {
    if (layer.type === 'symbol' && layer.layout) {
      const layout = layer.layout as Record<string, unknown>;
      delete layout['icon-overlap'];
      delete layout['text-overlap'];
    }
  }
  return style;
}

let mapReady = false;

/**
 * Apply the composed style via setStyle. The upstream crash (NPE in
 * the annotation plugin's DraggableAnnotationController on style
 * reload) is fixed by our patch-package patch (lazy annotation
 * managers — see patches/@capawesome+capacitor-maplibre+0.2.0.patch).
 */
async function applyStyle(revealZero?: Set<string>) {
  const epoch = ++styleEpoch.value;
  let styleJson: string;
  try {
    styleJson = JSON.stringify(await composeStyle(revealZero));
  } catch (e) {
    console.error('[WdNativeMapView] composeStyle failed', e);
    return;
  }
  try {
    await MapLibre.setStyle({ mapId: MAP_ID, json: styleJson });
    if (epoch !== styleEpoch.value) return; // superseded
    // setStyle leaves the native surface stale (plugin v0.2.0 render
    // bug: black map until the next layout pass) — re-apply the frame
    // to force a re-layout. Verified on device: this revives rendering.
    const el = document.getElementById(mapElementId);
    if (el) {
      const r = el.getBoundingClientRect();
      await MapLibre.setFrame({
        mapId: MAP_ID,
        frame: { x: r.x, y: r.y, width: r.width, height: r.height },
      }).catch(() => undefined);
    }
    console.debug(
      `[WdNativeMapView] style applied (name=${(JSON.parse(styleJson) as { name?: string }).name ?? '?'})`
    );
  } catch (e) {
    console.error('[WdNativeMapView] setStyle failed', e);
  }
}

/** Web parity: MIN_HUT_CLICK_ZOOM gate + nearest-hut hit test. */
function hitTestHut(latitude: number, longitude: number, zoom: number): HutFeature | undefined {
  // ~36px tolerance expressed in degrees at the current zoom (native
  // taps land a few pixels off the visual icon center)
  const threshold = (36 * 360) / (512 * Math.pow(2, zoom));
  let best: HutFeature | undefined;
  let bestD = Infinity;
  for (const f of hutFeatures) {
    const [lng, lat] = f.geometry.coordinates;
    const d = Math.hypot(lng - longitude, lat - latitude);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return bestD <= threshold ? best : undefined;
}

function selectionData(): { type: 'FeatureCollection'; features: HutFeature[] } {
  const hut = selectedHutSlug
    ? hutFeatures.find(f => f.properties.slug === selectedHutSlug)
    : undefined;
  return { type: 'FeatureCollection', features: hut ? [hut] : [] };
}

async function updateSelectionSource() {
  if (!mapReady) return;
  try {
    await MapLibre.updateGeoJsonSourceById({
      mapId: MAP_ID,
      sourceId: 'wd-selection',
      data: selectionData() as unknown as Record<string, unknown>,
    });
  } catch (e) {
    console.warn('[WdNativeMapView] selection update failed', e);
  }
}

async function flyToHut(lng: number, lat: number, currentZoom: number) {
  const targetZoom = currentZoom < MIN_FLY_ZOOM ? SELECT_ZOOM : currentZoom;
  await MapLibre.setCamera({
    mapId: MAP_ID,
    animate: true,
    animationDuration: 1200,
    center: { latitude: lat, longitude: lng },
    zoom: targetZoom,
  });
}

async function currentZoom(): Promise<number> {
  const { camera } = await MapLibre.getCamera({ mapId: MAP_ID });
  return camera.zoom;
}

onMounted(async () => {
  // Transparency contract for the native view behind the WebView
  document.body.classList.add('wd-native-map');

  const initial = localPropertiesStore.getInitialLocation();
  try {
    await MapLibre.createMap({
      mapId: MAP_ID,
      elementId: mapElementId,
      styleJson: JSON.stringify(await composeStyle()),
      center: { latitude: initial.lat, longitude: initial.lng },
      zoom: initial.zoom,
      minZoom: 7,
      maxZoom: 20,
    });
    mapReady = true;
    console.debug('[WdNativeMapView] map created');
  } catch (e) {
    console.error('[WdNativeMapView] createMap failed', e);
  }

  void loadHuts();

  // Scale bar: meters-per-CSS-pixel from the camera (512px tiles),
  // rounded to a nice 1/2/5×10ⁿ distance that fits ~80px.
  const updateScale = async () => {
    try {
      const { camera } = await MapLibre.getCamera({ mapId: MAP_ID });
      const lat = (camera.center.latitude * Math.PI) / 180;
      const mPerPx = (40075016.686 * Math.cos(lat)) / (512 * 2 ** camera.zoom);
      const target = mPerPx * 80;
      const pow = 10 ** Math.floor(Math.log10(target));
      let nice = pow;
      for (const m of [5, 2, 1]) {
        if (m * pow <= target * 1.25) {
          nice = m * pow;
          break;
        }
      }
      scaleWidth.value = Math.max(24, Math.round(nice / mPerPx));
      scaleLabel.value = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
    } catch {
      /* camera not ready */
    }
  };

  listeners.push(
    await MapLibre.addListener('mapClick', async event => {
      const zoom = await currentZoom();
      if (zoom < MIN_HUT_CLICK_ZOOM) return;
      const hit = hitTestHut(event.coordinates.latitude, event.coordinates.longitude, zoom);
      if (hit) {
        const slug = hit.properties.slug;
        // Toggle: tapping the selected hut deselects (back to map)
        if (slug === selectedHutSlug || route.params.slug === slug) {
          selectedHutSlug = undefined;
          void updateSelectionSource();
          router.push({ name: 'map', hash: route.hash, query: route.query });
        } else {
          selectedHutSlug = slug;
          void updateSelectionSource();
          void flyToHut(hit.geometry.coordinates[0], hit.geometry.coordinates[1], zoom);
          router.push({
            name: 'map-hut',
            params: { slug },
            hash: route.hash,
            query: route.query,
          });
        }
      }
    }),
    await MapLibre.addListener('cameraMoveStarted', () => {
      // Live scale: poll the camera while the gesture runs (the plugin
      // has no continuous move event), stop on cameraIdle
      if (scalePollTimer !== null) return;
      scalePollTimer = window.setInterval(() => void updateScale(), 150);
    }),
    await MapLibre.addListener('cameraIdle', () => {
      if (scalePollTimer !== null) {
        window.clearInterval(scalePollTimer);
        scalePollTimer = null;
      }
      void updateScale();
    })
  );
});

onUnmounted(async () => {
  document.body.classList.remove('wd-native-map');
  clearTimeout(revealTimer);
  if (scalePollTimer !== null) window.clearInterval(scalePollTimer);
  for (const l of listeners) await l.remove();
  listeners.length = 0;
  mapReady = false;
  try {
    await MapLibre.destroyMap({ mapId: MAP_ID });
  } catch {
    /* map already gone */
  }
});

// Basemap switch -> recompose + setStyle
watch(
  () => basemapStore.getBasemap()?.name,
  () => void applyStyle()
);

// Overlay toggles -> recompose + setStyle. Newly-enabled overlays get
// a two-phase reveal: first pass applies them with 0 opacity (the
// layer is visible -> its tiles pre-load invisibly, skipping the ugly
// stretched parent tile), then ~300ms later the final style swaps in
// the real opacity.
// overlayStore.overlays is a reactive() array whose element type
// deep-unwraps into a recursive spec union — Array.map/filter on it
// trips TS2589 (the store itself uses the same plain-type casts).
function overlaySnapshot(): OverlaySwitchItem[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return overlayStore.overlays as any[];
}
function overlayStateString(): string {
  return overlaySnapshot().map(o => `${o.name}:${o.active ? 1 : 0}`).join('|');
}
let lastOverlayState = overlayStateString();
let revealTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => overlayStateString(),
  next => {
    const prevState = lastOverlayState;
    lastOverlayState = next;
    clearTimeout(revealTimer);
    const newlyOn = new Set(
      overlaySnapshot()
        .filter(o => o.active && !prevState.includes(`${o.name}:1`))
        .map(o => o.name)
    );
    if (newlyOn.size > 0) {
      void applyStyle(newlyOn).then(() => {
        revealTimer = setTimeout(() => void applyStyle(), 300);
      });
    } else {
      void applyStyle();
    }
  }
);

// Hut selection via router (search, deep links, bottom-sheet close) —
// mirrors the web selectHutBySlug watcher
watch(
  () => route.params.slug as string | undefined,
  async slug => {
    if (!slug) {
      selectedHutSlug = undefined;
      void updateSelectionSource();
      return;
    }
    selectedHutSlug = slug;
    let hut = hutFeatures.find(f => f.properties.slug === slug);
    if (!hut) {
      // Huts may not be loaded yet — try once more
      if (hutFeatures.length === 0) await loadHuts();
      hut = hutFeatures.find(f => f.properties.slug === slug);
    }
    void updateSelectionSource();
    if (hut) {
      const [lng, lat] = hut.geometry.coordinates;
      void flyToHut(lng, lat, await currentZoom());
    }
  }
);

// Bookings/occupation overlay: the style snapshot carries the data at
// compose time; between rebuilds push updates through the GeoJSON
// source API (no map rebuild needed)
watch(
  () => hutsStore.bookingsGeojson,
  data => {
    if (!mapReady || !data) return;
    MapLibre.updateGeoJsonSourceById({
      mapId: MAP_ID,
      sourceId: 'wd-bookings',
      data: data as unknown as Record<string, unknown>,
    }).catch(e => console.warn('[WdNativeMapView] bookings update failed', e));
  }
);
</script>

<style lang="scss">
/* Transparency contract (unscoped): the native map renders behind the
   WebView, so nothing between body and the map element may paint. */
body.wd-native-map,
body.wd-native-map #q-app,
body.wd-native-map #q-app > div,
body.wd-native-map .q-layout,
body.wd-native-map .q-page-container,
body.wd-native-map .q-page,
body.wd-native-map .wd-map-fill {
  background: transparent !important;
  background-color: transparent !important;
  transition: none !important;
}
</style>

<style lang="scss" scoped>
.wd-native-map-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.wd-native-map-div {
  position: absolute;
  inset: 0;
  background: transparent;
}

.native-scale {
  position: absolute;
  left: 12px;
  bottom: calc(64px + var(--q-safe-area-inset-bottom, 0px));
  height: 4px;
  border-left: 2px solid rgba(28, 28, 28, 0.85);
  border-right: 2px solid rgba(28, 28, 28, 0.85);
  border-bottom: 2px solid rgba(28, 28, 28, 0.85);
  pointer-events: none;
}

.native-scale-label {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
  color: rgba(28, 28, 28, 0.9);
  text-shadow:
    0 0 3px #fff,
    0 0 3px #fff,
    0 0 3px #fff;
}
</style>
