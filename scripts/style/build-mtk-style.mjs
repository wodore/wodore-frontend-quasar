/**
 * Build `public/styles/outdoor-mtk/style*.json` — the default "Wodore
 * Outdoor" basemap, a terrain fork of Maptoolkit's hiking style
 * (Community License, see README).
 *
 * Adaptations on top of the subtractive base (routes/hut POIs removed):
 *   - LANGUAGE-AWARE: one style per app locale (de/fr/it/en). Labels
 *     prefer the localized name field (name_de/name_fr/name_it/name_en)
 *     with the local endonym as fallback — no more stacked languages.
 *   - Country labels smaller
 *   - Mountain names more prominent (x1.3)
 *   - Country borders more obvious (darker + wider)
 *   - Settlement dots (white + grey ring, swisstopo-style) for
 *     big/small places; place labels offset to the right of the dot
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

// Settlement dots (swisstopo-style white + grey ring). Inserted before
// the first place layer so labels draw on top.
const dotPaint = () => ({
  'circle-color': '#FFFFFF',
  'circle-stroke-color': '#6B665A',
  'circle-stroke-width': 1,
  'circle-pitch-alignment': 'map',
});
const dot = (id, categories, minzoom, radius) => ({
  id,
  type: 'circle',
  source: 'mtk',
  'source-layer': 'place_label',
  minzoom,
  filter: ['match', ['get', 'category'], categories, true, false],
  paint: { ...dotPaint(), 'circle-radius': radius },
});
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
  {
    // Dots from z7.5 and stay as long as the labels do — mtk keeps place
    // labels through z22, so no fade-out (the earlier overview-only
    // fade-out was backwards for on-map orientation).
    ...dot('wd-place-dot-big', ['capital', 'big_place'], 7.5, [
      'interpolate', ['linear'], ['zoom'],
      7.5, 3, 10, 4.2, 12, 5.2, 14, 6,
    ]),
    paint: {
      ...dotPaint(),
      'circle-stroke-width': 1.5,
    },
  },
  {
    // Village dots are the classic overview "dot field": visible on
    // far-out views (below z7.5, where villages have no labels yet) and
    // hidden once you zoom past — labels take over. Important places
    // keep their dot for as long as their label lives.
    ...dot('wd-place-dot-small', ['small_place'], 6, [
      'interpolate', ['linear'], ['zoom'],
      6, 1.1, 7.5, 1.5,
    ]),
    maxzoom: 7.5,
    paint: dotPaint(),
  },
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

// ── Streets, swisstopo-style (same recipe as the OFM style) ────────────
// Motorway/trunk get the soft orange fill, everything else white; casings
// become the visible "2nd line" (mtk's are sub-pixel and cool-grey).
const roadFill = layer('road_major_dark');
roadFill.paint['line-color'] = [
  'interpolate', ['linear'], ['zoom'],
  4, 'hsla(45, 100%, 82%, 0)',
  6, ['match', ['get', 'type'], ['motorway', 'trunk'], '#FFDD8A', '#FFFFFF'],
  7.5, ['match', ['get', 'type'], ['motorway', 'trunk'], '#FFDD8A', '#FFFFFF'],
];
const roadCasing = layer('road_major_casing');
roadCasing.paint['line-color'] = [
  'interpolate', ['linear'], ['zoom'],
  5, 'hsla(40, 8%, 72%, 0)',
  9, '#B8B2A4',
];
roadCasing.paint['line-width'] = [
  'interpolate', ['exponential', 1.6], ['zoom'],
  6, 0.9, 9, 1.8, 12, 2.8, 15, 4, 19, 8,
];
const minorCasing = layer('road_minor_casing');
minorCasing.paint['line-color'] = [
  'interpolate', ['linear'], ['zoom'],
  13, 'hsla(40, 8%, 72%, 0)', 15, '#B8B2A4',
];
minorCasing.paint['line-width'] = [
  'interpolate', ['exponential', 1.6], ['zoom'],
  13, 1.4, 15, 2, 19, 6,
];

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
 * 3) Per-locale variants: localized name field preferred               *
 * ------------------------------------------------------------------ */
const LOCALES = {
  de: 'name_de',
  fr: 'name_fr',
  it: 'name_it',
  en: 'name_en',
};

/** Replace `["get","name"]` with a localized coalesce in every text-field. */
function localizeTextField(expr, field) {
  const json = JSON.stringify(expr);
  const next = json.replaceAll(
    '["get","name"]',
    JSON.stringify(['coalesce', ['get', field], ['get', 'name']])
  );
  return json === next ? expr : JSON.parse(next);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [locale, field] of Object.entries(LOCALES)) {
  const style = JSON.parse(JSON.stringify(base));
  for (const l of style.layers) {
    if (l.type === 'symbol' && l.layout?.['text-field']) {
      l.layout['text-field'] = localizeTextField(l.layout['text-field'], field);
    }
  }
  const out = path.join(OUT_DIR, `style.${locale}.json`);
  fs.writeFileSync(out, JSON.stringify(style, null, 2) + '\n');
  console.log(`wrote ${out}`);
}
// generic default = English
fs.writeFileSync(
  path.join(OUT_DIR, 'style.json'),
  fs.readFileSync(path.join(OUT_DIR, 'style.en.json'))
);
console.log('wrote default (en) style.json');
