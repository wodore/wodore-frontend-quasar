<script setup lang="ts">
/**
 * WdMapPopup — the anchored popup shell (OpenSpec `add-place-interactions`,
 * capability `place-popup`). Mounted ONCE in MainLayout as a sibling of the
 * map (survives engine identity switches); teleports to body to escape the
 * map container's overflow/stacking.
 *
 * Anchoring (rAF discipline, place-popup spec): the adapter's projector
 * returns VIEWPORT px; map `move` events set a dirty flag (NOT moveend —
 * flyTo emits continuous moves, which glue the card through the
 * animation); ONE rAF loop drains the flag while the popup is open and
 * pauses when closed/tab-hidden (useRafFn); position writes are
 * IMPERATIVE style transforms — the anchor is a render artifact, not
 * reactive state. clampToViewport keeps the card clear of the topbar
 * pill, bottom chrome and safe-area insets, flipping above/below the pin.
 *
 * Engine swap (projector unregister) closes the popup; the card also
 * closes via ✕ and expands to detail when the entry has one (handoff —
 * never abort). The minimal `1/n` candidates chip cycles the switcher.
 */
import { computed, watch, shallowRef, ref, onScopeDispose } from 'vue';
import { useRafFn } from '@vueuse/core';
import { useSelectionStore } from '@stores/map/selection-store';
import { useProjector } from '@selection/projector';
import { clampToViewport, type ViewportChrome } from '@selection/clamp-viewport';
import { currentLocale } from '@services/locale';

const selection = useSelectionStore();
const projectorRef = useProjector();

const cardEl = ref<HTMLElement | null>(null);
const side = shallowRef<'above' | 'below'>('above');
/** Display name, localized AT RENDER TIME (props-only popup: a mid-session
 *  language switch re-renders — the bag itself is not reactive state). */
const title = computed(() => {
  const props = selection.popupTarget?.props as Record<string, unknown> | undefined;
  if (!props) return '';
  return String(props[`name_${currentLocale()}`] ?? props.name ?? '');
});

// ── Chrome insets (px): topbar pill 10+52 + gap, bottom-left map chrome,
// lateral breathing room. Safe-area insets ride along via CSS env() on
// the card container — the JS insets mirror the fixed chrome geometry.
const CHROME: ViewportChrome = { top: 74, right: 12, bottom: 68, left: 12 };

function updateAnchor(): void {
  const card = cardEl.value;
  const target = selection.popupTarget;
  const projector = projectorRef.value;
  if (!card || !target?.location || !projector) return;
  const anchor = projector.project(target.location);
  const rect = card.getBoundingClientRect();
  const clamped = clampToViewport(
    anchor,
    { width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight },
    CHROME
  );
  card.style.transform = `translate(${clamped.x}px, ${clamped.y}px)`;
  side.value = clamped.side;
}

// Dirty-flag re-anchoring: move events mark dirty, ONE rAF loop drains.
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
  [projectorRef, () => selection.popupTarget],
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
    dirty = true;
    resume();
  },
  { immediate: true }
);

// Engine swap (unregister): close the popup (place-popup spec); the
// adapter's unregister path owns feature-state cleanup.
watch(projectorRef, p => {
  if (!p) selection.closePopup();
});

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
        <header class="wd-map-popup__header">
          <span class="wd-map-popup__title">{{ title }}</span>
          <q-btn
            v-if="selection.candidates.length > 1"
            dense
            flat
            no-caps
            class="wd-map-popup__cycle"
            :aria-label="
              $t('place.popup.candidates', {
                n: selection.candidateIndex + 1,
                total: selection.candidates.length,
              })
            "
            @click="selection.cycleCandidates()"
          >
            {{ selection.candidateIndex + 1 }}/{{ selection.candidates.length }}
          </q-btn>
          <q-btn
            dense
            flat
            round
            icon="wd-close"
            :aria-label="$t('place.popup.close')"
            @click="selection.closePopup()"
          />
        </header>
        <slot />
        <footer v-if="selection.popupEntry?.capabilities?.includes('detail')" class="wd-map-popup__footer">
          <q-btn
            dense
            no-caps
            class="wd-map-popup__expand"
            :aria-label="$t('place.popup.expand')"
            @click="selection.expand()"
          >
            {{ $t('place.popup.expand') }}
          </q-btn>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.wd-map-popup {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2400; // above map chrome (attribution ~1000), below dialogs
  max-width: 280px;
  min-width: 200px;
  background: var(--wd-surface, #fff);
  color: var(--wd-ink, #1a1a1a);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 8px 10px;
  // Position is written imperatively (translate) — only the ENTRY
  // transition animates here (scale+fade); safe-area insets pad the
  // card body, the clamp math mirrors the fixed chrome geometry.
  margin: 0;
}

.wd-map-popup__stem {
  position: absolute;
  left: 50%;
  width: 10px;
  height: 10px;
  background: inherit;
  border-radius: 2px;
  transform: translateX(-50%) rotate(45deg);
}

.wd-map-popup[data-side='above'] .wd-map-popup__stem {
  bottom: -5px;
}

.wd-map-popup[data-side='below'] .wd-map-popup__stem {
  top: -5px;
}

.wd-map-popup__header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wd-map-popup__title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wd-map-popup__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

// Enter/leave: fade + scale only — `transform` is owned imperatively
// by the rAF loop; the independent `scale` property composes with it.
.wd-popup-enter-active,
.wd-popup-leave-active {
  transition:
    opacity 0.15s ease,
    scale 0.15s ease;
}

.wd-popup-enter-from,
.wd-popup-leave-to {
  opacity: 0;
  scale: 0.96;
}
</style>
