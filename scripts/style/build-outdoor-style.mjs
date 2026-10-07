/**
 * Build `public/styles/outdoor/style.json` — the keyless "Wodore Outdoor"
 * basemap style — from the vendored OpenFreeMap Liberty source
 * (`scripts/style/liberty-src.json`, BSD-licensed fork of OSM Liberty,
 * https://github.com/hyperknot/openfreemap-styles).
 *
 * Design target: mapy.com "turisticka" meets Stadia Outdoors — warm cream
 * base, soft landcover greens, dialed-down roads, emphasized trail
 * hierarchy (track / footway / cycleway / steps), hillshade + contour
 * lines from the free Mapterhorn DEM, peaks with elevation labels.
 * Huts are rendered as plain buildings (no POI text/icons) — the app's
 * own hut overlay owns hut markers.
 *
 * Run: node scripts/style/build-outdoor-style.mjs
 * Then fine-tune visually in Maputnik (changes must be ported back here):
 *   maputnik --watch --file public/styles/outdoor/style.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'liberty-src.json');
const OUT = path.join(__dirname, '..', '..', 'public', 'styles', 'outdoor', 'style.json');

/** JSON.parse that rethrows with context — the build must fail loudly
 * (and legibly) when the vendored source drifts. */
function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`invalid JSON in ${what}: ${err.message}`, { cause: err });
  }
}

const style = parseJson(fs.readFileSync(SRC, 'utf8'), SRC);

/* ------------------------------------------------------------------ *
 * Palette (mapy.com tourist reference captures, see docs/design-ref) *
 * ------------------------------------------------------------------ */
const C = {
  bg: '#EFE8D4', // warm cream base (mapy-like beige-green)
  wood: '#7FA868',
  grass: '#C3DB9F',
  ice: '#E9F2F6',
  wetland: '#B9D6C8',
  sand: '#EBDFB9',
  park: '#C4DFAE',
  parkOutline: '#AECF97',
  residential: '#EAE3D2',
  pitch: '#D5E8C8',
  dirt: '#E6D9BE',
  cemetery: '#DCE3D5',
  waterFill: '#5896CC',
  waterLine: '#6FB0DC',
  waterLine2: '#9CC5E0',
  waterLabel: '#4E7FA3',
  roadCasing: '#C9C3B4',
  roadCasingYellow: '#D9C98F',
  motorway: '#FFDD8A', // swisstopo: rgb(255,224,138)
  trunkPrimary: '#FFFFFF', // swisstopo: white fill for all non-motorway
  roadWhite: '#FFFFFF',
  roadMinor: '#FFFFFF',
  service: '#F6F3E9',
  aeroway: '#E5E0D5',
  building: '#D8D2C3',
  buildingOutline: '#C4BEAF',
  boundary1: '#8F8878',
  boundary2: '#B3AB9B',
  label: '#3A342A',
  labelHalo: '#F7F3E6',
  // Trail hierarchy
  trackCasing: '#F2ECDD',
  // trails are simple neutral lines (swisstopo-like) — colored routes
  // come from the app's wanderwege / cycling / MTB overlays
  trail: '#9A9284',
  track: '#A39B8C',
  // Contours
  contourIndex: '#96755B',
  contourMinor: '#B8A98F',
  contourHalo: '#F2EDE0',
  peakLabel: '#4E4638',
  peakHalo: '#F5F0E3',
};

const MAPTERHORN = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const ATTR_OSM =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';
const ATTR_OFM =
  ' | <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> | <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a>';
const ATTR_MAPTERHORN =
  ' | &copy; <a href="https://mapterhorn.com/attribution" target="_blank">Mapterhorn</a>';

/* ------------------------------------------------------------------ *
 * Helpers                                                            *
 * ------------------------------------------------------------------ */
