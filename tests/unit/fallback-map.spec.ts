/**
 * Unit tests for the Leaflet fallback map's pure logic.
 *
 * Covers the two must-test modules from the Opus review:
 * - toIsoDate (shared with the MapLibre path in availability-loading.ts)
 * - tile-math round-trip (lng/lat ↔ tile x/y, extracted to test inline)
 */
import { describe, expect, it } from 'vitest';

// ── toIsoDate (imported from the shared module) ─────────────────────────
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
// These functions live in WdFallbackMapView.vue; the math is duplicated
// here for testability. The Opus review recommends extracting to a
// shared tile-math.ts module (should-fix item).

const lngToTileX = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
const latToTileY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
};
const tileXToLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileYToLat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180) / Math.PI;
};

describe('tile-math round-trip', () => {
  const testCases: Array<{ lat: number; lng: number; label: string }> = [
    { lat: 46.46, lng: 8.05, label: 'Bernese Alps' },
    { lat: 0, lng: 0, label: 'equator/prime meridian' },
    { lat: -33.87, lng: 151.21, label: 'Sydney' },
    { lat: 64.13, lng: -21.9, label: 'Reykjavik' },
    { lat: 85, lng: 179.9, label: 'near north pole / date line' },
    { lat: -85, lng: -179.9, label: 'near south pole / date line' },
  ];

  for (const zoom of [0, 5, 9, 12, 16]) {
    it(`round-trips at z${zoom}`, () => {
      for (const { lat, lng, label } of testCases) {
        const tx = lngToTileX(lng, zoom);
        const ty = latToTileY(lat, zoom);
        const backLng = tileXToLng(tx, zoom);
        const backLat = tileYToLat(ty, zoom);
        // Precision: at z16 a tile is ~600m; 1e-6 degrees ≈ 0.1m
        expect(Math.abs(backLng - lng), `${label} lng at z${zoom}`).toBeLessThan(1e-6);
        expect(Math.abs(backLat - lat), `${label} lat at z${zoom}`).toBeLessThan(1e-6);
      }
    });
  }

  it('known tile: Bernese Alps at z8', () => {
    // 46.46°N, 8.05°E → tile 8/133/90 (tile 133 covers lng 7.03–8.44;
    // tile 90 covers lat ~46.4–47.1; verified via the MLT fetch logs)
    const tx = Math.floor(lngToTileX(8.05, 8));
    const ty = Math.floor(latToTileY(46.46, 8));
    expect(tx).toBe(133);
    expect(ty).toBe(90);
  });
});
