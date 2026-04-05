import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import WdPlaceTitle from '@/components/content/place/WdPlaceTitle.vue';

const meta = preview.meta({
  title: 'Content/WdPlaceTitle (Live)',
  component: WdPlaceTitle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays the place name as a toolbar title with a link to the external URL and weather info. Fetches data from the backend API via `usePlace(slug)`.',
      },
      source: {
        code: '<WdPlaceTitle :slug="aarbiwak" />',
      },
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
      description: 'Hut slug to fetch and display',
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
    components: { WdPlaceTitle },
    setup() {
      return { args };
    },
    template: '<WdPlaceTitle :slug="args.slug" />',
  }),
});
