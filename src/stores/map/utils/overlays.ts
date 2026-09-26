import { PropertyValueSpecification } from 'maplibre-gl';
import { getRasterStyle, getSwisstopoOverlay } from './raster';
import { OverlaySwitchItem } from './interfaces';
import { transportStyle } from './overlay-transport';
import { hutsStyle } from './overlay-huts';
import { i18n } from '@services/locale';

/**
 * Overlay definitions are FACTORIES (not module singletons) so that labels,
 * legend titles/descriptions and category names are resolved with the
 * ACTIVE locale at build time. The overlay store rebuilds its list from
 * these factories whenever the UI language changes (see rebuildOverlays).
 */
const t = i18n.global.t;

interface opacityLevelsArgs {
  zoomOut?: number;
  zoomMain?: number;
  zoomIn?: number;
}
export function opacityLevels({
  zoomOut = 0,
  zoomMain = 0.8,
  zoomIn = 0.3,
}: opacityLevelsArgs): PropertyValueSpecification<number> {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    zoomOut,
    11,
    zoomMain * 0.8,
    15,
    zoomMain,
    18,
    zoomIn,
  ];
}
export const createHuts = (): OverlaySwitchItem => ({
  name: 'huts',
  label: t('overlays.huts.label'),
  show: true,
  active: true,
  onLayer: 'ways',
  icon: 'huts',
  style: hutsStyle,

  // Overlay configuration (filters, settings, legend)
  config: {
    filters: [
      {
        id: 'hutTypes',
        label: t('overlays.huts.filter_types'),
        type: 'multi-select',

        // Simple string: fetch from backend API
        category: 'accommodation',

        // Options will be populated automatically from category API
        options: [],

        // Empty array = all selected by default
        defaultValue: [],

        // Map layer configuration for filter application
        mapLayers: [
          'wd-huts',
          'wd-huts-selected',
          'wd-huts-occupation',
          'wd-huts-occupation-day0',
          'wd-huts-occupation-day1',
          'wd-huts-occupation-day2',
          'wd-huts-occupation-day3',
        ],
        mapProperty: 'type_standard_identifier',
        filterExpression: 'in',
      },
    ],

    // Settings will be implemented in Phase 4+
    settings: [],

    // Legend with category-based auto-population
    legend: {
      sections: [
        {
          title: t('overlays.huts.legend_accommodation'),
          description: t('overlays.huts.legend_accommodation_desc'),

          // Simple string: fetch from backend API
          category: 'accommodation',

          // Render as dual symbols (show both detailed and simple icons)
          type: 'symbol_dual',

          // Items will be populated automatically from category API
          items: [],
        },
        {
          title: t('overlays.huts.legend_availability'),
          description: t('overlays.huts.legend_availability_desc'),

          // Simple string: fetch from backend API
          category: 'availability',

          // Render as detailed symbols with color indicators
          type: 'symbol_detailed',

          // Items will be populated automatically from category API
          items: [],
        },
      ],
    },
  },
});

export const createPublicTransportStops = (): OverlaySwitchItem => ({
  name: 'transport-stops',
  label: t('overlays.transport_stops.label'),
  onLayer: 'ways',
  show: true,
  active: false,
  icon: 'transport',
  opacity: false,
  style: transportStyle,

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.transport_stops.legend_title'),
          description: t('overlays.transport_stops.legend_desc'),
          category: [
            {
              slug: 'bus',
              name: t('overlays.transport_stops.bus'),
              description: t('overlays.transport_stops.bus_desc'),
              identifier: 'transport.bus',
              color: '#2d327d',
            },
            {
              slug: 'train',
              name: t('overlays.transport_stops.train'),
              description: t('overlays.transport_stops.train_desc'),
              identifier: 'transport.train',
              color: '#C60018',
            },
            {
              slug: 'other',
              name: t('overlays.transport_stops.other'),
              description: t('overlays.transport_stops.other_desc'),
              identifier: 'transport.other',
              color: '#0079C7',
            },
          ],
          type: 'point',
          items: [],
        },
      ],
    },
  },
});

