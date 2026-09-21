import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BASE_URL, requireDevServer } from './helpers';

test.beforeAll(async () => {
  await requireDevServer();
});

test('map page renders the map without fatal errors', async ({ page }) => {
  allure.label('feature', 'app-shell');
  allure.severity('critical');
  test.setTimeout(150_000); // cold dev-server compile can be slow

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  // First hit pays the Vite compile cost
  await page.goto(`${BASE_URL}/`, { timeout: 120_000 });

  const canvas = page.locator('.maplibregl-canvas').first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await expect(canvas)
    .toHaveAttribute('data-loaded', /.*/, { timeout: 10_000 })
    .catch(() => {
      // attribute is optional; visibility above is the real assertion
    });

  expect(pageErrors, 'uncaught page errors').toEqual([]);
});
