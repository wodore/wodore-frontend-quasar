const { chromium } = require('playwright');

const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

// Explicit theme pinning: set ui.theme in the user settings store BEFORE
// the app boots (auto/prefers-color-scheme was the old flaky path).
/**
 * Apply the theme through the app's OWN switcher (data-testid theme-cycle)
 * — the same path the owner uses. Clicks cycle auto → light → dark.
 */
async function pinTheme(page, theme) {
  if (theme === 'light') return; // default boot state is light/auto→light
  // Mobile: the switcher lives in the menu drawer — open it first
  const isMobile = page.viewportSize().width < 900;
  if (isMobile) {
    await page.evaluate('document.querySelector(".wd-topbar__user")?.click()');
    await page.waitForTimeout(700);
  }
  for (let i = 0; i < 3; i++) {
    const dark = await page.evaluate(() => document.body.classList.contains('body--dark'));
    if (dark) break;
    await page.evaluate('document.querySelector("[data-testid=theme-cycle]")?.click()');
    await page.waitForTimeout(400);
  }
  if (isMobile) {
    await page.evaluate('document.querySelector(".wd-topbar__user")?.click()');
    await page.waitForTimeout(500);
  }
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  const failures = [];

  function check(name, cond, detail = '') {
    report.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) failures.push(name);
  }

  for (const theme of ['light', 'dark']) {
    for (const [mode, vp, mob] of [
      ['mobile', { width: 390, height: 844 }, true],
      ['desktop', { width: 1440, height: 900 }, false],
    ]) {
      const tag = `${mode}-${theme}`;
      const ctx = await browser.newContext({
        viewport: vp,
        isMobile: mob,
        hasTouch: mob,
        serviceWorkers: 'block',
      });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e).slice(0, 80)));
      await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(12000);
      await pinTheme(p, theme);
      await p.waitForTimeout(1500);

      // ── Theme actually applied? ──
      const themeOk = await p.evaluate(() => document.body.classList.contains(`body--${localStorage.getItem('x') ? '' : ''}`) || true);
      const bodyClass = await p.evaluate(() => document.body.className);
      check(`${tag}: theme class`, bodyClass.includes(`body--${theme}`), bodyClass.slice(0, 60));

      // ── Computed COLOR assertions (the old suite never did this) ──
      const colors = await p.evaluate(() => {
        const q = s => document.querySelector(s);
        const bg = s => (q(s) ? getComputedStyle(q(s)).backgroundColor : 'MISSING');
        const color = s => (q(s) ? getComputedStyle(q(s)).color : 'MISSING');
        return {
          pillBg: bg('.wd-topbar__pill'),
          ovlBoxBg: bg('.wd-ovl__box'),
          ovlToggleBg: bg('.wd-ovl__toggle'),
          bmToggleBg: bg('.wd-bm__toggle'),
          focusBg: bg('.wd-focus-toggle'),
          attribBg: bg('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib, .maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib'),
          dateBg: bg('.wd-topbar__date'),
          pillInk: color('.wd-topbar__user'),
        };
      });
      const isDarkChip = c => c !== 'MISSING' && /rgb\(1[0-9], |rgb\(2[0-5], 2[0-5]|#11/.test(c) ? true : c.startsWith('rgb(17') || c.startsWith('rgb(1');
      const rgb = v => (v.match(/\d+/g) || []).map(Number);
      for (const [k, v] of Object.entries(colors)) {
        if (v === 'MISSING') { if (k !== 'attribBg') check(`${tag}: ${k} exists`, false); continue; }
        const m = rgb(v);
        if (m.length < 3) { check(`${tag}: ${k} parse`, false, v); continue; }
        if (k === 'dateBg') continue; // green wash in both themes
        if (k === 'pillInk') {
          // text ink: dark-on-light, light-on-dark
          const lum = 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];
          check(`${tag}: ${k} (${v})`, theme === 'dark' ? lum > 120 : lum < 150);
          continue;
        }
        // surfaces: white chips in light, pine chips in dark
        const ok = theme === 'dark' ? m[0] < 60 && m[1] < 80 && m[2] < 70 : m[0] > 200 && m[1] > 200 && m[2] > 195;
        check(`${tag}: ${k} ${theme} (${v})`, ok);
      }

      // ── Layout assertions ──
      const layout = await p.evaluate(mode => {
        const q = s => document.querySelector(s);
        const rect = s => {
          const el = q(s);
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        };
        return {
          pill: rect('.wd-topbar__pill'),
          focus: rect('.wd-focus-toggle'),
          gps: rect(mode === 'desktop' ? '.maplibregl-ctrl-top-right .maplibregl-ctrl-group' : '.maplibregl-ctrl-bottom-left .maplibregl-ctrl-group'),
          nav: rect('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-group:nth-child(2)'),
          ovlToggle: rect('.wd-ovl__toggle'),
          bmToggle: rect('.wd-bm__toggle'),
          bmBtns: document.querySelectorAll('.wd-bm__btn').length,
          attrib: rect('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib') || rect('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib'),
        };
      }, mode);
      const bmOpen = await p.evaluate(() => {
        document.querySelector('.wd-bm__toggle')?.click();
        return new Promise(r => setTimeout(() => r(document.querySelectorAll('.wd-bm__btn').length), 400));
      });
      check(`${tag}: basemap count = 3`, bmOpen === 3, String(bmOpen));
      check(`${tag}: sizes match (ovl ${layout.ovlToggle?.w} = bm ${layout.bmToggle?.w})`, layout.ovlToggle?.w === layout.bmToggle?.w);
      if (mode === 'desktop') {
        check(`${tag}: pill centered`, Math.abs((layout.pill.x) - (1440 - layout.pill.x - layout.pill.w)) < 12, `x=${layout.pill?.x} w=${layout.pill?.w}`);
        check(`${tag}: focus top-right`, layout.focus?.y === 14 && layout.focus?.x > 1300, JSON.stringify(layout.focus));
        check(`${tag}: GPS below focus`, (layout.gps?.y ?? 0) > 70, `gps.y=${layout.gps?.y}`);
      } else {
        check(`${tag}: pill centered`, Math.abs((layout.pill.x) - (390 - layout.pill.x - layout.pill.w)) < 12, `x=${layout.pill?.x} w=${layout.pill?.w}`);
        const pillRow = layout.pill?.y ?? 0;
      check(`${tag}: focus top-right on pill row`, Math.abs((layout.focus?.y ?? -99) - pillRow) < 14 && (layout.focus?.x ?? 0) > 320, JSON.stringify(layout.focus));
        check(`${tag}: GPS above nav`, (layout.gps?.y ?? 999) < (layout.nav?.y ?? 0), `gps=${layout.gps?.y} nav=${layout.nav?.y}`);
        check(`${tag}: GPS+nav merged (same x, stacked)`, layout.gps && layout.nav && Math.abs(layout.gps.x - layout.nav.x) < 2 && Math.abs(layout.nav.y - layout.gps.y - layout.gps.h) < 3, `gps=${JSON.stringify(layout.gps)} nav=${JSON.stringify(layout.nav)}`);
      }

      // ── Close the basemap rail (outside-click design: panels are
      //     mutually exclusive) so box geometry is measured clean ──
      await p.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
      await p.waitForTimeout(500);

      // ── Chip geometry (MINI state): equal gutters inside the 48px box ──
      const geomMini = await p.evaluate(() => {
        const box = document.querySelector('.wd-ovl__box')?.getBoundingClientRect();
        const icon = document.querySelector('.wd-ovl__icon')?.getBoundingClientRect();
        return { r: Math.round(box.right - icon.right), l: Math.round(icon.left - box.left), w: Math.round(icon.width) };
      });
      check(`${tag}: chip gutters equal (${geomMini.l}/${geomMini.r})`, geomMini.l === geomMini.r && geomMini.l <= 8, JSON.stringify(geomMini));

      // ── Icons stay when expanding (box grows UP) ──
      const iconYBefore = await p.evaluate('Math.round(document.querySelector(".wd-ovl__icon")?.getBoundingClientRect().y ?? -1)');
      const iconXBefore = await p.evaluate('Math.round(document.querySelector(".wd-ovl__icon")?.getBoundingClientRect().x ?? -1)');
      await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
      await p.waitForTimeout(700);
      const iconYAfter = await p.evaluate('Math.round(document.querySelector(".wd-ovl__icon")?.getBoundingClientRect().y ?? -1)');
      const iconXAfter = await p.evaluate('Math.round(document.querySelector(".wd-ovl__icon")?.getBoundingClientRect().x ?? -1)');
      check(`${tag}: icons stay on expand (y ${iconYBefore}→${iconYAfter})`, iconYBefore === iconYAfter && iconXBefore === iconXAfter);
      // ── Screenshots for vision round ──
      await p.screenshot({ path: `/tmp/v2-${tag}-base.png` });
      await p.screenshot({ path: `/tmp/v2-${tag}-expanded.png` });
      await p.evaluate('document.querySelector(".wd-bm__toggle")?.click()');
      await p.waitForTimeout(600);
      const bmRot = await p.evaluate(() => {
        const icons = [...document.querySelectorAll('.wd-bm__toggle-icon')];
        if (!icons.length) return 'missing';
        // rotation present iff matrix has non-zero b/c or a≠d (pure scale keeps them 0/equal)
        return icons.some(i => {
          const t = getComputedStyle(i).transform;
          if (t === 'none') return false;
          const m = t.match(/matrix\(([^)]+)\)/);
          if (!m) return false;
          const [a, b, c, d] = m[1].split(',').map(Number);
          return Math.abs(b) > 0.001 || Math.abs(c) > 0.001 || Math.abs(a - d) > 0.001;
        });
      });
      check(`${tag}: basemap toggle no rotation`, bmRot === false, String(bmRot));
      await p.screenshot({ path: `/tmp/v2-${tag}-basemap.png` });
      await p.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
      await p.waitForTimeout(900);
      await p.screenshot({ path: `/tmp/v2-${tag}-focus.png` });
      check(`${tag}: no page errors`, errs.length === 0, errs[0] || '');

      await ctx.close();
    }
  }

  // ── REAL touch double-tap test (mobile, light) ──
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const p = await ctx.newPage();
    await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(15000);
    await p.evaluate(`${GET_MAP}.jumpTo({center:[8,46.6],zoom:13})`);
    await p.waitForTimeout(2000);
    // double-tap: two touch taps 180ms apart at map center
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(180);
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(900);
    const focusAfterDoubleTap = await p.evaluate(() => document.body.classList.contains('wd-map-focus'));
    check('double-tap does NOT enter focus', focusAfterDoubleTap === false, String(focusAfterDoubleTap));

    // PAN (drag): must NOT enter focus — synthetic touch pointer sequence
    await p.evaluate(() => {
      const el = document.querySelector('.wd-map-view') || document.querySelector('.maplibregl-map');
      const opts = { bubbles: true, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 195, clientY: 420, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 195, clientY: 380, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 200, clientY: 300, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 200, clientY: 300, pointerId: 1 }));
    });
    await p.waitForTimeout(900);
    const focusAfterPan = await p.evaluate(() => document.body.classList.contains('wd-map-focus'));
    check('pan does NOT enter focus', focusAfterPan === false, String(focusAfterPan));

    // PINCH: second finger cancels
    await p.evaluate(() => {
      const el = document.querySelector('.wd-map-view') || document.querySelector('.maplibregl-map');
      const opts = { bubbles: true, pointerType: 'touch', isPrimary: true };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 150, clientY: 400, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 240, clientY: 400, pointerId: 2 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 150, clientY: 400, pointerId: 1 }));
      el.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 240, clientY: 400, pointerId: 2 }));
    });
    await p.waitForTimeout(900);
    const focusAfterPinch = await p.evaluate(() => document.body.classList.contains('wd-map-focus'));
    check('pinch does NOT enter focus', focusAfterPinch === false, String(focusAfterPinch));
    // single tap: focus after 500ms
    await p.touchscreen.tap(195, 420);
    await p.waitForTimeout(900);
    const focusAfterSingle = await p.evaluate(() => document.body.classList.contains('wd-map-focus'));
    check('single tap enters focus', focusAfterSingle === true, String(focusAfterSingle));
    await ctx.close();
  }

  console.log(report.join('\n'));
  console.log(`\n${failures.length ? failures.length + ' FAILURES: ' + failures.join(', ') : 'ALL CHECKS PASS'}`);
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
