const { chromium } = require('playwright');

const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

(async () => {
  const browser = await chromium.launch();
  // Desktop too for the full matrix
  for (const [name, vp, mob, scheme] of [
    ['m-light', { width: 390, height: 844 }, true, 'light'],
    ['m-dark', { width: 390, height: 844 }, true, 'dark'],
    ['d-light', { width: 1440, height: 900 }, false, 'light'],
    ['d-dark', { width: 1440, height: 900 }, false, 'dark'],
  ]) {
    const ctx = await browser.newContext({
      viewport: vp,
      isMobile: mob,
      hasTouch: mob,
      colorScheme: scheme,
      serviceWorkers: 'block',
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
    await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(18000);
    await p.evaluate(`${GET_MAP}.jumpTo({center:[8.0,46.62],zoom:14})`);
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `/tmp/mx-${name}-base.png` });

    // ── Slope ON ──
    await p.evaluate('document.querySelectorAll(".wd-ovl__row")[5]?.click()');
    await p.waitForTimeout(8000);
    await p.screenshot({ path: `/tmp/mx-${name}-slope.png` });

    // ── Slope OFF again + expand overlay box ──
    await p.evaluate('document.querySelectorAll(".wd-ovl__row")[5]?.click()');
    await p.waitForTimeout(800);
    await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await p.waitForTimeout(700);
    await p.screenshot({ path: `/tmp/mx-${name}-expanded.png` });
    // scroll rows to bottom → bottom fade hidden, top fade visible
    await p.evaluate('document.querySelector(".wd-ovl__rows")?.scrollTo({top: 999})');
    await p.waitForTimeout(400);
    await p.screenshot({ path: `/tmp/mx-${name}-scrolled.png` });

    // ── Basemap rail open ──
    await p.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `/tmp/mx-${name}-basemap.png` });

    // ── Focus mode ──
    await p.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
    await p.waitForTimeout(900);
    await p.screenshot({ path: `/tmp/mx-${name}-focus.png` });

    console.log(name, 'done', errs.length ? 'ERRS:' + errs[0] : '');
    await ctx.close();
  }
  await browser.close();
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
