import preview, { HUT_SLUGS } from '../../../.storybook/preview';
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import WdDetailBodyHost from '@/components/content/WdDetailBodyHost.vue';

/**
 * Detail body host (live) — the thin content-view renderer of the
 * selection framework: resolves the active entry (route-meta interim
 * binding → accommodation), loads its ONE surfaces barrel and renders
 * the body zone (WdPlaceContent, legacy slug props adapted by the host).
 * Title/actions zones live in the panel shells (MainLayout) — this story
 * covers the BODY parity with the pre-framework live story.
 */
const meta = preview.meta({
  title: 'Content/WdDetailBodyHost (Live)',
  component: WdDetailBodyHost,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "Generic body host for content named views — renders the active entry's detail surface. With no routed target, the interim route-meta binding resolves the accommodation entry; the slug prop passes through to the legacy WdPlaceContent.",
      },
      source: {
        code: '<WdDetailBodyHost :slug="aarbiwak" />',
      },
    },
  },
  argTypes: {
    slug: {
      control: 'select',
      options: HUT_SLUGS,
      description: 'Hut slug (route param shape) passed through to the body surface',
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
  render: (args: { slug: string }) => ({
    components: { WdDetailBodyHost },
    setup() {
      // The shared memory router starts at '/' — the route-meta binding
      // (contentType: 'place' → accommodation) only resolves on the
      // CONTENT route, so the story must navigate there (and re-navigate
      // when the slug control changes), or the body host stays empty.
      const router = useRouter();
      const goToSlug = (slug: string) => {
        void router.push({ name: 'map-hut', params: { slug } });
      };
      onMounted(() => goToSlug(args.slug));
      watch(
        () => args.slug,
        slug => goToSlug(slug)
      );
      return { args };
    },
    template: `
      <div style="max-width: 460px; width: 100%; margin: 0 auto;">
        <WdDetailBodyHost :slug="args.slug" />
      </div>
    `,
  }),
});
