const { chromium } = require('playwright');

/**
 * FULL visual matrix: 6 states x 2 themes x 2 viewports.
 * States: base, date-selected, expanded, basemap-open, focus, focus-exit
 * Output: /tmp/mx2/<viewport>-<theme>-<state>.png (+ topbar crops)
 */
const STATES = ['base', 'date', 'expanded', 'basemap', 'focus', 'focusexit'];

async function pinDark(p) {
  await p.evaluate('document.querySelector(".wd-topbar__user")?.click()');
  await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    if (await p.evaluate(() => document.body.classList.contains('body--dark'))) break;
    await p.evaluate('document.querySelector("[data-testid=theme-cycle]")?.click()');
    await p.waitForTimeout(400);
  }
  await p.evaluate('document.querySelector(".wd-topbar__user")?.click()');
  await p.waitForTimeout(600);
}

(async () => {
  const fs = require('fs');
  fs.mkdirSync('/tmp/mx2', { recursive: true });
  const browser = await chromium.launch();

  for (const [mode, vp, mob] of [
    ['mobile', { width: 375, height: 812 }, true],
    ['desktop', { width: 1440, height: 900 }, false],
  ]) {
    for (const theme of ['light', 'dark']) {
      const tag = `${mode}-${theme}`;
      // two sessions: empty-date (base states) and date-selected
      for (const dateSet of [false, true]) {
        const ctx = await browser.newContext({
          viewport: vp,
          isMobile: mob,
          hasTouch: mob,
          serviceWorkers: 'block',
          deviceScaleFactor: mob ? 2 : 1,
        });
        const p = await ctx.newPage();
        await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await p.waitForTimeout(14000);
        if (theme === 'dark') await pinDark(p);
        if (dateSet) {
          // REAL flow: open the calendar popup and pick a day
          await p.evaluate('document.querySelector(".wd-date-btn")?.click()');
          await p.waitForTimeout(900);
          const picked = await p.evaluate(() => {
            const days = [...document.querySelectorAll('.q-date__calendar-item button')]
              .filter(b => !b.disabled && !b.classList.contains('q-date__calendar-item--disable'));
            const target = days[Math.min(9, days.length - 1)];
            if (target) { target.click(); return true; }
            return false;
          });
          await p.waitForTimeout(1200);
          const dayText = await p.evaluate('document.querySelector(".wd-date-btn__day")?.textContent || ""');
          if (!picked || /availab|verfüg/i.test(dayText)) console.log(`  WARN: date not selected (${tag})`);
        }

        const suffix = dateSet ? '-datesel' : '';
        const shot = async (state, opts = {}) => {
          await p.screenshot({ path: `/tmp/mx2/${tag}-${state}${suffix}.png`, ...opts });
        };

        // BASE
        if (!dateSet) {
          await shot('base');
          await shot('base-top', { clip: { x: 0, y: 0, width: vp.width, height: mob ? 80 : 90 } });
        } else {
          await shot('date');
          await shot('date-top', { clip: { x: 0, y: 0, width: vp.width, height: mob ? 80 : 90 } });
        }

        // EXPANDED
        await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
        await p.waitForTimeout(700);
        await shot('expanded');
        // collapse again
        await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
        await p.waitForTimeout(400);

        // BASEMAP OPEN
        await p.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
        await p.waitForTimeout(600);
        await shot('basemap', mob
          ? { clip: { x: 100, y: vp.height - 130, width: vp.width - 100, height: 130 } }
          : { clip: { x: vp.width - 400, y: vp.height - 130, width: 400, height: 130 } });
        await p.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
        await p.waitForTimeout(400);

        // FOCUS
        await p.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
        await p.waitForTimeout(900);
        await shot('focus');
        // FOCUS-EXIT (X visible)
        await shot('focusexit', mob
          ? { clip: { x: vp.width - 120, y: 0, width: 120, height: 120 } }
          : { clip: { x: vp.width - 140, y: 0, width: 140, height: 140 } });

        await ctx.close();
      }
      console.log(tag, 'done');
    }
  }
  await browser.close();
  console.log('matrix complete:', fs.readdirSync('/tmp/mx2').length, 'files');
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
