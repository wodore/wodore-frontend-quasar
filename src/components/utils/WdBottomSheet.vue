<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VBottomSheet } from 'pure-web-bottom-sheet/vue';
import type { BottomSheet } from 'pure-web-bottom-sheet';

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

// Toolbar height (from Quasar toolbar)
const toolbarHeight = 50;

// Calculate snap points
// Index 5 (top): maxSnap
// Index 4: 80vh
// Index 3: 60vh
// Index 2 (initial): defaultSnap
// Index 1 (header only): 150px
// Index 0 (collapsed/dismissed): handled by swipe-to-dismiss
const defaultSnap = '330px';

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
      });
    } else {
      internalOpen.value = false;
      currentSnapIndex.value = 2;
    }
  },
  { immediate: true }
);

// Handle snap position changes
function handleSnapPositionChange(event: { detail: { sheetState: string; snapIndex: number } }) {
  const { sheetState, snapIndex } = event.detail;

  console.debug('[bottom-sheet] sheet state', sheetState);
  console.debug('[bottom-sheet] snap index', snapIndex);

  currentSnapIndex.value = snapIndex;

  // The sheet is dismissed whenever it reaches the collapsed state at the
  // bottom snap. Any gesture path that ends here (fast fling from above or a
  // swipe from the header-only snap) must close the sheet - gating on the
  // previous snap index missed fast flings and left the app in a state where
  // the sheet was visually gone but still considered open.
  if (snapIndex === 0 && sheetState === 'collapsed') {
    internalOpen.value = false;
    emit('update:modelValue', false);
    emit('close');
  }
}

// Force re-render when modelValue changes from false -> true
// This ensures content updates when navigating between huts
const sheetKey = computed(() => (props.modelValue ? 'open' : 'closed'));

// Snap index of the initial snap point (defaultSnap) - see snap point list above

// Underlying <bottom-sheet> web component. VBottomSheet is a functional
// component, so the template ref binds to its rendered root element.
const sheetElement = ref<BottomSheet | null>(null);

/**
 * Reset the inner content scroll so newly loaded content starts at the top.
 *
 * Called when new content is opened while the sheet is already showing (e.g.
 * another hut is selected on the map). The sheet's snap position is kept as
 * requested - only the content scroll position is reset. No-op while the
 * sheet is not mounted - fresh opens already start at the initial snap point.
 */
function onContentChanged() {
  const sheet = sheetElement.value;
  if (!sheet) return;

  sheet.shadowRoot?.querySelector('.sheet-content')?.scrollTo({ top: 0 });
}

defineExpose({ onContentChanged });
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
    ref="sheetElement"
    :key="sheetKey"
    :style="{ '--sheet-max-height': maxSnap, '--sheet-border-radius': '24px' }"
    nested-scroll
    swipe-to-dismiss
    @snap-position-change="handleSnapPositionChange"
  >
    <!-- Snap points -->
    <div slot="snap" style="--snap: 80vh"></div>
    <div slot="snap" style="--snap: 60vh"></div>
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
