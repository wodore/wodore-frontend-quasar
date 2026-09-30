const { chromium } = require('playwright');

const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const p = await ctx.newPage();
  const slopeTiles = [];
  p.on('request', r => {
    if (r.url().includes('hangneigung')) slopeTiles.push('req');
  });
  p.on('response', r => {
    if (r.url().includes('hangneigung') && r.status() >= 400) slopeTiles.push('ERR' + r.status());
  });
  const spriteErrs = [];
  p.on('console', m => {
    if (/could not be loaded/i.test(m.text())) spriteErrs.push(m.text().slice(0, 80));
  });

  await p.goto('http://localhost:9000/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(18000);

  // Jump to steep alpine terrain at zoom 12.5 (overlay minZoom is 10)
  await p.evaluate(`${GET_MAP}.jumpTo({center:[7.9,46.55],zoom:12.5})`);
  await p.waitForTimeout(4000);

  // Toggle Slope angle (row index 5)
  await p.evaluate('document.querySelectorAll(".wd-ovl__row")[5]?.click()');
  await p.waitForTimeout(10000);

  const z = await p.evaluate(`${GET_MAP}.getZoom()`);
  const op = await p.evaluate(`(() => {
    const m = ${GET_MAP};
    const layer = m.getStyle().layers.find(l => l.id.includes('hangneigung'));
    if (!layer) return 'no-layer';
    return {
      visibility: m.getLayoutProperty(layer.id, 'visibility'),
      rasterOpacity: m.getPaintProperty(layer.id, 'raster-opacity'),
      minzoom: layer.minzoom,
    };
  })()`);
  console.log('zoom:', Math.round(z * 10) / 10);
  console.log('slope tiles:', slopeTiles.length, slopeTiles.filter(t => t.startsWith('ERR')).slice(0, 2));
  console.log('slope layer:', JSON.stringify(op).slice(0, 160));
  await p.screenshot({ path: '/tmp/r4-slope-zoom.png' });

  // Toggle Huts (row 0) and verify symbol layer + sprite
  await p.evaluate('document.querySelectorAll(".wd-ovl__row")[0]?.click()');
  await p.waitForTimeout(8000);
  const huts = await p.evaluate(`(() => {
    const m = ${GET_MAP};
    const layer = m.getStyle().layers.find(l => l.id === 'wd-huts' || l.id.includes('huts'));
    if (!layer) return 'no-layer';
    return {
      visibility: m.getLayoutProperty(layer.id, 'visibility'),
      iconImage: JSON.stringify(m.getLayoutProperty(layer.id, 'icon-image') || layer.layout?.['icon-image']).slice(0, 80),
    };
  })()`);
  console.log('huts layer:', JSON.stringify(huts).slice(0, 160));
  console.log('sprite errors:', spriteErrs.length);
  await p.screenshot({ path: '/tmp/r4-huts-zoom.png' });
  await browser.close();
})().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
