<script setup lang="ts">
/**
 * WdConfirmPopover — the single instance that renders useConfirmPopover
 * requests. Teleported to body, anchored at the request coordinates,
 * clamped fully inside the viewport (flips below the pointer when there
 * is no room above) — the action buttons can never sit outside the
 * clickable area. Esc cancels.
 */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirmPopover, trackConfirmPointer } from '@composables/useConfirmPopover';

defineOptions({ name: 'WdConfirmPopover' });

const { t } = useI18n();
const { state, settle } = useConfirmPopover();
const panelEl = ref<HTMLElement | null>(null);
const pos = ref<{ left: string; top: string }>({ left: '-9999px', top: '-9999px' });

async function place(): Promise<void> {
  if (!state.request) return;
  // The watch fires BEFORE the v-if renders — wait for the panel first
  await nextTick();
  const el = panelEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const M = 10; // viewport margin
  const req = state.request;
  // Anchor: centered above the pointer; flip below when clipped at the top
  let x = req.x - r.width / 2;
  let y = req.y - r.height - 14;
  if (y < M) y = req.y + 14;
  // Clamp horizontally (and again vertically after the flip)
  x = Math.min(Math.max(x, M), window.innerWidth - r.width - M);
  y = Math.min(Math.max(y, M), window.innerHeight - r.height - M);
  pos.value = { left: `${Math.round(x)}px`, top: `${Math.round(y)}px` };
}

watch(
  () => state.request,
  () => {
    if (state.request) void place();
  }
);

function onKeydown(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && state.request) settle('cancel');
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  // Global pointer tracking — every confirmAt() without explicit coords
  // anchors at the last pointer/tap position
  window.addEventListener('pointerdown', trackConfirmPointer, { passive: true });
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('pointerdown', trackConfirmPointer);
});
</script>

<template>
  <Teleport to="body">
    <template v-if="state.request">
      <div class="wd-confirm__backdrop" @click="settle('cancel')" />
      <div
        ref="panelEl"
        class="wd-confirm"
        :class="{ 'wd-confirm--wide': state.request.dangerLabel }"
        :style="pos"
        role="dialog"
        :aria-label="state.request.message"
      >
        <div class="wd-confirm__msg">{{ state.request.message }}</div>
        <div class="wd-confirm__actions">
          <button class="wd-confirm__btn" @click.stop="settle('cancel')">
            {{ state.request.cancelLabel ?? t('overlays.edit_cancel') }}
          </button>
          <button
            v-if="state.request.dangerLabel"
            class="wd-confirm__btn wd-confirm__btn--danger"
            @click.stop="settle('danger')"
          >
            {{ state.request.dangerLabel }}
          </button>
          <button
            class="wd-confirm__btn wd-confirm__ok"
            :class="`wd-confirm__ok--${state.request.okVariant ?? 'neutral'}`"
            @click.stop="settle('ok')"
          >
            {{ state.request.okLabel }}
          </button>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style lang="scss">
/* Global (teleported to body) */
.wd-confirm__backdrop {
  position: fixed;
  inset: 0;
  z-index: 2090;
}

.wd-confirm {
  position: fixed;
  z-index: 2095;
  min-width: 240px;
  max-width: 320px;
  padding: 14px 16px;
  background: var(--wd-ctl-bg) !important;
  border: 1px solid var(--wd-ctl-border);
  border-radius: 8px;
  // Layered elevation: tight contact shadow + soft ambient — reads as
  // floating paper, not a flat sticker
  box-shadow:
    0 2px 6px rgba(10, 20, 15, 0.16),
    0 14px 34px rgba(10, 20, 15, 0.26) !important;
}

.wd-confirm--wide {
  min-width: 270px;
}

.wd-confirm__msg {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--wd-ctl-ink);
}

body.body--dark .wd-confirm__msg {
  color: #cfe8dc;
}

.wd-confirm__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.wd-confirm__btn {
  padding: 7px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--wd-ctl-ink-soft);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.wd-confirm__btn:hover {
  background: var(--wd-ctl-hover);
}

.wd-confirm__btn--danger {
  color: #c44e3b !important;

  &:hover {
    color: #a93d2c !important;
    background: rgba(196, 78, 59, 0.12);
  }
}

.wd-confirm__ok {
  color: var(--wd-ctl-ink);
  background: var(--wd-ctl-date-bg);
}

.wd-confirm__ok--danger {
  color: #b23e2d !important;
  background: rgba(196, 78, 59, 0.16) !important;

  &:hover {
    background: rgba(196, 78, 59, 0.24) !important;
  }
}

.wd-confirm__ok--go {
  color: #17513f !important;
  background: rgba(42, 138, 114, 0.18) !important;

  &:hover {
    background: rgba(42, 138, 114, 0.26) !important;
  }
}

body.body--dark .wd-confirm__ok--go {
  color: #7fe3c8 !important;
}
</style>
