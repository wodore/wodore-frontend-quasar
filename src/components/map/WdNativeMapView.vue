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
import type { StyleSpecification } from 'maplibre-gl';
import { MapLibre } from '@capawesome/capacitor-maplibre';
import type { PluginListenerHandle } from '@capacitor/core';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
import { useHutsStore } from '@stores/huts-store';
import { clientWodore } from '@clients/index';
import axios from 'axios';
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

const scaleWidth = ref(80);
const scaleLabel = ref('');

const styleEpoch = ref(0); // guards async setStyle races
const listeners: PluginListenerHandle[] = [];

// Fetched URL styles (OpenFreeMap etc.) — styles are static, cache them
const remoteStyleCache = new Map<string, StyleSpecification>();

async function resolveBasemapStyle(): Promise<StyleSpecification> {
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
      console.warn(`[WdNativeMapView] Style fetch failed (${style}), falling back`, e);
      const ofm = basemapStore.basemaps.find(b => b.name === 'openfreemap-bright');
      if (ofm && typeof ofm.style === 'string' && !remoteStyleCache.has(ofm.style)) {
        try {
          const res = await axios.get<StyleSpecification>(ofm.style, {
            headers: { Accept: 'application/json' },
          });
          remoteStyleCache.set(ofm.style, res.data);
          basemapStore.setBasemap(ofm);
          return JSON.parse(JSON.stringify(res.data));
        } catch {
          /* OpenFreeMap unreachable too — try swisstopo-full below */
        }
      }
      const full = basemapStore.basemaps.find(b => b.name === 'ch-swisstopo-full');
      if (full && typeof full.style !== 'string') {
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
async function composeStyle(): Promise<StyleSpecification> {
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

  for (const overlay of overlayStore.overlays) {
    if (!overlay.active || !overlay.style) continue;
    for (const [id, source] of Object.entries(overlay.style.sources)) {
      if (!(id in style.sources!)) {
        style.sources![id] = JSON.parse(JSON.stringify(source));
      }
    }
    for (const layer of overlay.style.layers) {
      style.layers!.push(JSON.parse(JSON.stringify(layer)));
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

  // Glyph server: fonts.openmaptiles.org serves BOTH the overlay fonts
  // ("Open Sans Semibold") and the standard Noto families basemaps use
  // (OpenFreeMap's own font server 404s on Open Sans and kills symbol
  // layers natively).
  style.glyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

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
async function applyStyle() {
  const epoch = ++styleEpoch.value;
  let styleJson: string;
  try {
    styleJson = JSON.stringify(await composeStyle());
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
    console.debug('[WdNativeMapView] style applied');
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
    await MapLibre.addListener('cameraIdle', () => void updateScale())
  );
});

onUnmounted(async () => {
  document.body.classList.remove('wd-native-map');
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

// Overlay toggles -> recompose + setStyle
watch(
  () => overlayStore.overlays.map(o => `${o.name}:${o.active ? 1 : 0}`).join('|'),
  () => void applyStyle()
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
