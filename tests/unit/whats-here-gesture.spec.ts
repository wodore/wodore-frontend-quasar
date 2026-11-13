//
// What's-here gesture coordination (amenity overlays): the swallow
// state machine of src/stores/map/utils/whats-here-gesture.ts — the
// probe fires on contextmenu (right-click / touch long-press) and the
// long-press release click must be swallowed exactly once.
import { describe, it, expect } from 'vitest';
import { createWhatsHereGesture } from '@stores/map/utils/whats-here-gesture';

describe('whats-here gesture', () => {
  it('swallows exactly one click after a touch long-press', () => {
    const g = createWhatsHereGesture();
    g.pointerDown();
    g.contextmenu(true); // long-press fired while the finger is down
    expect(g.consumeClick()).toBe(true); // release tail click
    expect(g.consumeClick()).toBe(false); // the NEXT tap's click is live
  });

  it('never swallows after a mouse right-click', () => {
    const g = createWhatsHereGesture();
    g.pointerDown();
    g.contextmenu(false); // right-click: no trailing DOM click exists
    expect(g.consumeClick()).toBe(false); // a left-click right after stays live
  });

  it('expires a stale flag when a new gesture starts', () => {
    const g = createWhatsHereGesture();
    g.contextmenu(true);
    // long-press cancelled into a drag → no release click ever fires;
    // the next gesture is a fresh tap
    g.pointerDown();
    expect(g.consumeClick()).toBe(false);
  });

  it('re-arms per gesture (long-press, tap, long-press)', () => {
    const g = createWhatsHereGesture();
    g.pointerDown();
    g.contextmenu(true);
    expect(g.consumeClick()).toBe(true); // swallowed tail
    g.pointerDown();
    g.contextmenu(true);
    expect(g.consumeClick()).toBe(true); // swallowed again
  });

  it('a plain tap without any contextmenu never swallows', () => {
    const g = createWhatsHereGesture();
    g.pointerDown();
    expect(g.consumeClick()).toBe(false);
    expect(g.consumeClick()).toBe(false);
  });
});