const byId = new Map(style.layers.map(l => [l.id, l]));
const layer = id => {
  const l = byId.get(id);
  if (!l) throw new Error(`layer not found: ${id}`);
  return l;
};
const paint = id => (layer(id).paint ??= {});
const layout = id => (layer(id).layout ??= {});
const setPaint = (id, prop, value) => (paint(id)[prop] = value);
const setLayout = (id, prop, value) => (layout(id)[prop] = value);
const removeLayers = ids => {
  for (const id of ids) {
    const i = style.layers.findIndex(l => l.id === id);
    if (i === -1) throw new Error(`layer to remove not found: ${id}`);
    style.layers.splice(i, 1);
    byId.delete(id);
  }
};
/** Insert layers after an existing layer id. */
const insertAfter = (anchorId, newLayers) => {
  const i = style.layers.findIndex(l => l.id === anchorId);
  if (i === -1) throw new Error(`anchor not found: ${anchorId}`);
  style.layers.splice(i + 1, 0, ...newLayers);
  for (const l of newLayers) byId.set(l.id, l);
};
const zw = (stops, base = 1.2) => [
  'interpolate',
  ['exponential', base],
  ['zoom'],
  ...stops.flatMap(([z, w]) => [z, w]),
];

/** Common transportation filter building blocks (OpenMapTiles schema). */
const isLine = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const notBridgeTunnel = ['match', ['get', 'brunnel'], ['bridge', 'tunnel'], false, true];
const brunnel = v => ['==', ['get', 'brunnel'], v];
const cls = (...v) => ['match', ['get', 'class'], v, true, false];

/* ------------------------------------------------------------------ *
 * Metadata + sources                                                 *
 * ------------------------------------------------------------------ */
style.name = 'Wodore Outdoor (OpenFreeMap)';
// stable id: the Maputnik CLI requires it to expose the local file
style.id = 'wodore-outdoor-ofm';
// MapLibre's public font server hosts both the Noto Sans stacks this style
// uses AND the "Open Sans Semibold" stack the app's overlay labels need
// (OFM's font server 404s on Open Sans, which broke hut label typography).
// Glyphs: the same vendored set as outdoor-mtk (yarn gen:glyphs) — no
// dependency on demotiles, service-worker cacheable for offline use.
// Note: our vendored Noto covers latin/latin-ext/greek/cyrillic only;
// CJK labels render empty rather than tofu (same trade-off as mtk).
style.glyphs = '../glyphs/{fontstack}/{range}.pbf';
style.sources.openmaptiles.attribution = ATTR_OSM + ATTR_OFM;
style.sources['dem-mapterhorn'] = {
  type: 'raster-dem',
  tiles: [MAPTERHORN],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution: ATTR_MAPTERHORN,
};
// Contour tiles are computed client-side from the Mapterhorn DEM by
// maplibre-contour (see src/services/outdoorContours.ts). The protocol
// `dem-contour://` is registered by DemSource.setupMaplibre(). Thresholds:
// zoom*minor(m)*major(m) — see scripts/style/README.md.
style.sources.contours = {
  type: 'vector',
  tiles: [
    'dem-contour://{z}/{x}/{y}?buffer=1&contourLayer=contours&elevationKey=ele&extent=4096&levelKey=level&overzoom=1&thresholds=11*200*1000~12*100*500~13*100*500~14*50*200~15*20*100',
  ],
  maxzoom: 15,
  attribution: ATTR_MAPTERHORN,
};

/* ------------------------------------------------------------------ *
 * Base + landcover + water                                           *
 * ------------------------------------------------------------------ */
setPaint('background', 'background-color', C.bg);
setPaint('natural_earth', 'raster-opacity', 0.9);

