<script lang="ts">
// Module scope — survives close/reopen of the panel: the minimized state
// STICKS across hut opens (owner 2026-10: "if minimized open next
// minimized as well, if larger then open maximized"). Default: minimized.
import { ref as moduleRef } from 'vue';
const sessionMinimized = moduleRef(true);

/**
 * Deep-link entry (owner 2026-10): a page load that lands directly on a
 * hut route (shared link, search engine) opens the card MAXIMIZED — only
 * map-first sessions start minimized. Called once from MainLayout's
 * setup when the INITIAL route is a hut route.
 */
export function openContentPanelMaximized(): void {
  sessionMinimized.value = false;
}
</script>
<script setup lang="ts">
/**
 * WdContentPanel — the desktop hut-details panel.
 *
 * Design (owner + UX consult 2026-10): a LEFT-anchored floating card that
 * OVERLAYS the map (the map canvas never shrinks/reflows when a hut
 * opens — the opposite of the docked drawer it replaces). It is the
 * desktop sibling of the mobile bottom sheet: same slot composition
 * (header title / content / footer actions), sheet-family tokens
 * (16px radius, the one granted over-imagery shadow) per DESIGN.md
 * "chrome floats over the map in compact panels".
 *
 * Size choreography (owner spec, refined 2026-10):
 * - Width fixed via --wd-panel-w (380px, 460px ≥1440) — the same slot the
 *   topbar pill reserves, so pill and card never collide.
 * - Expanded height = clamp(330px, content, 100dvh − 80px): the cap
 *   keeps the card clear of the bottom-left map chrome (scale at ~55px,
 *   attribution below it) so attribution NEVER needs an inset (owner
 *   2026-10); beyond the cap the body scrolls.
 * - MINIMIZE (owner revision 2026-10): no separate composition — the SAME
 *   normal content view, just clamped to a small height (300px) and
 *   scrollable. The open-monthly year stripe + type badges are the first
 *   things visible; bed counts appear exactly once. The gallery renders
 *   its MOBILE stripe variant while minimized (WdMediaPreview consumes
 *   the provided flag) and the desktop gallery when maximized.
 * - DEFAULT OPEN = MINIMIZED, and the state STICKS: the next hut opens
 *   the way the last one was left (module-scope ref survives close/
 *   reopen, owner 2026-10).
 * - Height changes animate (200ms, the app's control easing). Shrinks are
 *   DEBOUNCED (180ms) and only applied when stable — content swaps and
 *   skeleton→real loads must not make the card dip small and grow back
 *   (owner report 2026-10); growth applies immediately.
 *
 * a11y: NON-modal (the map stays interactive) — role="dialog" with
 * aria-modal="false", no focus trap; ESC closes; focus moves to the
 * panel on open and back to the triggering element on close.
 */
import { ref, computed, watch, nextTick, provide, type Ref } from 'vue';
import { useEventListener, useResizeObserver, useWindowSize } from '@vueuse/core';
import { usePlace } from '@composables/usePlace';
import { useWeatherPossible } from '@composables/useWeatherPossible';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';

