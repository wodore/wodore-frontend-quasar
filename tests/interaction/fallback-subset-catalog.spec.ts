/**
 * Fallback subset catalog — the overlay store's `profile=subset` fetch
 * (backend #440): no-WebGL/fallback sessions request the SUBSET catalog
 * view, so subset-servable overlays (transport-stops, once backend #443
 * ships its subset twin) appear in the fallback menu while full-only
 * rows (huts) never reach it. MapLibre sessions keep the DEFAULT
 * catalog (no profile param).
 *
 * Route pins: LIVE staging still lacks backend #443 — the subset view
 * (verified live: `?profile=subset` answers 10 rows, transport-stops
 * absent) — so the fallback's subset request is served a PINNED
 * post-#443 catalog: the live DEFAULT response with transport-stops
 * rewritten to its subset variant and non-subset rows dropped. The
 * default (no-profile) requests pass through to live staging.
 */
import { test, expect, tagTest } from './helpers';

const DATA_URL =
  'https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson';

/** The transport-stops SUBSET variant style (backend #443 seed shape:
 * the full style minus promoteId/layout, plus `minzoom: 10` — the
 * low-spec floor the adapter's default mirrors). */
const TS_SUBSET_STYLE = {
  version: 8,
  name: 'transport-stops',
  layers: [
    {
      id: 'transport-stops',
      type: 'circle',
      minzoom: 10,
      paint: {
        'circle-color': [
          'case',
          ['in', 'train', ['get', 'types']],
          '#C60018',
          ['in', 'bus', ['get', 'types']],
          '#2d327d',
          '#0079C7',
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7,
          ['case', ['in', 'train', ['get', 'types']], 3, ['in', 'bus', ['get', 'types']], 2, 1],
          9,
          ['case', ['in', 'train', ['get', 'types']], 4, ['in', 'bus', ['get', 'types']], 3, 3],
          16,
          ['case', ['in', 'train', ['get', 'types']], 9, ['in', 'bus', ['get', 'types']], 8, 8],
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 5, 0.3, 8, 0.6, 12, 1],
        'circle-stroke-color': '#F6F6F6',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 12, 1, 16, 2],
      },
      source: 'transport-stops',
    },
  ],
  sources: { 'transport-stops': { data: DATA_URL, type: 'geojson' } },
};

const FIXTURE_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 1,
      geometry: { type: 'Point', coordinates: [7.4472, 46.9482] },
      properties: { id: 1, types: ['train'] },
    },
    {
      type: 'Feature',
      id: 2,
      geometry: { type: 'Point', coordinates: [7.4512, 46.9466] },
      properties: { id: 2, types: ['bus'] },
    },
  ],
};

/** Every /v1/map/layers URL requested by the page, + its profile param. */
const layerRequestProfiles: Array<string | null> = [];

test.beforeEach(async ({ page }) => {
  layerRequestProfiles.length = 0;
  await page.route('**/v1/map/layers**', async route => {
    const url = new URL(route.request().url());
    const profile = url.searchParams.get('profile');
    layerRequestProfiles.push(profile);
    if (profile === 'subset') {
      // The pinned post-#443 subset view: the DEFAULT response (the
      // live subset view lacks transport-stops until #443) rewritten —
      // transport-stops as its subset twin, non-subset rows dropped.
      const upstream = new URL(route.request().url());
      upstream.searchParams.delete('profile');
      const resp = await route.fetch({ url: upstream.toString() });
      const body = await resp.json();
      const rows = (body?.data ?? []).filter(
        (l: { slug?: string; profile?: string }) =>
          l?.profile === 'subset' || l?.slug === 'transport-stops'
      );
      for (const l of rows) {
        if (l.slug === 'transport-stops') {
          l.profile = 'subset';
          l.style_url = '/v1/map/styles/transport-stops.json?spec=medium&profile=subset&v=pinned';
        }
      }
      return route.fulfill({ response: resp, json: { ...body, data: rows, count: rows.length } });
    }
    // Default view (MapLibre sessions, basemap stores): live staging.
    return route.fallback();
  });
  await page.route('**/v1/map/styles/transport-stops.json**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TS_SUBSET_STYLE),
    })
  );
  await page.route(DATA_URL, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FIXTURE_GEOJSON),
    })
  );
});

test.describe('fallback subset catalog', () => {
  test('fallback session fetches profile=subset: transport-stops listed (no huts), renders', async ({
    page,
  }) => {
    tagTest('light', 'mobile', 'fallback-subset-catalog');
    test.setTimeout(240_000);

    await page.goto('/?gpuTier=-1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('.leaflet-container', { timeout: 60_000 });
    await page.waitForFunction(
      () => !!(window as unknown as Record<string, unknown>).__wdFbDebug,
      null,
      { timeout: 30_000 }
    );
    // Above the pinned style's minzoom 10 floor.
    await page.evaluate('window.__wdFbDebug.map.setView([46.9482, 7.4472], 13)');

    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    // The SUBSET catalog drives the menu: transport-stops (pinned as
    // subset) is listed…
    await page.waitForSelector('.wd-ovl__row[data-slug="transport-stops"]', {
      timeout: 60_000,
    });
    // …and the full-only huts row never arrives at all.
    await page.waitForTimeout(1000); // settle: any late compile would apply by now
    expect(await page.locator('.wd-ovl__row[data-slug="huts"]').count()).toBe(0);

    // The overlay fetch itself declared the renderer capability.
    expect(layerRequestProfiles).toContain('subset');

    // The subset row is RENDERABLE end to end: toggle → circle markers.
    await page.evaluate(
      'document.querySelector(\'.wd-ovl__row[data-slug="transport-stops"]\')?.click()'
    );
    await page.waitForFunction(
      `(() => {
        const m = window.__wdFbDebug.map; let n = 0;
        m.eachLayer(l => {
          if (l?.options?.pane === 'wdOverlayData' && typeof l.eachLayer === 'function') {
            l.eachLayer(() => n++);
          }
        });
        return n >= 2;
      })()`,
      null,
      { timeout: 20_000 }
    );
    await page.waitForTimeout(500);
    expect(layerRequestProfiles.every(p => p === null || p === 'subset')).toBe(true);
  });
});

test.describe('maplibre default catalog', () => {
  test('maplibre session keeps the DEFAULT catalog (no profile param, huts row present)', async ({
    page,
  }) => {
    tagTest('light', 'mobile', 'subset-catalog-regression');
    test.setTimeout(240_000);

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });

    // The default catalog carries the full-only huts overlay — its row
    // rendering proves the DEFAULT view arrived (not a subset fetch).
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForSelector('.wd-ovl__row[data-slug="huts"]', { timeout: 60_000 });

    // No overlay/basemap layers request ever declared a profile.
    expect(layerRequestProfiles.length).toBeGreaterThan(0);
    expect(layerRequestProfiles.every(p => p === null)).toBe(true);
  });
});
