import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import WdPlaceTitle from '@/components/content/place/WdPlaceTitle.vue';
import WdPlaceContent from '@/components/content/place/WdPlaceContent.vue';
import WdPlaceActions from '@/components/content/place/WdPlaceActions.vue';

const meta = preview.meta({
  title: 'Layout/Place Detail (Live)',
  component: WdPlaceContent,
  tags: ['!autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      page: null,
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
    },
  },
});

export default meta;

export const Desktop = meta.story({
  args: { slug: 'aarbiwak' },
  globals: { viewport: { value: 'desktop' } },
  render: args => ({
    components: { WdPlaceTitle, WdPlaceContent, WdPlaceActions },
    setup() {
      return { args };
    },
    template: `
      <div style="height: 100vh; display: flex; justify-content: flex-end;">
        <div class="bg-grey-3" style="height: 100vh; width: 460px; max-width: 100%; flex-shrink: 0;">
          <q-layout view="lhh LpR lff" container>
            <q-header class="no-background" style="position: sticky; top: 0; z-index: 1000; backdrop-filter: blur(4px);">
              <WdPlaceActions :slug="args.slug" />
            </q-header>

            <WdPlaceTitle :slug="args.slug" />

            <q-page-container class="fit" style="height: 100%">
              <q-scroll-area
                visible
                :thumb-style="{
                  width: '6px',
                  backgroundColor: '#998019',
                  opacity: '0.5',
                  borderRadius: '8px 0 0 8px',
                }"
                style="height: 100%"
                class="fit"
              >
                <q-page class="q-px-md">
                  <WdPlaceContent :slug="args.slug" />
                </q-page>
              </q-scroll-area>
            </q-page-container>
          </q-layout>
        </div>
      </div>
    `,
  }),
});

export const Mobile = meta.story({
  args: { slug: 'aarbiwak' },
  globals: { viewport: { value: 'mobile' }, platform: 'mobile' },
  render: args => ({
    components: { WdPlaceTitle, WdPlaceContent, WdPlaceActions },
    setup() {
      return { args };
    },
    template: `
      <div class="bg-white" style="height: 100vh; width: 100%; margin: 0 auto; overflow-y: auto; position: relative;">
        <div class="q-px-md q-pt-sm q-pb-xs" style="padding-right: 50px">
          <WdPlaceTitle :slug="args.slug" />
        </div>
        <div class="q-px-md">
          <WdPlaceContent :slug="args.slug" />
        </div>
        <div class="q-pa-sm" style="border-top: 1px solid #e0e0e0; position: sticky; bottom: 0; background: white;">
          <WdPlaceActions :slug="args.slug" />
        </div>
      </div>
    `,
  }),
});
