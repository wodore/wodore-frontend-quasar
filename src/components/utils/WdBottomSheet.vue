<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VBottomSheet } from 'pure-web-bottom-sheet/vue';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const internalOpen = ref(false);

// Toolbar height (from Quasar toolbar)
const toolbarHeight = 330;

// Calculate snap points
// 370px from bottom = (100vh - 370px) from top
// On a 667px screen: 667 - 370 = 297px ≈ 44.5vh
// On a 844px screen: 844 - 370 = 474px ≈ 56.1vh
// Using 50vh as a reasonable approximation
const defaultSnap = '370px';

// Max height: 100vh - toolbar height
const maxSnap = `calc(100vh - ${toolbarHeight}px)`;

// Sync with v-model
watch(
  () => props.modelValue,
  open => {
    if (open) {
      nextTick(() => {
        internalOpen.value = true;
      });
    } else {
      internalOpen.value = false;
    }
  },
  { immediate: true }
);

// Handle snap position changes
function handleSnapPositionChange(event: { detail: { sheetState: string; snapIndex: number } }) {
  const { sheetState, snapIndex } = event.detail;

  // If sheet is collapsed (snapIndex 0, swiped down to bottom), close it
  if (snapIndex === 0 && sheetState === 'collapsed') {
    internalOpen.value = false;
    emit('update:modelValue', false);
    emit('close');
  }
}

// Force re-render when modelValue changes from false -> true
// This ensures content updates when navigating between huts
const sheetKey = computed(() => (props.modelValue ? 'open' : 'closed'));
</script>

<style scoped>
bottom-sheet {
  z-index: 10;
}
</style>

<template>
  <VBottomSheet
    v-if="internalOpen"
    :key="sheetKey"
    v-model="internalOpen"
    nested-scroll
    swipe-to-dismiss
    expand-to-scroll
    @snap-position-change="handleSnapPositionChange"
  >
    <!-- Snap points -->
    <div slot="snap" :style="{ '--snap': maxSnap }" class="top"></div>
    <div slot="snap" :style="{ '--snap': defaultSnap }" class="initial"></div>
    <div slot="snap" style="--snap: 150px"></div>

    <!-- Header -->
    <div slot="header" v-if="$slots.header">
      <slot name="header" />
    </div>

    <!-- Footer -->
    <div slot="footer" v-if="$slots.footer">
      <slot name="footer" />
    </div>

    <!-- Content -->
    <slot />
  </VBottomSheet>
</template>
