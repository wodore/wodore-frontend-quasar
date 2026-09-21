import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import WdPlaceContent from '@/components/content/place/WdPlaceContent.vue';

const meta = preview.meta({
  title: 'Content/WdPlaceContent (Live)',
  component: WdPlaceContent,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Full place detail content: gallery, type chips, description, availabilities, open schedule, and weather. Fetches data via `usePlace(slug)` and `useHutImages(slug)`.',
      },
      source: {
        code: '<WdPlaceContent :slug="aarbiwak" />',
      },
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
      description: 'Hut slug to fetch and display content for',
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
    components: { WdPlaceContent },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 460px; width: 100%; margin: 0 auto;">
        <WdPlaceContent :slug="args.slug" />
      </div>
    `,
  }),
});
