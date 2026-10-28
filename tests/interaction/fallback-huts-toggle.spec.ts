/**
 * Fallback huts toggle — store-driven visibility (owner decision,
 * option B): the fallback's built-in huts render following the overlay
 * store's `huts` row once the catalog serves it; row-absent catalogs
 * keep the always-on behavior (deploy window).
 *
 * Route pins: LIVE staging lacks the backend huts subset variant
 * (parallel backend task), so the subset request is served a pinned
 * catalog derived from the live DEFAULT view — the huts row rewritten
 * to its subset identity (profile=subset, style_url kept — the real
 * document feeds statusColors/clustering like production).
 *
 * Hut markers render from the real LAN Martin tile server
 * (WODORE_TILE_SERVER_URL in .env.local) — MLT tile requests are
 * counted to assert loading SUSPENDS while the row is toggled off and
 * resumes WITHOUT refetch when re-enabled (warm caches).
 */
import { test, expect, tagTest } from './helpers';

/** Marker counter via the DEV debug hook: hut dots are WdCanvasDot
 * markers inside the cluster groups (wdOverlay circles live in their
 * own pane and are counted separately — not part of this suite). */
const HUT_MARKER_COUNT = `(() => {
  const dbg = window.__wdFbDebug;
  if (!dbg) return null;
  let n = 0;
  for (const group of dbg.clusterGroups.values()) {
    if (typeof group.getLayers === 'function') n += group.getLayers().length;
  }
  return n;
})()`;

test.beforeEach(async ({ page }) => {
  // The LAN Martin tile server (WODORE_TILE_SERVER_URL in this
  // worktree's .env.local) currently emits a newer MLT column type
  // (code 9) than @maplibre/mlt 1.3.0 decodes — staging CDN tiles
  // decode fine (51 huts in the Bern tile). Rewrite the MLT tile
  // requests to the staging CDN so the suite tests the production tile
  // format regardless of the local server's version drift.
  await page.route(/\/(huts|availability)\/\d+\/\d+\/\d+\.mlt(\?.*)?$/, async route => {
    const resp = await route.fetch({
      url: route
        .request()
        .url()
        .replace(/^https?:\/\/[^/]+/, 'https://tiles.cdn.stg.wodore.com'),
    });
    // The page fetched the LAN origin; the fulfilled CDN response needs
    // an ACAO the LAN origin's request can accept or the fetch reads as
    // a network error (silently swallowed by the loader's catch).
    return route.fulfill({
      response: resp,
      headers: { ...resp.headers(), 'access-control-allow-origin': '*' },
    });
  });
  await page.route('**/v1/map/layers**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('profile') === 'subset') {
      // Pinned post-backend-variant subset view: the DEFAULT response
      // (the live subset view lacks the huts subset variant) with the
      // huts row rewritten to its subset identity; non-subset rows
      // dropped. transport-stops is left to its own spec.
      const upstream = new URL(route.request().url());
      upstream.searchParams.delete('profile');
      const resp = await route.fetch({ url: upstream.toString() });
      const body = await resp.json();
      const rows = (body?.data ?? []).filter(
        (l: { slug?: string; profile?: string }) => l?.profile === 'subset' || l?.slug === 'huts'
      );
      for (const l of rows) {
        if (l.slug === 'huts') l.profile = 'subset';
      }
      return route.fulfill({ response: resp, json: { ...body, data: rows, count: rows.length } });
    }
    return route.fallback(); // default view: live staging
  });
});

async function openFallbackAtBern(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?gpuTier=-1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.leaflet-container', { timeout: 60_000 });
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__wdFbDebug,
    null,
    { timeout: 30_000 }
  );
  // Bern at z9 — above the hut marker floor (z7), real MLT huts tiles.
  await page.evaluate('window.__wdFbDebug.map.setView([46.9482, 7.4472], 9)');
}

