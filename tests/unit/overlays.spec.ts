import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';

// overlays.ts imports overlay-huts, which registers a map watcher at module
// scope; useMap must be mocked (hoisted, so it also applies to the dynamic
// import below).
vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

describe('opacityLevels', () => {
  let overlays: typeof import('@stores/map/utils/overlays');

  // overlay-huts evaluates Pinia at import time, so pinia must be active
  // BEFORE the dynamic import.
  beforeAll(async () => {
    setActivePinia(createPinia());
    overlays = await import('@stores/map/utils/overlays');
  });

  it('returns a zoom-based interpolate expression with default stops', () => {
    allure.label('feature', 'map-overlays');
    allure.severity('critical');

    const expr = overlays.opacityLevels({}) as unknown as Array<unknown>;

    expect(expr[0]).toBe('interpolate');
    expect(expr[1]).toEqual(['linear']);
    expect(expr[2]).toEqual(['zoom']);
    // stops: zoom 10 (zoomOut=0), 11 (zoomMain*0.8), 15 (zoomMain), 18 (zoomIn)
    const stops = expr.filter((_, i) => i >= 3 && i % 2 === 1);
    expect(stops).toEqual([10, 11, 15, 18]);
    // default zoomMain = 0.8 -> zoom 11 stop is 0.64, zoom 15 stop is 0.8
    const values = expr.filter((_, i) => i >= 4 && i % 2 === 0);
    expect(values).toEqual([0, 0.8 * 0.8, 0.8, 0.3]);
  });

  it('applies custom zoom levels', () => {
    const expr = overlays.opacityLevels({
      zoomOut: 0.1,
      zoomMain: 1,
      zoomIn: 0.5,
    }) as unknown as Array<unknown>;
    const values = expr.filter((_, i) => i >= 4 && i % 2 === 0);
    expect(values).toEqual([0.1, 0.8, 1, 0.5]);
  });

  it('uses identical main opacity at zoom 11 and 15 when zoomMain = 0.8 (no visual jump)', () => {
    const expr = overlays.opacityLevels({ zoomMain: 0.8 }) as unknown as number[];
    expect(expr[6]).toBeGreaterThan(0);
    expect(expr[8]).toBe(0.8);
    expect(expr[10]).toBeLessThan(expr[8]);
  });
});

describe('overlay config sanity', () => {
  let overlays: typeof import('@stores/map/utils/overlays');

  beforeAll(async () => {
    setActivePinia(createPinia());
    overlays = await import('@stores/map/utils/overlays');
  });

  it('huts overlay item exposes name and style', () => {
    allure.label('feature', 'map-overlays');
    const huts = overlays.createHuts();
    expect(huts.name).toBe('huts');
    expect(huts.style).toBeDefined();
    expect(huts.style.version).toBe(8);
  });
});
