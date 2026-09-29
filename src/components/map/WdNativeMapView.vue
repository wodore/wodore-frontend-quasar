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
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import type { StyleSpecification } from 'maplibre-gl';
import { MapLibre, type Camera } from '@capawesome/capacitor-maplibre';
import type { PluginListenerHandle } from '@capacitor/core';
import { useBasemapStore } from '@stores/map/basemap-store';
import { useOverlayStore } from '@stores/map/overlay-store';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
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
    const res = await axios.get<StyleSpecification>(style, {
      headers: { Accept: 'application/json' },
    });
    cached = res.data;
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
 * Apply the composed style. setStyle() crashes the app (NPE in the
 * maplibre annotation plugin's DraggableAnnotationController when the
 * style reloads — upstream bug at plugin v0.2.0), so rebuild the map
 * instead: destroy + create with the current camera preserved.
 */
async function applyStyle() {
  const epoch = ++styleEpoch.value;
  let camera: Camera | null = null;
  if (mapReady) {
    camera = await MapLibre.getCamera({ mapId: MAP_ID })
      .then(r => r.camera)
      .catch(() => null);
    await MapLibre.destroyMap({ mapId: MAP_ID }).catch(() => undefined);
  }
  const initial = localPropertiesStore.getInitialLocation();
  let styleJson: string;
  try {
    styleJson = JSON.stringify(await composeStyle());
  } catch (e) {
    console.error('[WdNativeMapView] composeStyle failed', e);
    return;
  }
  try {
    await MapLibre.createMap({
      mapId: MAP_ID,
      elementId: mapElementId,
      styleJson,
      center: camera?.center ?? { latitude: initial.lat, longitude: initial.lng },
      zoom: camera?.zoom ?? initial.zoom,
      minZoom: 7,
      maxZoom: 20,
    });
    mapReady = true;
    if (epoch !== styleEpoch.value) return; // superseded
    console.debug('[WdNativeMapView] map (re)created with composed style');
  } catch (e) {
    console.error('[WdNativeMapView] applyStyle createMap failed', e);
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
          router.push({ name: 'map', hash: route.hash, query: route.query });
        } else {
          selectedHutSlug = slug;
          void flyToHut(hit.geometry.coordinates[0], hit.geometry.coordinates[1], zoom);
          router.push({
            name: 'map-hut',
            params: { slug },
            hash: route.hash,
            query: route.query,
          });
        }
      }
    })
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
      return;
    }
    selectedHutSlug = slug;
    let hut = hutFeatures.find(f => f.properties.slug === slug);
    if (!hut) {
      // Huts may not be loaded yet — try once more
      if (hutFeatures.length === 0) await loadHuts();
      hut = hutFeatures.find(f => f.properties.slug === slug);
    }
    if (hut) {
      const [lng, lat] = hut.geometry.coordinates;
      void flyToHut(lng, lat, await currentZoom());
    }
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
</style>