export const createSkitouren = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo-karto.skitouren',
    label: t('overlays.skitouren.label'),
    icon: 'skitouren',
    opacity: opacityLevels({}),
    minZoom: 8,
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.info'),
          description: t('overlays.skitouren.desc'),
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.skitouren.link_skitourenkarte'),
          url: 'https://www.swisstopo.admin.ch/de/karten-daten-online/karten-geodaten/freizeitkarten/skitourenkarte.html',
        },
        {
          name: t('overlays.link_avalanche'),
          url: 'https://www.slf.ch/de/lawinenbulletin-und-schneesituation.html',
        },
      ],
      attribution: [
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

export const createSnowshoes = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.schneeschuhwandern',
    label: t('overlays.snowshoes.label'),
    icon: 'snowshoeing',
    opacity: opacityLevels({}),
    minZoom: 8,
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.info'),
          description: t('overlays.snowshoes.desc'),
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.snowshoes.link'),
          url: 'https://www.swisstopo.admin.ch/de/karten-daten-online/karten-geodaten/freizeitkarten/schneeschuhwandern.html',
        },
      ],
      attribution: [
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

export const createProtectedNature = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'wildruhe_und_jagdbann',
    layers: ['ch.bafu.wrz-wildruhezonen_portal', 'ch.bafu.wrz-jagdbanngebiete_select'],
    label: t('overlays.protected_nature.label'),
    icon: 'deer2',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.7, zoomMain: 0.5, zoomIn: 0.3 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.protected_nature.legend_title'),
          description: t('overlays.protected_nature.desc'),
          category: [
            {
              slug: 'by_law',
              name: t('overlays.protected_nature.by_law'),
              description: '',
              identifier: 'nature.by_law',
              color: '#ff9b8d',
            },
            {
              slug: 'recommended',
              name: t('overlays.protected_nature.recommended'),
              description: '',
              identifier: 'nature.recommended',
              color: '#ffed80',
            },
          ],
          type: 'area',
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.protected_nature.link'),
          url: 'https://www.bafu.admin.ch/bafu/de/home/themen/biodiversitaet/fachinformationen/massnahmen-zur-erhaltung-und-foerderung-der-biodiversitaet/oekologische-infrastruktur/wildruhegebiete.html',
        },
      ],
      attribution: [
        {
          name: 'BAFU',
          url: 'https://www.bafu.admin.ch',
        },
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

export const createSheepdogs = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'ch.bafu.alpweiden-herdenschutzhunde',
    label: t('overlays.sheepdogs.label'),
    icon: 'dog',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.7, zoomMain: 0.5, zoomIn: 0.3 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.info'),
          description: t('overlays.sheepdogs.desc'),
          category: [
            {
              slug: 'sheepdogs',
              name: t('overlays.sheepdogs.pastures'),
              description: '',
              identifier: 'slope.sheepdogs',
              color: '#ffb300',
            },
          ],
          type: 'area',
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.sheepdogs.link'),
          url: 'https://www.protectiondestroupeaux.ch/de/herdenschutzhunde/begegnung-mit-herdenschutzhunden/',
        },
      ],
      attribution: [
        {
          name: 'BAFU',
          url: 'https://www.bafu.admin.ch',
        },
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

export const createHillslope = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.hangneigung-ueber_30',
    label: t('overlays.hillslope.label'),
    icon: 'hillslopes',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.1, zoomMain: 0.2, zoomIn: 0.4 }),
    minZoom: 10,
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.hillslope.legend_title'),
          description: t('overlays.hillslope.desc'),
          category: [
            {
              slug: '30-35',
              name: '30° - 35°',
              description: t('overlays.hillslope.range_30_35'),
              identifier: 'slope.30-35',
              color: '#f2e50a',
            },
            {
              slug: '35-40',
              name: '35° - 40°',
              description: t('overlays.hillslope.range_35_40'),
              identifier: 'slope.35-40',
              color: '#f46f24',
            },
            {
              slug: '40-45',
              name: '40° - 45°',
              description: t('overlays.hillslope.range_40_45'),
              identifier: 'slope.40-45',
              color: '#de055b',
            },
            {
              slug: '45+',
              name: '> 45°',
              description: t('overlays.hillslope.range_45'),
              identifier: 'slope.45+',
              color: '#c889bb',
            },
          ],
          type: 'area',
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.link_avalanche'),
          url: 'https://www.slf.ch/de/lawinenbulletin-und-schneesituation.html',
        },
        {
          name: t('overlays.hillslope.link_map_info'),
          url: 'https://www.swisstopo.admin.ch/de/karten-daten-online/karten-geodaten/freizeitkarten/hangneigungskarte.html',
        },
      ],
      attribution: [
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

export const createSkislopes = (): OverlaySwitchItem => ({
  name: 'slopes',
  label: t('overlays.skislopes.label'),
  opacity: opacityLevels({ zoomOut: 0.3, zoomMain: 0.6 }),
  icon: 'skislopes',
  onLayer: 'ways',
  show: true,
  style: getRasterStyle({
    name: 'slopes',
    tiles: ['https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png'],
    minZoom: 8,
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.difficulty'),
          description: t('overlays.skislopes.desc'),
          category: [
            {
              slug: 'green',
              name: t('overlays.skislopes.green'),
              description: t('overlays.skislopes.green_desc'),
              identifier: 'slope.green',
              color: '#4CAF50',
            },
            {
              slug: 'blue',
              name: t('overlays.skislopes.blue'),
              description: t('overlays.skislopes.blue_desc'),
              identifier: 'slope.blue',
              color: '#2196F3',
            },
            {
              slug: 'red',
              name: t('overlays.skislopes.red'),
              description: t('overlays.skislopes.red_desc'),
              identifier: 'slope.red',
              color: '#F44336',
            },
            {
              slug: 'black',
              name: t('overlays.skislopes.black'),
              description: t('overlays.skislopes.black_desc'),
              identifier: 'slope.black',
              color: '#212121',
            },
          ],
          type: 'line',
          items: [],
        },
      ],
    },
  },
});
export const createHiking = (): OverlaySwitchItem => ({
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.swisstlm3d-wanderwege',
    label: t('overlays.hiking.label'),
    icon: 'hiking',
    opacity: opacityLevels({ zoomOut: 0.4, zoomMain: 0.9, zoomIn: 0.7 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.hiking.legend_title'),
          description: t('overlays.hiking.desc'),
          category: [
            {
              slug: 'wanderweg',
              name: t('overlays.hiking.wanderweg'),
              description: t('overlays.hiking.wanderweg_desc'),
              identifier: 'hiking.wanderweg',
              color: '#fdc200',
            },
            {
              slug: 'bergwanderweg',
              name: t('overlays.hiking.bergwanderweg'),
              description: t('overlays.hiking.bergwanderweg_desc'),
              identifier: 'hiking.bergwanderweg',
              color: '#ff0000',
            },
            {
              slug: 'alpinwanderweg',
              name: t('overlays.hiking.alpinwanderweg'),
              description: t('overlays.hiking.alpinwanderweg_desc'),
              identifier: 'hiking.alpinwanderweg',
              color: '#0000ff',
            },
          ],
          type: 'line',
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.hiking.link_wanderland'),
          url: 'https://www.schweizmobil.ch/de/wanderland.html',
        },
        {
          name: t('overlays.hiking.link_sac_scale'),
          url: 'https://www.sac-cas.ch/de/huetten-und-touren/sac-tourenportal/schwierigkeitsskala/',
        },
      ],
      attribution: [
        {
          name: 'swisstopo',
          url: 'https://www.swisstopo.admin.ch',
        },
      ],
    },
  },
});

