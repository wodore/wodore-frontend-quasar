<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import WdPlaceSearch from './WdPlaceSearch.vue';

// State
const showDialog = ref(false);

// Refs
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);

// When dialog opens, focus the search input
watch(showDialog, (newVal) => {
  if (newVal) {
    nextTick(() => {
      placeSearchRef.value?.focus();
    });
  }
});

// Handle close from search component (always close on mobile)
function onSearchClose() {
  showDialog.value = false;
}
</script>

<template>
  <!-- Search icon button trigger -->
  <q-btn
    flat
    round
    dense
    @click="showDialog = true"
    class="q-ml-xs"
  >
    <q-icon size="sm" class="text-icon">
      <IconEvaSearchOutline />
    </q-icon>
  </q-btn>

  <!-- Mobile Full-screen Dialog -->
  <q-dialog v-model="showDialog" maximized transition-show="slide-up" transition-hide="slide-down">
    <div style="position: relative; height: 100vh; width: 100vw">
      <!-- Close button (top right corner) -->
      <div class="q-ma-xs z-top text-icon" style="position: absolute; top: 6px; right: 6px">
        <q-btn dense round flat v-close-popup color="accent-700" icon="wd-close">
          <q-tooltip :delay="2000">Schließen</q-tooltip>
        </q-btn>
      </div>

      <!-- Search component (complete card, full screen on mobile) -->
      <WdPlaceSearch ref="placeSearchRef" mobile @close="onSearchClose" style="height: 100vh; width: 100vw; max-width: 100vw" />
    </div>
  </q-dialog>
</template>
