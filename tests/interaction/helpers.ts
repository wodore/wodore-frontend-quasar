/**
 * Shared helpers for interaction specs — theme pinning, map access,
 * Allure screenshot attachment via Playwright's native API, and a
 * cross-run staging response cache.
 */
import { allure } from 'allure-playwright';
import { test as baseTest, expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

// ── staging response cache ─────────────────────────────────────────────────
// Cross-origin GETs (staging API, tiles, fonts) are served from a disk
// cache under tests/interaction/.staging-cache — first fetch per URL hits
// the network (staging-drift detection stays), every other test and every
// later run (CI persists the dir via actions/cache) serves local bytes.
// GET + 2xx + ≤5 MB only; content-encoding/length stripped so the decoded
// body can be replayed verbatim.
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.staging-cache');
const MAX_ENTRY_BYTES = 5 * 1024 * 1024;

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string; // base64
}

function cacheFileFor(url: string): string {
  return path.join(CACHE_DIR, `${crypto.createHash('sha256').update(url).digest('hex')}.json`);
}

function readCached(url: string): CachedResponse | null {
  try {
    return JSON.parse(fs.readFileSync(cacheFileFor(url), 'utf8')) as CachedResponse;
  } catch {
    return null;
  }
}

// ── map-catalog boot-cache seeding ──────────────────────────────────────────
// The app boots overlays/basemaps from the backend map catalog (persisted
// to localStorage + a background refresh). Fresh Playwright contexts have
// cold storage, so EVERY test would refetch the catalog and ~26 style
// documents through the route interception — a heavy per-test footprint
// on a 2-core CI runner. The fixture seeds the app's persisted caches
// from the disk cache (recorded by the route handler below), so tests
// boot the production cache-first path with ~one replayed request.
const CATALOG_URL_RE = /\/v1\/map\/catalog/;
const STYLE_URL_RE = /\/v1\/map\/styles\/([^/?]+)\.json/;
// The index is a DIRECTORY of per-URL marker files: playwright runs spec
// files in parallel workers (4 on CI), and a single JSON index would be a
// read-modify-write race across processes — a worker could clobber the
// catalog URL another worker recorded, silently disabling the seeding
// for every later test in that worker. One marker file per URL is
// atomic (tmp + rename) and additive by construction.
const INDEX_DIR = path.join(CACHE_DIR, 'catalog-index');

/** Recent [map-catalog] console lines from the current page (diagnostics). */
const catalogConsole: string[] = [];

function styleCacheKeyFor(url: string): string | null {
  const match = STYLE_URL_RE.exec(url);
  if (!match) return null;
  const spec = new URL(url).searchParams.get('spec') ?? 'high';
  const tokenized = new URL(url).searchParams.get('mode') === 'tokenized';
  return `${match[1]}|${spec}|${tokenized ? 'tokenized' : 'resolved'}`;
}

function readIndex(): string[] {
  try {
    return fs
      .readdirSync(INDEX_DIR)
      .filter(f => f.endsWith('.json'))
      .map(
        f => (JSON.parse(fs.readFileSync(path.join(INDEX_DIR, f), 'utf8')) as { url: string }).url
      );
  } catch {
    return [];
  }
}

