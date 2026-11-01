<script setup lang="ts">
/**
 * WdMapPopup — the anchored popup shell (OpenSpec `add-place-interactions`,
 * capability `place-popup`). Mounted ONCE in MainLayout as a sibling of the
 * map (survives engine identity switches); teleports to body to escape the
 * map container's overflow/stacking.
 *
 * Chrome (Opus UX spec 2026-11-01): NO dedicated header row — the close
 * button floats absolute at the card's top-right corner; the content's
 * first row clears it via padding-right. Card sizing: min-width 232px
 * (consistent feel), max-width clamped to viewport. Edge treatment:
 * ridge hairline + the sanctioned over-map shadow (DESIGN.md approved
 * exception for chrome floating over imagery).
 *
 * Candidates (owner #5): a collapsible list replaces the 1/n cycling
 * chip. Collapsed shows "n of m stops" + chevron; expanded lists each
 * candidate (click to select). Re-anchors on toggle (dirty flag).
 *
 * Anchoring (rAF discipline, place-popup spec): the adapter's projector
 * returns VIEWPORT px; map `move` events set a dirty flag; ONE rAF loop
 * drains the flag while open. Position writes are IMPERATIVE style
 * transforms. clampToViewport keeps the card clear of chrome insets,
 * flipping above/below the pin. transform-origin sits at the PIN's
 * x-offset (pop-from-the-dot). Measurement uses offsetWidth/offsetHeight
 * (layout size — never the scale-transformed visual box).
 */
import { computed, watch, shallowRef, ref, markRaw, onScopeDispose, type Component } from 'vue';
import { useRafFn } from '@vueuse/core';
import { useSelectionStore } from '@stores/map/selection-store';
import { useProjector } from '@selection/projector';
import { clampToViewport, type ViewportChrome } from '@selection/clamp-viewport';
import { currentLocale } from '@services/locale';
import type { EntrySurfaces } from '@selection/types';

const selection = useSelectionStore();
const projectorRef = useProjector();

const cardEl = ref<HTMLElement | null>(null);
const side = shallowRef<'above' | 'below'>('above');
const candidatesOpen = shallowRef(false);
/** Anchor is outside the viewport — the card is visually hidden (CSS
 *  fade/scale-out) but stays in the store; it pops back when the map
 *  pans the anchor back in (animated hide/reveal, owner 2026-11-01). */
const anchorOffScreen = shallowRef(false);

/** Display name for the SHELL title strip (non-transport entries with a
 *  `name` prop). Transport carries stop_name in its CONTENT component. */
const title = computed(() => {
  const props = selection.popupTarget?.props as Record<string, unknown> | undefined;
  if (!props) return '';
  return String(props[`name_${currentLocale()}`] ?? props.name ?? '');
});

// ── Chrome insets (px): topbar pill 10+52 + gap, bottom-left map chrome.
const CHROME: ViewportChrome = { top: 74, right: 12, bottom: 68, left: 12 };

