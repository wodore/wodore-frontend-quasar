import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { BASE_URL, HUT_SLUG, API_URL, lookupHut, requireDevServer } from './helpers';

test.beforeAll(async () => {
  await requireDevServer();
});

test('hut detail page loads via deep link', async ({ page, request }) => {
  allure.label('feature', 'hut-detail');
  allure.severity('critical');
  test.setTimeout(150_000);

  const hut = await lookupHut(request, HUT_SLUG);
  test.skip(
    !hut.exists,
    `Hut '${HUT_SLUG}' not found via ${API_URL} — ` +
      'start the backend or set E2E_HUT_SLUG to a hut that exists'
  );

  await page.goto(`${BASE_URL}/hut/${HUT_SLUG}`, { timeout: 120_000 });

  // Content opens in the mobile bottom sheet (a <bottom-sheet> web component)
  // or, on desktop, in the side content drawer
  await expect(page.locator('bottom-sheet')).toBeVisible({ timeout: 45_000 });

  const expectedName = hut.name ?? HUT_SLUG;
  await expect(page.getByText(expectedName).first()).toBeVisible({ timeout: 45_000 });
});
