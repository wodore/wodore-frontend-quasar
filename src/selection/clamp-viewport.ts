/**
 * clampToViewport — pure popup-anchoring math (OpenSpec
 * `place-popup`, capability `place-popup`). Keeps an anchored popup
 * card fully inside the visible viewport, accounting for map chrome
 * (topbar pill, bottom-left controls) and safe-area insets, and flips
 * the card below the anchor when there is no room above.
 *
 * Pure and engine-free so the occlusion math is unit-testable without
 * a map (the rAF/anchoring glue lives in WdMapPopup).
 */

/** Viewport-relative pixel point. */
export interface PxPoint {
  x: number;
  y: number;
}

/** Inset margins the card must respect: topbar pill + safe-top, bottom
 *  map chrome + safe-bottom, lateral breathing room. All in px. */
export interface ViewportChrome {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/** Gap between the anchor (the pin) and the card's nearest edge. */
export const POPUP_ANCHOR_GAP = 12;

export interface ClampedAnchor {
  /** Card top-left in viewport px (use with a translate transform). */
  x: number;
  y: number;
  /** Which side of the anchor the card ended up on (stem direction). */
  side: 'above' | 'below';
}

/**
 * Position a card of `card` size for `anchor` (the pin's viewport px):
 * preferred ABOVE the anchor, horizontally centered on it; flips BELOW
 * when the card would leave the top chrome; clamped into the viewport
 * on both axes. Zero-size cards are allowed (pre-measurement: only the
 * side pick happens, clamped to the anchor).
 */
export function clampToViewport(
  anchor: PxPoint,
  card: { width: number; height: number },
  viewport: ViewportSize,
  chrome: ViewportChrome
): ClampedAnchor {
  const { width: vw, height: vh } = viewport;
  const marginX = chrome.left;
  const maxX = Math.max(marginX, vw - chrome.right - card.width);

  const centeredX = anchor.x - card.width / 2;
  const x = Math.min(Math.max(centeredX, marginX), maxX);

  const aboveTop = anchor.y - POPUP_ANCHOR_GAP - card.height;
  const fitsAbove = aboveTop >= chrome.top;
  const side: 'above' | 'below' = fitsAbove ? 'above' : 'below';

  let y: number;
  if (side === 'above') {
    y = aboveTop;
  } else {
    const belowTop = anchor.y + POPUP_ANCHOR_GAP;
    const maxY = Math.max(chrome.top, vh - chrome.bottom - card.height);
    y = Math.min(Math.max(belowTop, chrome.top), maxY);
  }
  return { x, y, side };
}
