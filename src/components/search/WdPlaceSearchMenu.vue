<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useDraggable } from '@vueuse/core';
import WdPlaceSearch from './WdPlaceSearch.vue';

// State
const showMenu = ref(false);
const isSticky = ref(false);

// Refs
const placeSearchRef = ref<InstanceType<typeof WdPlaceSearch> | null>(null);
const dialogCardRef = ref<HTMLElement | null>(null);
const dragHandleRef = ref<HTMLElement | null>(null);
const inputTriggerRef = ref<HTMLElement | null>(null);

// Draggable functionality
const { x, y, style: draggableStyle } = useDraggable(dialogCardRef, {
  handle: dragHandleRef,
  initialValue: { x: 0, y: 0 },
});

// Calculate initial position based on input trigger
const initialPosition = computed(() => {
  if (!inputTriggerRef.value) return { top: 100, left: 100 };
  const rect = inputTriggerRef.value.getBoundingClientRect();
  return {
    top: rect.bottom + 10,
    left: rect.left + 10,
  };
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
      <div v-if="showMenu && isSticky" ref="dialogCardRef" class="draggable-search-container" :style="[
        draggableStyle,
        {
          top: `${initialPosition.top}px`,
          left: `${initialPosition.left}px`,
        }
      ]">
        <!-- Sticky/Close toggle buttons -->
        <div class="q-ma-xs z-top text-icon row q-gutter-xs" style="position: absolute; top: 6px; right: 6px">
          <!-- Drag handle (locked icon) -->
          <q-btn v-if="isSticky" dense round flat color="primary-400" ref="dragHandleRef" class="cursor-move"
            @click="toggleSticky">
            <q-icon size="sm" color="accent">
              <IconEvaMoveOutline />
            </q-icon>
            <q-tooltip :delay="2000">{{ $t('drag_to_move') }}</q-tooltip>
          </q-btn>
          <!-- Unlock button -->
          <q-btn v-else dense round flat color="primary-400" @click="toggleSticky">
            <q-icon size="sm">
              <IconEvaUnlockOutline />
            </q-icon>
            <q-tooltip :delay="1000">{{ $t('unpin_something') }}</q-tooltip>
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
