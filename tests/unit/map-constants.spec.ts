import { describe, it, expect } from 'vitest';
import { OVERLAY_MIN_ZOOM, withOverlayMinZoom } from '@stores/map/utils/map-constants';

describe('map-constants', () => {
  it('exposes the overlay zoom floor', () => {
    // Two levels below the previous floor of 7 — overlays fade in earlier
    expect(OVERLAY_MIN_ZOOM).toBe(5);
  });

  it('clamps layers that start below the overlay zoom floor', () => {
    expect(withOverlayMinZoom({ id: 'wd-huts', type: 'circle' })).toEqual({
      id: 'wd-huts',
      type: 'circle',
      minzoom: 5,
    });
  });

  it('keeps layers that already start at or above the floor', () => {
    const layer = { id: 'wd-huts-occupation-day0', type: 'symbol', minzoom: 6 };
    expect(withOverlayMinZoom(layer)).toBe(layer);
    expect(withOverlayMinZoom({ ...layer, minzoom: 5 })).toEqual({
      id: 'wd-huts-occupation-day0',
      type: 'symbol',
      minzoom: 5,
    });
  });

  it('returns the same object when no clamp is needed', () => {
    const layer = { id: 'wd-huts', type: 'circle', minzoom: 9 };
    expect(withOverlayMinZoom(layer)).toBe(layer);
  });
});
