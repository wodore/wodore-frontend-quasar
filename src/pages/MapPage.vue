<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { whenIdle } from '@services/idle';
import WdMapLoader from 'components/map/WdMapLoader.vue';

const WdMapView = defineAsyncComponent(() => import('components/map/WdMapView.vue'));

// First paint is the static boot shell (index.html) plus the loader
// grid; the MapLibre boot (chunk download, style chain, GPU
// detection, tiles) starts in the next idle slot so it never contends
// with the first-paint critical path. mapReady is per page instance —
// re-entering the route remounts the page and re-gates.
//
// The loader UX is a SINGLE visual (owner spec, 2026-10): the branded
// grid + logo + spinner (WdMapLoader) covers the map from first paint
// until the base basemap AND the overlays have rendered
// (WdMapView 'rendered'), then fades out — no intermediate spinners,
// no white window. The Suspense fallback uses the same component so
// the chunk-loading phase is visually identical.
const mapReady = ref(false);
const mapRendered = ref(false);
/** MapLibre `load` fired — pre-reveal signal for the splash (words fade
 * out, no new hills). */
const mapLibreReady = ref(false);
onMounted(() => {
  void whenIdle(() => {
    mapReady.value = true;
  });
});
</script>

<template>
  <q-page class="map-page">
    <!-- ONE splash instance spans the whole boot → reveal. The earlier
         v-if/v-else pair mounted a SECOND WdMapLoader when mapReady
         flipped — restarting the entrance choreography (wordmark
         vanished and rose again, mountains replayed) mid-boot. The map
         mounts INSIDE the same tree; the loader stays on top until
         `rendered`, no Suspense fallback needed (it covers that phase
         too). -->
    <Suspense v-if="mapReady">
      <q-no-ssr>
        <WdMapView @rendered="mapRendered = true" @mapready="mapLibreReady = true" />
      </q-no-ssr>
    </Suspense>
    <WdMapLoader :rendered="mapRendered" :map-ready="mapLibreReady" />
  </q-page>
</template>

<style lang="scss" scoped>
.map-page {
  position: relative;
}
</style>