function appendIndex(url: string): void {
  const marker = path.join(
    INDEX_DIR,
    `${crypto.createHash('sha256').update(url).digest('hex')}.json`
  );
  if (fs.existsSync(marker)) return;
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const tmp = `${marker}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ url }));
  fs.renameSync(tmp, marker);
}

/** Build the app's persisted localStorage caches from the disk cache. */
function buildCatalogSeed(): { catalog: unknown; styles: Record<string, unknown> } | null {
  const catalogUrl = readIndex().find(u => CATALOG_URL_RE.test(u));
  if (!catalogUrl) return null;
  const catalogEntry = readCached(catalogUrl);
  if (!catalogEntry) return null;
  let catalog: { slots: unknown; layers: Array<{ slug: string; version?: string | null }> };
  try {
    catalog = JSON.parse(Buffer.from(catalogEntry.body, 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(catalog.layers)) return null;
  const versions = new Map(catalog.layers.map(l => [l.slug, l.version ?? null]));
  const styles: Record<string, unknown> = {};
  for (const url of readIndex()) {
    const key = styleCacheKeyFor(url);
    if (!key) continue;
    const entry = readCached(url);
    if (!entry) continue;
    let doc: unknown;
    try {
      doc = JSON.parse(Buffer.from(entry.body, 'base64').toString('utf8'));
    } catch {
      continue;
    }
    const slug = key.split('|')[0]!;
    const version = versions.get(slug) ?? null;
    styles[key] = key.endsWith('|tokenized')
      ? { tokenized: doc, version }
      : { style: doc, version };
  }
  return {
    catalog: {
      savedAt: new Date().toISOString(),
      lang: 'en',
      slots: catalog.slots,
      layers: catalog.layers,
    },
    styles,
  };
}

/**
 * The `test` export every interaction spec should use: auto-installs the
 * staging response cache into each page. Re-exports `expect`.
 */
export const test = baseTest.extend<{ stagingCache: void }>({
  stagingCache: [
    async ({ page }, use) => {
      // Keep the app's map-catalog console output for boot diagnostics —
      // the caught fetch error is otherwise invisible in CI logs.
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[map-catalog]')) {
          catalogConsole.push(`${new Date().toISOString().slice(11, 19)} ${text.slice(0, 200)}`);
          if (catalogConsole.length > 20) catalogConsole.shift();
        }
      });
      // Seed the app's persisted map-catalog caches (production boot path,
      // near-zero per-test network footprint) once the warmup spec has
      // populated the disk cache.
      const seed = buildCatalogSeed();
      if (seed) {
        await page.addInitScript(
          ([catalog, styles]: unknown[]) => {
            localStorage.setItem('mapCatalogCache', JSON.stringify(catalog));
            if (styles && Object.keys(styles as object).length > 0) {
              localStorage.setItem('mapCatalogStyleCache', JSON.stringify(styles));
            }
          },
          [seed.catalog, seed.styles] as unknown[]
        );
      }
      // Intercept cross-origin GETs only — localhost (dev server) requests never
      // enter the handler at all: the initial 4-file burst of cold app loads
      // must not queue behind Node-side interception on a 2-core runner.
      await page.route(/^https?:\/\/(?!localhost)/, async route => {
        const req = route.request();
        const url = req.url();
        if (req.method() !== 'GET') return route.fallback();

        // Style-endpoint resilience: with the real document cached, serve
        // it; on a cache miss NEVER touch a slow/dead endpoint — a minimal
        // valid style keeps the suite independent of style-serving health
        // (catalog-driven rows still render; the overlay's map layers stay
        // empty for that slug — chrome assertions do not depend on them).
        if (styleCacheKeyFor(url) && !readCached(url)) {
          return route.fulfill({
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ version: 8, sources: {}, layers: [] }),
          });
        }

        const hit = readCached(url);
        if (hit) {
          // Record catalog/style URLs on HITS too — the CI-restored cache
          // replays without writes, and the boot-cache seeding below keys
          // off the index (without this it would never activate there).
          if (CATALOG_URL_RE.test(url) || styleCacheKeyFor(url)) {
            appendIndex(url);
          }
          return route.fulfill({
            status: hit.status,
            headers: hit.headers,
            body: Buffer.from(hit.body, 'base64'),
          });
        }

        const resp = await route.fetch();
        try {
          if (resp.ok()) {
            const body = await resp.body();
            if (body && body.length <= MAX_ENTRY_BYTES) {
              const headers = { ...resp.headers() };
              delete headers['content-encoding'];
              delete headers['content-length'];
              const entry: CachedResponse = {
                status: resp.status(),
                headers,
                body: body.toString('base64'),
              };
              fs.mkdirSync(CACHE_DIR, { recursive: true });
              const tmp = `${cacheFileFor(url)}.${process.pid}.tmp`;
              fs.writeFileSync(tmp, JSON.stringify(entry));
              fs.renameSync(tmp, cacheFileFor(url));
              if (CATALOG_URL_RE.test(url) || styleCacheKeyFor(url)) {
                appendIndex(url);
              }
            }
          }
        } catch {
          /* cache write failures never fail the test */
        }
        return route.fulfill({ response: resp });
      });
      await use();
      // App background work (map catalog + style fetches at boot) can still
      // be in flight when the test ends — an in-flight route.fetch() throws
      // "Target page, context or browser has been closed" and fails the
      // otherwise-passing test. Ignore those teardown races explicitly
      // (the documented Playwright remedy).
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    },
    { auto: true },
  ],
});
export { expect };

export interface ThemeFixture {
  page: Page;
  theme: 'light' | 'dark';
  mode: 'mobile' | 'desktop';
}

/**
 * Tag a test for Allure: layer + feature + theme/mode labels.
 */
export function tagTest(theme: string, mode: string, group: string): void {
  allure.label('layer', 'interaction');
  allure.label('epic', 'map-controls');
  allure.label('feature', group);
  allure.label('theme', theme);
  allure.label('viewport', mode);
  allure.tag('visual');
}

/**
 * Attach a screenshot to the test result AND the Allure report.
 * Uses Playwright's native testInfo.attach() — the allure-playwright
 * reporter picks these up automatically (allure.attachment() from a
 * helper didn't propagate reliably).
 */
export async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  clip?: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const buf = await page.screenshot(clip ? { clip } : undefined);
  await testInfo.attach(name, {
    body: buf,
    contentType: 'image/png',
  });
}

/**
 * Attach the Playwright trace from a failed test to the Allure report.
 * Called in afterEach when testInfo.status === 'failed'.
 */
export async function attachFailureArtifacts(testInfo: TestInfo): Promise<void> {
  // Playwright stores traces as test-results/<test-id>-trace.zip
  // The allure-playwright reporter SHOULD pick these up automatically
  // via its `trace: 'retain-on-failure'` config. This is a safety net:
  for (const attachment of testInfo.attachments) {
    if (attachment.path?.endsWith('.zip')) {
      await testInfo.attach('trace', {
        path: attachment.path,
        contentType: 'application/zip',
      });
    }
  }
}

/**
 * Apply the theme through the app's OWN switcher (data-testid theme-cycle)
 * — the same path the owner uses. Clicks cycle auto → light → dark.
 */
export async function pinTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  if (theme === 'light') return;
  const isMobile = page.viewportSize()!.width < 900;
  if (isMobile) {
    await page.evaluate(
      'document.querySelector(".wd-topbar__user, .wd-topbar__menu .q-btn")?.click()'
    );
    await page.waitForTimeout(700);
  }
  for (let i = 0; i < 3; i++) {
    const dark = await page.evaluate(() => document.body.classList.contains('body--dark'));
    if (dark) break;
    await page.evaluate('document.querySelector("[data-testid=theme-cycle]")?.click()');
    await page.waitForTimeout(400);
  }
  // The theme transition (CSS vars) must fully land before color sampling —
  // bounded poll instead of a blind sleep, but generous: intermediate
  // colors were sampled mid-transition when this waited too little.
  await page
    .waitForFunction(
      () => {
        if (!document.body.classList.contains('body--dark')) return false;
        const cs = getComputedStyle(document.body);
        return cs.transitionDuration === '0s' || cs.getPropertyValue('--transition') === '';
      },
      null,
      { timeout: 5_000 }
    )
    .catch(() => page.waitForTimeout(500));
  if (isMobile) {
    await page.evaluate(
      'document.querySelector(".wd-topbar__user, .wd-topbar__menu .q-btn")?.click()'
    );
    await page.waitForTimeout(500);
  }
}

/**
 * Wait until MapLibre settles: style loaded, tiles loaded, not moving —
 * with one extra 'idle' round as a safety net for data overlays landing
 * after the first settle. Replaces the fixed sleeps these specs used.
 */
export async function waitForMapIdle(page: Page, timeout = 10_000): Promise<void> {
  const settled = `(function() {
    const map = ${GET_MAP};
    if (!map) return false;
    const ok = () => map.isStyleLoaded() && !map.isMoving() && map.areTilesLoaded();
    return new Promise(resolve => {
      if (ok()) return resolve(true);
      map.once('idle', () => {
        if (ok()) resolve(true);
        else map.once('idle', () => resolve(true));
      });
    });
  })()`;
  await page.waitForFunction(settled, null, { timeout, polling: 'raf' });
}

/** Wait for the expanded overlay panel (after the "more" chevron click). */
export async function waitForOverlayExpanded(page: Page): Promise<void> {
  await page.waitForSelector('.wd-ovl__box--expanded', { timeout: 5_000 });
}

/**
 * Navigate to the map and wait for it to settle: MapLibre idle (tiles,
 * style, overlays) instead of the old fixed 14-second sleep.
 */
/** Optional API-host rewrite for local interaction runs: the dev
 *  server bakes WODORE_API_HOST from .env.local (often a LAN backend);
 *  E2E_API_HOST rewrites the inline runtime env in-flight so the suite
 *  can run against staging without touching local env files (CI needs
 *  neither — its dev server already gets WODORE_API_HOST).
 */
const API_REWRITE_HOST = process.env.E2E_API_HOST;

export async function loadMap(page: Page): Promise<void> {
  if (API_REWRITE_HOST) {
    await page.route(/localhost:\d+\/$|localhost:\d+\/index\.html/, async route => {
      const resp = await route.fetch();
      const html = (await resp.text()).replace(
        /(WODORE_API_HOST: ')[^']*(')/g,
        `$1${API_REWRITE_HOST}$2`
      );
      return route.fulfill({ response: resp, body: html });
    });
  }
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // First load after the dev server boots pays vite's on-demand dependency
  // optimization on a busy 2-core runner — give that burst real headroom.
  await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });
  // Generous budget: the default basemap pulls nine sources (mtk vector
  // + raster terrain/hillshade sets) — a throttled CI network needs room.
  await waitForMapIdle(page, 60_000);
  await waitForCatalogLayers(page);
  await page.waitForTimeout(500); // brief paint settle for overlay chrome
}

/**
 * Overlay/basemap definitions load from the backend map catalog — on a
 * cold cache (fresh CI storage) that is a catalog + style round-trip
 * before the first overlay row renders. Wait for either a rendered row
 * or the explicit error state; a warm cache renders instantly.
 */
export async function waitForCatalogLayers(page: Page): Promise<void> {
  await page.waitForSelector('.wd-ovl__row, .wd-ovl__status', { timeout: 60_000 });
  // Loading state → wait until it resolves (row appears or error stays)
  await page.waitForSelector('.wd-ovl__row', { timeout: 60_000 }).catch(() => {
    // Cold-boot failure keeps the error row — log the app's catalog state
    // so downstream assertion failures have actionable context.
    void page
      .evaluate(
        `(() => ({
          rows: document.querySelectorAll('.wd-ovl__row').length,
          status: document.querySelector('.wd-ovl__status')?.textContent ?? null,
          apiHost: window.__WODORE_RUNTIME_ENV__?.WODORE_API_HOST ?? null,
          catalogReqs: performance
            .getEntriesByType('resource')
            .filter(r => r.name.includes('/v1/map/'))
            .map(r => r.name.split('?')[0]?.split('/').pop() + ':' + Math.round(r.duration)),
        }))()`
      )
      .then(state =>
        console.warn(
          '[interaction] catalog boot incomplete after waits:',
          JSON.stringify(state),
          '\n  app console:\n  ' + (catalogConsole.join('\n  ') || '(no map-catalog output)')
        )
      )
      .catch(() => undefined);
  });
}

/**
 * Evaluate a function in the page and return the result as typed JSON.
 */
export async function evalJSON<T>(page: Page, fn: string | (() => T)): Promise<T> {
  return page.evaluate(typeof fn === 'string' ? fn : `(${fn.toString()})()`) as Promise<T>;
}

/** Parse computed color strings (rgb, rgba, color(srgb)) → [r,g,b] */
export function parseColor(v: string): [number, number, number] {
  const m = v.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (m)
    return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255].map(Math.round) as [
      number,
      number,
      number,
    ];
  const nums = (v.match(/\d+/g) || []).map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}