setPaint('park', 'fill-color', C.park);
setPaint('park', 'fill-opacity', 0.6);
setPaint('park_outline', 'line-color', C.parkOutline);
setPaint('landuse_residential', 'fill-color', C.residential);
setPaint('landuse_residential', 'fill-opacity', 0.55);
setPaint('landcover_wood', 'fill-color', C.wood);
setPaint('landcover_wood', 'fill-opacity', [
  'interpolate',
  ['linear'],
  ['zoom'],
  6,
  0,
  8,
  0.25,
  10,
  0.45,
  12,
  0.62,
  14,
  0.72,
]);
setPaint('landcover_grass', 'fill-color', C.grass);
setPaint('landcover_grass', 'fill-opacity', [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  0,
  10,
  0.2,
  12,
  0.35,
  14,
  0.5,
]);
setPaint('landcover_ice', 'fill-color', C.ice);
setPaint('landcover_ice', 'fill-opacity', [
  'interpolate',
  ['linear'],
  ['zoom'],
  6,
  0.5,
  10,
  0.8,
  13,
  0.95,
]);
setPaint('landcover_wetland', 'fill-color', C.wetland);
setPaint('landcover_wetland', 'fill-opacity', 0.7);
setPaint('landcover_sand', 'fill-color', C.sand);
setPaint('landcover_sand', 'fill-opacity', 0.8);
setPaint('landuse_pitch', 'fill-color', C.pitch);
setPaint('landuse_track', 'fill-color', C.dirt);
setPaint('landuse_cemetery', 'fill-color', C.cemetery);
setPaint('landuse_hospital', 'fill-color', C.cemetery);
setPaint('landuse_school', 'fill-color', C.dirt);

setPaint('water', 'fill-color', [
  'interpolate',
  ['linear'],
  ['zoom'],
  8,
  '#A9CBE4',
  11,
  '#7FB0D9',
  13,
  C.waterFill,
]);
setPaint('waterway_river', 'line-color', [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  '#A5C6E0',
  12,
  C.waterLine,
]);
setPaint('waterway_other', 'line-color', [
  'interpolate',
  ['linear'],
  ['zoom'],
  9,
  '#B4D0E6',
  12,
  C.waterLine2,
]);
setPaint('waterway_tunnel', 'line-color', C.waterLine2);
paint('waterway_tunnel')['line-opacity'] = 0.7;

setPaint('aeroway_fill', 'fill-color', C.aeroway);
setPaint('aeroway_runway', 'line-color', '#D8D3C8');
setPaint('aeroway_taxiway', 'line-color', '#D8D3C8');

/* ------------------------------------------------------------------ *
 * Roads — dialed down (thin, muted; trails are the heroes)           *
 * ------------------------------------------------------------------ */
for (const id of style.layers) {
  if (!id.id.includes('_casing') && !id.id.includes('-casing')) continue;
  if (id.type === 'line' && id.paint?.['line-color']) {
    id.paint['line-color'] = id.id.includes('motorway') ? C.roadCasingYellow : C.roadCasing;
  }
}
setPaint('road_motorway', 'line-color', C.motorway);
setPaint('tunnel_motorway', 'line-color', C.motorway);
setPaint('bridge_motorway', 'line-color', C.motorway);
for (const p of ['road_trunk_primary', 'tunnel_trunk_primary', 'bridge_trunk_primary']) {
  setPaint(p, 'line-color', C.trunkPrimary);
}
for (const p of [
  'road_secondary_tertiary',
  'tunnel_secondary_tertiary',
  'bridge_secondary_tertiary',
]) {
  setPaint(p, 'line-color', C.roadWhite);
}
setPaint('road_minor', 'line-color', C.roadMinor);
setPaint(
  'road_minor',
  'line-width',
  zw([
    [13.5, 0],
    [14, 2.6],
    [20, 16],
  ])
);
setPaint('road_service_track', 'line-color', C.service);
// service/track casings and fills: restrict to service only —
// `track` joins the trail family below.
for (const id of ['road_service_track_casing', 'road_service_track']) {
  const l = layer(id);
  l.filter = ['all', isLine, notBridgeTunnel, cls('service')];
}
for (const id of ['tunnel_service_track_casing', 'tunnel_service_track']) {
  layer(id).filter = ['all', isLine, brunnel('tunnel'), cls('service')];
}
for (const id of ['bridge_service_track_casing', 'bridge_service_track']) {
  layer(id).filter = ['all', isLine, brunnel('bridge'), cls('service')];
}

