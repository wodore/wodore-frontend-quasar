/**
 * Layout and size audit — 48px controls, alignment, pill centering.
 */
import { test, expect } from './helpers';
import {
  waitForMapIdle,
  waitForOverlayExpanded,
  loadMap,
  pinTheme,
  tagTest,
  attachScreenshot,
  evalJSON,
} from './helpers';

const CONFIGS = [
  { theme: 'light', mode: 'mobile' },
  { theme: 'dark', mode: 'mobile' },
  { theme: 'light', mode: 'desktop' },
  { theme: 'dark', mode: 'desktop' },
] as const;

test.describe('layout and sizing', () => {
  for (const { theme, mode } of CONFIGS) {
    test(`${theme}-${mode}: 48px control audit + alignment`, async ({ page }, testInfo) => {
      tagTest(theme, mode, 'layout');
      test.setTimeout(90_000);

      const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
      await page.setViewportSize(vp);

      await loadMap(page);
      await pinTheme(page, theme);

      const audit = await evalJSON(
        page,
        `(() => {
        const rect = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right), b: Math.round(b.bottom) };
        };
        return {
          overlayToggle: rect('.wd-ovl__toggle'),
          basemapToggle: rect('.wd-bm__toggle'),
          focus: rect('.wd-focus-toggle'),
          gps: rect('.maplibregl-ctrl-bottom-left div.maplibregl-ctrl-group:first-of-type'),
          nav: rect('.maplibregl-ctrl-bottom-left div.maplibregl-ctrl-group + div.maplibregl-ctrl-group'),
          overlayBox: rect('.wd-ovl__box'),
          chip: rect('.wd-ovl__icon'),
          pill: rect('.wd-topbar__pill'),
          basemapRail: null,
        };
      })()`
      );

      // Open basemap rail for its measurement
      await page.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
      await page.waitForSelector('.wd-bm__rail', { timeout: 5_000 });
      const railH = await page.evaluate(
        'Math.round(document.querySelector(".wd-bm__rail")?.getBoundingClientRect().height ?? -1)'
      );
      await page.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
      await page.waitForSelector('.wd-bm__rail', { state: 'hidden', timeout: 5_000 });

      await attachScreenshot(page, testInfo, `${theme}-${mode}-layout`);

      // All standalone TOGGLES: 48px × 48px (the box is only width-checked)
      for (const [name, c] of Object.entries(audit)) {
        if (
          !c ||
          name === 'basemapRail' ||
          name === 'pill' ||
          name === 'chip' ||
          name === 'overlayBox'
        )
          continue;
        expect(Math.abs((c as { w: number }).w - 48), `${name} width`).toBeLessThanOrEqual(1);
        expect(Math.abs((c as { h: number }).h - 48), `${name} height`).toBeLessThanOrEqual(1);
      }

      // Overlay box = 48px wide
      expect(Math.abs(audit.overlayBox!.w - 48)).toBeLessThanOrEqual(1);

      // Chip = 40px
      expect(Math.abs(audit.chip!.w - 40)).toBeLessThanOrEqual(1);

      // Basemap rail = 48px
      expect(Math.abs(railH - 48)).toBeLessThanOrEqual(1);

      // Right edges aligned (overlay toggle, basemap toggle, overlay box)
      const edges = [audit.overlayToggle!.r, audit.basemapToggle!.r, audit.overlayBox!.r];
      expect(Math.max(...edges) - Math.min(...edges), 'right edges aligned').toBeLessThanOrEqual(2);

      if (mode === 'mobile') {
        // GPS above nav, merged chip
        expect(audit.gps!.y).toBeLessThan(audit.nav!.y);
        expect(Math.abs(audit.gps!.x - audit.nav!.x)).toBeLessThan(2);
        expect(Math.abs(audit.nav!.y - audit.gps!.y - audit.gps!.h)).toBeLessThan(3);

        // Pill centered
        const vw = 390;
        expect(Math.abs(audit.pill!.x - (vw - audit.pill!.x - audit.pill!.w))).toBeLessThan(12);
      } else {
        // Focus top-right on desktop
        expect(audit.focus!.y).toBeLessThanOrEqual(16);
        expect(audit.focus!.x).toBeGreaterThan(1300);

        // Pill centered on desktop
        const vw = 1440;
        expect(Math.abs(audit.pill!.x - (vw - audit.pill!.x - audit.pill!.w))).toBeLessThan(12);
      }
    });
  }
});
