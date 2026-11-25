/**
 * Basemap presence ↔ interactive overlay contract (backend #506) — the
 * pure helpers. Fixtures mirror what the backend serves: the presence
 * layer ids come from `seed_lib.py` (accommodations + the legacy
 * `wd-basemap-transit-*` namespace of transport-stops), the label order
 * from `GET /v1/map/styles/wd-outdoor-base-mtk-hill.json`.
 */
import { describe, it, expect } from 'vitest';
import {
  KEEPER_LABEL_PREFIXES,
  hideReplacedPresence,
  labelBandAnchor,
  presenceFamilies,
  presenceLayerPrefix,
  presenceVisibility,
  resolveOverlayAnchor,
} from '@stores/map/utils/basemap-presence';

// The served mtk-hill order, trimmed to the layers the contract reads
// (real indices in comments).
const MTK_HILL_LAYER_IDS = [
  'land',
  'road_path_oneway_symbol', // 56 — the basemap's routes anchor
  'water_waterway_label_rank_5',
  'wd-basemap-accommodations-icons', // 86
  'wd-basemap-transit-stations', // 87
  'wd-basemap-transit-stations-label', // 88
  'wd-basemap-accommodations-labels', // 89
  'place_point_label_rank_5',
  'place_point_label_rank_4',
  'place_peak_label_rank_3', // 108 — first keeper label
  'place_line_label_rank_3',
  'place_point_label_rank_3',
  'place_peak_label_rank_2',
  'place_line_label_rank_2',
  'place_point_label_rank_2', // the catalog's places anchor (huts)
  'place_peak_label_rank_1',
  'place_line_label_rank_1',
  'place_point_label_rank_1',
];
const BAND = 'place_peak_label_rank_3';
const ACCOMMODATIONS_PRESENCE = [
  'wd-basemap-accommodations-icons',
  'wd-basemap-accommodations-labels',
];
const TRANSIT_PRESENCE = ['wd-basemap-transit-stations', 'wd-basemap-transit-stations-label'];

describe('presenceLayerPrefix', () => {
  it('derives the wd-basemap-<family>- namespace from the catalog slug', () => {
    expect(presenceLayerPrefix({ name: 'accommodations' })).toBe('wd-basemap-accommodations-');
    expect(presenceLayerPrefix({ name: 'restaurant' })).toBe('wd-basemap-restaurant-');
  });

  it('maps transport-stops onto its legacy transit namespace', () => {
    expect(presenceLayerPrefix({ name: 'transport-stops' })).toBe('wd-basemap-transit-');
  });

  it('prefers the catalog slug over a display alias', () => {
    expect(presenceLayerPrefix({ name: 'Transport', catalogSlug: 'transport-stops' })).toBe(
      'wd-basemap-transit-'
    );
  });
});

describe('presenceFamilies / presenceVisibility', () => {
  const overlays = (active: Record<string, boolean>) =>
    presenceFamilies(
      ['accommodations', 'transport-stops', 'huts'].map(name => ({ name, active: active[name] }))
    );

  it('replaces exactly the active family — the other family and non-presence layers are untouched', () => {
    const families = overlays({ accommodations: true });
    for (const id of ACCOMMODATIONS_PRESENCE) {
      expect(presenceVisibility(id, families)).toBe('none');
    }
    for (const id of TRANSIT_PRESENCE) {
      expect(presenceVisibility(id, families)).toBe('visible');
    }
    expect(presenceVisibility('place_point_label_rank_1', families)).toBeUndefined();
    expect(presenceVisibility('wd-accommodations', families)).toBeUndefined();
  });

  it('restores the family (visible) once its overlay is inactive', () => {
    const families = overlays({});
    for (const id of [...ACCOMMODATIONS_PRESENCE, ...TRANSIT_PRESENCE]) {
      expect(presenceVisibility(id, families)).toBe('visible');
    }
  });

  it('keeps a shared family replaced while ANY of its overlays is active', () => {
    const families = presenceFamilies([
      { name: 'transport-stops', active: false },
      { name: 'transport-stops', catalogSlug: 'transport-stops', active: true },
    ]);
    expect(families).toEqual([{ prefix: 'wd-basemap-transit-', hidden: true }]);
    expect(presenceVisibility('wd-basemap-transit-stations', families)).toBe('none');
  });

  it('assigns nested slugs to the longest matching prefix', () => {
    const families = presenceFamilies([
      { name: 'accommodations', active: true },
      { name: 'accommodations-alps', active: false },
    ]);
    // wd-basemap-accommodations- is a prefix of wd-basemap-accommodations-alps-…
    expect(presenceVisibility('wd-basemap-accommodations-alps-icons', families)).toBe('visible');
    expect(presenceVisibility('wd-basemap-accommodations-icons', families)).toBe('none');
  });
});