setPaint(
  'road_motorway',
  'line-width',
  zw([
    [5, 0.9],
    [7, 1.7],
    [9, 3.2],
    [11, 4.2],
    [13, 5.5],
    [20, 16],
  ])
);
setPaint(
  'road_trunk_primary',
  'line-width',
  zw([
    [6.5, 0.7],
    [8, 1.4],
    [10, 2.6],
    [12, 3.5],
    [20, 13],
  ])
);
setPaint(
  'road_secondary_tertiary',
  'line-width',
  zw([
    [8, 0.5],
    [10, 1.3],
    [12, 2.3],
    [20, 11],
  ])
);
// swisstopo-style "2nd line": visible casing around the fill from low zoom
setPaint(
  'road_motorway_casing',
  'line-width',
  zw([
    [5, 1.3],
    [9, 4.2],
    [13, 7],
    [20, 20],
  ])
);
setPaint(
  'road_trunk_primary_casing',
  'line-width',
  zw([
    [7, 0.9],
    [10, 3.2],
    [13, 5],
    [20, 17],
  ])
);
setPaint(
  'road_secondary_tertiary_casing',
  'line-width',
  zw([
    [10, 1.8],
    [13, 4],
    [20, 15],
  ])
);
// smaller white roads also get their outline (2nd line), later zooms
setPaint(
  'road_minor_casing',
  'line-width',
  zw([
    [13, 0],
    [14, 3],
    [20, 13],
  ])
);
setPaint(
  'road_link_casing',
  'line-width',
  zw([
    [13, 2.5],
    [20, 10],
  ])
);
setPaint(
  'road_service_track_casing',
  'line-width',
  zw([
    [14, 1.8],
    [20, 9],
  ])
);
// bridges carry the same network weight
for (const b of ['bridge_motorway', 'bridge_trunk_primary', 'bridge_secondary_tertiary']) {
  const r = 'road_' + b.slice(7);
  paint(b)['line-width'] = paint(r)['line-width'];
}
for (const b of [
  'bridge_motorway_casing',
  'bridge_trunk_primary_casing',
  'bridge_secondary_tertiary_casing',
]) {
  const r = 'road_' + b.slice(7);
  paint(b)['line-width'] = paint(r)['line-width'];
}

/* ------------------------------------------------------------------ *
 * Trail hierarchy — replaces Liberty's generic white dashed path     *
 * ------------------------------------------------------------------ */
removeLayers([
  'road_path_pedestrian',
  'tunnel_path_pedestrian',
  'bridge_path_pedestrian',
  'bridge_path_pedestrian_casing',
]);