interface Props {
  /** Open state (v-model) */
  modelValue: boolean;
  /** Place slug — drives the minimized strips + aria label */
  slug?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { t } = useI18n();
const $q = useQuasar();

// Place label only (no stripped-down composition anymore — the
// minimized state renders the SAME content view, just clamped).
const place = usePlace(computed(() => props.slug)).place;

// ── State ─────────────────────────────────────────────────────────────
const minimized = sessionMinimized;
const headerScrolled = ref(false);

const panelEl = ref<HTMLElement | null>(null);
const headerEl = ref<HTMLElement | null>(null);
const footerEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const scrollRef = ref<{
  setScrollPosition: (axis: 'vertical', offset: number, duration?: number) => void;
} | null>(null);

function toggleMinimized(): void {
  minimized.value = !minimized.value;
  if (minimized.value) headerScrolled.value = false;
  resetUpScrollAccum(); // user intent — bypass the shrink debounce
  applyHeightNow(); // user intent — bypass the shrink debounce
}

function close(): void {
  emit('update:modelValue', false);
}

// ── Measured size choreography ────────────────────────────────────────
// Panel height is set explicitly (px) so EVERY size change animates:
// minimize/expand, content growing as it loads, and the re-target when
// another hut is clicked (content swaps in place — no close/reopen).
// ResizeObservers keep the numbers live; the inner elements stay laid
// out while collapsed (clipped, not display:none) so measurement never
// goes blind.
const { height: winH } = useWindowSize();
const TOP_GAP = 12; // aligns the card's top with the pill's top datum
// Bottom gap clears the bottom-left map chrome (scale ~55px + attribution
// below it) so the card never covers it — attribution/scale stay put at
// bottom-left, no map inset needed (owner 2026-10).
const BOTTOM_GAP = 68;

// ── Expanded floor: the KNOWN blocks (owner 2026-10) ──────────────
// Gallery (3:2 of the content width), weather and location are
// deterministic — the panel never opens smaller than chrome + those.
// Description and availability are the DYNAMIC part: they add height
// (up to the cap, then scroll). Heights measured on the live panel
// (2026-10) — keep in sync with WdPlaceContent's reserved blocks.
const STRIPE_BLOCK = 20; // open-monthly year stripe
const BADGES_BLOCK = 40; // type badges line + margin
const WEATHER_BLOCK = 157;
const LOCATION_BLOCK = 80; // section title + coordinates item
const BLOCK_GAPS = 36; // inter-block margins/padding
const HEADER_FALLBACK = 85;
const FOOTER_FALLBACK = 50;

const panelWidthPx = computed(() => ($q.screen.gt.md ? 460 : 380));
const galleryBlockPx = computed(() => ((panelWidthPx.value - 24) * 2) / 3); // 3:2

// Weather exists only within ±14 days of the selected date (no date =
// today → exists). When the picked date is outside that horizon, the
// weather block never renders — the expanded floor must drop its
// height too, or every far-date hut opens ~157px too tall (owner
// 2026-10).
const weatherPossible = useWeatherPossible();
const weatherBlockPx = computed(() => (weatherPossible.value ? WEATHER_BLOCK : 0));

const headerH = ref(0);
const footerH = ref(0);
const contentH = ref(0);

// Measure BORDER-BOX heights. ResizeObserver's entry.contentRect is the
// content box — padding excluded — which systematically undercounted the
// header/footer and clipped the footer in the minimized state (owner
// report 2026-10). getBoundingClientRect on the watched element is the
// border-box size the height math actually needs.
function observeBox(el: Ref<HTMLElement | null>, store: Ref<number>): void {
  useResizeObserver(el, () => {
    store.value = el.value?.getBoundingClientRect().height ?? 0;
  });
}

observeBox(headerEl, headerH);
observeBox(footerEl, footerH);
observeBox(contentEl, contentH);

const maxCap = computed(() => Math.max(winH.value - TOP_GAP - BOTTOM_GAP, 200));
const minimizedH = computed(() =>
  Math.min(
    Math.max(
      305, // "normal view, small height": stripe + badges + gallery stripe
      // (owner revision 2026-10: −15px — the minimized footer's
      // availability dots now carry part of the glance signal)
      Math.max(headerH.value, HEADER_FALLBACK) +
        STRIPE_BLOCK +
        BADGES_BLOCK +
        95 + // mobile gallery stripe slot
        Math.max(footerH.value, FOOTER_FALLBACK) +
        BLOCK_GAPS
    ),
    maxCap.value
  )
);
const knownFloor = computed(
  () =>
    Math.max(headerH.value, HEADER_FALLBACK) +
    STRIPE_BLOCK +
    BADGES_BLOCK +
    galleryBlockPx.value +
    weatherBlockPx.value +
    LOCATION_BLOCK +
    Math.max(footerH.value, FOOTER_FALLBACK) +
    BLOCK_GAPS
);
const expandedH = computed(() =>
  Math.min(Math.max(knownFloor.value, headerH.value + contentH.value + footerH.value), maxCap.value)
);
const panelHeight = computed(() => (minimized.value ? minimizedH.value : expandedH.value));

// ── Stable height application ───────────────────────────────────────
// GROWTH applies immediately (snappy); SHRINKS are debounced 180ms so a
// transient dip (content swap fade, skeleton→real load) never renders —
// the card must not "get small, load, then increase again" (owner
// report 2026-10). User-initiated minimize/expand bypasses the debounce
// entirely — those are intentional, not noise.
const appliedH = ref<number>(0);
let shrinkTimer: ReturnType<typeof setTimeout> | null = null;

function applyHeightNow(): void {
  if (shrinkTimer !== null) {
    clearTimeout(shrinkTimer);
    shrinkTimer = null;
  }
  appliedH.value = Math.ceil(panelHeight.value);
}

watch(
  panelHeight,
  target => {
    const t = Math.ceil(target);
    if (t >= appliedH.value) {
      applyHeightNow();
    } else {
      if (shrinkTimer !== null) clearTimeout(shrinkTimer);
      shrinkTimer = setTimeout(applyHeightNow, 180);
    }
  },
  { immediate: true }
);

// ── Scroll: header shadow + auto-maximize + scroll-up-to-minimize ───
function onScroll(info: { verticalPosition?: number }): void {
  const position = info.verticalPosition ?? 0;
  contentAtTop.value = position <= 2;
  if (!minimized.value) headerScrolled.value = position > 2;
}

const contentAtTop = ref(true);
// Scroll-up intent accumulator: minimize only on a DELIBERATE up-scroll
// at the top (tolerance ~240px of wheel delta — not every tiny nudge)
let upScrollAccum = 0;

function resetUpScrollAccum(): void {
  upScrollAccum = 0;
}

// Scroll intent, captured at the window level so portaled children and
// stopPropagation-happy inner elements cannot swallow it. A GESTURE LOCK
// guards both directions: one continuous wheel stream (a flick has many
// events) may change the minimized state ONCE — without the lock the
// tail of the very gesture that minimized immediately maximizes again
// (owner report: "scroll up does not work"). A new gesture begins after
// a 300ms quiet gap.
// - MINIMIZED + wheel/touch/scroll-keys inside → maximize
// - EXPANDED + wheel UP while scrolled fully up → minimize, with a
//   ~240px cumulative delta tolerance so tiny nudges don't fire
const WHEEL_GESTURE_GAP_MS = 300;
const MINIMIZE_UP_DELTA_PX = 240;
let lastWheelTs = 0;
let scrollIntentLock = false;

function onWheelIntent(e: WheelEvent): void {
  const panel = panelEl.value;
  if (!panel || !e.composedPath().includes(panel)) return;

  const now = Date.now();
  if (now - lastWheelTs > WHEEL_GESTURE_GAP_MS) {
    // Fresh gesture: release the lock and start accumulating anew
    scrollIntentLock = false;
    resetUpScrollAccum();
  }
  lastWheelTs = now;

  if (scrollIntentLock) return; // state already changed by this gesture

  if (minimized.value) {
    minimized.value = false;
    scrollIntentLock = true; // the rest of this gesture may only scroll
    return;
  }
  if (e.deltaY >= 0 || !contentAtTop.value) {
    resetUpScrollAccum();
    return;
  }
  upScrollAccum += Math.abs(e.deltaY);
  if (upScrollAccum >= MINIMIZE_UP_DELTA_PX) {
    minimized.value = true;
    headerScrolled.value = false;
    resetUpScrollAccum();
    scrollIntentLock = true;
    applyHeightNow();
  }
}

function onTouchIntent(e: Event): void {
  const panel = panelEl.value;
  if (minimized.value && panel && e.composedPath().includes(panel)) {
    minimized.value = false;
    scrollIntentLock = true; // one state change per touch gesture
  }
}

useEventListener(window, 'wheel', onWheelIntent, { capture: true, passive: true });
useEventListener(window, 'touchmove', onTouchIntent, { capture: true, passive: true });
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (
    minimized.value &&
    ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End'].includes(e.key) &&
    panelEl.value?.contains(document.activeElement)
  ) {
    minimized.value = false;
  }
});

