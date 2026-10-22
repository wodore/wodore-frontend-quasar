/**
 * Basemap style-document failure detection (utils/basemap-fallback) —
 * the staging 2026-10 incident: the style endpoint answered
 * 404 "No active map layer with slug 'wd-outdoor-base-mtk'" while the
 * persisted layers snapshot still carried the layer. The map error
 * carries MapLibre's AJAXError shape (status/url); the predicate must
 * recognize definitive load failures of the ACTIVE basemap's own style
 * document and reject everything else (tile errors, transient 5xx,
 * other styles).
 */
import { describe, it, expect } from 'vitest';
import { isBasemapStyleGone, STYLE_GONE_STATUSES } from '@stores/map/utils/basemap-fallback';

const MTK_STYLE = 'https://hub.stg.wodore.com/v1/map/styles/wd-outdoor-base-mtk.json?spec=high';

/** MapLibre AJAXError shape (util/ajax.ts): status + url, message
 * `AJAXError: Not Found (404): <url>` — only the typed fields matter. */
function ajaxError(status: number, url: string): { status: number; url: string } {
  return { status, url };
}

describe('isBasemapStyleGone', () => {
  it('matches the exact staging incident: 404 on the active style URL', () => {
    expect(isBasemapStyleGone(ajaxError(404, MTK_STYLE), MTK_STYLE)).toBe(true);
  });

  it('matches 410 (gone) as a definitive status', () => {
    expect(isBasemapStyleGone(ajaxError(410, MTK_STYLE), MTK_STYLE)).toBe(true);
    expect([...STYLE_GONE_STATUSES]).toEqual([404, 410]);
  });

  it('matches the same style path behind a rewritten origin (spec may differ)', () => {
    // requestManager transforms could swap the origin; the layer slug
    // addressed by the path is what identifies the style document.
    const transformed = 'https://tiles.example.com/v1/map/styles/wd-outdoor-base-mtk.json';
    expect(isBasemapStyleGone(ajaxError(404, transformed), MTK_STYLE)).toBe(true);
    expect(
      isBasemapStyleGone(
        ajaxError(404, 'https://hub.stg.wodore.com/v1/map/styles/x.json'),
        MTK_STYLE
      )
    ).toBe(false);
  });

  it('rejects transient and network statuses (0/429/5xx must not switch basemaps)', () => {
    for (const status of [0, 401, 403, 429, 500, 503]) {
      expect(isBasemapStyleGone(ajaxError(status, MTK_STYLE), MTK_STYLE)).toBe(false);
    }
  });

  it('rejects 404s for OTHER resources (tiles, glyphs, sprites, other styles)', () => {
    expect(
      isBasemapStyleGone(
        ajaxError(404, 'https://hub.stg.wodore.com/tiles/9/231/331.pbf'),
        MTK_STYLE
      )
    ).toBe(false);
    expect(
      isBasemapStyleGone(
        ajaxError(
          404,
          'https://hub.stg.wodore.com/v1/map/styles/wd-outdoor-base-ofm.json?spec=high'
        ),
        MTK_STYLE
      )
    ).toBe(false);
  });

  it('rejects missing inputs (no active basemap, non-URL errors, empty url)', () => {
    expect(isBasemapStyleGone(undefined, MTK_STYLE)).toBe(false);
    expect(isBasemapStyleGone(ajaxError(404, MTK_STYLE), undefined)).toBe(false);
    expect(isBasemapStyleGone({ status: 404 }, MTK_STYLE)).toBe(false);
    expect(isBasemapStyleGone({ status: 404, url: '' }, MTK_STYLE)).toBe(false);
    expect(isBasemapStyleGone({ message: 'AJAXError: Not Found (404)' }, MTK_STYLE)).toBe(false);
  });

  it('accepts a root-relative active style URL via pathname comparison', () => {
    // No WODORE_API_HOST set → absolutizeStyleUrl leaves the URL
    // root-relative; the failed (absolute) fetch still addresses the
    // same style document.
    expect(
      isBasemapStyleGone(
        ajaxError(404, MTK_STYLE),
        '/v1/map/styles/wd-outdoor-base-mtk.json?spec=high'
      )
    ).toBe(true);
  });
});
