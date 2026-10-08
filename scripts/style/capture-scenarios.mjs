/**
 * Map screenshot scenarios — reproducible captures for style review.
 *
 * Captures every scenario below for OUR style and (optionally) the
 * swisstopo reference style (scripts/style/swz-ref.json, fetched from
 * their basemap.vt) through the same harness, so pairs are directly
 * comparable. Run after any style change:
 *
 *   node scripts/style/capture-scenarios.mjs            # ours + swisstopo
 *   node scripts/style/capture-scenarios.mjs --only ours
 *   node scripts/style/capture-scenarios.mjs --out /tmp/shots
 *
 * Needs the static server on :8917 (python3 -m http.server 8917).
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const OUT = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1]) : '/tmp/shots';
const BASE = 'http://localhost:8917';

/** name, anchor, zoom, what to check (kept in the manifest for reviews) */
export const SCENARIOS = [
  {
    name: 'country-z6.2',
    lon: 8.2,
    lat: 46.8,
    z: 6.2,
    check: 'town dots+labels, borders, overview hillshade, motorway skeleton',
  },
  {
    name: 'regional-z8',
    lon: 7.75,
    lat: 46.55,
    z: 8,
    check: 'rivers visible, lakes, serif range names, rail ribbon',
  },
  {
    name: 'rhone-valley-z10.3',
    lon: 7.7,
    lat: 46.31,
    z: 10.3,
    check: 'Rhone river spine, orange motorway+ramps, sparse streets, dots',
  },
  {
    name: 'brig-interchange-z13.5',
    lon: 7.98,
    lat: 46.31,
    z: 13.5,
    check: 'ramp casings, tunnels dashed, station dot+label',
  },
  {
    name: 'zermatt-trails-z13',
    lon: 7.748,
    lat: 46.012,
    z: 13,
    check: 'SAC dash ladder, no white on trails, glacier edge',
  },
  {
    name: 'matterhorn-glacier-z14.5',
    lon: 7.7,
    lat: 45.99,
    z: 14.5,
    check: 'glacier paths sparse-dotted, peaks + small elevation',
  },
  {
    name: 'gornergrat-terrain-z15.5',
    lon: 7.78,
    lat: 45.98,
    z: 15.5,
    check: 'rocks, AO relief, trail ink, close-zoom color',
  },
  {
    name: 'sion-streets-z15.5',
    lon: 7.361,
    lat: 46.235,
    z: 15.5,
    check: 'minor streets soft casings, hierarchy tints',
  },
  {
    name: 'bern-rail-z12.5',
    lon: 7.447,
    lat: 46.948,
    z: 12.5,
    check: 'rail ribbon + white hatch, station dots, quiet station names',
  },
  {
    name: 'engelberg-ranges-z11.5',
    lon: 8.4,
    lat: 46.82,
    z: 11.5,
    check: 'serif mountain-range labels dark, peaks readable',
  },
];

const VARIANTS = {
  // Ours is served by the local Martin tile server (styles live in the
  // backend repo); swisstopo reference is a local vendored copy.
  ours: `${process.env.WODORE_TILE_SERVER_URL ?? 'http://localhost:8075'}/style/wd-outdoor-base-mtk`,
  swz: '/scripts/style/swz-ref.json',
};

const browser = await chromium.launch();
for (const [variant, stylePath] of Object.entries(VARIANTS)) {
  if (only && variant !== only) continue;
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  for (const s of SCENARIOS) {
    const url =
      `${BASE}/scripts/style/preview/index.html?sv=9&style=${encodeURIComponent(stylePath + '?v=' + Date.now())}` +
      `&lon=${s.lon}&lat=${s.lat}&z=${s.z}&dpr=2`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.maplibregl-canvas', { timeout: 20000 });
    await page.waitForTimeout(11000); // tiles + glyphs settle
    const dir = `${OUT}/${variant}`;
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${s.name}.png` });
    console.log(`${variant}/${s.name}.png  (${s.check})`);
  }
  await page.close();
}
await browser.close();
console.log(`done -> ${OUT}`);
