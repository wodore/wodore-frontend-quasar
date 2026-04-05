import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import WdHutAvailabilities from '@/components/huts/WdHutAvailabilities.vue';

const meta = preview.meta({
  title: 'Content/WdHutAvailabilities (Live)',
  component: WdHutAvailabilities,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Horizontal scrollable availability calendar. Fetches booking availability from the backend API for a given hut slug.',
      },
      source: {
        code: '<WdHutAvailabilities :slug="aarbiwak" />',
      },
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
      description: 'Hut slug to fetch availability for',
      table: {
        type: { summary: 'string' },
      },
    },
    hasAvailability: {
      control: 'boolean',
      description: 'Whether the hut has availability data',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
  },
});

export default meta;

export const Interactive = meta.story({
  args: {
    slug: 'aarbiwak',
  },
  render: args => ({
    components: { WdHutAvailabilities },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 800px; width: 100%; margin: 0 auto;">
        <WdHutAvailabilities :slug="args.slug" :has-availability="args.hasAvailability"/>
      </div>
    `,
  }),
});
