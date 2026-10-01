/**
 * Shared helpers for interaction specs — theme pinning, map access,
 * Allure screenshot attachment.
 */
import type { test } from '@playwright/test';
import { allure } from 'allure-playwright';

export const GET_MAP =
  'document.querySelector(".maplibregl-map").__vueParentComponent.exposed.map._value';

export interface ThemeFixture {
  page: import('@playwright/test').Page;
  theme: 'light' | 'dark';
  mode: 'mobile' | 'desktop';
}

/**
 * Tag a test for Allure: layer + feature + theme/mode labels.
 * Screenshots are attached on both pass and fail.
 */
export function tagTest(theme: string, mode: string, group: string): void {
  allure.label('layer', 'interaction');
  allure.label('epic', 'map-controls');
  allure.label('feature', group);
  allure.label('theme', theme);
  allure.label('viewport', mode);
  allure.tag('visual'); // all interaction tests are visual-adjacent
}

/**
 * Attach a screenshot to the Allure report.
 */
export async function attachScreenshot(
  page: import('@playwright/test').Page,
  name: string,
  clip?: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const buf = await page.screenshot(clip ? { clip } : undefined);
  await allure.attachment(name, buf, 'image/png');
}

/**
 * Apply the theme through the app's OWN switcher (data-testid theme-cycle)
 * — the same path the owner uses. Clicks cycle auto → light → dark.
 */
export async function pinTheme(
  page: import('@playwright/test').Page,
  theme: 'light' | 'dark'
): Promise<void> {
  if (theme === 'light') return; // default boot state is light/auto→light
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
export async function loadMap(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.maplibregl-canvas', { timeout: 20_000 });
  await page.waitForTimeout(14_000); // map tiles + overlays settle
}

/**
 * Evaluate a function in the page and return the result as typed JSON.
 */
export async function evalJSON<T>(
  page: import('@playwright/test').Page,
  fn: string | (() => T)
): Promise<T> {
  return page.evaluate(typeof fn === 'string' ? fn : `(${fn.toString()})()`) as Promise<T>;
}

/** Parse computed color strings (rgb, rgba, color(srgb)) → [r,g,b] */
export function parseColor(v: string): [number, number, number] {
  const m = v.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (m) return [Number(m[1]) * 255, Number(m[2]) * 255, Number(m[3]) * 255].map(Math.round) as [number, number, number];
  const nums = (v.match(/\d+/g) || []).map(Number);
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}
