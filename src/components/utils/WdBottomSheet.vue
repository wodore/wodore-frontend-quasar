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
const currentSnapIndex = ref(2); // Track current snap index (starts at index 2 - initial)
const previousSnapIndex = ref(2); // Track previous snap index to detect dismissal from index 1

// Toolbar height (from Quasar toolbar)
const toolbarHeight = 330;

// Calculate snap points
// Index 3 (top): maxSnap
// Index 2 (initial): defaultSnap
// Index 1 (header only): 150px
// Index 0 (collapsed/dismissed): handled by swipe-to-dismiss
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
        currentSnapIndex.value = 2; // Reset to initial snap
        previousSnapIndex.value = 2; // Reset previous snap
      });
    } else {
      internalOpen.value = false;
      currentSnapIndex.value = 2;
      previousSnapIndex.value = 2;
    }
  },
  { immediate: true }
);

// Handle snap position changes
function handleSnapPositionChange(event: { detail: { sheetState: string; snapIndex: number } }) {
  const { sheetState, snapIndex } = event.detail;

  console.debug('[bottom-sheet] sheet state', sheetState);
  console.debug('[bottom-sheet] snap index', snapIndex);

  // Store previous index before updating
  previousSnapIndex.value = currentSnapIndex.value;
  currentSnapIndex.value = snapIndex;

  // Handle dismiss only when at index 0 (collapsed)
  // Only allow dismiss if user was previously at index 1 (header-only state)
  if (snapIndex === 0 && sheetState === 'collapsed' && previousSnapIndex.value === 1) {
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

bottom-sheet::part(footer) {
  z-index: 100;
}
</style>

<style>
/* Force the snap at index 1 (bottom) to always stop - prevents skipping from index 2 to 0 */
/* This needs to be unscoped to work with the web component's slotted content */
bottom-sheet [slot='snap'].bottom::before {
  scroll-snap-stop: always;
}
</style>

<template>
  <VBottomSheet
    v-if="internalOpen"
    :key="sheetKey"
    v-model="internalOpen"
    nested-scroll
    expand-to-scroll
    swipe-to-dismiss
    @snap-position-change="handleSnapPositionChange"
  >
    <!-- Snap points -->
    <div slot="snap" :style="{ '--snap': maxSnap }" class="top"></div>
    <div slot="snap" :style="{ '--snap': defaultSnap }" class="initial"></div>
    <div slot="snap" style="--snap: 150px" class="bottom"></div>

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
