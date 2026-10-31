import preview from '../../../.storybook/preview';
import WdTransportPopup from '@/selection/entries/transport/WdTransportPopup.vue';
import { targetKey } from '@/selection/types';

/** Sample Transitland tile targets — routes ride as a JSON string. */
const stationTarget = {
  key: targetKey({ source: 'transport', id: 's-9q8yy-matterhorntal' }),
  source: 'transport',
  id: 's-9q8yy-matterhorntal',
  props: {
    onestop_id: 's-9q8yy-zermatt',
    operator_name: 'Matterhorn Gotthard Bahn',
    operator_short_name: 'MGB',
    routes: JSON.stringify([
      { short_name: 'S1', color: 'd81e05' },
      { short_name: 'Regio', color: null },
      { long_name: 'Glacier Express', color: 'c41230' },
    ]),
    location_type: 1,
  },
};

const bareTarget = {
  key: targetKey({ source: 'transport', id: 's-9q8yy-bare' }),
  source: 'transport',
  id: 's-9q8yy-bare',
  props: { onestop_id: 's-9q8yy-bare' },
};

const meta = preview.meta({
  title: 'Selection/Transport Popup',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'External-source popup content (Transitland tile props): operator + route chips parsed defensively from the JSON routes blob. Props-only, zero fetch.',
      },
    },
  },
});

export default meta;

export const Station = meta.story({
  render: () => ({
    components: { WdTransportPopup },
    setup: () => ({ target: stationTarget }),
    template: `
      <div style="max-width: 280px; border: 1px solid #ccc; border-radius: 12px; padding: 8px 10px;">
        <strong style="font-size: 14px;">Zermatt</strong>
        <WdTransportPopup :target="target" />
      </div>
    `,
  }),
});

export const Bare = meta.story({
  render: () => ({
    components: { WdTransportPopup },
    setup: () => ({ target: bareTarget }),
    template: `
      <div style="max-width: 280px; border: 1px solid #ccc; border-radius: 12px; padding: 8px 10px;">
        <strong style="font-size: 14px;">bare</strong>
        <WdTransportPopup :target="target" />
      </div>
    `,
  }),
});