// Expose the minimized state to content components: WdMediaPreview
// renders its mobile gallery stripe while the panel is minimized and
// WdPlaceActions gates the availability dots on it (owner 2026-10).
provide('wdContentPanelMinimized', minimized);

// Maximize callback for injected consumers (the footer availability dots
// maximize the card on click — owner 2026-10).
function maximizePanel(): void {
  minimized.value = false;
  scrollIntentLock = true; // one state change per gesture
  applyHeightNow();
}
provide('wdContentPanelMaximize', maximizePanel);

// ── a11y: ESC closes; focus in on open, back to trigger on close ──────
let previouslyFocused: HTMLElement | null = null;

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (props.modelValue && e.key === 'Escape') {
    e.stopPropagation();
    close();
  }
});

watch(
  () => props.modelValue,
  open => {
    if (open) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // NOTE: the minimized state intentionally persists — a fresh open
      // starts the way the previous card was left (owner 2026-10).
      nextTick(() => panelEl.value?.focus({ preventScroll: true }));
    } else {
      previouslyFocused?.focus?.({ preventScroll: true });
      previouslyFocused = null;
    }
  }
);

// New hut while open (re-target): keep the current minimized state —
// "if minimized open next minimized as well, if larger then open
// maximized" (owner 2026-10) — and reset the scroll + scroll-intent
// accumulator.
watch(
  () => props.slug,
  () => {
    if (props.modelValue) {
      resetUpScrollAccum();
      onContentChanged();
    }
  }
);

