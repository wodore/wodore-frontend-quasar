/**
 * Build `public/styles/outdoor-mtk/style*.json` — the default "Wodore
 * Outdoor" basemap, a terrain fork of Maptoolkit's hiking style
 * (Community License, see README).
 *
 * Adaptations on top of the subtractive base (routes/hut POIs removed):
 *   - LOCAL NAMES ONLY: one single style, mtk's own name fields
 *     (local endonym; non-latin names keep mtk's latin second line).
 *     A localized fallback chain can be added later if wanted.
 *   - Country labels smaller
 *   - Mountain names more prominent (x1.3)
 *   - Country borders more obvious (darker + wider)
 *   - Settlement dots exactly like swisstopo's lightbasemap: tiny
 *     dark-grey circles on circle layers that mirror the label rank
 *     bands (a dot appears exactly when its place label layer does),
 *     capitals become hollow rings from z8 on
 *   - Accommodation POIs removed (type "lodging"; hut labels were
 *     already gone — the app's hut overlay owns accommodation)
 *
 * Run: node scripts/style/build-mtk-style.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'mtk-src.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'public', 'styles', 'outdoor-mtk');

const base = JSON.parse(fs.readFileSync(SRC, 'utf8'));

/* ------------------------------------------------------------------ *
 * 1) Shared transforms (language-independent)                         *
 * ------------------------------------------------------------------ */
base.name = 'Wodore Outdoor (Maptoolkit)';
// stable id: the Maputnik CLI requires it to expose the local file
base.id = 'wodore-outdoor-mtk';

const removed = [
  'poi_hut_label', // huts are the app overlay's job
  'road_hiking', // routes live in the dedicated overlay
  'road_hiking_label',
  'road_hiking_shield',
  'road_hiking_node_shield',
  'road_path_scale_label',
  // performance: 4 hillshade layers = 4 full-screen GPU passes
  // (28fps pan measured). ao_min + ao_med carry the look; removing
  // these two brings pan to 39fps with barely visible difference.
  'relief_hillshade_ao_max',
  'relief_hillshade_dramatic',
];
base.layers = base.layers.filter(l => !removed.includes(l.id));

const byId = new Map(base.layers.map(l => [l.id, l]));
const layer = id => {
  const l = byId.get(id);
  if (!l) throw new Error(`layer not found: ${id}`);
  return l;
};

// POI crowd control: defer the densest generic ranks...
const poiZoom = { poi_generic_label_rank_4: 14, poi_generic_label_rank_5: 15.5 };
for (const [id, z] of Object.entries(poiZoom)) layer(id).minzoom = z;

// ...and remove ALL accommodation (type "lodging": hotels, hostels,
// guest houses — alpine_hut/shelter were a separate, already-removed layer)
for (const l of base.layers) {
  if (!l.id.startsWith('poi_generic_label')) continue;
  const f = l.filter;
  const excl = f?.find?.(
    op => Array.isArray(op) && op[0] === '!' && Array.isArray(op[1]) && op[1][0] === 'in'
  );
  if (!excl) throw new Error(`unexpected poi filter shape in ${l.id}`);
  excl[1][2][1].push('lodging');
}

// Country labels smaller (they carry category="country"). Zoom must
// stay the top-level expression, so the category case wraps each
// interpolate stop's value instead of the whole size.
const countryScale = 0.75;
const wrapCountry = v =>
  ['case', ['==', ['get', 'category'], 'country'], ['*', countryScale, v], v];

/** Multiply every zoom-interpolate stop value by `factor` (data-driven
 * stop values are wrapped in an arithmetic expression — allowed, since
 * only zoom-dependent subexpressions are restricted). */
function scaleZoomStops(expr, factor) {
  if (!Array.isArray(expr) || expr[0] !== 'interpolate') {
    throw new Error('expected top-level interpolate: ' + JSON.stringify(expr).slice(0, 80));
  }
  const out = [...expr];
  for (let i = 4; i < out.length; i += 2) {
    const v = out[i];
    out[i] = typeof v === 'number' ? v * factor : ['*', factor, v];
  }
  return out;
}

for (const id of ['place_point_label_rank_1', 'place_line_label_rank_1']) {
  const l = layer(id);
  const size = l.layout['text-size'];
  const scaled = [...size];
  for (let i = 4; i < scaled.length; i += 2) {
    const v = scaled[i];
    scaled[i] = typeof v === 'number' ? wrapCountry(v) : ['case', ['==', ['get', 'category'], 'country'], ['*', countryScale, v], v];
  }
  l.layout['text-size'] = scaled;
}

