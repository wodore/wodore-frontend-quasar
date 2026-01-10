<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDraggable } from '@vueuse/core';
import WdPlaceSearch from './WdPlaceSearch.vue';

// State
const showMenu = ref(false);
const isSticky = ref(false);

// Refs
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);
const dialogCardRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);

// Draggable functionality
const { x, y, style: draggableStyle } = useDraggable(dialogCardRef, {
  handle: dragHandleRef,
  initialValue: { x: 0, y: 0 },
});

// When menu opens, focus the search input
watch(showMenu, (newVal) => {
  if (newVal) {
    nextTick(() => {
      placeSearchRef.value?.focus();
    });
  } else {
    // Reset sticky and position when menu closes
    isSticky.value = false;
    x.value = 0;
    y.value = 0;
  }
});

// Handle close from search component
function onSearchClose() {
  if (!isSticky.value) {
    showMenu.value = false;
  }
}

// Toggle sticky mode
function toggleSticky() {
  isSticky.value = !isSticky.value;
}

// Close menu
function closeMenu() {
  showMenu.value = false;
}
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}
</style>

<template>
  <div class="q-ml-md q-mr-md" style="max-width: 280px; max-height: 40px">
    <!-- Readonly input field trigger -->
    <div id="select-place-search-location" style="flex: 1; position: relative">
      <q-input
        readonly
        model-value=""
        dense
        dark
        standout
        placeholder="Orte suchen..."
        class="toolbar-font"
        @click="showMenu = true"
      >
        <template v-slot:prepend>
          <q-icon @click="showMenu = true" class="text-icon cursor-pointer" size="sm">
            <IconEvaSearchOutline />
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Desktop Popup Menu -->
    <q-popup-proxy
      :offset="[10, 1]"
      no-parent-event
      anchor="top start"
      target="#select-place-search-location"
      v-model="showMenu"
      transition-show="jump-down"
      transition-hide="jump-up"
      :persistent="isSticky"
    >
      <div ref="dialogCardRef" :style="draggableStyle" style="position: relative">
        <!-- Sticky/Close toggle buttons -->
        <div class="q-ma-xs z-top text-icon row q-gutter-xs" style="position: absolute; top: 6px; right: 6px">
          <!-- Drag icon (shown when sticky) -->
          <q-btn v-if="isSticky" dense round flat color="primary-400" ref="dragHandleRef" class="cursor-move">
            <q-icon size="sm">
              <IconEvaMoveOutline />
            </q-icon>
            <q-tooltip :delay="2000">Ziehen um zu verschieben</q-tooltip>
          </q-btn>
          <!-- Lock/Unlock toggle -->
          <q-btn v-if="!isSticky" dense round @click="toggleSticky" color="primary-400">
            <q-icon size="sm">
              <IconEvaUnlockOutline />
            </q-icon>
            <q-tooltip :delay="2000">Dialog anheften</q-tooltip>
          </q-btn>
          <q-btn v-else dense round @click="closeMenu" color="accent-700" icon="wd-close">
            <q-tooltip :delay="2000">Schließen</q-tooltip>
          </q-btn>
        </div>

        <!-- Search component (complete card) -->
        <WdPlaceSearch ref="placeSearchRef" @close="onSearchClose" />
      </div>
    </q-popup-proxy>
  </div>
</template>
