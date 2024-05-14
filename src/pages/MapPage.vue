<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
const WdMapView = defineAsyncComponent(
  () => import('components/map/WdMapView.vue'),
);
</script>

<style lang="scss" scoped>
.background-map {
  background-color: #dddddd;
  opacity: 1;
  background-image: linear-gradient(#d0d0d0 1.6px, transparent 1.6px),
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
</style>
<template>
  <q-page>
    <Suspense>
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
