<script setup lang="ts">
import { ref, watch, nextTick, computed, useTemplateRef } from 'vue';
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

// Toolbar height (from Quasar toolbar)
const toolbarHeight = 50;

// Safe area insets (native app: bottom nav bar, status bar). In the PWA
// these evaluate to 0 and all snap points reduce to their base values.
const safeBottom = 'var(--q-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))';

// Calculate snap points
// Index 4 (top): maxSnap
// Index 3: 70vh
// Index 2 (initial): defaultSnap
// Index 1 (header only): 150px
// Index 0 (collapsed/dismissed): handled by swipe-to-dismiss
const defaultSnap = `calc(330px + ${safeBottom})`;

// Max height: visible viewport minus toolbar (dvh = dynamic viewport, so the
// sheet stops right at the app toolbar on mobile instead of overshooting
// it). In the native app the header sits below the status bar
// (edge-to-edge), so its safe-area inset must be subtracted too — in the
// PWA the inset is 0 and the behavior is unchanged.
const maxSnap = `calc(100dvh - ${toolbarHeight}px - var(--q-safe-area-inset-top, env(safe-area-inset-top, 0px)))`;

// Sync with v-model
watch(
  () => props.modelValue,
  open => {
    if (open) {
      nextTick(() => {
        internalOpen.value = true;
        reachedSnapAfterOpen.value = false;
      });
    } else {
      internalOpen.value = false;
    }
  },
  { immediate: true }
);

// Whether the sheet has reached a real snap position since it opened. The
// web component mounts its host scroll container at scrollTop 0 - which is
// the collapsed position - and can emit one collapsed@0 event during the
// initial snap animation. Dismissing on that artifact would instantly
// self-close the freshly opened sheet (seen on real devices).
const reachedSnapAfterOpen = ref(false);
const INITIAL_SNAP_INDEX = 2;

// Handle snap position changes
function handleSnapPositionChange(event: { detail: { sheetState: string; snapIndex: number } }) {
  const { sheetState, snapIndex } = event.detail;

  console.debug('[bottom-sheet] sheet state', sheetState);
  console.debug('[bottom-sheet] snap index', snapIndex);

  // The sheet is dismissed whenever it reaches the collapsed state at the
  // bottom snap. Any gesture path that ends here (fast fling from above or a
  // swipe from the header-only snap) must close the sheet - gating on the
  // previous snap index missed fast flings and left the app in a state where
  // the sheet was visually gone but still considered open.
  if (snapIndex === 0 && sheetState === 'collapsed') {
    if (!reachedSnapAfterOpen.value) return; // mount artifact, see above
    internalOpen.value = false;
    emit('update:modelValue', false);
    emit('close');
    return;
  }
  reachedSnapAfterOpen.value = true;
}

// Force re-render when modelValue changes from false -> true
// This ensures content updates when navigating between huts
const sheetKey = computed(() => (props.modelValue ? 'open' : 'closed'));

// Snap index of the initial snap point (defaultSnap) - see snap point list above

// Underlying <bottom-sheet> web component. VBottomSheet is a functional
// component, so the template ref binds to its rendered root element.
const sheetElement = useTemplateRef<BottomSheet>('sheetElement');

// Shadow state for the header slot: elevated once the content is scrolled
const contentScrolled = ref(false);
let detachContentScroll: (() => void) | null = null;

function onContentScroll(event: Event): void {
  const target = event.target as { scrollTop?: number } | null;
  // Tolerance 10px: the snap animation and subpixel rounding can leave
  // a few px of scrollTop on a fresh open - the line must not show
  // before the user actually scrolled (owner report)
  const scrolled = (target?.scrollTop ?? 0) > 10;
  if (scrolled === contentScrolled.value) return;
  contentScrolled.value = scrolled;
  sheetElement.value?.toggleAttribute('data-content-scrolled', scrolled);
}

function attachContentScrollListener(sheet: BottomSheet): void {
  // The sheet's own content element...
  const element = sheet.shadowRoot?.querySelector('.sheet-content');
  // ...AND the slotted app content's scroller: on hut pages the real
  // scrolling happens inside the slot (q-scrollarea), not in
  // .sheet-content - without this listener the scrolled header state
  // never fires on mobile (owner report: header line "still barely
  // visible" - it literally never appeared).
  const slottedScroller = sheet.querySelector<HTMLElement>(
    '.q-scrollarea__container, .q-drawer__content, .overlay-scroll'
  );
  // NEVER use the host's own scrollTop as the signal: on this sheet the
  // host scroll IS the snap position (330px at the peek snap, max when
  // expanded - measured live), so host-based detection showed the line
  // on every fresh open. Content scroll happens in .sheet-content
  // (nested-scroll mode) or the slotted scroller only.
  const targets = [element, slottedScroller].filter(Boolean) as HTMLElement[];
  for (const t of targets) t.addEventListener('scroll', onContentScroll, { passive: true });
  detachContentScroll = () => {
    for (const t of targets) t.removeEventListener('scroll', onContentScroll);
  };
  sheet.toggleAttribute(
    'data-content-scrolled',
    targets.some((t) => t.scrollTop > 10)
  );
}

/**
 * Arm a freshly mounted sheet: attach the content scroll listener and snap
 * to the initial position.
 *
 * The web component builds its shadow DOM and slotted snap points
 * asynchronously after connection - immediately after mount the shadow may
 * not exist and snapToPoint would silently do nothing (index out of range),
 * leaving the sheet invisible at the collapsed position. Poll briefly until
 * the shadow is ready.
 */
let armTimer: ReturnType<typeof setTimeout> | null = null;

