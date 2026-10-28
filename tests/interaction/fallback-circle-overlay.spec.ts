/**
 * Fallback map circle overlays — the transport-stops geojson overlay on
 * the Leaflet fallback (adapter: src/components/map/fallback/
 * overlay-adapter.ts; `?gpuTier=-1` forces the fallback, services/
 * gpu-override.ts).
 *
 * Route overrides pin the serving state so the test works on TODAY's
 * staging (which still serves transport-stops as profile=full — the
 * row would hide in the fallback menu) and stays deterministic:
 *
 * * `/v1/map/layers` — the live staging catalog with transport-stops
 *   made LENIENT (profile stripped: the pre-#440 state, and the state
 *   until the backend's subset variant deploys — the fallback menu
 *   shows the row, the adapter renders it).
 * * `/v1/map/styles/transport-stops.json` — the staging style document
 *   verbatim (no layer minzoom → exercises the adapter's default z10
 *   floor; paints verbatim so radius/color/stroke evaluation is real).
 * * the BAV geojson URL — a small fixture (the real list is 27k
 *   features / 4.1 MB: determinism + network budget; marker count and
 *   per-type colors assert exactly).
 *
 * The maplibre counterpart (same routes, no gpuTier override) guards
 * the native path stays console-clean with the overlay active.
 */
import { test, expect, evalJSON, tagTest, attachScreenshot, GET_MAP } from './helpers';

const DATA_URL =
  'https://raw.githubusercontent.com/wodore/bav-haltestellen/main/static/bav_list.geojson';

/** The transport-stops style as staging serves it (full variant,
 * hub.stg.wodore.com /v1/map/styles/transport-stops.json, 2026-10-28;
 * no layer minzoom — the adapter's default z10 floor applies). */
const TS_STYLE = {
  version: 8,
  name: 'transport-stops',
  glyphs:
    'https://tiles.cdn.stg.wodore.com/font/{fontstack}/{range}?v=290e313f7228565d883db8a2844b6de6',
  layers: [
    {
      id: 'transport-stops',
      type: 'circle',
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
      layout: { visibility: 'visible' },
      source: 'transport-stops',
    },
  ],
  sources: {
    'transport-stops': {
      data: DATA_URL,
      type: 'geojson',
      promoteId: 'id',
    },
  },
  metadata: { 'wd:served_spec': 'medium', 'wd:slug': 'transport-stops' },
};

/** Fixture stops: three types around Bern (in a z13 Bern view) + one
 * far-away stop (still a map layer — the adapter adds every feature,
 * viewport-independent). */
const FIXTURE_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    pt(1, [7.4472, 46.9482], ['train']), // Bern Bahnhof — red
    pt(2, [7.4512, 46.9466], ['bus']), // Bern station bus stop — indigo
    pt(3, [7.4431, 46.9501], ['tram']), // other — blue
    pt(4, [7.4405, 46.9441], ['train', 'bus']), // train wins (case order) — red
    pt(5, [8.5417, 47.3782], ['ship']), // Zurich — out of view, still a layer
  ],
};

function pt(id: number, coordinates: [number, number], types: string[]) {
  return {
    type: 'Feature' as const,
    id,
    geometry: { type: 'Point' as const, coordinates },
    properties: { id, types },
  };
}

/** Count + inspect the circle-overlay layers via the fallback debug
 * hook (DEV builds only — the dev server qualifies). The adapter adds
 * one L.geoJSON group per overlay whose markers carry the
 * wdOverlayData pane; map.eachLayer does not recurse into groups, so
 * walk one level down. */
const CIRCLE_STATE = `(() => {
  const m = window.__wdFbDebug?.map;
  if (!m) return null;
  const markers = [];
  m.eachLayer(l => {
    if (l?.options?.pane !== 'wdOverlayData') return;
    if (typeof l.eachLayer !== 'function') return; // the group container
    l.eachLayer(inner => {
      markers.push({
        id: inner?.feature?.properties?.id ?? null,
        fillColor: inner?.options?.fillColor ?? null,
        radius: typeof inner?.getRadius === 'function' ? inner.getRadius() : null,
      });
    });
  });
  return markers;
})()`;

test.beforeEach(async ({ page }) => {
  // Layers catalog: the DEFAULT staging response with transport-stops
  // made lenient (profile stripped → the row stays visible in the
  // fallback menu — the pre-#440 state, and the state until the
  // backend's subset variant deploys). Fetched WITHOUT the profile
  // param: the overlay store now sends profile=subset on fallback
  // sessions (fallback-subset-catalog.spec), and staging's subset view
  // lacks transport-stops — the upstream must be the default view so
  // the pinned lenient rows (incl. transport-stops) arrive either way.
  await page.route('**/v1/map/layers**', async route => {
    let body: { data?: Array<{ slug?: string; profile?: string }> } | undefined;
    try {
      const upstream = new URL(route.request().url());
      upstream.searchParams.delete('profile');
      const resp = await route.fetch({ url: upstream.toString() });
      body = await resp.json();
      for (const layer of body?.data ?? []) {
        if (layer?.slug === 'transport-stops') delete layer.profile;
      }
      return route.fulfill({ response: resp, json: body });
    } catch (error) {
      console.warn(`[fallback-circle] layers fetch failed: ${String(error)}`);
      return route.fulfill({ status: 503, json: { detail: 'catalog unreachable' } });
    }
  });
  // Style document: served verbatim (deterministic, independent of
  // staging's v-token rotation).
  await page.route('**/v1/map/styles/transport-stops.json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TS_STYLE) })
  );
  // The geojson source: fixture (the real BAV list is 4.1 MB / 27k stops).
  await page.route(DATA_URL, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FIXTURE_GEOJSON),
    })
  );
});

