/**
 * Unit tests for the fallback map's shared date parsing (toIsoDate —
 * shared with the MapLibre path in availability-loading.ts).
 *
 * The fallback's extracted modules have their own specs:
 * - fallback-tile-math.spec.ts (tile-math round-trip, viewport range)
 * - fallback-mlt-tile-loader.spec.ts (fetch/decode/evict/generation)
 */
import { describe, expect, it } from 'vitest';

import { toIsoDate } from '@stores/map/availability-loading';

describe('toIsoDate', () => {
  it('converts DD.MM.YY to ISO', () => {
    expect(toIsoDate('30.10.26')).toBe('2026-10-30');
  });

  it('converts DD.MM.YYYY to ISO', () => {
    expect(toIsoDate('30.10.2026')).toBe('2026-10-30');
  });

  it('passes through valid ISO dates', () => {
    expect(toIsoDate('2026-10-30')).toBe('2026-10-30');
  });

  it('returns undefined for unparseable input', () => {
    expect(toIsoDate('garbage')).toBeUndefined();
    expect(toIsoDate('30/10/2026')).toBeUndefined();
    expect(toIsoDate('')).toBeUndefined();
    expect(toIsoDate(undefined)).toBeUndefined();
  });

  it('handles edge dates correctly', () => {
    expect(toIsoDate('01.01.00')).toBe('2000-01-01');
    expect(toIsoDate('31.12.99')).toBe('2099-12-31');
  });
});

// ── Tile-math round-trip (tested inline — mirrors the fallback code) ────
