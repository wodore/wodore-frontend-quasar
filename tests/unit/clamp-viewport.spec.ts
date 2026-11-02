/**
 * clampToViewport — pure popup-anchoring math (place-popup spec): card
 * stays inside the chrome insets, prefers ABOVE the anchor, flips BELOW
 * when there is no room, clamps both axes.
 */
import { describe, it, expect } from 'vitest';
import { clampToViewport, POPUP_ANCHOR_GAP } from '@selection/clamp-viewport';

const VIEWPORT = { width: 1000, height: 800 };
const CHROME = { top: 74, right: 12, bottom: 68, left: 12 };
const CARD = { width: 240, height: 160 };

describe('clampToViewport', () => {
  it('places the card centered above the anchor with the stem gap', () => {
    const anchor = { x: 500, y: 400 };
    const r = clampToViewport(anchor, CARD, VIEWPORT, CHROME);
    expect(r.side).toBe('above');
    expect(r.x).toBe(anchor.x - CARD.width / 2); // centered
    expect(r.y).toBe(anchor.y - POPUP_ANCHOR_GAP - CARD.height);
  });

  it('flips below when the card would leave the top chrome', () => {
    const anchor = { x: 500, y: 100 }; // too close to the topbar pill
    const r = clampToViewport(anchor, CARD, VIEWPORT, CHROME);
    expect(r.side).toBe('below');
    expect(r.y).toBe(anchor.y + POPUP_ANCHOR_GAP);
  });

  it('clamps horizontally into the viewport margins', () => {
    const left = clampToViewport({ x: 50, y: 400 }, CARD, VIEWPORT, CHROME);
    expect(left.x).toBe(CHROME.left); // not past the left margin
    const right = clampToViewport({ x: 980, y: 400 }, CARD, VIEWPORT, CHROME);
    expect(right.x).toBe(VIEWPORT.width - CHROME.right - CARD.width);
  });

  it('never places the card above the top chrome even when flipped low', () => {
    // Tiny viewport where even below-placement overflows: clamp to top.
    const r = clampToViewport(
      { x: 500, y: 60 },
      CARD,
      { width: 400, height: 260 },
      { top: 74, right: 12, bottom: 68, left: 12 }
    );
    expect(r.y).toBeGreaterThanOrEqual(74);
  });

  it('handles zero-size cards (pre-measurement pass)', () => {
    const r = clampToViewport({ x: 500, y: 400 }, { width: 0, height: 0 }, VIEWPORT, CHROME);
    expect(r.x).toBe(500);
    expect(r.side).toBe('above');
  });
});
