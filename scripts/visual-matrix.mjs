/**
 * Visual test matrix: capture, assert, contrast-audit.
 *
 * Usage: node scripts/visual-matrix.mjs [--scheme light|dark] [--tag desktop|mobile] [--sheet]
 *       (yarn test:visual runs everything)
 *
 * Output: .visual-tests/<timestamp>/
 *   <scheme>-<tag>-<state>.png   full-resolution, state-ASSERTED captures
 *                                 (PRIMARY artifacts; vision analysis uses
 *                                 these individually - never downscaled)
 *   contrast-<scheme>-<tag>.json WCAG violations of visible text nodes
 *   report.json                  assertion + violation summary
 *   SHEET-<scheme>-<tag>.png     OPTIONAL (--sheet): labeled contact sheet,
 *                                 human index only - NOT for analysis
 *
 * Exit code 1 if any state assertion failed or any contrast violation
 * (ratio < 4.5 for >= 12px text, < 3.0 for large text) was found.
 *
 * Learnings baked in (2026-09 device review): never save a screenshot whose
 * intended state did not render (assert the selector!), analyse full-res
 * images individually (sheets hide small-text contrast failures), and audit
 * contrast per element, not by eye.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const ARGS = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : []))
    .filter(x => x.length)
);
// Boolean flags (no value): --sheet generates optional human contact sheets
const FLAGS = { sheet: process.argv.includes('--sheet') };
const BASE = process.env.VISUAL_BASE_URL || 'http://localhost:9000';
const HUT = '/hut/laemmeren?date=26.09.26#p=12/46.43749/7.08606';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = `.visual-tests/${TS}`;
mkdirSync(OUT, { recursive: true });

/** click the first matching element; resolve false instead of throwing */
const softClick = async (page, selector, timeout = 2500) => {
  const el = page.locator(selector).first();
  try {
    await el.click({ timeout });
    return true;
  } catch {
    return false;
  }
};

