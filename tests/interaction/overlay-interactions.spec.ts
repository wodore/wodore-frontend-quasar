/**
 * Overlay interaction tests — expand/collapse, stays-open, closing-tap,
 * outside-click, attribution open/close, focus-mode entry guards.
 */
import { test, expect } from '@playwright/test';
import { loadMap, pinTheme, tagTest, attachScreenshot, evalJSON } from './helpers';

const CONFIGS = [
  { theme: 'light', mode: 'mobile' },
  { theme: 'dark', mode: 'mobile' },
  { theme: 'light', mode: 'desktop' },
  { theme: 'dark', mode: 'desktop' },
] as const;

test.describe('overlay interactions', () => {
  for (const { theme, mode } of CONFIGS) {
    test(`${theme}-${mode}: expanded stays open on select`, async ({ page }, testInfo) => {
      tagTest(theme, mode, 'overlay');
      test.setTimeout(90_000);

      const vp = mode === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 };
      await page.setViewportSize(vp);

      await loadMap(page);
      await pinTheme(page, theme);

      await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
      await page.waitForTimeout(600);
      await page.evaluate('document.querySelector(".wd-ovl__row")?.click()');
      await page.waitForTimeout(600);

      const stillExpanded = await evalJSON<boolean>(page, '!!document.querySelector(".wd-ovl__box--expanded")');
      await attachScreenshot(page, testInfo, `${theme}-${mode}-expanded-selected`);
      expect(stillExpanded).toBe(true);
    });

    test(`${theme}-${mode}: closing-tap collapses, no focus`, async ({ page }, testInfo) => {
      tagTest(theme, mode, 'overlay');
      test.setTimeout(90_000);

      const vp = mode === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 };
      await page.setViewportSize(vp);

      await loadMap(page);
      await pinTheme(page, theme);

      await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
      await page.waitForTimeout(600);

      if (mode === 'mobile') {
        await page.touchscreen.tap(60, 400);
      } else {
        await page.evaluate(`(() => {
          const el = document.querySelector('.maplibregl-map');
          const o = { bubbles: true, pointerType: 'touch', isPrimary: true };
          el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 60, clientY: 400, pointerId: 1 }));
          el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 60, clientY: 400, pointerId: 1 }));
          const target = document.elementFromPoint(60, 400);
          target?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 60, clientY: 400 }));
        })()`);
      }
      await page.waitForTimeout(1000);

      const state = await evalJSON(page, `(() => ({
        closed: !document.querySelector('.wd-ovl__box--expanded'),
        focus: document.body.classList.contains('wd-map-focus'),
      }))()`);
      await attachScreenshot(page, testInfo, `${theme}-${mode}-closing-tap`);
      expect(state.closed).toBe(true);
      expect(state.focus).toBe(false);
    });
  }
});

test.describe('attribution', () => {
  test('light-mobile: open shows close glyph, tap closes', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'attribution');
    test.setTimeout(90_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await loadMap(page);

    const state = await evalJSON(page, `(() => {
      const chip = document.querySelector('.wd-attrib');
      if (!chip) return { exists: false };
      const btn = chip.querySelector('.wd-attrib__i');
      return { exists: true, collapsed: !chip.classList.contains('wd-attrib--open') };
    })()`);
    expect(state.exists).toBe(true);
    expect(state.collapsed).toBe(true);

    // Open via tap
    const pt = await evalJSON<{ x: number; y: number }>(page,
      `(() => { const b = document.querySelector('.wd-attrib').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(400);

    const open = await evalJSON(page, `(() => {
      const chip = document.querySelector('.wd-attrib');
      const close = chip.querySelector('.wd-attrib__close');
      return {
        open: chip.classList.contains('wd-attrib--open'),
        closeVisible: close ? getComputedStyle(close).display !== 'none' : false,
      };
    })()`);
    await attachScreenshot(page, testInfo, 'attribution-open');
    expect(open.open).toBe(true);
    expect(open.closeVisible).toBe(true);

    // Close via the × button
    const xpt = await evalJSON<{ x: number; y: number }>(page,
      `(() => { const b = document.querySelector('.wd-attrib--open .wd-attrib__i').getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
    await page.touchscreen.tap(xpt.x, xpt.y);
    await page.waitForTimeout(400);

    const closed = await evalJSON<boolean>(page, '!document.querySelector(".wd-attrib").classList.contains("wd-attrib--open")');
    expect(closed).toBe(true);
  });
});

test.describe('gesture disambiguation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadMap(page);
  });

  test('double-tap does NOT enter focus', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'gestures');
    await page.touchscreen.tap(195, 420);
    await page.waitForTimeout(180);
    await page.touchscreen.tap(195, 420);
    await page.waitForTimeout(900);

    const focus = await evalJSON<boolean>(page, 'document.body.classList.contains("wd-map-focus")');
    await attachScreenshot(page, testInfo, 'gesture-double-tap');
    expect(focus).toBe(false);
  });

  test('pan does NOT enter focus', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'gestures');
    await page.evaluate(`(() => {
      const el = document.querySelector('.maplibregl-map');
      const o = { bubbles: true, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 195, clientY: 420, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: 195, clientY: 380, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: 200, clientY: 300, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 200, clientY: 300, pointerId: 1 }));
    })()`);
    await page.waitForTimeout(900);

    const focus = await evalJSON<boolean>(page, 'document.body.classList.contains("wd-map-focus")');
    expect(focus).toBe(false);
  });

  test('pinch does NOT enter focus', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'gestures');
    await page.evaluate(`(() => {
      const el = document.querySelector('.maplibregl-map');
      const o = { bubbles: true, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 150, clientY: 400, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...o, clientX: 240, clientY: 400, pointerId: 2 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 150, clientY: 400, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...o, clientX: 240, clientY: 400, pointerId: 2 }));
    })()`);
    await page.waitForTimeout(900);

    const focus = await evalJSON<boolean>(page, 'document.body.classList.contains("wd-map-focus")');
    expect(focus).toBe(false);
  });

  test('single tap enters focus', async ({ page }, testInfo) => {
    tagTest('light', 'mobile', 'gestures');
    await page.touchscreen.tap(195, 420);
    await page.waitForTimeout(900);

    const focus = await evalJSON<boolean>(page, 'document.body.classList.contains("wd-map-focus")');
    await attachScreenshot(page, testInfo, 'gesture-single-tap-focus');
    expect(focus).toBe(true);
  });
});
