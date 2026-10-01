/**
 * Visual regression — pixel-level comparison on deterministic chrome states.
 *
 * Uses Playwright's built-in toHaveScreenshot() which:
 *   - captures a reference on first run (stored in tests/interaction/__screenshots__/)
 *   - compares against the reference on subsequent runs
 *   - produces a diff image on failure
 *
 * Update references: npx playwright test tests/interaction/visual-regression.spec.ts --update-snapshots
 *
 * Only captures DETERMINISTIC states (the map controls without live tile
 * data behind them) — hut/home states render staging data and vary run-to-run.
 */
import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { loadMap, pinTheme, tagTest } from './helpers';

// Only the most stable states — the map behind is cropped out where possible
const STATES = [
  { id: 'overlay-strip', theme: 'light', mode: 'mobile' },
  { id: 'overlay-expanded', theme: 'light', mode: 'mobile' },
  { id: 'basemap-rail', theme: 'light', mode: 'mobile' },
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
          // default state — strip is open
          break;
        case 'overlay-expanded':
          await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
          await page.waitForTimeout(700);
          break;
        case 'basemap-rail':
          await page.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
          await page.waitForTimeout(700);
          break;
        case 'focus-mode':
          await page.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
          await page.waitForTimeout(900);
          break;
        case 'topbar':
          // just capture the top area
          break;
      }

      // Capture only the CONTROL AREA (right edge, bottom) — not the full page
      // which includes variable map tiles
      const clip =
        id === 'topbar'
          ? { x: 0, y: 0, width: 390, height: 80 }
          : id === 'focus-mode'
            ? { x: 200, y: 200, width: 190, height: 644 }
            : { x: 200, y: 300, width: 190, height: 544 };

      await expect(page).toHaveScreenshot(`${id}-${theme}-${mode}.png`, {
        clip,
        maxDiffPixels: 100, // tolerate antialiasing
        animations: 'disabled',
      });
    });
  }
});
