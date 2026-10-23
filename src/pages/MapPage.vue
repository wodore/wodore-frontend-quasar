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
onMounted(() => {
  void whenIdle(() => {
    mapReady.value = true;
  });
});
</script>

<template>
  <q-page class="map-page">
    <WdMapLoader v-if="!mapReady" />
    <template v-else>
      <Suspense>
        <q-no-ssr>
          <WdMapView @rendered="mapRendered = true" />
        </q-no-ssr>
        <template #fallback>
          <WdMapLoader />
        </template>
      </Suspense>
      <WdMapLoader :rendered="mapRendered" />
    </template>
  </q-page>
</template>

<style lang="scss" scoped>
.map-page {
  position: relative;
}
</style>
