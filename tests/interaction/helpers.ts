/**
 * Shared helpers for interaction specs — theme pinning, map access,
 * Allure screenshot attachment via Playwright's native API.
 */
import { allure } from 'allure-playwright';
import type { Page, TestInfo } from '@playwright/test';

export const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

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
export async function attachFailureArtifacts(
  testInfo: TestInfo
): Promise<void> {
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
    await page.evaluate('document.querySelector(".wd-topbar__user, .wd-topbar__menu .q-btn")?.click()');
    await page.waitForTimeout(700);
  }
  for (let i = 0; i < 3; i++) {
    const dark = await page.evaluate(() => document.body.classList.contains('body--dark'));
    if (dark) break;
    await page.evaluate('document.querySelector("[data-testid=theme-cycle]")?.click()');
    await page.waitForTimeout(400);
  }
  if (isMobile) {
    await page.evaluate('document.querySelector(".wd-topbar__user, .wd-topbar__menu .q-btn")?.click()');
    await page.waitForTimeout(500);
  }
}

/**
 * Navigate to the map and wait for it to settle.
 */
export async function loadMap(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 20_000 });
  await page.waitForTimeout(14_000);
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
  if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255].map(Math.round) as [number, number, number];
  const nums = (v.match(/\d+/g) || []).map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}
