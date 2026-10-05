/**
 * useConfirmPopover — global pointer-anchored confirm dialogs.
 *
 * One WdConfirmPopover instance (mounted in App.vue) renders whatever the
 * last confirmAt() call describes, anchored at the pointer/tap position,
 * clamped to the viewport. Any component can use it:
 *
 *   const { confirmAt } = useConfirmPopover();
 *   confirmAt({
 *     message: t('…'),
 *     okLabel: t('save'), okVariant: 'go',
 *     dangerLabel: t('discard'),   // optional third action
 *     onOk: () => save(),
 *     onDanger: () => discard(),
 *   });
 *
 * Backdrop click / Esc / focus loss = cancel (nothing runs).
 */
import { reactive, readonly } from 'vue';

export interface ConfirmRequest {
  message: string;
  okLabel: string;
  okVariant?: 'go' | 'danger' | 'neutral';
  dangerLabel?: string;
  onOk: () => void;
  onDanger?: () => void;
  cancelLabel?: string;
  x: number;
  y: number;
}

interface ConfirmState {
  request: ConfirmRequest | null;
}

const state = reactive<ConfirmState>({ request: null });

export function useConfirmPopover() {
  function confirmAt(req: Omit<ConfirmRequest, 'x' | 'y'> & { x?: number; y?: number }): void {
    state.request = {
      ...req,
      x: req.x ?? lastPointer.x,
      y: req.y ?? lastPointer.y,
    };
  }

  function settle(action: 'ok' | 'danger' | 'cancel'): void {
    const req = state.request;
    state.request = null;
    if (!req) return;
    if (action === 'ok') req.onOk();
    else if (action === 'danger') req.onDanger?.();
  }

  return { confirmAt, settle, state: readonly(state) };
}

/** Last pointer position — module scope so every caller shares it */
let lastPointer = { x: 0, y: 0 };

export function trackConfirmPointer(ev: PointerEvent): void {
  lastPointer = { x: ev.clientX, y: ev.clientY };
}

export function lastPointerPosition(): { x: number; y: number } {
  return { ...lastPointer };
}
