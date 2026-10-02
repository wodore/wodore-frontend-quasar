<template>
  <!--
    Proof of concept: @capawesome/capacitor-maplibre native map.
    The map div must stay EMPTY; the native view renders behind the
    WebView. Everything covering the map (body, #q-app, this wrapper)
    must be transparent — toggled via the body class below.
  -->
  <div class="poc-map-root">
    <div id="poc-map"></div>

    <!-- Overlay controls: siblings of the map div, not ancestors,
         so they may be opaque. -->
    <div class="poc-controls">
      <div class="poc-log">{{ log || 'Ready.' }}</div>
      <div class="poc-buttons">
        <q-btn v-if="!mapReady" label="Create map" color="primary" unelevated @click="createMap" />
        <template v-else>
          <q-btn label="Fly to Bern" color="primary" unelevated @click="flyToBern" />
          <q-btn label="Add marker" color="primary" unelevated @click="addMarker" />
          <q-btn
            :label="markerAdded ? 'Remove marker' : 'No marker'"
            color="secondary"
            unelevated
            :disable="!markerAdded"
            @click="removeMarker"
          />
          <q-btn label="Destroy" color="negative" unelevated @click="destroyMap" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css';
import { onMounted, onUnmounted, ref } from 'vue';
import { MapLibre, MarkerIconAnchor } from '@capawesome/capacitor-maplibre';
import type { PluginListenerHandle } from '@capacitor/core';
import { getRasterStyle } from 'stores/map/utils/raster';

const MAP_ID = 'poc-map';
const MARKER_ID = 'poc-marker';
// Bern, Switzerland — inside the swisstopo tile coverage
const BERN = { latitude: 46.948, longitude: 7.4474 };

const mapReady = ref(false);
const markerAdded = ref(false);
const log = ref('');
const listeners: PluginListenerHandle[] = [];

function say(message: string) {
  log.value = `${new Date().toLocaleTimeString()} ${message}`;
}

async function createMap() {
  try {
    // Reuse the app's keyless Swiss raster basemap style (geo.admin.ch
    // WMTS tiles + OpenMapTiles glyphs — no API key needed).
    const style = getRasterStyle({
      name: 'ch.swisstopo.pixelkarte-farbe',
      tiles: [
        'https://wmts0.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
      ],
      attribution: '© swisstopo',
      maxZoom: 18,
    });
    await MapLibre.createMap({
      mapId: MAP_ID,
      elementId: 'poc-map',
      styleJson: JSON.stringify(style),
      center: BERN,
      zoom: 8,
    });
    mapReady.value = true;
    say('Map created (native render behind WebView).');
  } catch (e) {
    say(`createMap failed: ${String(e)}`);
  }
}

async function flyToBern() {
  try {
    await MapLibre.setCamera({
      mapId: MAP_ID,
      animate: true,
      animationDuration: 1500,
      center: BERN,
      zoom: 13,
      bearing: 0,
      pitch: 0,
    });
    say('Flew to Bern.');
  } catch (e) {
    say(`setCamera failed: ${String(e)}`);
  }
}

async function addMarker() {
  try {
    await MapLibre.addMarker({
      mapId: MAP_ID,
      marker: {
        id: MARKER_ID,
        coordinates: BERN,
        iconUrl: 'https://maplibre.org/maplibre-gl-js/docs/assets/custom_marker.png',
        iconAnchor: MarkerIconAnchor.Bottom,
        iconSize: { width: 30, height: 40 },
      },
    });
    markerAdded.value = true;
    say('Marker added (drag me on Android).');
  } catch (e) {
    say(`addMarker failed: ${String(e)}`);
  }
}

async function removeMarker() {
  try {
    await MapLibre.removeMarkerById({ mapId: MAP_ID, markerId: MARKER_ID });
    markerAdded.value = false;
    say('Marker removed.');
  } catch (e) {
    say(`removeMarker failed: ${String(e)}`);
  }
}

async function destroyMap() {
  try {
    await MapLibre.destroyMap({ mapId: MAP_ID });
    mapReady.value = false;
    markerAdded.value = false;
    say('Map destroyed.');
  } catch (e) {
    say(`destroyMap failed: ${String(e)}`);
  }
}

onMounted(async () => {
  // Transparency contract: the native map renders behind the WebView,
  // so body and #q-app must not paint over it while this page is open.
  document.body.classList.add('poc-native-map');
  listeners.push(
    await MapLibre.addListener('mapClick', e => {
      say(`mapClick @ ${e.coordinates.latitude.toFixed(4)}, ${e.coordinates.longitude.toFixed(4)}`);
    }),
    await MapLibre.addListener('markerClick', () => say('markerClick')),
    await MapLibre.addListener('cameraIdle', e => {
      say(`cameraIdle zoom=${e.camera.zoom.toFixed(1)}`);
    })
  );
});

onUnmounted(async () => {
  document.body.classList.remove('poc-native-map');
  if (mapReady.value) {
    await MapLibre.destroyMap({ mapId: MAP_ID }).catch(() => undefined);
  }
  for (const l of listeners) await l.remove();
});
</script>

<style lang="scss">
/* Transparency contract for the native map (unscoped: body + #q-app) */
body.poc-native-map,
body.poc-native-map #q-app {
  background: transparent !important;
  transition: none !important;
}
</style>

<style lang="scss" scoped>
.poc-map-root {
  position: fixed;
  inset: 0;
  background: transparent;
}

#poc-map {
  position: absolute;
  inset: 0;
  background: transparent;
}

.poc-controls {
  position: absolute;
  top: calc(48px + var(--q-safe-area-inset-top, 0px));
  left: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.poc-log {
  pointer-events: auto;
  align-self: flex-start;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(10, 18, 14, 0.8);
  color: #eaf4ec;
  font-size: 12px;
  font-family: monospace;
}

.poc-buttons {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
