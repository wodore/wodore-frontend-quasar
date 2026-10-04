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

  // 1. Expand the overlay
  await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
  await p.waitForTimeout(700);

  // 2. Edit mode toggle exists
  const editBtn = await p.evaluate(() => {
    const btn = document.querySelector('.wd-ovl__toolbar-btn:not([disabled])');
    return btn ? { exists: true, label: btn.getAttribute('aria-label') } : { exists: false };
  });
  console.log('edit button:', JSON.stringify(editBtn));

  // 3. Enter edit mode
  await p.evaluate('document.querySelector(".wd-ovl__toolbar-btn:not([disabled])")?.click()');
  await p.waitForTimeout(500);

  // 4. Remove buttons appear on group rows
  const removeBtns = await p.evaluate(() =>
    document.querySelectorAll('.wd-ovl__row-action--remove').length
  );
  console.log('remove buttons (group rows):', removeBtns);

  // 5. Add buttons appear on "All layers" rows NOT in the group
  const addBtns = await p.evaluate(() =>
    document.querySelectorAll('.wd-ovl__row-action--add').length
  );
  console.log('add buttons (other rows):', addBtns);

  await p.screenshot({ path: '/tmp/edit-mode.png' });

  // 6. Test: remove a layer from the group
  const removeTarget = await p.evaluate(() => {
    const btn = document.querySelector('.wd-ovl__row-action--remove');
    if (!btn) return null;
    const row = btn.closest('.wd-ovl__row');
    return row ? row.querySelector('.wd-ovl__row-name')?.textContent : null;
  });
  console.log('will remove:', removeTarget);
  await p.evaluate('document.querySelector(".wd-ovl__row-action--remove")?.click()');
  await p.waitForTimeout(500);

  const afterRemove = await p.evaluate(() => ({
    groupRows: document.querySelectorAll('.wd-ovl__rows .wd-ovl__row:not(.wd-ovl__row--other)').length,
    otherRows: document.querySelectorAll('.wd-ovl__row--other').length,
  }));
  console.log('after remove:', JSON.stringify(afterRemove));

  // 7. Test: add a layer back
  const addTarget = await p.evaluate(() => {
    const btn = document.querySelector('.wd-ovl__row-action--add');
    if (!btn) return null;
    const row = btn.closest('.wd-ovl__row');
    return row ? row.querySelector('.wd-ovl__row-name')?.textContent : null;
  });
  console.log('will add:', addTarget);
  await p.evaluate('document.querySelector(".wd-ovl__row-action--add")?.click()');
  await p.waitForTimeout(500);

  const afterAdd = await p.evaluate(() => ({
    groupRows: document.querySelectorAll('.wd-ovl__rows .wd-ovl__row:not(.wd-ovl__row--other)').length,
  }));
  console.log('after add:', JSON.stringify(afterAdd));
  await p.screenshot({ path: '/tmp/edit-after.png' });

  // 8. Exit edit mode
  await p.evaluate('document.querySelector(".wd-ovl__toolbar-btn--active")?.click()');
  await p.waitForTimeout(400);

  const afterExit = await p.evaluate(() =>
    document.querySelectorAll('.wd-ovl__row-action--remove, .wd-ovl__row-action--add').length
  );
  console.log('after exit edit mode, edit buttons visible:', afterExit);

  console.log('page errors:', errs.length ? errs[0] : 'none');
  await browser.close();
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