//const public_transport_stops = getSwisstopoOverlay({
//  name: 'ch.bav.haltestellen-oev',
//  label: 'Haltestellen',
//  icon: 'transport',
//  opacity: ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.8, 20, 0.85],
//});
export const createCycling = (): OverlaySwitchItem => ({
  name: 'cycling',
  label: t('overlays.cycling.label'),
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: 'cycling',
  onLayer: 'ways',
  show: true,
  style: getRasterStyle({
    name: 'cycling',
    tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.info'),
          description: t('overlays.cycling.desc'),
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.cycling.link'),
          url: 'https://www.schweizmobil.ch/de/veloland.html',
        },
      ],
      attribution: [
        {
          name: 'OpenStreetMap',
          url: 'https://www.openstreetmap.org/copyright',
        },
        {
          name: 'Waymarked Trails',
          url: 'https://cycling.waymarkedtrails.org/',
        },
      ],
    },
  },
});

export const createMtb = (): OverlaySwitchItem => ({
  name: 'mtb',
  label: t('overlays.mtb.label'),
  opacity: opacityLevels({ zoomOut: 0.6, zoomMain: 0.9, zoomIn: 0.7 }),
  icon: 'mtb',
  onLayer: 'ways',
  show: true,
  style: getRasterStyle({
    name: 'mtb',
    tiles: ['https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png'],
  }),

  config: {
    legend: {
      sections: [
        {
          title: t('overlays.difficulty'),
          description: t('overlays.mtb.desc'),
          //category: [
          //  {
          //    slug: 's0',
          //    name: 'S0 - Leicht',
          //    description: 'Geschotterte Wege, keine besonderen Fahrtechniken erforderlich',
          //    identifier: 'mtb.s0',
          //    color: '#4CAF50',
          //  },
          //  {
          //    slug: 's1',
          //    name: 'S1 - Mittel',
          //    description: 'Kleine Hindernisse, grundlegende Fahrtechnik erforderlich',
          //    identifier: 'mtb.s1',
          //    color: '#8BC34A',
          //  },
          //  {
          //    slug: 's2',
          //    name: 'S2 - Schwierig',
          //    description: 'Größere Hindernisse, fortgeschrittene Fahrtechnik erforderlich',
          //    identifier: 'mtb.s2',
          //    color: '#FFC107',
          //  },
          //  {
          //    slug: 's3',
          //    name: 'S3 - Sehr schwierig',
          //    description: 'Viele Hindernisse, hohe Fahrtechnik erforderlich',
          //    identifier: 'mtb.s3',
          //    color: '#FF9800',
          //  },
          //  {
          //    slug: 's4',
          //    name: 'S4 - Extrem',
          //    description: 'Sehr anspruchsvoll, Expertenfahrtechnik erforderlich',
          //    identifier: 'mtb.s4',
          //    color: '#FF5722',
          //  },
          //  {
          //    slug: 's5',
          //    name: 'S5 - Maximum',
          //    description: 'Höchste Schwierigkeit, nur für Profis',
          //    identifier: 'mtb.s5',
          //    color: '#F44336',
          //  },
          //],
          //type: 'line',
          items: [],
        },
      ],
      links: [
        {
          name: t('overlays.mtb.link'),
          url: 'https://www.schweizmobil.ch/de/mountainbikeland.html',
        },
      ],
      attribution: [
        {
          name: 'OpenStreetMap',
          url: 'https://www.openstreetmap.org/copyright',
        },
        {
          name: 'Waymarked Trails',
          url: 'https://mtb.waymarkedtrails.org/',
        },
      ],
    },
  },
});

/** Overlay factories in menu/store order. */
export const overlayFactories = [
  createHuts,
  createPublicTransportStops,
  createHiking,
  createMtb,
  createCycling,
  createHillslope,
  createSkitouren,
  createSnowshoes,
  createSkislopes,
  createProtectedNature,
  createSheepdogs,
];
