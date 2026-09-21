import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BASE_URL, requireDevServer } from './helpers';

test.beforeAll(async () => {
  await requireDevServer();
});

test('data policy page renders its content', async ({ page }) => {
  allure.label('feature', 'static-pages');
  allure.severity('minor');
  test.setTimeout(150_000);

  await page.goto(`${BASE_URL}/data-policy`, { timeout: 120_000 });

  await expect(page.locator('h5').filter({ hasText: 'Datenschutzerklärung' })).toBeVisible({
    timeout: 30_000,
  });
});

test('unknown route shows the 404 page', async ({ page }) => {
  allure.label('feature', 'static-pages');
  allure.severity('minor');
  test.setTimeout(150_000);

  await page.goto(`${BASE_URL}/this-route-does-not-exist`, { timeout: 120_000 });

  await expect(page.getByText('404')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Verlaufen')).toBeVisible();
});