describe('hideReplacedPresence (style-document form)', () => {
  const iconLayer = {
    id: 'wd-basemap-accommodations-icons',
    type: 'symbol',
    minzoom: 10,
    layout: { 'icon-image': 'wd-sdf-accommodations:mono/x', 'icon-size': 1 },
  } as const;

  it('hides a replaced family layer, keeping every other layout key', () => {
    const families = presenceFamilies([{ name: 'accommodations', active: true }]);
    const hidden = hideReplacedPresence(iconLayer, families);
    expect(hidden).not.toBe(iconLayer);
    expect(hidden.layout).toEqual({
      'icon-image': 'wd-sdf-accommodations:mono/x',
      'icon-size': 1,
      visibility: 'none',
    });
    expect(hidden.id).toBe(iconLayer.id);
    expect(hidden.minzoom).toBe(10);
    // the served document is never mutated
    expect(iconLayer.layout).not.toHaveProperty('visibility');
  });

  it('returns inactive families and foreign layers as the same object', () => {
    const inactive = presenceFamilies([{ name: 'accommodations', active: false }]);
    expect(hideReplacedPresence(iconLayer, inactive)).toBe(iconLayer);
    const active = presenceFamilies([{ name: 'accommodations', active: true }]);
    const foreign = { id: 'place_point_label_rank_1' };
    expect(hideReplacedPresence(foreign, active)).toBe(foreign);
    // no overlay of the family at all → the served document is authoritative
    expect(hideReplacedPresence(iconLayer, [])).toBe(iconLayer);
  });
});

describe('labelBandAnchor', () => {
  it('is the first keeper label of the served order — place_peak_label_rank_3 on mtk-hill', () => {
    expect(labelBandAnchor(MTK_HILL_LAYER_IDS)).toBe(BAND);
    expect(MTK_HILL_LAYER_IDS.indexOf(BAND)).toBeLessThan(
      MTK_HILL_LAYER_IDS.indexOf('place_point_label_rank_1')
    );
  });

  it('is undefined for styles without keeper labels (raster/external basemaps)', () => {
    expect(labelBandAnchor(['land', 'label_city', 'label_town'])).toBeUndefined();
    expect(labelBandAnchor([])).toBeUndefined();
  });

  it('matches exactly the keepers of the served order — every place_point rank 1–2 and every peak rank', () => {
    const keepers = MTK_HILL_LAYER_IDS.filter(id =>
      KEEPER_LABEL_PREFIXES.some(prefix => id.startsWith(prefix))
    );
    expect(keepers).toEqual([
      'place_peak_label_rank_3',
      'place_peak_label_rank_2',
      'place_point_label_rank_2',
      'place_peak_label_rank_1',
      'place_point_label_rank_1',
    ]);
  });
});

describe('resolveOverlayAnchor', () => {
  const indexOf = (id: string) => MTK_HILL_LAYER_IDS.indexOf(id);

  it('settles unanchored ways overlays below the band instead of on top', () => {
    // accommodations/transport-stops carry no ways anchor on mtk-hill —
    // they used to append after place_point_label_rank_1.
    expect(resolveOverlayAnchor(undefined, 'ways', MTK_HILL_LAYER_IDS)).toBe(BAND);
  });

  it('caps a places anchor that sits above the band (huts: place_point_label_rank_2)', () => {
    expect(resolveOverlayAnchor('place_point_label_rank_2', 'places', MTK_HILL_LAYER_IDS)).toBe(
      BAND
    );
    expect(indexOf('place_point_label_rank_2')).toBeGreaterThan(indexOf(BAND));
  });

  it('keeps an anchor that already sits below the band', () => {
    expect(resolveOverlayAnchor('water_waterway_label_rank_5', 'ways', MTK_HILL_LAYER_IDS)).toBe(
      'water_waterway_label_rank_5'
    );
  });

  it('keeps the band position when the basemap anchor is missing from the style', () => {
    expect(resolveOverlayAnchor('Other place labels', 'ways', MTK_HILL_LAYER_IDS)).toBe(BAND);
  });

  it('leaves routes and background groups on the basemap anchors — even above the band', () => {
    expect(resolveOverlayAnchor(undefined, 'routes', MTK_HILL_LAYER_IDS)).toBeUndefined();
    expect(resolveOverlayAnchor('place_point_label_rank_1', 'routes', MTK_HILL_LAYER_IDS)).toBe(
      'place_point_label_rank_1'
    );
    expect(resolveOverlayAnchor(undefined, 'background', MTK_HILL_LAYER_IDS)).toBeUndefined();
    expect(resolveOverlayAnchor('land', undefined, MTK_HILL_LAYER_IDS)).toBe('land');
  });

  it('falls back to the basemap anchor when the style has no keeper labels', () => {
    const external = ['land', 'Other place labels', 'label_city'];
    expect(resolveOverlayAnchor(undefined, 'ways', external)).toBeUndefined();
    expect(resolveOverlayAnchor('Other place labels', 'ways', external)).toBe('Other place labels');
  });
});