/**
 * Reset the body scroll so newly targeted content starts at the top.
 * Called by MainLayout when the slug changes while the panel is open
 * (mirrors WdBottomSheet.onContentChanged).
 */
function onContentChanged(): void {
  scrollRef.value?.setScrollPosition('vertical', 0);
}
defineExpose({ onContentChanged });

const panelLabel = computed(() => place.value?.name ?? t('hut.hut'));
</script>

<template>
  <transition name="wd-cpanel">
    <div
      v-if="modelValue"
      ref="panelEl"
      class="wd-content-panel"
      :class="{
        'wd-content-panel--min': minimized,
        'wd-content-panel--scrolled': headerScrolled,
      }"
      :style="{ height: appliedH + 'px' }"
      role="dialog"
      aria-modal="false"
      :aria-label="panelLabel"
      tabindex="-1"
    >
      <!-- Header: title + minimize/close controls (owner: max/min next to
           the close button; chevron = state, × = dismiss — never conflate) -->
      <div ref="headerEl" class="wd-content-panel__header">
        <div class="wd-content-panel__title">
          <slot name="header" />
        </div>
        <div class="wd-content-panel__ctrls">
          <!-- Close is the header's ONLY verb now (UX consult 2026-10): a
               minimize chevron next to close was a mis-click footgun —
               collapse lives on the footer handle + scroll gestures. -->
          <q-btn flat round dense icon="wd-close" :aria-label="$t('close')" @click="close" />
        </div>
      </div>

      <!-- Scrollable body: the SAME content router-view in BOTH states —
           minimized just clamps the height ("normal view, small height",
           owner 2026-10): the open-monthly year stripe and type badges
           lead the view; bed counts appear exactly once -->
      <q-scroll-area
        ref="scrollRef"
        visible
        class="wd-content-panel__body"
        :thumb-style="{
          width: '6px',
          backgroundColor: 'rgba(var(--wd-ink-rgb), 0.3)',
          borderRadius: '8px 0 0 8px',
        }"
        @scroll="onScroll"
      >
        <div ref="contentEl" class="wd-content-panel__content">
          <slot />
        </div>
      </q-scroll-area>

      <!-- Footer: actions toolbar at the bottom (WdPlaceActions draws its
           own hairline). The centered minimize chevron sits exactly ON the
           footer's top line (owner 2026-10) — same verb as the header
           chevron, mirrored. -->
      <div ref="footerEl" class="wd-content-panel__footer">
        <q-btn
          round
          dense
          flat
          class="wd-content-panel__footer-min"
          :icon="minimized ? 'wd-arrowhead-down' : 'wd-arrowhead-up'"
          :aria-label="minimized ? $t('maximize') : $t('minimize')"
          :title="minimized ? $t('maximize') : $t('minimize')"
          @click="toggleMinimized"
        />
        <slot name="footer" />
      </div>
    </div>
  </transition>
</template>

