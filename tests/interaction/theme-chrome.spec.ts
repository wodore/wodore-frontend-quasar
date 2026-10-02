/**
 * Theme chrome tests — chip backgrounds, ink colors, icon filters.
 * Runs light AND dark, mobile AND desktop.
 */
import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { loadMap, pinTheme, tagTest, attachScreenshot, evalJSON, parseColor } from './helpers';

const CONFIGS = [
  { theme: 'light', mode: 'mobile' },
  { theme: 'dark', mode: 'mobile' },
  { theme: 'light', mode: 'desktop' },
  { theme: 'dark', mode: 'desktop' },
] as const;

test.describe('map chrome theming', () => {
  for (const { theme, mode } of CONFIGS) {
    test(`${theme}-${mode}: chip backgrounds and ink`, async ({ page }, testInfo) => {
      tagTest(theme, mode, 'theming');
      test.setTimeout(90_000);

      const vp = mode === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 };
      await page.setViewportSize(vp);

      await loadMap(page);
      await pinTheme(page, theme);

      const isDark = theme === 'dark';
      const chips = await evalJSON<Record<string, string>>(page, () => {
        const q = (s: string) => document.querySelector(s);
        const bg = (s: string) => (q(s) ? getComputedStyle(q(s)!).backgroundColor : 'MISSING');
        return {
          pill: bg('.wd-topbar__pill'),
          overlayBox: bg('.wd-ovl__box'),
          overlayToggle: bg('.wd-ovl__toggle'),
          basemapToggle: bg('.wd-bm__toggle'),
          focus: bg('.wd-focus-toggle'),
          attribution: bg('.wd-attrib'),
          dateSegment: bg('.wd-topbar__date'),
        };
      });

      await attachScreenshot(page, testInfo, `${theme}-${mode}-chrome`);

      for (const [name, value] of Object.entries(chips)) {
        if (value === 'MISSING') {
          if (name === 'attribution' && mode === 'desktop') continue; // desktop uses MapLibre's own
          test.fail(true, `${name} element missing`);
          continue;
        }
        const [r, g, b] = parseColor(value);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (name === 'dateSegment') continue; // wash, not a chip
        if (theme === "dark") {
          expect(lum, `${name} should be pine-dark in dark (${value})`).toBeLessThan(80);
        } else {
          expect(lum, `${name} should be white in light (${value})`).toBeGreaterThan(195);
        }
      }
    });

    test(`${theme}-${mode}: icon invert treatment`, async ({ page }, testInfo) => {
      tagTest(theme, mode, 'theming');
      test.setTimeout(90_000);

      const vp = mode === 'mobile'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 };
      await page.setViewportSize(vp);

      await loadMap(page);
      await pinTheme(page, theme);

      const filters = await evalJSON(page, `(() => {
        const g = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).filter : 'MISSING'; };
        return {
          canvas: g('.maplibregl-canvas'),
          layerIcon: g('.wd-ovl__icon .q-icon'),
          overlayToggleIcon: g('.wd-ovl__toggle-icon'),
          basemapToggleIcon: g('.wd-bm__toggle-icon'),
        };
      })()`);

      // Map is NEVER darkened
      expect(filters.canvas).toBe('none');

      if (theme === "dark") {
        // Layer icons: inverted (black silhouettes → white)
        expect(filters.layerIcon).toContain('invert');
        // Toggle icons: NOT inverted (colored graphics keep their colors)
        expect(filters.overlayToggleIcon).toBe('none');
        expect(filters.basemapToggleIcon).toBe('none');
      } else {
        expect(filters.layerIcon).toBe('none');
      }
    });
  }
});
