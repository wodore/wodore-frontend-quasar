/**
 * Visual regression — pixel-level comparison on deterministic chrome states.
 *
 * Uses Playwright's built-in toHaveScreenshot() which:
 *   - captures a reference on first run (stored in tests/interaction/__screenshots__/)
 *   - compares against the reference on subsequent runs
 *   - produces a diff image on failure
 *
 * Update references: yarn test:snapshots-update
 *
 * Captures the FULL viewport width — the controls live at the right edge
 * but their visual context (what's beside them, the map margin) matters.
 */
import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { loadMap, pinTheme, tagTest } from './helpers';

const STATES = [
  { id: 'overlay-strip', theme: 'light', mode: 'mobile' },
  { id: 'overlay-expanded', theme: 'light', mode: 'mobile' },
  { id: 'basemap-rail', theme: 'light', mode: 'mobile' },
  { id: 'zoom-only', theme: 'light', mode: 'mobile' },
  { id: 'focus-mode', theme: 'light', mode: 'mobile' },
  { id: 'overlay-strip', theme: 'dark', mode: 'mobile' },
  { id: 'overlay-expanded', theme: 'dark', mode: 'mobile' },
  { id: 'topbar', theme: 'light', mode: 'mobile' },
  { id: 'topbar', theme: 'dark', mode: 'mobile' },
] as const;

test.describe('visual regression', () => {
  for (const { id, theme, mode } of STATES) {
    test(`${theme}-${mode}: ${id} matches reference`, async ({ page }) => {
      tagTest(theme, mode, `visual-regression-${id}`);
      test.setTimeout(90_000);

      await page.setViewportSize({ width: 390, height: 844 });
      await loadMap(page);
      await pinTheme(page, theme);

      // Navigate to the state
      switch (id) {
        case 'overlay-strip':
          // default state — strip is open, zoom hidden
          break;
        case 'overlay-expanded':
          await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
          await page.waitForTimeout(700);
          break;
        case 'basemap-rail':
          await page.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
          await page.waitForTimeout(700);
          break;
        case 'zoom-only':
          // close the overlay strip — zoom handle becomes visible
          await page.evaluate('document.querySelector(".wd-ovl__toggle")?.click()');
          await page.waitForTimeout(500);
          break;
        case 'focus-mode':
          await page.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
          await page.waitForTimeout(900);
          break;
        case 'topbar':
          // just the top area
          break;
      }

      // Full viewport for most states; topbar clips to the pill area
      const clip =
        id === 'topbar'
          ? { x: 0, y: 0, width: 390, height: 80 }
          : undefined; // full page — the controls' context matters

      await expect(page).toHaveScreenshot(`${id}-${theme}-${mode}.png`, {
        ...(clip ? { clip } : {}),
        maxDiffPixels: 200, // tolerate antialiasing + map tile edges
        animations: 'disabled',
        caret: 'hide',
      });
    });
  }
});