const trailCommon = { source: 'openmaptiles', 'source-layer': 'transportation', type: 'line' };
const trailLayers = [
  {
    ...trailCommon,
    id: 'trail-track',
    minzoom: 11.5,
    filter: ['all', isLine, notBridgeTunnel, cls('track')],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': C.track,
      'line-width': zw([
        [11.5, 0.5],
        [13, 1],
        [15, 2.2],
        [20, 7],
      ]),
    },
  },
  {
    ...trailCommon,
    id: 'trail-cycleway',
    minzoom: 12.5,
    filter: [
      'all',
      isLine,
      notBridgeTunnel,
      cls('path'),
      ['any', ['==', ['get', 'subclass'], 'cycleway'], ['==', ['get', 'bicycle'], 'designated']],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': C.trail,
      'line-width': zw([
        [12.5, 0.7],
        [15, 1.5],
        [20, 4.5],
      ]),
    },
  },
  {
    ...trailCommon,
    id: 'trail-pedestrian',
    minzoom: 13.5,
    filter: [
      'all',
      isLine,
      notBridgeTunnel,
      cls('path'),
      ['==', ['get', 'subclass'], 'pedestrian'],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': C.trail,
      'line-width': zw([
        [13.5, 0.9],
        [15, 1.8],
        [20, 6],
      ]),
    },
  },
  {
    ...trailCommon,
    id: 'trail-footway',
    minzoom: 13,
    filter: [
      'all',
      isLine,
      notBridgeTunnel,
      cls('path'),
      ['==', ['get', 'subclass'], 'footway'],
      ['!=', ['get', 'bicycle'], 'designated'],
    ],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': C.trail,
      'line-width': zw([
        [13, 0.7],
        [15, 1.4],
        [20, 4],
      ]),
    },
  },
  {
    // dashed = "not good": generic small paths (subclass 'path', often
    // informal/unclear) and bridleways — solid lines are developed ways.
    // (sac_scale / via_ferrata are not in the OpenMapTiles schema)
    ...trailCommon,
    id: 'trail-path-dashed',
    minzoom: 13.5,
    filter: [
      'all',
      isLine,
      notBridgeTunnel,
      cls('path'),
      ['match', ['get', 'subclass'], ['path', 'bridleway'], true, false],
      ['!=', ['get', 'bicycle'], 'designated'],
    ],
    paint: {
      'line-color': C.trail,
      'line-dasharray': [3, 1.5],
      'line-width': zw([
        [13.5, 0.7],
        [15, 1.4],
        [20, 4],
      ]),
    },
  },
  {
    ...trailCommon,
    id: 'trail-steps',
    minzoom: 15,
    filter: ['all', isLine, notBridgeTunnel, cls('path'), ['==', ['get', 'subclass'], 'steps']],
    paint: {
      'line-color': C.trail,
      'line-dasharray': [1.2, 1],
      'line-width': zw([
        [15, 0.9],
        [20, 3],
      ]),
    },
  },
  // tunnel trails: faded, dashed
  {
    ...trailCommon,
    id: 'trail-tunnel',
    minzoom: 13,
    filter: [
      'all',
      isLine,
      brunnel('tunnel'),
      ['match', ['get', 'class'], ['path', 'track', 'pedestrian'], true, false],
    ],
    paint: {
      'line-color': C.trail,
      'line-opacity': 0.55,
      'line-dasharray': [2, 2],
      'line-width': zw([
        [13, 0.7],
        [15, 1.4],
        [20, 4],
      ]),
    },
  },
  // bridge trails: subtle casing only, so they stay readable
  {
    ...trailCommon,
    id: 'trail-bridge-casing',
    minzoom: 13,
    filter: [
      'all',
      isLine,
      brunnel('bridge'),
      ['match', ['get', 'class'], ['path', 'track', 'pedestrian'], true, false],
    ],
    paint: {
      'line-color': C.trackCasing,
      'line-width': zw([
        [13, 1.4],
        [20, 7],
      ]),
    },
  },
  {
    ...trailCommon,
    id: 'trail-bridge',
    minzoom: 13,
    filter: [
      'all',
      isLine,
      brunnel('bridge'),
      ['match', ['get', 'class'], ['path', 'track', 'pedestrian'], true, false],
    ],
    paint: {
      'line-color': C.trail,
      'line-width': zw([
        [13, 0.9],
        [15, 1.6],
        [20, 5],
      ]),
    },
  },
];
insertAfter('road_minor', trailLayers);

/* ------------------------------------------------------------------ *
 * Hillshade + contours (Mapterhorn DEM)                              *
 * ------------------------------------------------------------------ */
