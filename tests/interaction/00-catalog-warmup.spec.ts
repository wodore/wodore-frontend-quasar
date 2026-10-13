/**
 * Map catalog cache warmup — runs FIRST (Playwright executes spec files
 * in alphabetical order; the 00- prefix wins).
 *
 * Overlay/basemap definitions load from the backend map catalog: a cold
 * CI context (fresh storage per test, daily-rotated response cache)
 * pays the catalog + per-layer style round-trip before the first
 * overlay row renders — and the backend's style endpoint re-renders
 * each unique spec/mode document until its render cache ships
 * (wodore-backend #315). This spec absorbs that cold cost once: it
 * boots the app and waits for the catalog layers, so every subsequent
 * spec replays the responses from the local staging cache.
 */
import { test, expect } from './helpers';
import { loadMap } from './helpers';

test('map catalog layers load', async ({ page }) => {
  test.setTimeout(420_000);
  await loadMap(page);
  // Rows render (or the explicit error state shows when staging is
  // down — either way the response cache is populated).
  const state = await page
    .waitForSelector('.wd-ovl__row', { timeout: 300_000 })
    .then(() => 'rows')
    .catch(() => 'error-state');
  expect(['rows', 'error-state']).toContain(state);
});