async function openFallbackMap(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?gpuTier=-1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.leaflet-container', { timeout: 60_000 });
  await page.waitForFunction(
    () => !!(window as unknown as Record<string, unknown>).__wdFbDebug,
    null,
    {
      timeout: 30_000,
    }
  );
  // Bern at z13 — above the default z10 floor, all fixture types visible.
  await page.evaluate('window.__wdFbDebug.map.setView([46.9482, 7.4472], 13)');
}

async function toggleTransportStops(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
  await page.waitForSelector('.wd-ovl__row[data-slug="transport-stops"]', { timeout: 60_000 });
  await page.evaluate(
    'document.querySelector(\'.wd-ovl__row[data-slug="transport-stops"]\')?.click()'
  );
}

test.describe('fallback circle overlays', () => {
  test('transport-stops renders gated circle markers and toggles off', async ({
    page,
  }, testInfo) => {
    tagTest('light', 'mobile', 'fallback-circle');
    test.setTimeout(240_000);

    await openFallbackMap(page);
    await toggleTransportStops(page);

    // Markers appear: every fixture feature becomes a circle marker in
    // the wdOverlayData pane.
    await page.waitForFunction(
      `(() => { const s = ${CIRCLE_STATE}; return s !== null && s.length >= 5; })()`,
      null,
      { timeout: 20_000 }
    );
    const markers = await evalJSON<Array<{ id: number; fillColor: string; radius: number | null }>>(
      page,
      CIRCLE_STATE
    );
    const byId = new Map(markers.map(m => [m.id, m]));
    expect(byId.size).toBe(5);
    expect(byId.get(1)?.fillColor).toBe('#C60018'); // train → red
    expect(byId.get(2)?.fillColor).toBe('#2d327d'); // bus → indigo
    expect(byId.get(3)?.fillColor).toBe('#0079C7'); // tram → default blue
    expect(byId.get(4)?.fillColor).toBe('#C60018'); // train+bus → case order: train wins
    expect(byId.get(5)?.fillColor).toBe('#0079C7'); // ship → default
    // Radius from the interpolated curve at z13 (train: 4→9 over 9→16).
    expect(byId.get(1)?.radius).toBeCloseTo(4 + 5 * (4 / 7), 1);

    await attachScreenshot(page, testInfo, 'fallback-circles-on');

    // Below the default floor (z9 < 10): the group is removed — the
    // 27k-stop overlay never paints at world view.
    await page.evaluate('window.__wdFbDebug.map.setZoom(9)');
    await page.waitForFunction(
      `(() => { const s = ${CIRCLE_STATE}; return s?.length === 0; })()`,
      null,
      {
        timeout: 15_000,
      }
    );

    // Back above the floor: re-added without a refetch.
    await page.evaluate('window.__wdFbDebug.map.setZoom(12)');
    await page.waitForFunction(
      `(() => { const s = ${CIRCLE_STATE}; return s?.length === 5; })()`,
      null,
      {
        timeout: 15_000,
      }
    );
    // Re-styled at the new zoom (radius curve moved: train @z12 < @z13).
    const restyled = await evalJSON<Array<{ id: number; radius: number | null }>>(
      page,
      CIRCLE_STATE
    );
    const train = restyled.find(m => m.id === 1);
    expect(train?.radius).toBeCloseTo(4 + 5 * (3 / 7), 1);

    // Toggle off: the entry is removed entirely.
    await page.evaluate(
      'document.querySelector(\'.wd-ovl__row[data-slug="transport-stops"]\')?.click()'
    );
    await page.waitForFunction(
      `(() => { const s = ${CIRCLE_STATE}; return s?.length === 0; })()`,
      null,
      {
        timeout: 15_000,
      }
    );
    await attachScreenshot(page, testInfo, 'fallback-circles-off');
  });
});

test.describe('maplibre regression', () => {
  test('maplibre map stays console-clean with transport-stops active', async ({ page }) => {
    tagTest('light', 'mobile', 'maplibre-console');
    test.setTimeout(240_000);

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', error => errors.push(String(error)));

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });
    await page.evaluate('document.querySelector(".wd-ovl__more")?.click()');
    await page.waitForSelector('.wd-ovl__row[data-slug="transport-stops"]', { timeout: 60_000 });
    await page.evaluate(
      'document.querySelector(\'.wd-ovl__row[data-slug="transport-stops"]\')?.click()'
    );

    // The native path adds the style's own layer id to the maplibre map.
    await page.waitForFunction(
      `(() => { const map = ${GET_MAP}; return !!map && !!map.getLayer('transport-stops'); })()`,
      null,
      { timeout: 30_000 }
    );
    expect(errors).toEqual([]);
  });
});
