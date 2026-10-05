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

  // 1. Mini strip: group layers + distinct selector
  const mini = await p.evaluate(() => ({
    groupRows: document.querySelectorAll('.wd-ovl__rows .wd-ovl__row:not(.wd-ovl__row--other)').length,
    groupBtn: !!document.querySelector('.wd-ovl__group-btn'),
    groupBtnSpansWidth: (() => {
      const btn = document.querySelector('.wd-ovl__group-btn');
      const box = document.querySelector('.wd-ovl__box');
      return btn && box ? btn.getBoundingClientRect().width === box.getBoundingClientRect().width : false;
    })(),
    groupBtnHasArrow: !!document.querySelector('.wd-ovl__group-arrow'),
    groupBtnHasBorder: (() => {
      const btn = document.querySelector('.wd-ovl__group-btn');
      return btn ? getComputedStyle(btn).borderTopWidth !== '0px' : false;
    })(),
  }));
  console.log('mini:', JSON.stringify(mini));
  await p.screenshot({ path: '/tmp/v2-mini.png', clip: { x: 240, y: 250, width: 135, height: 500 } });

  // 2. Expanded: same height, wider, group name in toolbar, scrolls
  const miniBoxH = await p.evaluate('Math.round(document.querySelector(".wd-ovl__box").getBoundingClientRect().height)');
  await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
  await p.waitForTimeout(600);
  const expanded = await p.evaluate(() => ({
    toolbarTitle: document.querySelector('.wd-ovl__toolbar-title')?.textContent,
    boxW: Math.round(document.querySelector('.wd-ovl__box').getBoundingClientRect().width),
    otherRows: document.querySelectorAll('.wd-ovl__row--other').length,
    allSep: !!document.querySelector('.wd-ovl__all-sep'),
    rowsScrollable: (() => {
      const rows = document.querySelector('.wd-ovl__rows');
      return rows ? rows.scrollHeight > rows.clientHeight : false;
    })(),
  }));
  const expandedBoxH = await p.evaluate('Math.round(document.querySelector(".wd-ovl__box").getBoundingClientRect().height)');
  console.log('expanded:', JSON.stringify(expanded), '| miniH:', miniBoxH, '→ expandedH:', expandedBoxH);
  await p.screenshot({ path: '/tmp/v2-expanded.png' });

  // 3. Edit mode: +/− buttons
  await p.evaluate('document.querySelector(".wd-ovl__toolbar-btn")?.click()');
  await p.waitForTimeout(400);
  const edit = await p.evaluate(() => ({
    removeBtns: document.querySelectorAll('.wd-ovl__row-action--remove').length,
    addBtns: document.querySelectorAll('.wd-ovl__row-action--add').length,
  }));
  console.log('edit mode:', JSON.stringify(edit));
  await p.screenshot({ path: '/tmp/v2-edit.png' });
  await p.evaluate('document.querySelector(".wd-ovl__toolbar-btn")?.click()');
  await p.waitForTimeout(300);

  // 4. Group switch: map layers update + animation class
  const M = 'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';
  await p.evaluate('document.querySelector(".wd-ovl__group-btn")?.click()');
  await p.waitForTimeout(600);
  const afterSwitch = await p.evaluate(() => ({
    rowsAnimation: getComputedStyle(document.querySelector('.wd-ovl__rows')).animationName,
    hutsVis: (() => {
      const map = document.querySelector('.maplibregl-map').__vueParentComponent.exposed.map._value;
      try { return map.getLayoutProperty('wd-huts', 'visibility'); } catch { return 'no-layer'; }
    })(),
  }));
  console.log('after group switch:', JSON.stringify(afterSwitch));

  console.log('errors:', errs.length ? errs[0] : 'none');
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
