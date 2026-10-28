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
import {
  HUTS_OVERLAY_NAME,
  hutsRowVisible,
  shouldAdoptHutsActive,
} from '@components/map/fallback/huts-visibility';

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

describe('shouldAdoptHutsActive (one-time deploy-window adoption)', () => {
  it('present + compiled inactive + NO persisted state → adopt (pure-fallback users)', () => {
    expect(shouldAdoptHutsActive({ active: false }, false)).toBe(true);
  });

  it('present + inactive + persisted state → follow the flag, no adoption', () => {
    // The user toggled huts before (any session) — their choice wins.
    expect(shouldAdoptHutsActive({ active: false }, true)).toBe(false);
  });

  it('already-active or absent rows never adopt', () => {
    expect(shouldAdoptHutsActive({ active: true }, false)).toBe(false); // nothing to adopt
    expect(shouldAdoptHutsActive(undefined, false)).toBe(false); // deploy window: no row
    expect(shouldAdoptHutsActive({}, false)).toBe(false); // flagless degenerate row
  });
});
