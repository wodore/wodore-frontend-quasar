/**
 * Touch-gesture and bottom-sheet helpers for the local e2e suite.
 *
 * The bottom sheet (pure-web-bottom-sheet) is driven by native touch
 * scrolling with CSS scroll-snap, so tests dispatch real touch sequences via
 * CDP. All state is read from the shadow DOM (Playwright locators pierce open
 * shadow roots, but direct evaluate is more precise for scroll positions).
 */
import type { Page } from '@playwright/test';

export interface SheetState {
  exists: boolean;
  /** Host element scrollTop - the sheet's visual snap position (0 = fully expanded) */
  hostScrollTop: number | null;
  /** Inner content scrollTop */
  contentScrollTop: number | null;
  sheetState: string | null;
}

export async function getSheetState(page: Page): Promise<SheetState> {
  return page.evaluate(() => {
    const el = document.querySelector('bottom-sheet');
    if (!el) {
      return { exists: false, hostScrollTop: null, contentScrollTop: null, sheetState: null };
    }
    return {
      exists: true,
      hostScrollTop: el.scrollTop,
      contentScrollTop: el.shadowRoot?.querySelector('.sheet-content')?.scrollTop ?? null,
      sheetState: el.getAttribute('data-sheet-state'),
    };
  });
}

/** Y coordinate of the visual sheet top (its header/handle area). */
export async function getSheetTop(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const sheet = document.querySelector('bottom-sheet')?.shadowRoot?.querySelector('aside.sheet');
    return sheet ? Math.round(sheet.getBoundingClientRect().top) : null;
  });
}

interface TouchGestureOptions {
  steps?: number;
  /** Delay between touch moves in ms - lower is faster (fling) */
  gap?: number;
}

/** Dispatch a touch drag from (x1, y1) to (x2, y2) via CDP. */
export async function touchDrag(
  page: Page,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: TouchGestureOptions = {}
): Promise<void> {
  const { steps = 12, gap = 25 } = options;
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(x1), y: Math.round(y1) }],
    });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: Math.round(x1 + ((x2 - x1) * i) / steps),
            y: Math.round(y1 + ((y2 - y1) * i) / steps),
          },
        ],
      });

      await page.waitForTimeout(gap);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await page.waitForTimeout(400);
}

/** Dispatch a single tap via CDP. */
export async function touchTap(page: Page, x: number, y: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(x), y: Math.round(y) }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await page.waitForTimeout(400);
}

/**
 * Dismiss the bottom sheet by dragging it down, with retries.
 *
 * A slow drag stops at the header-only snap (scroll-snap-stop), a fast fling
 * from there dismisses the sheet. Gesture recognition in emulation can be
 * flaky, so both steps are retried until the sheet is gone.
 */
export async function dismissSheet(page: Page, maxAttempts = 5): Promise<boolean> {
  const vp = page.viewportSize();
  const cx = Math.round((vp?.width ?? 390) / 2);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const top = await getSheetTop(page);
    if (top === null) return true;

    await touchDrag(page, cx, top + 60, cx, (vp?.height ?? 844) - 140, { gap: 25 });
    const topAfterDrag = await getSheetTop(page);
    if (topAfterDrag === null) return true;

    // Two fling variants from the header-only snap; gesture recognition in
    // emulation is flaky, so alternate short-fast and long-fast flings
    const variants =
      attempt % 2 === 0
        ? { steps: 6, gap: 8 }
        : { steps: 10, gap: 5, to: (vp?.height ?? 844) - 30 };
    await touchDrag(
      page,
      cx,
      topAfterDrag + 30,
      cx,
      variants.to ?? (vp?.height ?? 844) - 40,
      variants
    );
    if ((await getSheetState(page)).exists === false) return true;
  }

  // Gesture fallback: drive the sheet to the collapsed snap programmatically.
  // This fires the same snap-position-change event the swipe would, running
  // the identical close chain in the app.
  await page.evaluate(() => {
    const sheet = document.querySelector('bottom-sheet') as {
      snapToPoint?: (index: number) => void;
    } | null;
    sheet?.snapToPoint?.(0);
  });
  await page.waitForTimeout(800);
  return (await getSheetState(page)).exists === false;
}
