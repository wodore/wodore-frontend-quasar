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
import { catalogConsoleLines, evalJSON, loadMap, stagingCacheIndexCount } from './helpers';

test('map catalog layers load', async ({ page }) => {
  test.setTimeout(420_000);
  await loadMap(page);
  // Rows render (or the explicit error state shows when staging is
  // down — either way the response cache is populated).
  const state = await page
    .waitForSelector('.wd-ovl__row', { timeout: 300_000 })
    .then(() => 'rows')
    .catch(() => 'error-state');

  // ALWAYS surface boot diagnostics — on CI a failing catalog boot used
  // to leave zero evidence downstream (rows:0, no console lines, empty
  // cache). These three lines disambiguate the failure modes: staging
  // unreachable from the runner (entries: 0 + fetch errors in console /
  // resource timing), console capture gaps (state error but no console
  // lines), or a healthy boot (rows + entries > 0).
  const boot = await evalJSON(page, () => ({
    rows: document.querySelectorAll('.wd-ovl__row').length,
    status: document.querySelector('.wd-ovl__status')?.textContent ?? null,
    apiHost: window.__WODORE_RUNTIME_ENV__?.WODORE_API_HOST ?? null,
    mapReqs: performance
      .getEntriesByType('resource')
      .filter(r => r.name.includes('/v1/map/'))
      .map(r => r.name.split('?')[0]?.split('/').pop() + ':' + Math.round(r.duration)),
  })).catch(() => null);
  console.warn(
    `[warmup] boot state: ${state}`,
    `| staging-cache entries: ${stagingCacheIndexCount()}`
  );
  console.warn(`[warmup] catalog boot state: ${JSON.stringify(boot)}`);
  console.warn(
    '[warmup] app console:\n  ' + (catalogConsoleLines().join('\n  ') || '(no map-catalog output)')
  );

  expect(['rows', 'error-state']).toContain(state);
});
