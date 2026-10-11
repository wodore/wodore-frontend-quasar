/**
 * Layout and size audit — 48px controls, alignment, pill resting position.
 */
import { test, expect } from './helpers';
import { loadMap, pinTheme, tagTest, attachScreenshot, evalJSON } from './helpers';

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

        // Pill rests on the reserved panel slot: center at
        // (viewport − panel width)/2 in BOTH panel states — zero movement
        // when hut details open/close (owner 2026-10). 1440px → 460px panel.
        const vw = 1440;
        const panelW = 460;
        const expectedCenter = (vw - panelW) / 2;
        const pillCenter = audit.pill!.x + audit.pill!.w / 2;
        expect(Math.abs(pillCenter - expectedCenter)).toBeLessThan(2);
      }
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}-desktop: pill holds its slot across hut details open/close`, async ({
      page,
    }, testInfo) => {
      tagTest(theme, 'desktop', 'layout');
      test.setTimeout(90_000);

      await page.setViewportSize({ width: 1440, height: 900 });
      await loadMap(page);
      await pinTheme(page, theme);

      // Retry-safe: a backend-failure redirect can navigate under any
      // evaluate on CI (execution context destroyed); ride it out and
      // retry — the pill is static, so the assertions hold from wherever
      // the app lands.
      const pillRect = () =>
        page
          .evaluate(() => {
            const b = document.querySelector('.wd-topbar__pill')!.getBoundingClientRect();
            return { x: Math.round(b.x), cx: Math.round(b.x + b.width / 2) };
          })
          .catch(() =>
            page.evaluate(() => {
              const b = document.querySelector('.wd-topbar__pill')!.getBoundingClientRect();
              return { x: Math.round(b.x), cx: Math.round(b.x + b.width / 2) };
            })
          );
      const setRoute = (path: string) =>
        page
          .evaluate(p => {
            history.pushState({}, '', p);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, path)
          .catch(() =>
            page.evaluate(p => {
              history.pushState({}, '', p);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }, path)
          );

      const closed = await pillRect();

      // Open hut details via the in-app router. A full page.goto here
      // races the map's own hash-position navigation (interrupted-
      // navigation on CI) and pays reloads that starve the parallel
      // workers. Works regardless of backend state — the drawer opens
      // even into its error state.
      const slug = process.env.E2E_HUT_SLUG ?? 'aarbiwak';
      await setRoute(`/hut/${slug}`);
      await page.waitForFunction(
        () => document.body.classList.contains('wd-sidepanel-open'),
        null,
        {
          timeout: 10_000,
        }
      );
      await page.waitForTimeout(300); // let the drawer's 140ms slide finish (clean screenshot)
      const open = await pillRect();
      await attachScreenshot(page, testInfo, `${theme}-pill-slot-open`);

      // Back to the bare map. If a backend-failure redirect already
      // navigated home, the class is gone — fine either way.
      await setRoute('/');
      await page
        .waitForFunction(() => !document.body.classList.contains('wd-sidepanel-open'), null, {
          timeout: 10_000,
        })
        .catch(() => {});
      const reclosed = await pillRect();

      // The owner contract: the pill rests at the reserved panel slot —
      // center (viewport − panel)/2 at 1440px = 490 — and NEVER moves.
      expect(Math.abs(open.cx - (1440 - 460) / 2)).toBeLessThan(2);
      expect(Math.abs(open.x - closed.x)).toBeLessThan(2);
      expect(Math.abs(reclosed.x - closed.x)).toBeLessThan(2);
    });
  }
});
