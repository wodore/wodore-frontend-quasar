import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BASE_URL, requireDevServer } from './helpers';

test.beforeAll(async () => {
  await requireDevServer();
});

test('feedback dialog opens via deep link and closes again', async ({ page }) => {
  allure.label('feature', 'navigation');
  allure.severity('minor');
  test.setTimeout(150_000);

  await page.goto(`${BASE_URL}/feedback`, { timeout: 120_000 });

  const dialog = page.locator('.q-dialog');
  await expect(dialog).toBeVisible({ timeout: 45_000 });

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible({ timeout: 15_000 });

  // The map underneath is still alive
  await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({ timeout: 30_000 });
});

test('support dialog opens via deep link', async ({ page }) => {
  allure.label('feature', 'navigation');
  allure.severity('minor');
  test.setTimeout(150_000);

  await page.goto(`${BASE_URL}/support`, { timeout: 120_000 });

  await expect(page.locator('.q-dialog')).toBeVisible({ timeout: 45_000 });
});