// Mountain names more prominent (rank_new bands, elevation line kept)
for (const id of [
  'place_peak_label_rank_1',
  'place_peak_label_rank_2',
  'place_peak_label_rank_3',
]) {
  const l = layer(id);
  l.layout['text-size'] = scaleZoomStops(l.layout['text-size'], 1.3);
  l.paint['text-halo-width'] = 1.4;
}

// Country borders more obvious: darker ink + wider line
for (const id of ['border_admin_country', 'border_admin_disputed']) {
  const p = layer(id).paint;
  p['line-color'] = 'hsla(306, 30%, 40%, 1)';
  p['line-width'] = [
    'interpolate',
    ['exponential', 0.9],
    ['zoom'],
    3,
    0.55,
    19,
    3.1,
  ];
}

// Settlement dots, swisstopo lightbasemap style: tiny dark-grey
// circles. Each dot layer mirrors one place-label rank band (same
// minzoom, same filter), so a dot appears exactly when its place label
// layer is active — no dot fields for places that carry no labels.
// Capitals switch from a solid dot to a hollow ring at z8 (like
// swisstopo's dot_circle -> circle_circle step), towns/villages stay
// solid dots at every zoom.
const SW_DOT_GREY = '#4B4B4B';
const byCategory = (capital, big, small) => [
  'match', ['get', 'category'],
  ['capital'], capital,
  ['big_place'], big,
  small,
];
const dotLayers = () =>
  base.layers
    .filter(l => /^place_point_label_rank_\d$/.test(l.id))
    .map(l => ({
      id: `wd-place-dot-${l.id.match(/rank_(\d)$/)[1]}`,
      type: 'circle',
      source: 'mtk',
      'source-layer': 'place_label',
      minzoom: l.minzoom,
      maxzoom: l.maxzoom,
      filter: [
        'all',
        l.filter,
        ['match', ['get', 'category'], ['capital', 'big_place', 'small_place'], true, false],
      ],
      paint: {
        'circle-color': SW_DOT_GREY,
        // capitals hollow out into rings from z8 on
        'circle-opacity': [
          'step', ['zoom'], 1, 8, byCategory(0, 1, 1),
        ],
        'circle-stroke-color': SW_DOT_GREY,
        'circle-stroke-width': [
          'step', ['zoom'], 0, 8, byCategory(1.3, 0, 0),
        ],
        'circle-pitch-alignment': 'map',
        // swisstopo icon ladder: dot 6 -> 8px, ring 10 -> 12px;
        // villages 4 -> 6 -> 8 -> 10px (radii = half diameter)
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          1, byCategory(2.2, 2.2, 1.8),
          6, byCategory(3, 3, 2),
          8, byCategory(4, 4, 3),
          10, byCategory(5, 5, 4),
          12, byCategory(6, 6, 5),
        ],
      },
    }));
// Park labels: mtk ranks parks like top places (r5-r10), so the generic
// rank bands show them from z1. Exclude them there and render via a
// dedicated layer that only appears once you zoom in.
const PARK_CATEGORIES = ['national_park', 'protected_area'];
for (const l of base.layers) {
  if (l['source-layer'] !== 'place_label' || l.type !== 'symbol') continue;
  const f = l.filter;
  const excl = f?.find?.(
    op => Array.isArray(op) && op[0] === '!' && Array.isArray(op[1]) && op[1][0] === 'in'
  );
  if (!excl) throw new Error(`unexpected place filter shape in ${l.id}`);
  excl[1][2][1].push(...PARK_CATEGORIES);
}
const parkLabel = {
  id: 'wd-park-label',
  type: 'symbol',
  source: 'mtk',
  'source-layer': 'place_label',
  // mtk only carries park labels in the tiles up to z10 — outside this
  // window there is simply no data (borders/fills keep showing)
  minzoom: 9.5,
  maxzoom: 10.5,
  filter: ['match', ['get', 'category'], PARK_CATEGORIES, true, false],
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Ysabeau Italic'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 9.5, 10, 14, 12.5],
    'text-letter-spacing': 0.1,
    'text-transform': 'uppercase',
    'text-max-width': 8,
  },
  paint: {
    'text-color': '#4A6B45',
    'text-halo-color': 'rgba(255,255,255,0.75)',
    'text-halo-width': 1.2,
  },
};

const firstPlaceIdx = base.layers.findIndex(l => l.id.startsWith('place_'));
base.layers.splice(
  firstPlaceIdx === -1 ? base.layers.length : firstPlaceIdx,
  0,
  ...dotLayers(),
  parkLabel,
);
// Place labels sit to the right of their dot (point layers only)
for (const l of base.layers) {
  if (
    l.type === 'symbol' &&
    /^place_(point|peak)_label/.test(l.id) &&
    l['source-layer'] === 'place_label'
  ) {
    l.layout['text-anchor'] = 'left';
    l.layout['text-offset'] = [0.6, 0.05];
  }
}

