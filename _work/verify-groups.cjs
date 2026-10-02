const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
  await p.goto('http://localhost:9000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(18000);

  // 1. mini strip shows only active group layers
  const miniRows = await p.evaluate(
    () => document.querySelectorAll('.wd-ovl__rows .wd-ovl__row').length
  );

  // 2. group selector button exists
  const groupBtn = await p.evaluate(() => {
    const btn = document.querySelector('.wd-ovl__group-btn');
    return btn ? { exists: true } : { exists: false };
  });

  console.log('mini rows:', miniRows, '| group selector:', JSON.stringify(groupBtn), errs.length ? 'ERRS' : '');
  await p.screenshot({ path: '/tmp/groups-mini.png', clip: { x: 240, y: 250, width: 135, height: 500 } });

  // 3. cycle to next group
  await p.evaluate('document.querySelector(".wd-ovl__group-btn")?.click()');
  await p.waitForTimeout(600);
  const afterCycle = await p.evaluate(() => ({
    rows: document.querySelectorAll('.wd-ovl__rows .wd-ovl__row').length,
    activeLayers: document.querySelectorAll('.wd-ovl__icon--active').length,
  }));
  console.log('after cycle to cycling:', JSON.stringify(afterCycle));

  // 4. expand and check "All layers" section
  await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
  await p.waitForTimeout(700);
  const expanded = await p.evaluate(() => ({
    allSep: !!document.querySelector('.wd-ovl__all-sep'),
    allLabel: document.querySelector('.wd-ovl__all-label')?.textContent,
    otherRows: document.querySelectorAll('.wd-ovl__row--other').length,
  }));
  console.log('expanded:', JSON.stringify(expanded));
  await p.screenshot({ path: '/tmp/groups-expanded.png' });

  await browser.close();
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
