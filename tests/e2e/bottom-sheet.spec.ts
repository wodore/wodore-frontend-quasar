import { test, expect, type Page } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BASE_URL, lookupHut, requireDevServer } from './helpers';
import { dismissSheet, getSheetState, getSheetTop, touchDrag, touchTap } from './sheet-helpers';

test.beforeAll(async () => {
  await requireDevServer();
});

/**
 * Deep-links to a hut page and waits for the bottom sheet to mount.
 * Retries with one reload: the dev server occasionally fails to serve a
 * lazily imported chunk on the first (cold) navigation.
 */
async function openHutSheet(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(url, { timeout: 120_000 });
    const found = await page
      .waitForSelector('bottom-sheet', { timeout: attempt === 0 ? 30_000 : 60_000 })
      .then(() => true)
      .catch(() => false);
    if (found) return;
  }
  await page.waitForSelector('bottom-sheet', { timeout: 10_000 });
}

/**
 * Expands a truncated description by clicking the "mehr" link.
 * Uses a DOM-level click to avoid Playwright's scrollIntoView side effects
 * on the sheet's host scroll container.
 */
async function expandDescription(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.querySelector('bottom-sheet');
    if (!root) return;
    const walk = (el: Element): boolean => {
      if (el.textContent?.trim() === 'mehr' && el.children.length === 0) {
        el.click();
        return true;
      }
      return [...el.children].some(walk);
    };
    walk(root);
  });
  await page.waitForTimeout(500);
}

/**
 * Taps a hut marker on the map by sweeping a grid of candidate points above
 * the sheet until the target hut's content opens.
 *
 * Marker screen positions cannot be computed statically: the map recentres
 * on the selected hut with viewport padding that tracks the sheet position.
 * The sweep skips the area around the currently selected hut's marker (the
 * padded viewport center) so it never toggles the open hut closed.
 */
async function tapHutMarkerBySweep(page: Page, targetName: string): Promise<boolean> {
  const canvas = await page.locator('.maplibregl-canvas').first().boundingBox();
  if (!canvas) return false;
  const sheetTop = (await getSheetTop(page)) ?? canvas.y + canvas.height;
  // Padded viewport center ~ where the currently selected hut's marker sits
  const pivotX = canvas.x + canvas.width / 2;
  const pivotY = canvas.y + (sheetTop - canvas.y) / 2;

  for (let y = canvas.y + 70; y < sheetTop - 40; y += 48) {
    for (let x = canvas.x + 45; x < canvas.x + canvas.width - 45; x += 48) {
      // Skip the current hut's marker zone (tapping it would toggle it closed)
      if (Math.abs(x - pivotX) < 75 && Math.abs(y - pivotY) < 75) continue;
      await touchTap(page, x, y);
      if (
        await page
          .getByText(targetName)
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        return true;
      }
    }
  }
  return false;
}

