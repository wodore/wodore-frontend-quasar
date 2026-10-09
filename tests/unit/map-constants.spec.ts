import { describe, it, expect } from 'vitest';
import { GLOBE_SKY, MAP_MIN_ZOOM, OVERLAY_MIN_ZOOM } from '@stores/map/utils/map-constants';

describe('map-constants', () => {
  it('keeps the camera floor below the overlay floor', () => {
    // zooming out past the overlay floor must remain possible (that is
    // where the globe view lives)
    expect(MAP_MIN_ZOOM).toBeLessThan(OVERLAY_MIN_ZOOM);
    expect(MAP_MIN_ZOOM).toBe(2);
  });

  it('defines a dark space sky that fades back to daylight by z10', () => {
    const skyColor = GLOBE_SKY['sky-color'] as unknown as Array<unknown>;
    expect(Array.isArray(skyColor)).toBe(true);
    expect(skyColor[0]).toBe('interpolate');
    // dark near the planet, MapLibre's default daylight blue up close
    expect(JSON.stringify(skyColor)).toContain('#02040a');
    expect(JSON.stringify(skyColor)).toContain('#88c6fc');
    // no atmosphere haze once zoomed in
    const blend = GLOBE_SKY['atmosphere-blend'] as unknown as Array<unknown>;
    expect(blend[blend.length - 1]).toBe(0);
  });
});
