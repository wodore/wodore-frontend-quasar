/**
 * What's-here gesture coordination (OpenSpec `amenity-interactions`
 * A7, owner revision 2026-11): the proximity probe fires ONLY on the
 * deliberate detail gesture — mouse right-click / touch long-press,
 * both surfaced by MapLibre as ONE map `contextmenu` event. A touch
 * long-press still releases into a DOM `click` (the browser fires it
 * when the lifted finger never left the click tolerance; MapLibre
 * forwards it as a map click), so exactly that one trailing click is
 * swallowed — it must not close the popup the probe just opened nor
 * re-run the click pipeline for the same gesture.
 *
 * Mouse right-clicks never produce a trailing click (DOM clicks are
 * primary-button only), so they arm no swallow — a left-click right
 * after a right-click stays live. A new pointer gesture (down) expires
 * a stale flag: a long-press cancelled into a drag never releases a
 * click, and the NEXT click belongs to a new gesture.
 */
export interface WhatsHereGesture {
  /**
   * A `contextmenu` fired. `touchLongPress`: a tracked touch gesture is
   * mid-press (finger still down) — only those produce a trailing
   * click; mouse right-clicks never do.
   */
  contextmenu(touchLongPress: boolean): void;
  /**
   * A new pointer gesture started (any pointer type) — a stale swallow
   * flag expires (the long-press was cancelled into a drag, or the tail
   * click already passed).
   */
  pointerDown(): void;
  /**
   * Consume one click. `true` when this click is the release tail of a
   * touch long-press that ran the probe — the caller drops it. Resets
   * the flag either way: exactly ONE click per long-press is swallowed.
   */
  consumeClick(): boolean;
}

export function createWhatsHereGesture(): WhatsHereGesture {
  let swallowClick = false;
  return {
    contextmenu(touchLongPress: boolean): void {
      swallowClick = touchLongPress;
    },
    pointerDown(): void {
      swallowClick = false;
    },
    consumeClick(): boolean {
      const swallow = swallowClick;
      swallowClick = false;
      return swallow;
    },
  };
}