<style lang="scss" scoped>
.wd-content-panel {
  position: fixed;
  left: calc(12px + env(safe-area-inset-left, 0px));
  top: calc(12px + env(safe-area-inset-top, 0px));
  width: var(--wd-panel-w, 380px);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 16px; // sheet/dialog ramp step — this is a floating sheet
  background: var(--wd-surface);
  color: var(--wd-ink);
  // The one granted over-imagery shadow (Tonal Layer Rule exception)
  box-shadow: 0 1px 3px rgba(10, 20, 15, 0.2);
  outline: none; // focus lands on the panel root (non-modal, labelled)

  // Every size change animates: minimize/expand, late-loading content,
  // and the re-target when another hut is clicked
  transition: height 0.2s cubic-bezier(0.2, 0, 0, 1);
}

// Scroll thumb: tonal ink, not gold — the Head-Torch Rule reserves gold
// for scarce emphasis (availability accents, favorite); chrome scrolls
// speak in ridge/ink tones (DESIGN.md, UX review 2026-10). The rgba uses
// --wd-ink-rgb so the thumb adapts to both lighting conditions.

.wd-content-panel__header {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 6px 4px 12px;
  border-bottom: 1px solid transparent;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

// Content visibly slides UNDER the header once scrolled (port of the
// drawer's content-drawer-header-scrolled behavior)
.wd-content-panel--scrolled .wd-content-panel__header {
  background: var(--wd-surface-deep);
  border-bottom-color: rgba(var(--wd-ink-rgb), 0.16);
}

.wd-content-panel__title {
  flex: 1 1 auto;
  min-width: 0;
}

.wd-content-panel__ctrls {
  flex: none;
  display: flex;
  gap: 2px;
  padding-top: 2px;

  // Minimize/close are the card's primary verbs — give them the design
  // system's ≥40px control target (DESIGN.md layout rules; UX review
  // 2026-10) while keeping the icons optically small (~18px).
  :deep(.q-btn) {
    width: 40px;
    height: 40px;

    .q-icon {
      font-size: 18px;
    }
  }
}

// ── Body: takes whatever the animated panel height leaves it; the
//     minimized state is the SAME view at a clamped height (300px) —
//     the open-monthly year stripe leads, content scrolls inside ──
.wd-content-panel__body {
  flex: 1 1 0;
  min-height: 0;

  // Width containment (owner report 2026-10: gallery "very wide").
  // QScrollArea's (Quasar v2 — re-check on a Quasar major upgrade)
  // content container is position:absolute with
  // min-width:100% — an absolutely positioned block SHRINKS TO FIT its
  // content, so a wide-intrinsic child (the image gallery's Swiper track
  // laid out at natural size, ~25k px) grows it far beyond the panel and
  // the whole content chain overflows. Pinning the scroll content to the
  // container width caps the chain — the same containment the retired
  // drawer's q-page(maxWidth) provided. NOTE: wide content (availability
  // and weather tables) must own its horizontal overflow (overflow-x)
  // since the scroll area no longer scrolls horizontally.
  :deep(.q-scrollarea__content) {
    width: 100%;
  }
}

.wd-content-panel--min .wd-content-panel__body {
  overflow: hidden;
}

.wd-content-panel__content {
  padding: 4px 12px 8px;
}

// ── Footer: WdPlaceActions' toolbar draws its own hairline; the centered
//     minimize chevron rides exactly on that line ───────────────────
.wd-content-panel__footer {
  flex: none;
  position: relative;
}

.wd-content-panel__footer-min {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: 40px; // THE state control now (header chevron retired) — meets
  height: 40px; // the control-target rule (UX consult 2026-10)
  background: var(--wd-surface);
  border: 1px solid var(--wd-ridge);
  color: var(--wd-ink-soft);

  :deep(.q-icon) {
    font-size: 18px;
  }
}

// ── Open/close: slide in from the anchored edge + fade (140ms, matches
//     the spec'd drawer slide) ─────────────────────────────────────────
.wd-cpanel-enter-active,
.wd-cpanel-leave-active {
  transition:
    transform 0.14s cubic-bezier(0.2, 0, 0, 1),
    opacity 0.14s cubic-bezier(0.2, 0, 0, 1);
}

.wd-cpanel-enter-from,
.wd-cpanel-leave-to {
  transform: translateX(-8px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wd-content-panel,
  .wd-content-panel__strips,
  .wd-cpanel-enter-active,
  .wd-cpanel-leave-active {
    transition: none;
  }
}
</style>
