import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import WdPlaceActions from '@/components/content/place/WdPlaceActions.vue';

const meta = preview.meta({
  title: 'Content/WdPlaceActions (Live)',
  component: WdPlaceActions,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Action toolbar for a place: geo link, external sources, review status, watch/star, and more menu. Fetches data via `usePlace(slug)`.',
      },
      source: {
        code: '<WdPlaceActions :slug="aarbiwak" />',
      },
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
      description: 'Hut slug to fetch and display actions for',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'undefined' },
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
    components: { WdPlaceActions },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 460px; width: 100%; margin: 0 auto;">
        <WdPlaceActions :slug="args.slug" />
      </div>
    `,
  }),
});