test.describe('fallback huts toggle (store-driven)', () => {
  test('huts row present: toggle off clears markers + suspends tile loads; on restores from cache', async ({
    page,
  }, testInfo) => {
    tagTest('light', 'mobile', 'fallback-huts-toggle');
    test.setTimeout(240_000);

    // Count MLT huts tile requests (real tile server).
    let hutsTileRequests = 0;
    page.on('request', req => {
      if (/\/huts\/\d+\/\d+\/\d+\.mlt/.test(req.url())) hutsTileRequests += 1;
    });

    await openFallbackAtBern(page);

    // The pinned subset catalog serves the huts row → the menu lists it.
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForSelector('.wd-ovl__row[data-slug="huts"]', { timeout: 60_000 });

    // Whatever the persisted default, drive the row to ON first: the
    // store's active flag gates the built-in rendering (click only when
    // the row is currently inactive).
    if (
      !(await page.evaluate(
        `document.querySelector('.wd-ovl__row[data-slug="huts"]')?.classList.contains('wd-ovl__row--active')`
      ))
    ) {
      await page.evaluate('document.querySelector(\'.wd-ovl__row[data-slug="huts"]\')?.click()');
    }
    await page.waitForFunction(
      `(() => { const n = ${HUT_MARKER_COUNT}; return n !== null && n > 0; })()`,
      null,
      {
        timeout: 30_000,
      }
    );
    const rendered = await page.evaluate(HUT_MARKER_COUNT);
    expect(rendered as number).toBeGreaterThan(0);
    const requestsAtOn = hutsTileRequests;
    expect(requestsAtOn).toBeGreaterThan(0); // tiles actually loaded

    // Toggle OFF: markers clear…
    await page.evaluate('document.querySelector(\'.wd-ovl__row[data-slug="huts"]\')?.click()');
    await page.waitForFunction(
      `(() => { const n = ${HUT_MARKER_COUNT}; return n === 0; })()`,
      null,
      {
        timeout: 15_000,
      }
    );

    // …and tile loading STAYS suspended while panning (no top-ups for
    // an invisible layer).
    await page.evaluate('window.__wdFbDebug.map.panBy([120, 90])');
    await page.waitForTimeout(1200); // > the 400ms moveend debounce
    expect(hutsTileRequests).toBe(requestsAtOn);

    await testInfo.attach('markers-cleared', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // Pan BACK to the loaded area (still off), then toggle ON: markers
    // return from the WARM tile cache — zero refetch. (A re-enable over
    // SHIFTED ground legitimately top-ups new tiles — that path is not
    // asserted here; the cache-resume is.)
    await page.evaluate('window.__wdFbDebug.map.panBy([-120, -90])');
    await page.waitForTimeout(1200);
    expect(hutsTileRequests).toBe(requestsAtOn); // still suspended
    await page.evaluate('document.querySelector(\'.wd-ovl__row[data-slug="huts"]\')?.click()');
    await page.waitForFunction(
      `(() => { const n = ${HUT_MARKER_COUNT}; return n !== null && n > 0; })()`,
      null,
      {
        timeout: 30_000,
      }
    );
    await page.waitForTimeout(600); // settle any debounced top-up
    expect(hutsTileRequests).toBe(requestsAtOn); // zero refetch — cache hit
  });

  test('huts row ABSENT: built-in huts render as today (deploy window)', async ({ page }) => {
    tagTest('light', 'mobile', 'fallback-huts-toggle');
    test.setTimeout(240_000);

    // Strip the huts row from EVERY catalog view (subset + default):
    // a pre-backend-variant catalog.
    await page.route('**/v1/map/layers**', async route => {
      const resp = await route.fetch();
      const body = await resp.json();
      const rows = (body?.data ?? []).filter((l: { slug?: string }) => l?.slug !== 'huts');
      return route.fulfill({ response: resp, json: { ...body, data: rows, count: rows.length } });
    });

    await openFallbackAtBern(page);

    // No menu row (checked after the menu renders other rows)…
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForSelector('.wd-ovl__row', { timeout: 60_000 });
    await page.waitForTimeout(1000); // settle any late compile
    expect(await page.locator('.wd-ovl__row[data-slug="huts"]').count()).toBe(0);

    // …but the built-in huts render exactly as before the binding.
    await page.waitForFunction(
      `(() => { const n = ${HUT_MARKER_COUNT}; return n !== null && n > 0; })()`,
      null,
      {
        timeout: 30_000,
      }
    );
    expect((await page.evaluate(HUT_MARKER_COUNT)) as number).toBeGreaterThan(0);
  });
});