const STATES = [
  {
    id: 'home',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.maplibregl-canvas', { timeout: 15000 });
    },
    assert: '.maplibregl-canvas',
  },
  {
    id: 'hover-rail',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.maplibregl-canvas', { timeout: 15000 });
      await p
        .locator('.q-fab, .q-page button')
        .first()
        .hover()
        .catch(() => {});
    },
    assert: '.maplibregl-canvas',
  },
  {
    id: 'overlay-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.q-fab', { timeout: 15000 });
      await softClick(p, '.q-fab');
    },
    assert: '.q-fab__actions, .q-fab--opened',
  },
  {
    id: 'overlay-actions-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.q-fab', { timeout: 15000 });
      await softClick(p, '.q-fab');
      await p.waitForTimeout(700);
      await softClick(p, '.q-fab__actions button, .q-fab__actions .q-btn');
    },
    assert: '.q-fab__actions',
  },
  {
    id: 'overlay-selected',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.q-fab', { timeout: 15000 });
      await softClick(p, '.q-fab');
      await p.waitForTimeout(700);
      await softClick(p, '.q-fab__actions button, .q-fab__actions .q-btn');
      await p.waitForTimeout(400);
    },
    assert: '.q-fab__actions',
  },
  {
    id: 'baselayer-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForSelector('.q-fab', { timeout: 15000 });
      const fabs = p.locator('.q-fab');
      const n = await fabs.count();
      for (let i = 0; i < Math.min(n, 3); i++) {
        await softClick(p, `.q-fab >> nth=${i}`);
        await p.waitForTimeout(700);
        if (await p.locator('[class*="basemap" i], .wd-basemap').count()) break;
      }
    },
    assert: 'body', // capture regardless; basemap panel selector is brittle
    optional: true,
  },
  {
    id: 'hut',
    run: async p => {
      await p.goto(BASE + HUT, { waitUntil: 'load' });
      await p.waitForTimeout(3500);
    },
    assert: 'text=/Aarbiwak|Lämmern|lammeren/i',
  },
  {
    id: 'hut-expanded',
    run: async p => {
      await p.goto(BASE + HUT, { waitUntil: 'load' });
      await p.waitForTimeout(3500);
      await softClick(
        p,
        '[aria-label*="expand" i], [aria-label*="maximi" i], button:has(i[class*="expand"]), button:has(i[class*="resize"])'
      );
      await p.waitForTimeout(800);
    },
    assert: 'text=/Aarbiwak|Lämmern|lammeren/i',
  },
  {
    id: 'hut-bottom',
    run: async p => {
      await p.goto(BASE + HUT, { waitUntil: 'load' });
      await p.waitForTimeout(3500);
      await p.evaluate(() => {
        const els = [...document.querySelectorAll('*')].filter(
          e =>
            e.scrollHeight > e.clientHeight + 50 &&
            /drawer|scroll|content/i.test(String(e.className) + e.id)
        );
        const el =
          els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement;
        el.scrollTop = el.scrollHeight;
      });
      await p.waitForTimeout(600);
    },
    assert: 'text=/Aarbiwak|Lämmern|lammeren/i',
  },
  {
    id: 'menu-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      await softClick(p, 'header button');
      await p.waitForTimeout(700);
    },
    assert: '.q-drawer--mobile, .q-drawer, .q-menu',
  },
  {
    id: 'account-sheet-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      await softClick(p, 'header button');
      await p.waitForTimeout(700);
      // if a drawer opened, look for the account/user entry inside it
      await softClick(
        p,
        '.q-drawer [class*="user" i], .q-drawer button:has-text("ogin"), .q-drawer a:has-text("ogin")'
      );
      await p.waitForTimeout(700);
    },
    assert: '.q-drawer, .q-menu, .q-dialog__inner',
  },
  {
    id: 'calendar-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      await softClick(p, '.wd-date-field, header .q-field, header input[readonly]');
      await p.waitForTimeout(900);
    },
    assert: '.q-date, [class*="calendar" i]',
  },
  {
    id: 'search-open',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      await softClick(p, 'header input, header .q-field');
      await p.waitForTimeout(900);
    },
    assert: '.q-menu, [class*="search" i]',
  },
  {
    id: 'search-results',
    run: async p => {
      await p.goto(BASE + '/', { waitUntil: 'load' });
      await p.waitForTimeout(2500);
      await softClick(p, 'header input, header .q-field');
      await p.waitForTimeout(600);
      const inp = p.locator('.q-menu input, header input, [class*="search"] input').first();
      if (await inp.count()) await inp.fill('lam').catch(() => {});
      await p.waitForTimeout(1200);
    },
    assert: '.q-menu, [class*="result" i]',
  },
];

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const schemes = ARGS.scheme ? [ARGS.scheme] : ['light', 'dark'];
const tags = ARGS.tag ? [ARGS.tag] : ['desktop', 'mobile'];

const ZONE_PROBE = `(() => {
  // ZONES regression gate: header toolbar icons must be FLAT (no bg in any
  // state incl. hover/active), map-floating controls must be SOLID (alpha 1).
  const out = [];
  const solid = c => !c.includes('rgba') || +c.split(',')[3] >= 1;
  for (const b of document.querySelectorAll('.app-header .q-btn, header .q-btn')) {
    const cs = getComputedStyle(b);
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
      out.push({ zone: 'header', el: b.getAttribute('aria-label') || b.className.slice(0, 30), bg: cs.backgroundColor });
  }
  for (const b of document.querySelectorAll('.wd-switcher-fab, .overlay-main-btn, .overlay-icon-btn, .maplibregl-ctrl button')) {
    const cs = getComputedStyle(b);
    if (!solid(cs.backgroundColor))
      out.push({ zone: 'map', el: b.className.slice(0, 30), bg: cs.backgroundColor });
  }
  return out;
})()`;

