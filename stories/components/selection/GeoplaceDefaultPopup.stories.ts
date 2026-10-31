import preview from '../../../.storybook/preview';
import WdGeoplacePopup from '@/selection/entries/geoplace-default/WdGeoplacePopup.vue';
import { targetKey } from '@/selection/types';

/** Sample targets for the generic popup content (props-only render). */
const waterTarget = {
  key: targetKey({ source: 'geoplace', id: 'water-sample' }),
  source: 'geoplace',
  id: 'water-sample',
  props: {
    name: 'Brunnen Wispile',
    name_de: 'Brunnen Wispile',
    domain: 'amenity',
    kind: { identifier: 'amenity.water_point', name: 'Water point', symbol: null },
    elevation: 1900,
    description: 'Quelle mit Trinkwasser, direkt am Wanderweg.',
  },
};

const plainTarget = {
  key: targetKey({ source: 'geoplace', id: 'plain-sample' }),
  source: 'geoplace',
  id: 'plain-sample',
  props: { name: 'Unnamed place' },
};

const meta = preview.meta({
  title: 'Selection/Geoplace Default Popup',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Fail-open popup content for any geoplace target without a specific entry — renders payload fields only (kind symbol → tier fallback, elevation, description snippet).',
      },
    },
  },
});

export default meta;

export const WaterPoint = meta.story({
  render: () => ({
    components: { WdGeoplacePopup },
    setup: () => ({ target: waterTarget }),
    template: `
      <div style="max-width: 280px; border: 1px solid #ccc; border-radius: 12px; padding: 8px 10px;">
        <strong style="font-size: 14px;">Brunnen Wispile</strong>
        <WdGeoplacePopup :target="target" />
      </div>
    `,
  }),
});

export const Bare = meta.story({
  render: () => ({
    components: { WdGeoplacePopup },
    setup: () => ({ target: plainTarget }),
    template: `
      <div style="max-width: 280px; border: 1px solid #ccc; border-radius: 12px; padding: 8px 10px;">
        <strong style="font-size: 14px;">Unnamed place</strong>
        <WdGeoplacePopup :target="target" />
      </div>
    `,
  }),
});
