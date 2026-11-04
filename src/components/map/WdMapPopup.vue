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
/** Whether updateAnchor() has written a real transform at least once —
 *  the card is visibility:hidden until then (never painted at 0,0). */
const positioned = shallowRef(false);

/** Display name for the SHELL title strip (entries with a `name` prop
 *  that do NOT own their title in the popup content). Transport carries
 *  stop_name in its CONTENT component; entries declaring
 *  `popupOwnsTitle` (amenity — transport grammar: icon + eyebrow + name)
 *  render the name themselves and suppress the strip. */
const title = computed(() => {
  if (selection.popupEntry?.popupOwnsTitle) return '';
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
    anchor.x < -20 ||
    anchor.x > window.innerWidth + 20 ||
    anchor.y < -20 ||
    anchor.y > window.innerHeight + 20;
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
  // transform-origin is CSS-owned (data-side rules) — 50% of the card
  // width at the stem edge. The animation grows from the CENTER of the
  // stem edge (upward when above, downward when below), not from the
  // exact pin x-offset (owner 2026-11-01: "grow from bottom center").
  // Stem sits at the anchor's x position — compute the offset inline
  // (originX was removed with the transform-origin override).
  const stemX = Math.max(
    card.offsetWidth * 0.2,
    Math.min(card.offsetWidth * 0.8, anchor.x - clamped.x)
  );
  card.style.setProperty('--wd-stem-x', `${Math.round(stemX)}px`);
  // Position is now authoritative — the card may be painted.
  positioned.value = true;
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
      positioned.value = false; // fresh mount must re-earn visibility
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

// (Retarget watcher removed with the Transition.)

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
    <div
      v-if="selection.popupTarget"
      ref="cardEl"
      class="wd-map-popup"
      :class="{ 'wd-map-popup--unpositioned': !positioned }"
      :data-side="side"
      role="dialog"
      aria-modal="false"
    >
      <div class="wd-map-popup__stem" aria-hidden="true" />

      <!-- Accessible close: visually hidden, keyboard-focusable.
             Dismissal is by map click (the natural gesture for ephemeral
             map popups); this exists for screen readers and keyboard
             users only (owner 2026-11-01: "drop the close button"). -->
      <button
        type="button"
        class="wd-map-popup__sr-close"
        :aria-label="$t('place.popup.close')"
        @click.stop="selection.closePopup()"
      >
        {{ $t('place.popup.close') }}
      </button>

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

// ── Accessible close: visually hidden (sr-only) ────────────────────────
// Standard screen-reader-only pattern: off-screen until keyboard-focused,
// then visible for sighted keyboard users.
.wd-map-popup__sr-close {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  background: none;
  color: var(--wd-ink);
  font-size: 12px;
  cursor: pointer;

  &:focus {
    position: absolute;
    top: 4px;
    right: 4px;
    width: auto;
    height: auto;
    padding: 4px 8px;
    margin: 0;
    clip: auto;
    border-radius: 4px;
    background: var(--wd-wash);
    z-index: 1;
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

// ── Unpositioned gate: never paint at translate(0,0) ────────────────────
// visibility:hidden suppresses painting but KEEPS layout (measurement works).
// Flips to visible the instant updateAnchor() writes a real transform.
.wd-map-popup--unpositioned {
  visibility: hidden;
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

// (Retarget animation removed with the Transition.)

// ── Enter/leave: pop from the pin ──────────────────────────────────────
.wd-map-popup[data-side='above'] {
  transform-origin: 50% calc(100% - 8px);
}

.wd-map-popup[data-side='below'] {
  transform-origin: 50% 8px;
}

.wd-popup-enter-active {
  transition:
    opacity 0.14s ease-out,
    scale 0.18s cubic-bezier(0.22, 1.15, 0.36, 1);
}

.wd-popup-leave-active {
  transition:
    opacity 0.12s ease-in,
    scale 0.14s ease-in;
}

// GROW from the stem edge: the CSS transform-origin (50% at the stem)
// makes the card unfold upward (side=above) or downward (side=below).
// Scale 0.4→1.0 gives a clear vertical grow; the opacity runs slightly
// ahead of the scale so the card becomes visible before it reaches
// full size (owner: "grow from bottom center, with alpha combined").
.wd-popup-enter-from {
  opacity: 0;
  scale: 0.4;
}

// SHRINK back toward the stem — the reverse of the enter.
.wd-popup-leave-to {
  opacity: 0;
  scale: 0.4;
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
