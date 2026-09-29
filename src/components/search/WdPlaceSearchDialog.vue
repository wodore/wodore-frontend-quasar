<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import WdPlaceSearch from './WdPlaceSearch.vue';

const showDialog = ref(false);
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);

watch(showDialog, newVal => {
  if (newVal) {
    nextTick(() => placeSearchRef.value?.focus());
  }
});

function onSearchClose() {
  showDialog.value = false;
}
</script>

<template>
  <div>
    <q-btn flat round dense @click="showDialog = true">
      <q-icon size="sm" class="text-icon">
        <IconEvaSearchOutline />
      </q-icon>
    </q-btn>

    <q-dialog
      v-model="showDialog"
      maximized
      square
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <!-- Opaque background fills the card; content pads itself
           clear of system bars (same approach as the header toolbar) -->
      <div class="search-dialog-root">
        <div class="search-dialog-close">
          <q-btn
            dense
            round
            flat
            v-close-popup
            icon="wd-close"
            class="wd-close-chip"
          >
            <q-tooltip :delay="2000">{{ $t('close') }}</q-tooltip>
          </q-btn>
        </div>
        <WdPlaceSearch
          ref="placeSearchRef"
          mobile
          swipe-to-close
          @close="onSearchClose"
          class="search-dialog-content"
        />
      </div>
    </q-dialog>
  </div>
</template>

<style scoped>
.search-dialog-root {
  background: var(--q-dark, #112119);
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overscroll-behavior-y: none;
}

.search-dialog-close {
  position: fixed;
  top: calc(
    8px + var(--q-safe-area-inset-top, env(safe-area-inset-top, 0px))
  );
  right: 6px;
  z-index: 200;
}

.search-dialog-content {
  flex: 1;
  overflow: hidden;
}
</style>
