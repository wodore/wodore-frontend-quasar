import { describe, it, expect } from 'vitest';
import { MAP_MIN_ZOOM, OVERLAY_MIN_ZOOM } from '@stores/map/utils/map-constants';

describe('map-constants', () => {
  it('keeps the camera floor below the overlay floor', () => {
    // zooming out past the overlay floor must remain possible (the
    // plain basemap-only far view)
    expect(MAP_MIN_ZOOM).toBeLessThan(OVERLAY_MIN_ZOOM);
    expect(MAP_MIN_ZOOM).toBe(3);
  });
});