function armFreshSheet(): void {
  const sheet = sheetElement.value;
  if (!sheet) return;

  const tryArm = (remaining: number) => {
    // The sheet may have been closed again while polling
    if (!internalOpen.value) return;
    const element = sheet.shadowRoot?.querySelector('.sheet-content');
    if (!element) {
      if (remaining > 0) {
        armTimer = setTimeout(() => tryArm(remaining - 1), 100);
      } else {
        console.debug('[bottom-sheet] shadow content never appeared');
      }
      return;
    }
    attachContentScrollListener(sheet);
    sheet.snapToPoint(INITIAL_SNAP_INDEX);
  };
  tryArm(20);
}

function detachContentScrollListener(): void {
  if (armTimer !== null) {
    clearTimeout(armTimer);
    armTimer = null;
  }
  detachContentScroll?.();
  detachContentScroll = null;
}

watch(
  internalOpen,
  open => {
    if (open) {
      // flush: post - the element must exist before we can reach into it
      armFreshSheet();
    } else {
      detachContentScrollListener();
    }
  },
  { flush: 'post' }
);

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

/*
 * On touch devices, let vertical touch gestures on the sheet content reach
 * the host scroll container while the sheet is not fully expanded.
 *
 * With expand-to-scroll the sheet must be expandable by dragging its content:
 * the library sets `touch-action: pan-y` on .sheet-content (WebKit overflow
 * guard), but .sheet-content has `overflow-y: hidden` while the sheet is not
 * expanded - so `pan-y` hands vertical gestures to an element that cannot
 * scroll and the gesture dies before the host can expand the sheet.
 *
 * While the sheet is not expanded, reset touch-action to `auto`: vertical
 * gestures then scroll the nearest y-scrollable ancestor - the host scroll
 * container - which drives the CSS scroll snap to expand the sheet. Once the
 * sheet IS expanded, the library default applies and the content scrolls
 * normally. Touch-action restrictions apply along the whole ancestor chain,
 * so no other restriction may be reintroduced in between.
 */
@media (pointer: coarse) {
  bottom-sheet[expand-to-scroll]:not([data-sheet-state='expanded'])::part(content) {
    touch-action: auto !important;
  }
}

/*
 * Guarantee scrollability at the expanded state.
 *
 * The library toggles .sheet-content overflow-y with a scroll-timeline
 * animation (hidden until the host scroll reaches exactly 100%). On real
 * touch devices the settled scroll position can be a fraction off the
 * maximum (dynamic viewport rounding, momentum), so the timeline never
 * completes and the content stays unscrollable. Force it open.
 */
bottom-sheet[expand-to-scroll][data-sheet-state='expanded']::part(content) {
  overflow-y: auto !important;
}

/*
 * Rounded top corners while partially open, square top edge when expanded.
 * The border-radius transition animates the change; the :host shadow rules
 * use the same properties, document styles on the host element win.
 */
bottom-sheet {
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  /* Theme the sheet surface: the web component defaults to light grey
     (#f2f2f2) via --sheet-background; route it through the surface token
     so the mobile hut sheet follows Day/Night. */
  --sheet-background: var(--wd-surface);
  color: var(--wd-ink);
  transition:
    border-top-left-radius 0.25s ease,
    border-top-right-radius 0.25s ease;
}

bottom-sheet[data-sheet-state='expanded'] {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

/*
 * Header elevation: the header gets a drop shadow once the content is
 * scrolled (standard mobile app-bar pattern). The shadow lives on the
 * shadow-DOM header element itself and the header is elevated with z-index,
 * otherwise later-painted content (the photo gallery) covers the shadow.
 * The attribute is toggled by the component's content scroll listener.
 */

/*
 * Slotted app content inherits box-sizing through the flattened (shadow)
 * tree, where the document-wide border-box reset does not reach. Without
 * this, padded bars (e.g. the footer q-toolbar) overflow the sheet by their
 * own padding and push buttons off-screen.
 */
bottom-sheet * {
  box-sizing: border-box;
}

/*
 * Native app (capacitor): lift the footer toolbar above the Android
 * navigation bar. The sheet surface fills the bar zone behind it —
 * empty space in the navigation area, buttons never inside it.
 */
body.capacitor bottom-sheet::part(footer) {
  padding-bottom: var(--q-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
}
</style>
<style>
/*
 * Scrolled sheet header - UNSCOPED on purpose: the scoped data-v
 * attribute never lands on the custom-element host, so the previous
 * ::part(header) rules (shadow, then line) were dead CSS - the header
 * treatment literally never rendered. Same language as the desktop
 * drawer header: surface-deep + 16%-ink line when scrolled.
 */
bottom-sheet::part(header) {
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

bottom-sheet[data-content-scrolled]::part(header) {
  background: var(--wd-surface-deep);
  border-bottom-color: rgba(var(--wd-ink-rgb), 0.16);
  box-shadow: none;
  z-index: 10;
}
</style>

<template>
  <VBottomSheet
    v-if="internalOpen"
    ref="sheetElement"
    :key="sheetKey"
    :style="{ '--sheet-max-height': maxSnap }"
    nested-scroll
    expand-to-scroll
    swipe-to-dismiss
    @snap-position-change="handleSnapPositionChange"
  >
    <!-- Snap points (safe-area-inset-bottom keeps content above the
         Android navigation bar in the native app) -->
    <div slot="snap" :style="{ '--snap': `calc(70vh + ${safeBottom})` }"></div>
    <div slot="snap" :style="{ '--snap': defaultSnap }" class="initial"></div>
    <div slot="snap" :style="{ '--snap': `calc(150px + ${safeBottom})` }" class="bottom"></div>

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
