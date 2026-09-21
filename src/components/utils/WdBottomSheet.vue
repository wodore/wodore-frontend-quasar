<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { VBottomSheet } from 'pure-web-bottom-sheet/vue';
import type { BottomSheet, SnapToPointOptions } from 'pure-web-bottom-sheet';

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

// Snap index of the initial snap point (defaultSnap) - see snap point list above
const INITIAL_SNAP_INDEX = 2;

// Underlying <bottom-sheet> web component. VBottomSheet is a functional
// component, so the template ref binds to its rendered root element.
const sheetElement = ref<BottomSheet | null>(null);

/**
 * Snap the sheet back to its initial snap point (defaultSnap).
 *
 * Used when new content is opened while the sheet is already showing (e.g.
 * another hut is clicked on the map) so the new content is visible from the
 * top. Also resets the inner content scroll position. No-op while the sheet
 * is not mounted - fresh opens already start at the initial snap point.
 */
function snapToInitial(options?: SnapToPointOptions) {
  const sheet = sheetElement.value;
  if (!sheet) return;

  // Reset inner content scroll so newly loaded content starts at the top
  sheet.shadowRoot?.querySelector('.sheet-content')?.scrollTo({ top: 0 });

  sheet.snapToPoint(INITIAL_SNAP_INDEX, options);
}

defineExpose({ snapToInitial });
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

/*
 * On touch devices, let vertical touch gestures on the sheet content reach the
 * host scroll container while the sheet is not fully expanded.
 *
 * The library's WebKit workaround sets `touch-action: pan-y` on .sheet-content
 * (to guard the horizontal overflow scroller on iOS). But with expand-to-scroll,
 * .sheet-content has `overflow-y: hidden` when the sheet is not expanded, so
 * declaring `pan-y` hands vertical gestures to an element that cannot scroll -
 * the gesture is consumed and the host never receives it (the sheet cannot be
 * expanded by dragging the content).
 *
 * Fix: while the sheet is not expanded, reset touch-action to `auto`. Touch-action
 * restrictions apply along the whole ancestor chain of the touch target, so the
 * content must not declare ANY restriction (pan-x would block vertical panning of
 * the host in Blink/Gecko). With `auto`, vertical gestures scroll the nearest
 * y-scrollable ancestor - the host scroll container - which drives the CSS scroll
 * snap to expand the sheet. When the sheet IS expanded, the library's default
 * `touch-action: pan-y` applies and the content scrolls normally.
 *
 * Verified in Chromium touch emulation (see openspec fix-mobile-touch-scroll).
 * iOS Safari behavior still needs a real-device check.
 */
@media (pointer: coarse) {
  bottom-sheet[expand-to-scroll]:not([data-sheet-state='expanded'])::part(content) {
    touch-action: auto !important;
  }
}
</style>

<template>
  <VBottomSheet
    v-if="internalOpen"
    ref="sheetElement"
    :key="sheetKey"
    :style="{ '--sheet-max-height': maxSnap, '--sheet-border-radius': '24px' }"
    nested-scroll
    expand-to-scroll
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