const hillshadeLayer = {
  id: 'hillshade',
  type: 'hillshade',
  source: 'dem-mapterhorn',
  minzoom: 6,
  paint: {
    'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 6, 0.06, 10, 0.16, 13, 0.36],
    'hillshade-shadow-color': '#50483A',
    'hillshade-highlight-color': '#FFFFFF',
    'hillshade-accent-color': '#5E5544',
  },
};
const contourLayers = [
  {
    id: 'contour-lines',
    type: 'line',
    source: 'contours',
    'source-layer': 'contours',
    minzoom: 13,
    layout: { 'line-join': 'round' },
    paint: {
      // level 1 = index contour (multiple of the major threshold)
      'line-color': ['match', ['get', 'level'], 1, C.contourIndex, C.contourMinor],
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        ['match', ['get', 'level'], 1, 1.0, 0.65],
        16,
        ['match', ['get', 'level'], 1, 1.6, 1.1],
      ],
      'line-blur': 0.25,
      'line-opacity': 0.78,
    },
  },
  {
    id: 'contour-labels',
    type: 'symbol',
    source: 'contours',
    'source-layer': 'contours',
    minzoom: 13,
    filter: ['>', ['get', 'level'], 0],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['number-format', ['get', 'ele'], { 'max-fraction-digits': 0 }],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 11],
      'text-rotation-alignment': 'map',
      'symbol-spacing': 220,
      'text-letter-spacing': 0.05,
    },
    paint: {
      'text-color': C.contourIndex,
      'text-halo-color': C.contourHalo,
      'text-halo-width': 1.2,
    },
  },
];
// Above all area fills (incl. water), below every road/trail line.
insertAfter('aeroway_taxiway', [hillshadeLayer, ...contourLayers]);

/* ------------------------------------------------------------------ *
 * Buildings — plain fills, huts are NOT special here                 *
 * ------------------------------------------------------------------ */
setPaint('building', 'fill-color', C.building);
setPaint('building', 'fill-outline-color', C.buildingOutline);
if (byId.has('building-3d')) {
  setPaint('building-3d', 'fill-extrusion-color', C.building);
  setPaint('building-3d', 'fill-extrusion-opacity', 0.85);
}

/* ------------------------------------------------------------------ *
 * Boundaries                                                         *
 * ------------------------------------------------------------------ */
setPaint('boundary_3', 'line-color', C.boundary1);
setPaint('boundary_2', 'line-color', C.boundary2);
setPaint('boundary_disputed', 'line-color', C.boundary2);

// swisstopo-style settlement symbols: white dot with gray ring for
// cities (size by OMT place.rank — a GLOBAL population rank: Zurich 3,
// Budapest 3, Košice 7, Winterthur 14), small ring for towns.
const cityDotLayers = [
  {
    id: 'city-dot',
    type: 'circle',
    source: 'openmaptiles',
    'source-layer': 'place',
    minzoom: 6,
    filter: ['==', ['get', 'class'], 'city'],
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        6,
        [
          'case',
          ['<=', ['to-number', ['get', 'rank']], 3],
          3.5,
          ['<=', ['to-number', ['get', 'rank']], 6],
          2.5,
          1.8,
        ],
        13,
        [
          'case',
          ['<=', ['to-number', ['get', 'rank']], 3],
          6,
          ['<=', ['to-number', ['get', 'rank']], 6],
          4.5,
          3.5,
        ],
      ],
      'circle-color': '#FFFFFF',
      'circle-stroke-color': '#6B665A',
      'circle-stroke-width': 1.1,
      'circle-pitch-alignment': 'map',
    },
  },
  {
    id: 'town-dot',
    type: 'circle',
    source: 'openmaptiles',
    'source-layer': 'place',
    minzoom: 8,
    filter: ['==', ['get', 'class'], 'town'],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 13, 2.4],
      'circle-color': '#FFFFFF',
      'circle-stroke-color': '#6B665A',
      'circle-stroke-width': 0.9,
      'circle-pitch-alignment': 'map',
    },
  },
];
insertAfter('boundary_disputed', cityDotLayers);
// swisstopo places the name to the RIGHT of the dot, cities uppercase
for (const id of ['label_city', 'label_city_capital', 'label_town']) {
  setLayout(id, 'text-anchor', 'left');
  setLayout(id, 'text-offset', [0.65, 0.02]);
}
setLayout('label_city', 'text-transform', 'uppercase');
setLayout('label_city_capital', 'text-transform', 'uppercase');

/* ------------------------------------------------------------------ *
 * Labels — sparser, warm ink on cream halo                           *
 * ------------------------------------------------------------------ */
