const { chromium } = require('playwright');

const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

(async () => {
  const browser = await chromium.launch();

  // ── Mobile probe ──
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: 'block',
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 100)));
    await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(18000);

    // Expand + measure
    await p.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await p.waitForTimeout(700);
    const m1 = await p.evaluate(() => {
      const r = s => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), op: cs.opacity };
      };
      return {
        vw: window.innerWidth,
        pill: r('.wd-topbar__pill'),
        date: r('.wd-topbar__date'),
        user: r('.wd-topbar__user'),
        box: r('.wd-ovl__box'),
        more: r('.wd-ovl__more'),
        rows: r('.wd-ovl__rows'),
        fadeTop: r('.wd-ovl__fade--top'),
        fadeBottom: r('.wd-ovl__fade--bottom'),
        gps: r('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-group'),
        attrib: r('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-attrib'),
        scale: r('.maplibregl-ctrl-top-left .maplibregl-ctrl-scale'),
      };
    });
    console.log('MOBILE expanded metrics:', JSON.stringify(m1));

    // Scroll rows to bottom, check fade states
    await p.evaluate('document.querySelector(".wd-ovl__rows")?.scrollTo({top: 9999})');
    await p.waitForTimeout(500);
    const fades = await p.evaluate(() => ({
      top: getComputedStyle(document.querySelector('.wd-ovl__fade--top')).opacity,
      bottom: getComputedStyle(document.querySelector('.wd-ovl__fade--bottom')).opacity,
      scrollTop: document.querySelector('.wd-ovl__rows')?.scrollTop,
    }));
    console.log('MOBILE scrolled fades:', JSON.stringify(fades));

    // Focus mode click + body class
    await p.evaluate('document.querySelector(".wd-focus-toggle")?.click()');
    await p.waitForTimeout(1000);
    const focus = await p.evaluate(() => ({
      bodyClass: document.body.className,
      mapFocus: !!document.querySelector('.wd-focus-toggle--active'),
      btnOp: getComputedStyle(document.querySelector('.wd-focus-toggle') || document.body).opacity,
      btnRect: (() => { const b = document.querySelector('.wd-focus-toggle')?.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) } : null; })(),
    }));
    console.log('MOBILE focus:', JSON.stringify(focus), errs.length ? 'ERRS ' + errs[0] : '');
    await p.screenshot({ path: '/tmp/dbg-m-focus.png' });
    await ctx.close();
  }

  // ── Desktop probe ──
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    });
    const p = await ctx.newPage();
    await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(18000);
    const d = await p.evaluate(() => {
      const ctrls = [...document.querySelectorAll('.maplibregl-ctrl-top-right .maplibregl-ctrl')].map(c => {
        const b = c.getBoundingClientRect();
        return { cls: c.className.split(' ').pop(), y: Math.round(b.y), h: Math.round(b.height), op: getComputedStyle(c).opacity };
      });
      const fb = document.querySelector('.wd-focus-toggle')?.getBoundingClientRect();
      const utils = document.querySelector('.wd-topbar__utils')?.getBoundingClientRect();
      const attrib = document.querySelector('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-attrib')?.getBoundingClientRect();
      const scale = document.querySelector('.maplibregl-ctrl-bottom-left .maplibregl-ctrl-scale')?.getBoundingClientRect();
      return {
        ctrls,
        focusBtn: fb ? { x: Math.round(fb.x), y: Math.round(fb.y) } : null,
        focusOp: getComputedStyle(document.querySelector('.wd-focus-toggle') || document.body).opacity,
        utils: utils ? { x: Math.round(utils.x), y: Math.round(utils.y), h: Math.round(utils.height) } : null,
        attrib: attrib ? { x: Math.round(attrib.x), y: Math.round(attrib.y) } : null,
        scale: scale ? { x: Math.round(scale.x), y: Math.round(scale.y) } : null,
      };
    });
    console.log('DESKTOP metrics:', JSON.stringify(d));
    await ctx.close();
  }
  await browser.close();
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
