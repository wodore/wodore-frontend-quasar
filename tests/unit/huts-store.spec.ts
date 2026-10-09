import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as allure from 'allure-js-commons';

// The store fetches through the generated OpenAPI client; mock it so the
// fixture can deliver an UNORDERED day array (as the unreleased staging
// backend currently does).
const getMock = vi.fn();

vi.mock('@clients/index', () => ({
  clientWodore: { GET: (...args: unknown[]) => getMock(...args) },
  schemasWodore: {},
}));

vi.mock('@services/locale', () => ({
  currentLocale: () => 'en',
  setLocale: vi.fn(),
  i18n: { global: { t: (key: string) => key } },
}));

vi.mock('quasar', () => ({
  Notify: { create: vi.fn() },
}));

function feature(hutId: string, days: Array<{ date: string; occupancy_status: string }>) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [7.5, 46.2] },
    properties: { hut_id: hutId, slug: hutId, data: days },
  };
}

describe('huts store availability geojson', () => {
  let store: Awaited<ReturnType<typeof import('@stores/huts-store')['useHutsStore']>>;

  beforeAll(async () => {
    setActivePinia(createPinia());
    const { useHutsStore } = await import('@stores/huts-store');
    store = useHutsStore();
  });

  it('sorts availability days by date so map day indexes match the requested date', async () => {
    allure.label('feature', 'map-overlays');
    allure.severity('critical');

    // Days delivered unordered (staging backend regression): index 0 would
    // read 2026-10-13 and paint a later day's status behind the hut.
    getMock.mockResolvedValue({
      data: {
        type: 'FeatureCollection',
        bbox: null,
        features: [
          feature('adula', [
            { date: '2026-10-13', occupancy_status: 'full' },
            { date: '2026-10-11', occupancy_status: 'high' },
            { date: '2026-10-14', occupancy_status: 'full' },
            { date: '2026-10-10', occupancy_status: 'low' },
            { date: '2026-10-09', occupancy_status: 'unknown' },
            { date: '2026-10-16', occupancy_status: 'empty' },
            { date: '2026-10-15', occupancy_status: 'medium' },
            { date: '2026-10-12', occupancy_status: 'free_unknown' },
          ]),
        ],
      },
    });

    await store.fetchHutBookingsGeojson({ date: '09.10.26', days: 8 });

    const days = store.bookingsGeojson.features[0].properties.data;
    expect(days.map(d => d.date)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
    ]);
    // Day 0 (the requested date) really is the unknown day
    expect(days[0].occupancy_status).toBe('unknown');
  });

  it('keeps already sorted data unchanged', async () => {
    getMock.mockResolvedValue({
      data: {
        type: 'FeatureCollection',
        bbox: null,
        features: [
          feature('h1', [
            { date: '2026-10-09', occupancy_status: 'empty' },
            { date: '2026-10-10', occupancy_status: 'full' },
          ]),
        ],
      },
    });

    await store.fetchHutBookingsGeojson({ date: '09.10.26', days: 8 });

    const days = store.bookingsGeojson.features[0].properties.data;
    expect(days.map(d => d.date)).toEqual(['2026-10-09', '2026-10-10']);
  });
});