test('sheet expands to fullscreen first, then content scrolls', async ({ page }) => {
  allure.label('feature', 'bottom-sheet');
  allure.severity('critical');
  test.setTimeout(180_000);

  const hut = await lookupHut(page.request, 'peule-peulaz');
  test.skip(!hut.exists, 'Hut peule-peulaz not found - start the backend with seed data');

  await openHutSheet(page, `${BASE_URL}/hut/peule-peulaz`);
  await expect(page.getByText(hut.name ?? 'Peule').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  await expandDescription(page);

  // The content must overflow the sheet at its initial (partial) snap
  const overflow = await page.evaluate(() => {
    const content = document
      .querySelector('bottom-sheet')
      ?.shadowRoot?.querySelector('.sheet-content');
    if (!content) return 0;
    return content.scrollHeight - content.clientHeight;
  });
  expect(overflow).toBeGreaterThan(50);

  const vp = page.viewportSize();
  const cx = Math.round((vp?.width ?? 390) / 2);
  const top = (await getSheetTop(page)) ?? 0;

  // Drag up on the content: the SHEET expands towards fullscreen first
  await touchDrag(page, cx, top + 220, cx, 90, { steps: 10, gap: 20 });
  const expanded = await getSheetState(page);
  expect(expanded.sheetState).toBe('expanded');

  // The sheet stops at the toolbar (50px), it must not cover or overshoot it
  const sheetTop = (await getSheetTop(page)) ?? -1;
  expect(sheetTop).toBeGreaterThanOrEqual(45);
  expect(sheetTop).toBeLessThanOrEqual(60);
  await page.screenshot({ path: 'test-results/sheet-expanded.png' });

  // Now - fully expanded - a further drag scrolls the content normally
  const scrollBefore = expanded.contentScrollTop ?? 0;
  await touchDrag(page, cx, 600, cx, 300, { steps: 10, gap: 20 });
  const scrolled = await getSheetState(page);
  expect(scrolled.contentScrollTop).toBeGreaterThan(scrollBefore);

  // The sheet stays expanded (fullscreen) while the content scrolls
  expect(scrolled.sheetState).toBe('expanded');
  expect(scrolled.hostScrollTop).toBe(expanded.hostScrollTop);
  await page.screenshot({ path: 'test-results/sheet-expanded-scrolled.png' });
});

test('dismissed sheet reopens when tapping the same hut marker again', async ({ page }) => {
  allure.label('feature', 'bottom-sheet');
  allure.severity('critical');
  test.setTimeout(180_000);

  const hut = await lookupHut(page.request, 'broch');
  test.skip(!hut.exists, 'Hut broch not found - start the backend with seed data');

  // Zoomed in on the hut so its marker sits at the map center
  await openHutSheet(page, `${BASE_URL}/hut/broch#p=13/46.68051/8.13895`);
  await expect(page.getByText('Brochhütte').first()).toBeVisible({ timeout: 30_000 });

  // Dismiss the sheet by dragging it down
  const dismissed = await dismissSheet(page);
  expect(dismissed, 'sheet could not be dismissed by dragging').toBe(true);
  expect((await getSheetState(page)).exists).toBe(false);
  await expect(page).toHaveURL(/\/$|\/#/, { timeout: 10_000 });

  // Tap the same hut marker (map center) - the sheet must open again.
  // Previously the marker was still marked selected, so the tap toggled the
  // selection off and nothing opened.
  const canvas = await page.locator('.maplibregl-canvas').first().boundingBox();
  expect(canvas).toBeTruthy();
  await touchTap(
    page,
    Math.round(canvas.x + canvas.width / 2),
    Math.round(canvas.y + canvas.height / 2)
  );

  await page.waitForSelector('bottom-sheet', { timeout: 30_000 });
  await expect(page.getByText('Brochhütte').first()).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/hut\/broch/);
});

test('sheet keeps its snap position when another hut is opened', async ({ page }) => {
  allure.label('feature', 'bottom-sheet');
  allure.severity('critical');
  test.setTimeout(180_000);

  const kima = await lookupHut(page.request, 'bivacco-kima');
  test.skip(!kima.exists, 'Hut bivacco-kima not found - start the backend with seed data');

  // Centered between two huts ~700m apart; at zoom 14 both markers are
  // visible near the map center, above the sheet
  await openHutSheet(page, `${BASE_URL}/hut/bivacco-kima#p=14/46.27462/9.72851`);
  await expect(page.getByText('Kima').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1000);

  // Drag the sheet down towards the header-only snap (150px). The drag
  // distance must be large enough that the nearest snap after release is the
  // 150px snap, but not so large that it dismisses the sheet.
  const vp = page.viewportSize();
  const cx = Math.round((vp?.width ?? 390) / 2);
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await getSheetState(page);
    if ((state.hostScrollTop ?? 0) < 220) break; // below the 330px initial snap
    const start = ((await getSheetTop(page)) ?? 0) + 60;
    const end = Math.min(start + 150, (vp?.height ?? 844) - 50);
    await touchDrag(page, cx, start, cx, end);
  }
  const reduced = await getSheetState(page);
  expect(reduced.exists).toBe(true);
  expect(reduced.hostScrollTop ?? 999).toBeLessThan(220);

  // Open the second hut: the sheet must load the new hut but KEEP its position
  const opened = await tapHutMarkerBySweep(page, 'Odello');
  expect(opened, 'could not find the second hut marker on the map').toBe(true);

  await expect(page).toHaveURL(/\/hut\/odello-grandori/, { timeout: 10_000 });

  // Position kept: still at the header-only snap, not snapped back to 330px
  const after = await getSheetState(page);
  expect(after.exists).toBe(true);
  expect(after.hostScrollTop ?? 999).toBeLessThan(220);
});