const recolorLabels = (ids, color, halo) => {
  for (const id of ids) {
    if (!byId.has(id)) continue;
    setPaint(id, 'text-color', color);
    setPaint(id, 'text-halo-color', halo);
  }
};
recolorLabels(
  [
    'label_other',
    'label_village',
    'label_town',
    'label_state',
    'label_city',
    'label_city_capital',
    'label_country_1',
    'label_country_2',
    'label_country_3',
  ],
  C.label,
  C.labelHalo
);
layer('label_other').minzoom = 11.5; // hamlets/neighbourhoods later
layer('label_village').minzoom = 11.5;
layout('label_village')['text-size'] = [
  'interpolate',
  ['exponential', 1.2],
  ['zoom'],
  7,
  11,
  11,
  13,
];
layer('label_town').minzoom = 7.5;
layout('label_city')['text-size'] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  [
    'case',
    ['<=', ['to-number', ['get', 'rank']], 2],
    13,
    ['<=', ['to-number', ['get', 'rank']], 4],
    12,
    ['<=', ['to-number', ['get', 'rank']], 8],
    10.5,
    10,
  ],
  11,
  [
    'case',
    ['<=', ['to-number', ['get', 'rank']], 2],
    17,
    ['<=', ['to-number', ['get', 'rank']], 4],
    15,
    ['<=', ['to-number', ['get', 'rank']], 8],
    13.5,
    12.5,
  ],
];
layout('label_city_capital')['text-size'] = layout('label_city')['text-size'];
layout('label_town')['text-size'] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  7,
  ['case', ['<=', ['to-number', ['get', 'rank']], 2], 12.5, 11],
  11,
  ['case', ['<=', ['to-number', ['get', 'rank']], 2], 14.5, 13],
];
layout('label_town')['text-size'] = ['interpolate', ['exponential', 1.2], ['zoom'], 7, 13, 11, 15];
recolorLabels(
  ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'],
  C.waterLabel,
  C.labelHalo
);
// path names earlier + warm trail ink
layer('highway-name-path').minzoom = 14;
setPaint('highway-name-path', 'text-color', '#8A6F4D');
setPaint('highway-name-path', 'text-halo-color', C.contourHalo);
layout('highway-name-path')['text-size'] = ['interpolate', ['linear'], ['zoom'], 14.5, 9.5, 17, 11];

/* ------------------------------------------------------------------ *
 * POIs — functional & sparse only                                    *
 * ------------------------------------------------------------------ */
// Crowd control: drop Liberty's generic rank-based POI layers entirely.
removeLayers(['poi_r20', 'poi_r7', 'poi_r1']);
// No road-number shields (A9-style badges) in an outdoor basemap —
// also silences the ref_length=null filter warnings from Liberty.
removeLayers(['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us']);