function updateAnchor(): void {
  const card = cardEl.value;
  const target = selection.popupTarget;
  const projector = projectorRef.value;
  if (!card || !target?.location || !projector) return;
  const anchor = projector.project(target.location);
  // ANIMATED OFF-SCREEN HIDE/REVEAL (owner 2026-11-01): when the anchor
  // leaves the viewport, fade+scale the card out (CSS class — the popup
  // target STAYS in the store, map click still fully closes). When the
  // anchor re-enters on a later move frame, the class lifts and the
  // card pops back at its re-clamped position.
  const offScreen =
    anchor.x < -20 || anchor.x > window.innerWidth + 20 ||
    anchor.y < -20 || anchor.y > window.innerHeight + 20;
  if (offScreen !== anchorOffScreen.value) {
    anchorOffScreen.value = offScreen;
    card.classList.toggle('wd-map-popup--off-screen', offScreen);
  }
  if (offScreen) return; // hidden — skip positioning until back in view

  // Layout size (offsetWidth/Height) — NOT getBoundingClientRect.
  const clamped = clampToViewport(
    anchor,
    { width: card.offsetWidth, height: card.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
    CHROME
  );
  card.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`;
  side.value = clamped.side;
  const originX = Math.round(anchor.x - clamped.x);
  card.style.transformOrigin =
    clamped.side === 'above' ? `${originX}px calc(100% - 8px)` : `${originX}px 8px`;
  // Stem sits at the anchor's x position (not card center) — the arrow
  // points at the dot even when the card is clamped away from it.
  card.style.setProperty(
    '--wd-stem-x',
    `${Math.max(8, Math.min(card.offsetWidth - 8, originX))}px`
  );
}

// ── Entry popup CONTENT (module-scope cache, GLM F1) ─────────────────
const surfacesCache = new Map<string, Promise<EntrySurfaces>>();

const popupContent = shallowRef<Component | null>(null);
let contentSeq = 0;

watch(
  () => selection.popupEntry,
  async entry => {
    const token = ++contentSeq;
    popupContent.value = null; // GLM F2: drop stale component immediately
    if (!entry?.surfaces) return;
    let promise = surfacesCache.get(entry.id);
    if (!promise) {
      promise = entry.surfaces();
      surfacesCache.set(entry.id, promise);
      promise.catch(() => surfacesCache.delete(entry.id));
    }
    try {
      const surfaces = await promise;
      if (token !== contentSeq) return;
      popupContent.value = surfaces.popup ? markRaw(surfaces.popup) : null;
    } catch {
      if (token === contentSeq) popupContent.value = null;
    }
  },
  { immediate: true }
);

// ── rAF re-anchoring ────────────────────────────────────────────────────
let dirty = false;
const { pause, resume } = useRafFn(
  () => {
    if (!dirty) return;
    dirty = false;
    updateAnchor();
  },
  { immediate: false }
);

let unsubscribeMove: (() => void) | null = null;
watch(
  [projectorRef, () => selection.popupTarget, () => popupContent.value],
  ([projector, target]) => {
    unsubscribeMove?.();
    unsubscribeMove = null;
    if (!projector || !target) {
      pause();
      return;
    }
    unsubscribeMove = projector.onMove(() => {
      dirty = true;
    });
    updateAnchor(); // flush:'post' → card mounted: position synchronously
    resume();
  },
  { immediate: true, flush: 'post' }
);

// Engine swap (unregister): close the popup.
watch(projectorRef, p => {
  if (!p) selection.closePopup();
});

// ── Candidates: toggle + re-anchor (card grows/shrinks) ────────────────
function toggleCandidates(): void {
  candidatesOpen.value = !candidatesOpen.value;
  dirty = true; // re-anchor after the height change
}

/** Candidate label: stop_name > name > title > id (readable). */
function candidateLabel(index: number): string {
  const item = selection.candidates[index];
  if (!item) return '';
  const props = item.target.props as Record<string, unknown>;
  return String(
    props.stop_name ?? props[`name_${currentLocale()}`] ?? props.name ?? item.target.id
  );
}

onScopeDispose(() => {
  unsubscribeMove?.();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="wd-popup">
      <div
        v-if="selection.popupTarget"
        ref="cardEl"
        class="wd-map-popup"
        :data-side="side"
        role="dialog"
        aria-modal="false"
      >
        <div class="wd-map-popup__stem" aria-hidden="true" />

        <!-- Chrome: close button, absolute top-right (no header row) -->
        <div class="wd-map-popup__chrome">
          <q-btn
            flat
            round
            dense
            icon="wd-close"
            :aria-label="$t('place.popup.close')"
            @click="selection.closePopup()"
          />
        </div>

        <!-- Title strip (entries with a name prop; transport renders in content) -->
        <div v-if="title" class="wd-map-popup__title-strip">{{ title }}</div>

        <!-- Candidates: collapsible list (replaces 1/n chip) -->
        <div v-if="selection.candidates.length > 1" class="wd-map-popup__cands">
          <button type="button" class="wd-map-popup__cands-toggle" @click="toggleCandidates">
            <q-icon name="wd-layers-outline" size="14px" />
            <span class="wd-map-popup__cands-label">
              {{ candidateLabel(selection.candidateIndex) }}
            </span>
            <span class="wd-map-popup__cands-count">
              {{ selection.candidateIndex + 1 }}/{{ selection.candidates.length }}
            </span>
            <q-icon :name="candidatesOpen ? 'wd-chevron-up' : 'wd-chevron-down'" size="14px" />
          </button>
          <Transition name="wd-cands">
            <div v-if="candidatesOpen" class="wd-map-popup__cands-list">
              <button
                v-for="(c, i) in selection.candidates"
                :key="c.target.key"
                type="button"
                class="wd-map-popup__cands-item"
                :class="{ 'wd-map-popup__cands-item--active': i === selection.candidateIndex }"
                @click="selection.selectCandidate(i)"
              >
                {{ candidateLabel(i) }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Entry popup content -->
        <component :is="popupContent" v-if="popupContent" :target="selection.popupTarget" />
        <slot v-else />

        <!-- Expand affordance -->
        <div
          v-if="selection.popupEntry?.capabilities?.includes('detail')"
          class="wd-map-popup__footer"
        >
          <q-btn
            dense
            no-caps
            class="wd-map-popup__expand"
            :aria-label="$t('place.popup.expand')"
            @click="selection.expand()"
          >
            {{ $t('place.popup.expand') }}
          </q-btn>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
// ── Card: design-language chrome (Opus UX spec) ────────────────────────
.wd-map-popup {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2400;
  width: 232px; // FIXED — only height grows (owner 2026-11-01); the
  // card re-anchors upward via the rAF loop when content expands
  min-height: 80px; // skeleton floor before the async barrel resolves
  background: var(--wd-surface);
  color: var(--wd-ink);
  border-radius: 8px;
  border: 1px solid var(--wd-ridge); // crisp edge over busy tiles
  box-shadow: 0 1px 3px rgba(10, 20, 15, 0.2); // sanctioned over-map shadow
  padding: 8px 10px;
  overflow: visible; // stem extends outside
}

// ── Stem ────────────────────────────────────────────────────────────────
.wd-map-popup__stem {
  position: absolute;
  left: var(--wd-stem-x, 50%);
  width: 10px;
  height: 10px;
  background: inherit;
  border-radius: 2px;
  border: 1px solid var(--wd-ridge);
  transform: translateX(-5px) rotate(45deg);
}

.wd-map-popup[data-side='above'] .wd-map-popup__stem {
  bottom: -6px;
  border-top: none;
  border-left: none;
}

.wd-map-popup[data-side='below'] .wd-map-popup__stem {
  top: -6px;
  border-bottom: none;
  border-right: none;
}

// ── Chrome: absolute close button ───────────────────────────────────────
.wd-map-popup__chrome {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;

  .q-btn {
    color: var(--wd-ink-soft);
  }
}

// ── Title strip (entries with name; transport uses content component) ──
.wd-map-popup__title-strip {
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--wd-ink);
  padding-right: 24px; // clear the close button
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── Candidates: collapsible list ────────────────────────────────────────
.wd-map-popup__cands {
  margin-bottom: 4px;
}

.wd-map-popup__cands-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 3px 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wd-ink-soft);
  font-family: 'Barlow Semi Condensed', 'Barlow', sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: left;

  &:hover {
    color: var(--wd-ink);
  }
}

.wd-map-popup__cands-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-map-popup__cands-count {
  flex: none;
  opacity: 0.7;
}

.wd-map-popup__cands-list {
  max-height: 160px;
  overflow-y: auto;
  border-top: 1px solid var(--wd-ridge);
  margin-top: 2px;
  padding-top: 2px;
}

.wd-map-popup__cands-item {
  display: block;
  width: 100%;
  padding: 4px 6px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'Barlow', sans-serif;
  font-size: 13px;
  color: var(--wd-ink);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: var(--wd-wash);
  }

  &--active {
    background: var(--wd-wash);
    font-weight: 600;
  }
}

// Candidates expand/collapse
.wd-cands-enter-active,
.wd-cands-leave-active {
  transition:
    opacity 0.12s ease,
    max-height 0.15s ease;
  overflow: hidden;
}

.wd-cands-enter-from,
.wd-cands-leave-to {
  opacity: 0;
  max-height: 0;
}

// ── Footer: expand affordance ────────────────────────────────────────────
.wd-map-popup__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  margin-top: 4px;
  border-top: 1px solid var(--wd-ridge);
}

// ── Off-screen hide/reveal (animated fade+scale) ───────────────────────
// The card stays in the DOM; the class toggles on/off as the anchor
// leaves/re-enters the viewport. Same pop easing as the enter/leave —
// the reveal reads as a second pop from the pin. The BASE card has NO
// transition (the enter/leave and off-screen classes own it — a base
// transition made the enter animation start from the wrong position).
.wd-map-popup--off-screen {
  opacity: 0;
  scale: 0.6;
  pointer-events: none;
  transition:
    opacity 0.15s ease-in,
    scale 0.15s ease-in;
}

.wd-map-popup:not(.wd-map-popup--off-screen) {
  transition:
    opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    scale 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

// Kill any inherited transition on the enter-active phase — the Vue
// Transition's enter-active class owns the animation timing; a base
// transition on the same properties makes the card briefly visible at
// the pre-anchor position (0,0) before the transform lands (owner:
// "popup flies in from top left").
.wd-popup-enter-active {
  transition:
    opacity 0.1s ease-out,
    scale 0.14s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

// ── Enter/leave: pop from the pin ──────────────────────────────────────
.wd-map-popup[data-side='above'] {
  transform-origin: 50% calc(100% - 8px);
}

.wd-map-popup[data-side='below'] {
  transform-origin: 50% 8px;
}

.wd-popup-enter-active {
  transition:
    opacity 0.12s ease-out,
    scale 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.wd-popup-leave-active {
  transition:
    opacity 0.1s ease-in,
    scale 0.12s ease-in;
}

.wd-popup-enter-from {
  opacity: 0;
  scale: 0.92;
}

.wd-popup-leave-to {
  opacity: 0;
  scale: 0.85;
}

@media (prefers-reduced-motion: reduce) {
  .wd-popup-enter-active,
  .wd-popup-leave-active {
    transition: opacity 0.12s ease;
  }

  .wd-popup-enter-from,
  .wd-popup-leave-to {
    scale: 1;
  }
}
</style>
