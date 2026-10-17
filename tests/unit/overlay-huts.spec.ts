// @vitest-environment happy-dom
//
// Availability overlay fixups — the `wd-bookings` geojson source rides
// the huts store's live bookingsGeojson (date-picker flow) and the
// occupation layers follow the picked date. Pure synchronous functions:
// date changes flow through applyOverlayParameters (map-catalog-store),
// data arrival through its single store-level watch — there is no
// per-style watcher state to test here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Map as MlMap, StyleSpecification } from 'maplibre-gl';
import {
  fixupBookingsStyle,
  applyBookingsToMap,
  isDateGatedLayer,
  dateGatedVisibility,
} from '@stores/map/utils/overlay-huts';
import { useHutsStore } from '@stores/huts-store';

const bookingsStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    'wd-bookings': {
      type: 'geojson',
      data: 'https://hub.example.com/v1/huts/availability/{{date}}.geojson',
      promoteId: 'hut_id',
    },
  },
  layers: [
    { id: 'wd-huts', type: 'symbol', source: 'wd-bookings' },
    {
      id: 'wd-huts-occupation',
      type: 'circle',
      source: 'wd-bookings',
      layout: { visibility: 'visible' },
    },
  ],
});

/** Recording map stub — only the listed layers exist, the wd-bookings
 *  source records setData. */
const recordingMap = (layerIds: string[]) => {
  const setLayoutProperty = vi.fn();
  const setData = vi.fn();
  const map = {
    isStyleLoaded: () => true,
    getLayer: (id: string) => layerIds.includes(id),
    setLayoutProperty,
    getSource: (id: string) => (id === 'wd-bookings' ? { setData } : undefined),
  };
  return { map: map as unknown as MlMap, setLayoutProperty, setData };
};

describe('availability overlay fixups', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fixupBookingsStyle rides the live store geojson — never the style URL', () => {
    const style = bookingsStyle();
    expect(fixupBookingsStyle(style)).toBe(true);
    const source = style.sources['wd-bookings'] as { data: unknown };
    expect(source.data).toMatchObject({ type: 'FeatureCollection', features: [] });
  });

  it('bakes occupation layers hidden until a date is picked, then visible', () => {
    const style = bookingsStyle();
    fixupBookingsStyle(style);
    const layer = style.layers[1] as { layout: Record<string, string> };
    // No date picked → availability layers baked hidden
    expect(layer.layout.visibility).toBe('none');

    useHutsStore().selectedDate = '2026-10-20';
    // Synchronous — the re-resolve path (applyOverlayParameters) calls
    // the fixup again on the fresh document.
    fixupBookingsStyle(style);
    expect(layer.layout.visibility).toBe('visible');
  });

  it('no-ops (returns false) for styles without a wd-bookings geojson source', () => {
    expect(fixupBookingsStyle({ version: 8, sources: {}, layers: [] })).toBe(false);
    const nonGeojson = {
      version: 8,
      sources: { 'wd-bookings': { type: 'raster', tiles: [], tileSize: 256 } },
      layers: [],
    } as unknown as StyleSpecification;
    expect(fixupBookingsStyle(nonGeojson)).toBe(false);
  });

  it('exposes the date-gate predicate for the overlay control', () => {
    expect(isDateGatedLayer('wd-huts-occupation')).toBe(true);
    expect(isDateGatedLayer('wd-huts-occupation-day2')).toBe(true);
    expect(isDateGatedLayer('wd-huts')).toBe(false);
  });

  it('dateGatedVisibility mirrors the picked date', () => {
    expect(dateGatedVisibility()).toBe('none');
    useHutsStore().selectedDate = '2026-10-23';
    expect(dateGatedVisibility()).toBe('visible');
  });

  describe('applyBookingsToMap', () => {
    it('applies date-gated visibility to present occupation layers', () => {
      const { map, setLayoutProperty } = recordingMap(['wd-huts-occupation']);
      applyBookingsToMap(map, true);
      expect(setLayoutProperty).toHaveBeenCalledWith('wd-huts-occupation', 'visibility', 'none');

      useHutsStore().selectedDate = '2026-10-20';
      applyBookingsToMap(map, true);
      expect(setLayoutProperty).toHaveBeenCalledWith('wd-huts-occupation', 'visibility', 'visible');
    });

    it('hiding the whole overlay wins over the date gate', () => {
      const { map, setLayoutProperty } = recordingMap(['wd-huts-occupation']);
      useHutsStore().selectedDate = '2026-10-20';
      applyBookingsToMap(map, false);
      expect(setLayoutProperty).toHaveBeenCalledWith('wd-huts-occupation', 'visibility', 'none');
    });

    it('skips layers the map does not carry and pushes the live object to the source', () => {
      const { map, setLayoutProperty, setData } = recordingMap([]);
      applyBookingsToMap(map, true);
      expect(setLayoutProperty).not.toHaveBeenCalled();
      expect(setData).toHaveBeenCalledWith(expect.objectContaining({ type: 'FeatureCollection' }));
    });

    it('no-ops without a map or while the style is loading', () => {
      expect(() => applyBookingsToMap(undefined, true)).not.toThrow();
      const { map, setLayoutProperty, setData } = recordingMap(['wd-huts-occupation']);
      (map as unknown as { isStyleLoaded: () => boolean }).isStyleLoaded = () => false;
      applyBookingsToMap(map, true);
      expect(setLayoutProperty).not.toHaveBeenCalled();
      expect(setData).not.toHaveBeenCalled();
    });
  });
});
