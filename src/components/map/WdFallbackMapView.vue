<script setup lang="ts">
/**
 * NON-WebGL fallback map (POC) — Leaflet + clustered hut dots.
 *
 * Mounted by WdMapView only when its WebGL pre-check fails: MapLibre
 * GL cannot render at all there (raster basemaps included — they still
 * need a GL canvas), so this component degrades to Leaflet's 2D-canvas
 * stack instead of the WEBGL_NOT_SUPPORTED dead end.
 *
 * Stack (deliberately minimal — a degraded mode, not a second map app):
 * - Basemap: keyless OSM raster (tile.openstreetmap.org) — same source
 *   the weak-GPU raster basemap uses. Follow-up candidate: the
 *   mapproxy `world_topo` facade (`/raster/tiles/world_topo/...`),
 *   which already merges OpenTopoMap + geoland.at + swisstopo and is
 *   what prod serves — see AGENTS.md / the tile-router.
 * - Huts: `GET /v1/huts/geojson?bbox=…` (ETag-cached), refetched on
 *   debounced moveend; circleMarker dots in a markercluster group.
 *   Dots appear from HUT_MIN_ZOOM (owner: "z9 or so") — below that the
 *   basemap renders alone.
 * - Click: seeds the place identity (same seedPlaceFromMap the tile
 *   click uses) and routes to `map-hut` — the exact same content panel
 *   the MapLibre map opens.
 *
 * Leaflet + markercluster ride this component's async chunk
 * (WdMapView async-imports it), so WebGL users never download them.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useDebounceFn } from '@vueuse/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { clientWodore } from '@clients/index';
import { currentLocale } from '@services/locale';
import { useLocalPropertiesStore } from '@stores/local-properties-store';
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

const fallbackEl = ref<HTMLDivElement>();

/** Hut dots render from this zoom up (owner: z9-ish — consistent with
 * the MapLibre overlays' zoom floors; below it the basemap is alone). */
const HUT_MIN_ZOOM = 9;

/** Brand dot ($primary green, white halo) — the POC "dots" variant.
 * Follow-up: type color via embed_type / category projection. */
const DOT_STYLE = {
  radius: 6,
  weight: 2,
  color: '#ffffff',
  fillColor: '#346751',
  fillOpacity: 1,
} satisfies L.CircleMarkerOptions;

/** Narrow view of the feature properties the endpoint guarantees
 * (slug always; name/elevation when requested). */
type HutProperties = Record<string, unknown> & { slug: string };

let map: L.Map | undefined;
let cluster: L.MarkerClusterGroup | undefined;
/** Latest-wins guard for in-flight bbox fetches. */
let fetchGeneration = 0;

async function loadHuts(): Promise<void> {
  const activeMap = map;
  const activeCluster = cluster;
  if (!activeMap || !activeCluster) return; // unmounted mid-flight
  if (activeMap.getZoom() < HUT_MIN_ZOOM) {
    activeCluster.clearLayers();
    return;
  }
  const generation = ++fetchGeneration;
  // Padded viewport bbox — small overshoot so dots exist at the edge
  // while panning (matches the tile buffer idea, cheaply).
  const bounds = activeMap.getBounds().pad(0.25);
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
  const { data, error } = await clientWodore.GET('/v1/huts/huts.geojson', {
    params: {
      query: {
        bbox,
        lang: currentLocale(),
        include_name: true,
        include_elevation: true,
      },
    },
  });
  // KNOWN backend bug (staging, unreleased API): a bbox with ZERO huts
  // 422s ("Input should be a valid list" — the GeoJSON aggregate
  // returns None and response validation fails) instead of an empty
  // FeatureCollection. Treat exactly that case as "no huts here" and
  // clear; other errors keep the previous markers (network flake).
  if (error?.status === 422) {
    if (generation === fetchGeneration && cluster) cluster.clearLayers();
    return;
  }
  // The generic FeatureCollection response unions with list-shaped
  // schemas — narrow to the FeatureCollection member before reading.
  if (
    error ||
    !data ||
    !('features' in data) ||
    generation !== fetchGeneration ||
    !map ||
    !cluster
  ) {
    return; // failed, superseded, or unmounted — keep previous markers
  }
  const markers: L.CircleMarker[] = [];
  for (const feature of data.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'Point') continue;
    const [lon, lat] = geometry.coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    // SAFETY: the endpoint always serializes properties (slug + the
    // requested include_* fields) — the cast only drops the generated
    // schema's null union.
    const properties = (feature.properties ?? {}) as HutProperties;
    if (!properties.slug) continue;
    const marker = L.circleMarker([lat, lon], DOT_STYLE);
    marker.on('click', () => selectHut(properties, lat, lon));
    markers.push(marker);
  }
  cluster.clearLayers();
  cluster.addLayers(markers); // bulk add: no per-marker animation
}

const refreshHuts = useDebounceFn(() => void loadHuts(), 400);

/** Same open-details flow as the MapLibre hut layer click: seed the
 * panel identity from the feature properties, then route — the place
 * content panel (`map-hut`) is shared with the main map. */
function selectHut(properties: HutProperties, lat: number, lon: number): void {
  const slug = String(properties.slug);
  seedPlaceFromMap(slug, properties, { lat, lon });
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

onMounted(() => {
  const el = fallbackEl.value;
  if (!el) return;
  const initial = localPropertiesStore.getInitialLocation();
  map = L.map(el, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 2,
    maxZoom: 19,
  });
  map.setView([initial.lat, initial.lng], initial.zoom);
  // Bottom-right zoom control — mirrors the main map's control strip
  // placement instead of Leaflet's top-left default.
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);
  cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    chunkedLoading: true,
    maxClusterRadius: 48,
    disableClusteringAtZoom: 14,
    spiderfyOnMaxZoom: false,
  });
  map.addLayer(cluster);
  // Debounced bbox refresh + shared position memory (the MapLibre map
  // and this fallback restore each other's viewport).
  map.on('moveend zoomend', () => {
    localPropertiesStore.updateLocation({
      lat: map!.getCenter().lat,
      lng: map!.getCenter().lng,
      zoom: map!.getZoom(),
      bearing: 0,
    });
    refreshHuts();
  });
  map.whenReady(() => {
    emit('ready');
    void loadHuts();
  });
});

onBeforeUnmount(() => {
  fetchGeneration++; // invalidate any in-flight fetch callbacks
  map?.remove(); // tears down layers + listeners
  map = undefined;
  cluster = undefined;
});
</script>

<template>
  <div ref="fallbackEl" class="wd-fallback-map" role="application" :aria-label="t('map.loading')">
    <div class="wd-fallback-map__note">{{ t('map.fallbackNote') }}</div>
  </div>
</template>

<style lang="scss" scoped>
.wd-fallback-map {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #f6f9f7; // same base the MapLibre canvas paints over
}

/* Reduced-mode chip: explains why this map looks different. Sits BELOW
 * the topbar (the app shell's search/availability bar overlays the map's
 * top edge — a top: 8px chip hides behind it), centered, above Leaflet's
 * panes (z 400) and controls (z 1000). */
.wd-fallback-map__note {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 68px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  padding: 3px 12px;
  border-radius: 12px;
  background: rgba(28, 28, 28, 0.72);
  color: rgba(242, 247, 244, 0.92);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  white-space: nowrap;
  pointer-events: none;
}
</style>
