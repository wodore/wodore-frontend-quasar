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

/**
 * The `test` export every interaction spec should use: auto-installs the
 * staging response cache into each page. Re-exports `expect`.
 */
export const test = baseTest.extend<{ stagingCache: void }>({
  stagingCache: [
    async ({ page }, use) => {
      await page.route('**/*', async route => {
        const req = route.request();
        const url = req.url();
        const isLocal = /^[a-z]+:\/\/localhost/.test(url);
        if (req.method() !== 'GET' || isLocal) return route.fallback();

        const hit = readCached(url);
        if (hit) {
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
            }
          }
        } catch {
          /* cache write failures never fail the test */
        }
        return route.fulfill({ response: resp });
      });
      await use();
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
export async function loadMap(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 20_000 });
  await waitForMapIdle(page, 30_000);
  await page.waitForTimeout(500); // brief paint settle for overlay chrome
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
