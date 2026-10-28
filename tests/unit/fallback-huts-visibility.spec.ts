/**
 * Unit tests for the fallback's store-driven huts visibility
 * (fallback/huts-visibility — owner decision, option B: the built-in
 * hut rendering follows the overlay store's huts row instead of
 * rendering always-on).
 *
 * Matrix: row absent → ACTIVE (deploy-window default = today's
 * behavior); row present → its active flag. The rendering/loading
 * gates (rebuildMarkers/refreshTiles/refreshAvailTiles) consume this
 * predicate inside WdFallbackMapView — covered end-to-end by the
 * fallback-huts-toggle interaction spec.
 */
import { describe, expect, it } from 'vitest';
import { HUTS_OVERLAY_NAME, hutsRowVisible } from '@components/map/fallback/huts-visibility';

describe('hutsRowVisible', () => {
  it('row ABSENT → active (today always-on behavior, deploy window)', () => {
    expect(hutsRowVisible(undefined)).toBe(true);
    expect(hutsRowVisible(null)).toBe(true);
  });

  it('row present + active → visible', () => {
    expect(hutsRowVisible({ active: true })).toBe(true);
  });

  it('row present + inactive → hidden', () => {
    expect(hutsRowVisible({ active: false })).toBe(false);
  });

  it('row present without a flag reads as off (catalog rows always carry one)', () => {
    expect(hutsRowVisible({})).toBe(false);
    expect(hutsRowVisible({ active: undefined })).toBe(false);
  });

  it('the row identity is the huts catalog slug', () => {
    expect(HUTS_OVERLAY_NAME).toBe('huts');
  });
});
