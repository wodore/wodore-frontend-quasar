import preview, { HUT_SLUGS } from '../../../../.storybook/preview';
import { createRegistry } from '@/selection/registry';
import { definePresentation, targetKey } from '@/selection/types';
import { accommodationEntry } from '@/selection/entries/accommodation';
import { geoplaceDefaultEntry } from '@/selection/entries/geoplace-default';

/**
 * Registry resolution — pure data-in/data-out demo of the selection
 * framework's matching (OpenSpec `add-place-interactions`): declarative
 * MatchSpec, first-wins order, geoplace-default fail-open. This story
 * uses a SCOPED registry (createRegistry) exactly like the unit tests —
 * the app's default registry installs the same entries.
 */

function target(source: string, id: string, props: Record<string, unknown>) {
  return { key: targetKey({ source, id }), source, id, props };
}

const registry = createRegistry([accommodationEntry, geoplaceDefaultEntry]);

const SAMPLES: Array<{ label: string; t: ReturnType<typeof target> }> = [
  {
    label: 'hut (search row: domain + kind)',
    t: target('geoplace', 'aarbiwak', {
      domain: 'amenity',
      kind: { identifier: 'accommodation.hut', slug: 'hut' },
    }),
  },
  {
    label: 'water point (unknown kind → fail open)',
    t: target('geoplace', 'water-1', {
      domain: 'amenity',
      kind: { identifier: 'amenity.water_point', slug: 'water_point' },
    }),
  },
  {
    label: 'village (domain admin, no kind → fail open)',
    t: target('geoplace', 'zermatt', { domain: 'admin' }),
  },
  {
    label: 'transport stop (no entry yet → unresolved)',
    t: target('transport', 'ch:sbb:8501120', { name: 'Station' }),
  },
];

const meta = preview.meta({
  title: 'Selection/Registry Resolution',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'How the presentation registry resolves sample targets — declarative MatchSpec, first-wins, geoplace-default fallback. The transport sample shows the dev-warning case (no entry installed for that source yet).',
      },
    },
  },
});

export default meta;

export const Samples = meta.story({
  render: () => ({
    setup() {
      const rows = SAMPLES.map(({ label, t }) => ({
        label,
        key: t.key,
        entry: registry.resolve(t)?.id ?? '(unresolved)',
      }));
      return { rows };
    },
    template: `
      <div class="q-pa-md" style="max-width: 720px">
        <table class="q-table full-width">
          <thead><tr><th>Sample</th><th>target.key</th><th>Resolved entry</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.label">
              <td>{{ r.label }}</td>
              <td><code>{{ r.key }}</code></td>
              <td><code>{{ r.entry }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
  }),
});

// Reference the helper so the erasure shape stays story-checked.
void definePresentation;
void HUT_SLUGS;
