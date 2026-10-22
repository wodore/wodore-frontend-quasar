<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { whenIdle } from '@services/idle';

const WdMapView = defineAsyncComponent(() => import('components/map/WdMapView.vue'));

// First paint is the static boot shell (index.html) plus this grid
// placeholder; the MapLibre boot (chunk download, style chain, GPU
// detection, tiles) starts in the next idle slot so it never contends
// with the first-paint critical path. mapReady is per page instance —
// re-entering the route remounts the page and re-gates.
//
// There are deliberately THREE placeholder layers in sequence — the
// static boot shell in index.html (pre-JS paint), this grid
// q-inner-loading (pre-idle), and the Suspense fallback while the map
// chunk loads — each hands over to the next; do not "fix" the
// apparent double/triple spinner, it is the staged handover.
const mapReady = ref(false);
onMounted(() => {
  void whenIdle(() => {
    mapReady.value = true;
  });
});
</script>

<style lang="scss" scoped>
.background-map {
  background-color: #dddddd;
  opacity: 1;
  background-image:
    linear-gradient(#d0d0d0 1.6px, transparent 1.6px),
    linear-gradient(90deg, #d0d0d0 1.6px, transparent 1.6px),
    linear-gradient(#d0d0d0 0.8px, transparent 0.8px),
    linear-gradient(90deg, #d0d0d0 0.8px, #dddddd 0.8px);
  background-size:
    40px 40px,
    40px 40px,
    8px 8px,
    8px 8px;
  background-position:
    -1.6px -1.6px,
    -1.6px -1.6px,
    -0.8px -0.8px,
    -0.8px -0.8px;
}

/* Dark theme: match the boot shell's night grid (index.html + design
   tokens .body--dark: page #0a140f, ridge #1c3629) so the
   shell → placeholder handover stays dark for dark-theme users. */
.body--dark .background-map {
  background-color: #0a140f;
  background-image:
    linear-gradient(#1c3629 1.6px, transparent 1.6px),
    linear-gradient(90deg, #1c3629 1.6px, transparent 1.6px),
    linear-gradient(#1c3629 0.8px, transparent 0.8px),
    linear-gradient(90deg, #1c3629 0.8px, #0a140f 0.8px);
}
</style>
<template>
  <q-page class="map-page">
    <q-inner-loading v-if="!mapReady" :showing="true" class="background-map">
      <q-spinner-grid size="50px" color="secondary" />
    </q-inner-loading>
    <Suspense v-else>
      <q-no-ssr>
        <WdMapView />
      </q-no-ssr>
      <template #fallback>
        <q-inner-loading :showing="true" class="background-map">
          <q-spinner-grid size="50px" color="secondary" />
        </q-inner-loading>
      </template>
    </Suspense>
  </q-page>
</template>
