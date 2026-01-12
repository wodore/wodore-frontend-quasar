<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDraggable } from '@vueuse/core';
import WdPlaceSearch from './WdPlaceSearch.vue';

// State
const showMenu = ref(false);
const isSticky = ref(false);
const wasDragging = ref(false);
let dragTimeout: ReturnType<typeof setTimeout> | null = null;

// Refs
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);
const menuContentRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);

// Border constraints (in pixels from viewport edge)
const BORDER_MARGIN = 0;
const CARD_WIDTH = 440;
const CARD_HEIGHT = 400;

// Draggable functionality with constraints
const {
  x,
  y,
  style: draggableStyle,
  isDragging: vueuseDragging,
} = useDraggable(menuContentRef, {
  handle: dragHandleRef,
  initialValue: { x: 0, y: 0 },
  onMove: (position) => {
    // Only apply constraints when sticky (when dragging is enabled)
    if (!isSticky.value) return position;

    // Get viewport dimensions
    const maxX = window.innerWidth - CARD_WIDTH - BORDER_MARGIN;
    const maxY = window.innerHeight - CARD_HEIGHT - BORDER_MARGIN;

    // Constrain position
    position.x = Math.max(BORDER_MARGIN, Math.min(position.x, maxX));
    position.y = Math.max(BORDER_MARGIN, Math.min(position.y, maxY));

    return position;
  },
});

// Track dragging state with timeout
watch(vueuseDragging, (newVal) => {
  if (newVal) {
    // Started dragging
    wasDragging.value = true;
    if (dragTimeout) {
      clearTimeout(dragTimeout);
      dragTimeout = null;
    }
  } else if (wasDragging.value) {
    // Stopped dragging, reset after 200ms
    if (dragTimeout) clearTimeout(dragTimeout);
    dragTimeout = setTimeout(() => {
      wasDragging.value = false;
    }, 200);
  }
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

// When entering sticky mode, capture current position
watch(isSticky, (newVal) => {
  if (newVal && menuContentRef.value) {
    // Capture position BEFORE applying fixed positioning
    const rect = menuContentRef.value.getBoundingClientRect();
    const capturedX = rect.left;
    const capturedY = rect.top;

    // Wait for next tick to ensure position: fixed is applied, then set position
    nextTick(() => {
      x.value = capturedX;
      y.value = capturedY;
    });
  } else {
    // Reset position when leaving sticky mode
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

// Handle drag handle click (only if not dragging)
function handleDragHandleClick() {
  // Only toggle if we didn't just finish dragging
  if (!wasDragging.value) {
    toggleSticky();
  }
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

.menu-content-sticky {
  position: fixed !important;
  z-index: 9000;
}
</style>

<template>
  <div class="q-ml-md q-mr-md" style="max-width: 140px; max-height: 40px">
    <!-- Readonly input field trigger -->
    <div id="select-place-search-location" style="flex: 1; position: relative">
      <q-input
        readonly
        model-value=""
        dense
        dark
        standout
        :placeholder="$t('search') + ' ...'"
        class="toolbar-font"
        @click="showMenu = true"
      >
        <template v-slot:prepend>
          <q-icon
            @click="showMenu = true"
            class="text-icon cursor-pointer"
            size="sm"
          >
            <IconEvaSearchOutline />
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Q-menu with draggable content -->
    <q-menu
      :offset="[10, 1]"
      no-parent-event
      anchor="top start"
      target="#select-place-search-location"
      v-model="showMenu"
      transition-show="jump-down"
      transition-hide="jump-up"
      :persistent="isSticky"
    >
      <div
        ref="menuContentRef"
        :class="{ 'menu-content-sticky': isSticky }"
        :style="isSticky ? draggableStyle : undefined"
        style="position: relative"
      >
        <!-- Control buttons -->
        <div
          class="q-ma-xs z-top text-icon row q-gutter-xs"
          style="position: absolute; top: 6px; right: 6px"
        >
          <!-- Pin/Drag handle -->
          <q-btn
            v-if="!isSticky"
            dense
            round
            flat
            color="primary-400"
            @click="toggleSticky"
          >
            <q-icon size="sm">
              <IconEvaUnlockOutline />
            </q-icon>
            <q-tooltip :delay="1000">{{ $t('pin_something') }}</q-tooltip>
          </q-btn>
          <q-btn
            v-else
            dense
            round
            flat
            color="primary-400"
            ref="dragHandleRef"
            class="cursor-move"
            @click="handleDragHandleClick"
          >
            <q-icon size="sm">
              <IconEvaMoveOutline />
            </q-icon>
            <q-tooltip :delay="2000">{{ $t('drag_to_move') }}</q-tooltip>
          </q-btn>

          <!-- Close button -->
          <q-btn
            dense
            round
            @click="closeMenu"
            color="accent-700"
            icon="wd-close"
          >
          </q-btn>
        </div>

        <!-- Search component (single instance) -->
        <WdPlaceSearch ref="placeSearchRef" @close="onSearchClose" />
      </div>
    </q-menu>
  </div>
</template>