// Peaks with elevation (mountain_peak layer, rank 1 = most prominent)
const peakTextField = [
  'format',
  ['coalesce', ['get', 'name:latin'], ['get', 'name']],
  {},
  ['concat', '\n', ['get', 'ele'], ' m'],
  { 'font-scale': 0.82 },
];
const peakLayers = [
  {
    // rank-1 + >=2200 m from z8 — OMT's rank is PER TILE, so rank==1 alone
    // would surface every local bump (Dürrenberg 656 m...). The floor is
    // low enough for worldwide mountain ranges (Austria incl. Grossglockner
    // 3798 m, US, Norway...); below it, peaks appear via the z11 layer.
    id: 'peak-rank1',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'mountain_peak',
    minzoom: 8,
    filter: [
      'all',
      ['==', ['get', 'class'], 'peak'],
      ['==', ['get', 'rank'], 1],
      ['>=', ['to-number', ['get', 'ele']], 2200],
    ],
    layout: {
      'icon-image': 'mountain_11',
      'icon-size': 0.95,
      'text-field': peakTextField,
      'text-font': ['Noto Sans Bold'],
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        [
          'case',
          ['>=', ['to-number', ['get', 'ele']], 4000],
          11.5,
          ['>=', ['to-number', ['get', 'ele']], 3000],
          10.5,
          ['>=', ['to-number', ['get', 'ele']], 2000],
          9.5,
          9,
        ],
        14,
        [
          'case',
          ['>=', ['to-number', ['get', 'ele']], 4000],
          15,
          ['>=', ['to-number', ['get', 'ele']], 3000],
          13.5,
          ['>=', ['to-number', ['get', 'ele']], 2000],
          12,
          11,
        ],
      ],
      'text-letter-spacing': 0.02,
      'text-max-width': 7,
    },
    paint: {
      'text-color': C.peakLabel,
      'text-halo-color': C.peakHalo,
      'text-halo-width': 1.3,
      'icon-opacity': 0.9,
    },
  },
  {
    // every rank-1 peak from z11 — by now the viewport is small enough
    // that per-tile rank is meaningful
    id: 'peak-rank1-all',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'mountain_peak',
    minzoom: 11,
    filter: [
      'all',
      ['==', ['get', 'class'], 'peak'],
      ['==', ['get', 'rank'], 1],
      ['<', ['to-number', ['get', 'ele']], 2200],
    ],
    layout: {
      'icon-image': 'mountain_11',
      'icon-size': 0.85,
      'text-field': peakTextField,
      'text-font': ['Noto Sans Bold'],
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9.5, 14, 12],
      'text-letter-spacing': 0.02,
      'text-max-width': 7,
    },
    paint: {
      'text-color': C.peakLabel,
      'text-halo-color': C.peakHalo,
      'text-halo-width': 1.2,
      'icon-opacity': 0.85,
    },
  },
  {
    // rank 2 from z11.5, regular weight
    id: 'peak-rank2',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'mountain_peak',
    minzoom: 11.5,
    filter: ['all', ['==', ['get', 'class'], 'peak'], ['==', ['get', 'rank'], 2]],
    layout: {
      'text-field': peakTextField,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 9.5, 16, 11.5],
      'text-letter-spacing': 0.02,
      'text-max-width': 7,
    },
    paint: {
      'text-color': C.peakLabel,
      'text-halo-color': C.peakHalo,
      'text-halo-width': 1.1,
    },
  },
  {
    // everything else from z13
    id: 'peak-minor',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'mountain_peak',
    minzoom: 13,
    filter: [
      'all',
      ['==', ['get', 'class'], 'peak'],
      ['match', ['get', 'rank'], [1, 2], false, true],
    ],
    layout: {
      'text-field': peakTextField,
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 10.5],
      'text-letter-spacing': 0.02,
      'text-max-width': 7,
    },
    paint: {
      'text-color': C.peakLabel,
      'text-halo-color': C.peakHalo,
      'text-halo-width': 1.1,
    },
  },
];
// Peaks sit below settlement labels in the collision stack.
layer('poi_transit').minzoom = 12.5;
insertAfter('poi_transit', peakLayers);

// Parking POIs (trailhead access) — icon only, high zoom
insertAfter('poi_transit', [
  {
    id: 'poi-parking',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: 15,
    filter: ['==', ['get', 'class'], 'parking'],
    layout: {
      'icon-image': 'parking_11',
      'icon-size': 0.85,
      'icon-allow-overlap': false,
    },
    paint: { 'icon-opacity': 0.9 },
  },
]);

/* ------------------------------------------------------------------ *
 * Write + validate                                                   *
 * ------------------------------------------------------------------ */
// basic sanity: layer ids unique, sources referenced exist
const ids = style.layers.map(l => l.id);
if (new Set(ids).size !== ids.length) throw new Error('duplicate layer ids');
for (const l of style.layers) {
  if (l.source && !(l.source in style.sources)) {
    throw new Error(`layer ${l.id} references unknown source ${l.source}`);
  }
}
const forbidden = JSON.stringify(style).includes('api.maptiler.com');
if (forbidden) throw new Error('style must not reference api.maptiler.com');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(style, null, 2) + '\n');
console.log(
  `wrote ${OUT} (${style.layers.length} layers, ${Object.keys(style.sources).length} sources)`
);
