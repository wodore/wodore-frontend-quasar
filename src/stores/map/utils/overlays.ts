import { PropertyValueSpecification } from 'maplibre-gl';
import { getRasterStyle, getSwisstopoOverlay } from './raster';
import { OverlaySwitchItem } from './interfaces';
import { transportStyle } from './overlay-transport';
import { hutsStyle } from './overlay-huts';

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
export const huts: OverlaySwitchItem = {
  name: 'huts',
  label: 'Huts', //$t('transport.travel_time'),
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
        label: 'Unterkünfte',
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
          title: 'Unterkünfte',
          description: 'Verschiedene Unterkunftsarten',

          // Simple string: fetch from backend API
          category: 'accommodation',

          // Render as dual symbols (show both detailed and simple icons)
          type: 'symbol_dual',

          // Items will be populated automatically from category API
          items: [],
        },
        {
          title: 'Verfügbarkeit',
          description: 'Belegungsstatus',

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
};

export const public_transport_stops: OverlaySwitchItem = {
  name: 'transport-stops',
  label: 'Haltestellen', //$t('transport.station'),
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
          title: 'Haltestellen',
          description: 'Öffentliche Verkehrsmittel Haltestellen',
          category: [
            {
              slug: 'bus',
              name: 'Bus',
              description: 'Bushaltestellen',
              identifier: 'transport.bus',
              color: '#2d327d',
            },
            {
              slug: 'train',
              name: 'Zug',
              description: 'Bahnhöfe',
              identifier: 'transport.train',
              color: '#C60018',
            },
            {
              slug: 'other',
              name: 'Andere',
              description: 'Andere Haltestellen',
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
};

export const skitouren: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo-karto.skitouren',
    label: 'Skitouren',
    icon: 'skitouren',
    opacity: opacityLevels({}),
    minZoom: 8,
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Information',
          description:
            'Skitourenrouten von Swisstopo. Beachten Sie Lawinengefahr und Wetterbedingungen.',
          items: [],
        },
      ],
      links: [
        {
          name: 'Swisstopo Skitourenkarte',
          url: 'https://www.swisstopo.admin.ch/de/karten-daten-online/karten-geodaten/freizeitkarten/skitourenkarte.html',
        },
        {
          name: 'Lawinenwarnung SLF',
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
};

export const snowshoes: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.schneeschuhwandern',
    label: 'Schneeschuh',
    icon: 'snowshoeing',
    opacity: opacityLevels({}),
    minZoom: 8,
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Information',
          description: 'Schneeschuhwanderrouten von Swisstopo. Winterausrüstung erforderlich.',
          items: [],
        },
      ],
      links: [
        {
          name: 'Swisstopo Schneeschuhwandern',
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
};

export const protected_nature: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'wildruhe_und_jagdbann',
    layers: ['ch.bafu.wrz-wildruhezonen_portal', 'ch.bafu.wrz-jagdbanngebiete_select'],
    label: 'Naturschutz',
    icon: 'deer2',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.7, zoomMain: 0.5, zoomIn: 0.3 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Schutzgebiete',
          description: 'Wildschutzgebiete und Jagdbanngebiete zum Schutz von Wildtieren',
          category: [
            {
              slug: 'by_law',
              name: 'Rechtsverbindlich',
              description: '',
              identifier: 'nature.by_law',
              color: '#ff9b8d',
            },
            {
              slug: 'recommended',
              name: 'Empfohlen',
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
          name: 'Wildruhegebiete Info',
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
};

export const sheepdogs: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'ch.bafu.alpweiden-herdenschutzhunde',
    label: 'Herdenschutzhunde',
    icon: 'dog',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.7, zoomMain: 0.5, zoomIn: 0.3 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Information',
          description:
            'Alpweiden mit Herdenschutzhunden. Hunde an der Leine führen, Abstand zu Herden halten.',
          category: [
            {
              slug: 'sheepdogs',
              name: 'Geschützte Alpweiden',
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
          name: 'Verhaltensregeln Herdenschutzhunde',
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
};

export const hillslope: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.hangneigung-ueber_30',
    label: 'Hangneigung',
    icon: 'hillslopes',
    onLayer: 'background',
    opacity: opacityLevels({ zoomOut: 0.1, zoomMain: 0.2, zoomIn: 0.4 }),
    minZoom: 10,
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Hangneigung',
          description: 'Hänge mit über 30° Neigung (kritisch für Lawinen)',
          category: [
            {
              slug: '30-35',
              name: '30° - 35°',
              description: 'Hangneigung 30° bis 35°',
              identifier: 'slope.30-35',
              color: '#f2e50a',
            },
            {
              slug: '35-40',
              name: '35° - 40°',
              description: 'Hangneigung 35° bis 40°',
              identifier: 'slope.35-40',
              color: '#f46f24',
            },
            {
              slug: '40-45',
              name: '40° - 45°',
              description: 'Hangneigung 40° bis 45°',
              identifier: 'slope.40-45',
              color: '#de055b',
            },
            {
              slug: '45+',
              name: 'over 45°',
              description: 'Hangneigung über 45°',
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
          name: 'Lawinenwarnung SLF',
          url: 'https://www.slf.ch/de/lawinenbulletin-und-schneesituation.html',
        },
        {
          name: 'Hangneigungskarte Info',
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
};

export const skislopes: OverlaySwitchItem = {
  name: 'slopes',
  label: 'Skipisten',
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
          title: 'Schwierigkeitsgrad',
          description: 'Skipisten nach internationaler Farbklassifizierung',
          category: [
            {
              slug: 'green',
              name: 'Grün - Sehr leicht',
              description: 'Sehr flache Pisten für Anfänger',
              identifier: 'slope.green',
              color: '#4CAF50',
            },
            {
              slug: 'blue',
              name: 'Blau - Leicht',
              description: 'Leichte Pisten mit mäßiger Neigung',
              identifier: 'slope.blue',
              color: '#2196F3',
            },
            {
              slug: 'red',
              name: 'Rot - Mittel',
              description: 'Mittelschwere Pisten',
              identifier: 'slope.red',
              color: '#F44336',
            },
            {
              slug: 'black',
              name: 'Schwarz - Schwierig',
              description: 'Schwierige Pisten mit steilen Abschnitten',
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
};
export const hiking: OverlaySwitchItem = {
  ...getSwisstopoOverlay({
    name: 'ch.swisstopo.swisstlm3d-wanderwege',
    label: 'Wanderwege',
    icon: 'hiking',
    opacity: opacityLevels({ zoomOut: 0.4, zoomMain: 0.9, zoomIn: 0.7 }),
  }),

  config: {
    legend: {
      sections: [
        {
          title: 'Wegkategorien',
          description: 'Offizielle Wanderwegkategorien von Swisstopo',
          category: [
            {
              slug: 'wanderweg',
              name: 'Wanderweg',
              description: 'Einfache Wanderwege, für die meisten Altersgruppen geeignet',
              identifier: 'hiking.wanderweg',
              color: '#fdc200',
            },
            {
              slug: 'bergwanderweg',
              name: 'Bergwanderweg',
              description:
                'Anspruchsvollere Routen, können Steilhänge oder Hängebrücken beinhalten',
              identifier: 'hiking.bergwanderweg',
              color: '#ff0000',
            },
            {
              slug: 'alpinwanderweg',
              name: 'Alpinwanderweg',
              description: 'Schwierigste Routen, alpine Erfahrung und Ausrüstung erforderlich',
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
          name: 'Wanderland Schweiz',
          url: 'https://www.schweizmobil.ch/de/wanderland.html',
        },
        {
          name: 'SAC Wanderskala',
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
};

//const public_transport_stops = getSwisstopoOverlay({
//  name: 'ch.bav.haltestellen-oev',
//  label: 'Haltestellen',
//  icon: 'fa-solid fa-bus',
//  opacity: ['interpolate', ['linear'], ['zoom'], 9, 0, 11, 0.8, 20, 0.85],
//});
export const cycling: OverlaySwitchItem = {
  name: 'cycling',
  label: 'Fahrrad',
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
          title: 'Information',
          description: 'Fahrradrouten aus OpenStreetMap, angezeigt über Waymarked Trails',
          items: [],
        },
      ],
      links: [
        {
          name: 'Veloland Schweiz',
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
};

export const mtb: OverlaySwitchItem = {
  name: 'mtb',
  label: 'Mountainbike',
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
          title: 'Schwierigkeitsgrad',
          description: 'Mountainbike-Routen aus OpenStreetMap, angezeigt über Waymarked Trails',
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
          name: 'Mountainbikeland Schweiz',
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
};