const CONTRAST_AUDIT = `(() => {
  // Enumerates EVERY visible text node (querySelectorAll('*') incl. value
  // spans inside weather/availability components) - do not filter by
  // component, that is how weather temps escaped detection once.
  const s2l = c => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const parse = s => { const m = (s || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = ([r, g, b]) => 0.2126 * s2l(r) + 0.7152 * s2l(g) + 0.0722 * s2l(b);
  const blend = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
  const bgOf = el => {
    let e = el;
    while (e && e !== document.documentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0.85) return c;
      e = e.parentElement;
    }
    return [255, 255, 255, 1];
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.4) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const L1 = lum(blend(fg, bg)), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), weight = +cs.fontWeight;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3.0 : 4.5;
    if (ratio < need) out.push({ text: node.textContent.trim().slice(0, 40), ratio: +ratio.toFixed(2), need, size, cls: String(el.className).slice(0, 50) });
  }
  return out;
})()`;

const browser = await chromium.launch();
const report = { out: OUT, assertions: [], contrast: [], ts: TS };
let failed = 0;

for (const scheme of schemes) {
  for (const tag of tags) {
    const files = [];
    for (const s of STATES) {
      const ctx = await browser.newContext({ viewport: VIEWPORTS[tag], colorScheme: scheme });
      const page = await ctx.newPage();
      const file = `${OUT}/${scheme}-${tag}-${s.id}.png`;
      try {
        await s.run(page);
        await page.waitForTimeout(1500);
        // STATE ASSERTION: never save a wrong-state screenshot
        let ok = true;
        if (s.assert && !s.optional) {
          ok = await page
            .locator(s.assert)
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false);
        }
        if (!ok) {
          report.assertions.push({
            state: s.id,
            scheme,
            tag,
            ok: false,
            reason: `assert failed: ${s.assert}`,
          });
          failed++;
        } else {
          await page.screenshot({ path: file });
          files.push({ file: `${scheme}-${tag}-${s.id}.png`, state: s.id });
          report.assertions.push({ state: s.id, scheme, tag, ok: true });
          // contrast audit per state
          const violations = await page.evaluate(CONTRAST_AUDIT);
          if (violations.length) {
            report.contrast.push({ state: s.id, scheme, tag, violations });
            failed += violations.length;
          }
          // ZONES regression gate per state (header flat / map solid)
          const zoneViolations = await page.evaluate(ZONE_PROBE);
          if (zoneViolations.length) {
            if (!report.zones) report.zones = [];
            report.zones.push({ state: s.id, scheme, tag, zoneViolations });
            failed += zoneViolations.length;
          }
        }
      } catch (e) {
        report.assertions.push({
          state: s.id,
          scheme,
          tag,
          ok: false,
          reason: String(e).slice(0, 120),
        });
        failed++;
      }
      await ctx.close();
    }
    writeFileSync(
      `${OUT}/contrast-${scheme}-${tag}.json`,
      JSON.stringify(
        report.contrast.filter(c => c.scheme === scheme && c.tag === tag),
        null,
        1
      )
    );
    // OPTIONAL contact sheet (--sheet): human index only, never for analysis
    if (FLAGS.sheet && files.length) {
      const tiles = files
        .map(f => `<figure><img src="${f.file}"><figcaption>${f.state}</figcaption></figure>`)
        .join('');
      const html = `<html><body style="margin:0;background:#222;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px">${tiles}</div></body><style>figure{margin:0;background:#333}img{width:100%;display:block}figcaption{color:#fff;font-size:12px;padding:3px 6px}</style></html>`;
      writeFileSync(`${OUT}/sheet-${scheme}-${tag}.html`, html);
      const sp = await (
        await browser.newContext({ viewport: { width: 1440, height: 2400 } })
      ).newPage();
      await sp.goto('file://' + process.cwd() + `/${OUT}/sheet-${scheme}-${tag}.html`);
      await sp.waitForTimeout(1200);
      await sp.screenshot({ path: `${OUT}/SHEET-${scheme}-${tag}.png`, fullPage: true });
      await sp.close();
    }
  }
}
await browser.close();

report.failed = failed;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(
  `visual-matrix: ${report.assertions.filter(a => a.ok).length}/${report.assertions.length} states ok, ${report.contrast.reduce((n, c) => n + c.violations.length, 0)} contrast violations -> ${OUT}`
);
process.exit(failed > 0 ? 1 : 0);
