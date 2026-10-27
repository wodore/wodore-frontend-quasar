/**
 * Unit tests for the fallback map's tile math — now imported from the
 * extracted module (fallback/tile-math.ts) instead of duplicated here.
 */
import { describe, expect, it } from 'vitest';
import {
  lngToTileX,
  latToTileY,
  tileXToLng,
  tileYToLat,
  viewportTileRange,
  wrapTileX,
} from '@components/map/fallback/tile-math';

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

describe('wrapTileX', () => {
  it('wraps out-of-range x into [0, 2^z)', () => {
    expect(wrapTileX(512, 9)).toBe(0); // one full globe east
    expect(wrapTileX(513, 9)).toBe(1);
    expect(wrapTileX(-1, 9)).toBe(511); // one west
  });
});

describe('viewportTileRange', () => {
  // Leaflet-style bounds stub (the module takes the structural shape).
  const bounds = (w: number, s: number, e: number, n: number) => ({
    getWest: () => w,
    getSouth: () => s,
    getEast: () => e,
    getNorth: () => n,
  });

  it('clamps the tile zoom to the source pyramid', () => {
    const r = viewportTileRange(bounds(7.8, 46.3, 8.3, 46.6), 0.25, 14, 5, 9);
    expect(r.tileZoom).toBe(9); // overzoom from the source max
  });

  it('never goes below the pyramid floor', () => {
    const r = viewportTileRange(bounds(-30, -20, 30, 20), 0.25, 3, 5, 9);
    expect(r.tileZoom).toBe(5);
  });

  it('padding grows the range (0.25 pad, Bernese viewport at z9)', () => {
    const padded = viewportTileRange(bounds(7.83, 46.37, 8.27, 46.55), 0.25, 12, 5, 9);
    const exact = viewportTileRange(bounds(7.83, 46.37, 8.27, 46.55), 0, 12, 5, 9);
    expect(padded.x1).toBeLessThanOrEqual(exact.x1);
    expect(padded.x2).toBeGreaterThanOrEqual(exact.x2);
    expect(padded.y1).toBeLessThanOrEqual(exact.y1);
    expect(padded.y2).toBeGreaterThanOrEqual(exact.y2);
  });
});
