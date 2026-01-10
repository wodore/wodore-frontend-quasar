<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useDraggable } from '@vueuse/core';
import WdPlaceSearch from './WdPlaceSearch.vue';

// State
const showMenu = ref(false);
const isSticky = ref(false);
const isDragging = ref(false);

// Refs
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);
const dialogCardRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const inputTriggerRef = ref<HTMLElement | null>(null);

// Border constraints (in pixels from viewport edge)
const BORDER_MARGIN = 0;
const CARD_WIDTH = 440;
const CARD_HEIGHT = 400;

// Draggable functionality with constraints
const { x, y, style: draggableStyle, isDragging: vueuseDragging } = useDraggable(dialogCardRef, {
  handle: dragHandleRef,
  initialValue: { x: 0, y: 0 },
  onMove: (position) => {
    // Get viewport dimensions
    const maxX = window.innerWidth - CARD_WIDTH - BORDER_MARGIN;
    const maxY = window.innerHeight - CARD_HEIGHT - BORDER_MARGIN;

    // Constrain position
    position.x = Math.max(BORDER_MARGIN, Math.min(position.x, maxX));
    position.y = Math.max(BORDER_MARGIN, Math.min(position.y, maxY));

    return position;
  },
});

// Track dragging state
watch(vueuseDragging, (newVal) => {
  isDragging.value = newVal;
});

// When menu opens, focus the search input
watch(showMenu, (newVal) => {
  if (newVal) {
    nextTick(() => {
      placeSearchRef.value?.focus();
    });
  } else {
    // Reset sticky when menu closes
    isSticky.value = false;
  }
});

// When entering sticky mode, position near the trigger
watch(isSticky, (newVal) => {
  if (newVal && inputTriggerRef.value) {
    const rect = inputTriggerRef.value.getBoundingClientRect();

    // Calculate position with constraints
    const proposedX = rect.left + 10;
    const proposedY = rect.bottom + 10;

    const maxX = window.innerWidth - CARD_WIDTH - BORDER_MARGIN;
    const maxY = window.innerHeight - CARD_HEIGHT - BORDER_MARGIN;

    x.value = Math.max(BORDER_MARGIN, Math.min(proposedX, maxX));
    y.value = Math.max(BORDER_MARGIN, Math.min(proposedY, maxY));
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
  if (!isDragging.value) {
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

.draggable-search-container {
  position: fixed;
  z-index: 9000;
  /* Above most UI elements but below dialogs */
}
</style>

<template>
  <div class="q-ml-md q-mr-md" style="max-width: 140px; max-height: 40px">
    <!-- Readonly input field trigger -->
    <div ref="inputTriggerRef" id="select-place-search-location" style="flex: 1; position: relative">
      <q-input readonly model-value="" dense dark standout :placeholder="$t('search') + ' ...'" class="toolbar-font"
        @click="showMenu = true">
        <template v-slot:prepend>
          <q-icon @click="showMenu = true" class="text-icon cursor-pointer" size="sm">
            <IconEvaSearchOutline />
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- Non-sticky popup menu -->
    <q-menu v-if="!isSticky" :offset="[10, 1]" no-parent-event anchor="top start" target="#select-place-search-location"
      v-model="showMenu" transition-show="jump-down" transition-hide="jump-up">
      <div style="position: relative">
        <!-- Sticky/Close toggle buttons -->
        <div class="q-ma-xs z-top text-icon row q-gutter-xs" style="position: absolute; top: 6px; right: 6px">
          <!-- Lock/Unlock toggle -->
          <q-btn dense round flat color="primary-400" @click="toggleSticky">
            <q-icon size="sm">
              <IconEvaUnlockOutline />
            </q-icon>
            <q-tooltip :delay="1000">{{ $t('pin_something') }}</q-tooltip>
          </q-btn>
          <q-btn dense round @click="closeMenu" color="accent-700" icon="wd-close">
          </q-btn>
        </div>

        <!-- Search component (complete card) -->
        <WdPlaceSearch ref="placeSearchRef" @close="onSearchClose" />
      </div>
    </q-menu>

    <!-- Sticky draggable container (fixed positioning) -->
    <Teleport to="body">
      <div v-if="showMenu && isSticky" ref="dialogCardRef" class="draggable-search-container" :style="draggableStyle">
        <!-- Sticky/Close toggle buttons -->
        <div class="q-ma-xs z-top text-icon row q-gutter-xs" style="position: absolute; top: 6px; right: 6px">
          <!-- Drag handle (locked icon) - click to unpin if not dragging -->
          <q-btn dense round flat color="primary-400" ref="dragHandleRef" class="cursor-move"
            @click="handleDragHandleClick">
            <q-icon size="sm">
              <IconEvaMoveOutline />
            </q-icon>
            <q-tooltip :delay="2000">{{ $t('drag_to_move') }}</q-tooltip>
          </q-btn>
          <q-btn dense round @click="closeMenu" color="accent-700" icon="wd-close">
          </q-btn>
        </div>

        <!-- Search component (complete card) -->
        <WdPlaceSearch ref="placeSearchRef" @close="onSearchClose" />
      </div>
    </Teleport>
  </div>
</template>