// ── Streets, ported 1:1 from swisstopo's lightbasemap ─────────────────
// White fills with soft-orange motorways/trunk; casings in near-black
// grey (gold-brown under motorways) as the crisp thin second line.
// mtk splits fills by class across three layers (dark = motorway/
// trunk/primary, medium = secondary/tertiary, minor = minor/service/
// track) while the casings span whole classes — so the swisstopo width
// ladders are distributed accordingly, including the _bridge/_tunnel
// sibling layers (mtk renders those as separate layers) and the
// motorway ramp thinning swisstopo applies.
const rampOr = (rampW, mainW) => ['match', ['get', 'ramp'], 1, rampW, mainW];
const byType = (motorway, trunk, primary, secondary, tertiary, minor, rest) => [
  'match', ['get', 'type'],
  ['motorway'], motorway,
  ['trunk'], trunk,
  ['primary'], primary,
  ['secondary'], secondary,
  ['tertiary'], tertiary,
  ['minor', 'service'], minor,
  rest,
];
const paintOnto = (id, paint) => {
  const l = layer(id);
  l.paint = { ...l.paint, ...paint };
};
const clonePaint = (ids, paint) => ids.forEach(id => paintOnto(id, paint));

// Fill colors: white everywhere, soft orange on motorway/trunk
const FILL_WHITE = [
  'interpolate', ['linear'], ['zoom'],
  4, 'hsla(45, 100%, 82%, 0)',
  6, byType('#FFE6A0', '#FFE6A0', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'),
  15, byType('#FFE08A', '#FFE08A', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'),
];
const FILL_MEDIUM_COLOR = [
  'interpolate', ['linear'], ['zoom'],
  8, 'hsla(45, 100%, 82%, 0)',
  10, '#FFFFFF',
];
const FILL_MINOR_COLOR = [
  'interpolate', ['linear'], ['zoom'],
  9, 'hsla(45, 100%, 82%, 0)',
  10.5, '#FFFFFF',
];
const FILL_BLUR = ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 0.1];

// Fill widths (swisstopo stops, split by mtk's layer coverage)
const FILL_DARK_WIDTH = [
  'interpolate', ['exponential', 2], ['zoom'],
  6, 0,
  8, byType(rampOr(0.5, 2), 2, 0, 0, 0, 0, 0),
  9, byType(rampOr(0.75, 2.25), 2.25, 0, 0, 0, 0, 0),
  10, byType(rampOr(0.75, 2.75), 2.75, 2.5, 0, 0, 0, 0),
  12, byType(rampOr(1.5, 3.75), 3.75, 4, 0, 0, 0, 0),
  15, byType(rampOr(2.75, 5.5), 5.5, 5.5, 0, 0, 0, 0),
  19, byType(rampOr(5, 8), 8, 8, 0, 0, 0, 0),
];
const FILL_MEDIUM_WIDTH = [
  'interpolate', ['exponential', 2], ['zoom'],
  9, 0,
  10, byType(0, 0, 0, 2.5, 2, 0, 0),
  12, byType(0, 0, 0, 3.5, 3, 0, 0),
  15, byType(0, 0, 0, 5, 4, 0, 0),
  19, byType(0, 0, 0, 7, 5.5, 0, 0),
];
const FILL_MINOR_WIDTH = [
  'interpolate', ['exponential', 2], ['zoom'],
  10, ['match', ['get', 'type'], ['minor', 'service'], 1.5, 1],
  12, ['match', ['get', 'type'], ['minor', 'service'], 2, 1.4],
  15, ['match', ['get', 'type'], ['minor', 'service'], 3, 1.9],
  19, ['match', ['get', 'type'], ['minor', 'service'], 4, 2.6],
];

clonePaint(['road_major_dark', 'road_major_dark_bridge'], {
  'line-color': FILL_WHITE,
  'line-width': FILL_DARK_WIDTH,
  'line-blur': FILL_BLUR,
});
clonePaint(['road_major_medium', 'road_major_medium_bridge'], {
  'line-color': FILL_MEDIUM_COLOR,
  'line-width': FILL_MEDIUM_WIDTH,
  'line-blur': FILL_BLUR,
});
clonePaint(['road_minor', 'road_minor_bridge'], {
  'line-color': FILL_MINOR_COLOR,
  'line-width': FILL_MINOR_WIDTH,
  'line-blur': FILL_BLUR,
});

// Casings: swisstopo's near-black grey (gold-brown under motorway/trunk)
const CASING_COLOR = [
  'interpolate', ['linear'], ['zoom'],
  5, 'hsla(40, 8%, 32%, 0)',
  9, byType('#AA881E', '#AA881E', '#505050', '#505050', '#505050', '#505050', '#505050'),
  15, byType('#8B6B3F', '#8B6B3F', '#5A5A5A', '#5A5A5A', '#5A5A5A', '#5A5A5A', '#5A5A5A'),
];
const CASING_WIDTH = [
  'interpolate', ['exponential', 2], ['zoom'],
  6, 0,
  8, byType(rampOr(1.5, 3), 3, 0, 0, 0, 0, 0),
  9, byType(rampOr(2, 3.5), 3.5, 0, 0, 0, 0, 0),
  10, byType(rampOr(2, 4), 4, 3.5, 3.5, 3, 2.5, 0),
  12, byType(rampOr(3, 6.5), 6.5, 6, 5, 4, 3, 2.5),
  15, byType(rampOr(5, 10), 10, 8, 6.5, 5.5, 4, 3),
  19, byType(rampOr(6.5, 13), 13, 10.5, 8.5, 7, 5.5, 4),
];
const CASING_BLUR = ['interpolate', ['linear'], ['zoom'], 7, 3, 8, 0.4];
clonePaint(
  ['road_major_casing', 'road_major_casing_bridge', 'road_major_casing_tunnel'],
  {
    'line-color': CASING_COLOR,
    'line-width': CASING_WIDTH,
    'line-opacity': 1,
    'line-blur': CASING_BLUR,
  }
);
const MINOR_CASING_COLOR = [
  'interpolate', ['linear'], ['zoom'],
  13, 'hsla(40, 8%, 32%, 0)', 15, '#5A5A5A',
];
const MINOR_CASING_WIDTH = [
  'interpolate', ['exponential', 2], ['zoom'],
  13, 2, 15, 3.2, 19, 7,
];
clonePaint(
  ['road_minor_casing', 'road_minor_casing_bridge', 'road_minor_casing_tunnel'],
  {
    'line-color': MINOR_CASING_COLOR,
    'line-width': MINOR_CASING_WIDTH,
  }
);

// ── Parks: strong at overview zooms, receding when zoomed in; visible
// borders (mtk's protected-area lines are nearly invisible).
const landuse = layer('nature_landuse');
const parkAt = o => ['case', ['==', ['get', 'type'], 'park'], o, 1];
landuse.paint['fill-opacity'] = [
  'interpolate', ['linear'], ['zoom'],
  8, parkAt(0.55), 12, parkAt(0.35), 14, parkAt(0.22),
];
const protectedLine = layer('border_protected_area');
protectedLine.paint['line-opacity'] = [
  'interpolate', ['exponential', 0.9], ['zoom'],
  8, 0, 9.5, 0.45, 12, 0.8,
];
protectedLine.paint['line-width'] = [
  'interpolate', ['exponential', 0.9], ['zoom'],
  3, ['match', ['get', 'type'], 'national_park', 0.4, 0.28],
  19, ['match', ['get', 'type'], 'national_park', 1.6, 1.1],
];

// performance: rock-drawing raster fetched ~90 tiles (z14, 512px) per
// z13 view — half of ALL requests. Start it at z14 where the texture
// actually matters, fading IN to its mid-zoom peak and back out as the
// vector stipple textures (z12+) take over — no popping.
const rocks = layer('nature_rocks');
rocks.minzoom = 14;
rocks.paint['raster-opacity'] = [
  'interpolate', ['linear'], ['zoom'],
  14, 0, 14.6, 0.35, 15, 0.3, 15.5, 0,
];

/* ------------------------------------------------------------------ *
 * 2) Sanity guards                                                    *
 * ------------------------------------------------------------------ */
if (!base.sources.mtk || !base.sources.contours) {
  throw new Error('mtk/contours sources missing — upstream style changed?');
}
for (const [id, src] of Object.entries(base.sources)) {
  if (!src.attribution && !src.url && ['mtk', 'contours', 'rocks'].includes(id)) {
    throw new Error(`source ${id} lost its attribution`);
  }
}
const ids = base.layers.map(l => l.id);
if (new Set(ids).size !== ids.length) throw new Error('duplicate layer ids');
for (const l of base.layers) {
  if (l.source && !(l.source in base.sources)) {
    throw new Error(`layer ${l.id} references unknown source ${l.source}`);
  }
}

/* ------------------------------------------------------------------ *
 * 3) Output: one style, local names only                              *
 * ------------------------------------------------------------------ */
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT_DIR, 'style.json'),
  JSON.stringify(base, null, 2) + '\n'
);
console.log('wrote style.json (single style, local names)');
