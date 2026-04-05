import preview from '../../../../.storybook/preview';
import WdHutOpenMonthly from '@/components/huts/monthly/WdHutOpenMonthly.vue';

const meta = preview.meta({
  title: 'Content/WdHutOpenMonthly',
  component: WdHutOpenMonthly,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Monthly open/closed status display for a hut. Shows 12 months with icons indicating open, closed, or unknown status based on the `open_monthly` data.',
      },
      source: {
        code: '<WdHutOpenMonthly :open_monthly="data.open_monthly" :type_open="data.type_open" :type_closed="data.type_closed" />',
      },
    },
  },
  argTypes: {
    open_monthly: {
      control: 'object',
      description: 'Monthly open status data (month_01 through month_12)',
      table: {
        type: { summary: 'HutSchemaDetails.open_monthly' },
      },
    },
    type_open: {
      control: 'object',
      description: 'Open hut type with name and symbol',
      table: {
        type: { summary: 'HutSchemaDetails.type_open' },
      },
    },
    type_closed: {
      control: 'object',
      description: 'Closed hut type with name and symbol',
      table: {
        type: { summary: 'HutSchemaDetails.type_closed' },
      },
    },
  },
});

export default meta;

const mockOpenMonthly = {
  month_01: 'no' as const,
  month_02: 'no' as const,
  month_03: 'maybe' as const,
  month_04: 'yes' as const,
  month_05: 'yes' as const,
  month_06: 'yes' as const,
  month_07: 'yes' as const,
  month_08: 'yes' as const,
  month_09: 'yesish' as const,
  month_10: 'maybe' as const,
  month_11: 'no' as const,
  month_12: 'no' as const,
};

const mockTypeOpen = {
  slug: 'serviced',
  name: 'Bewirtschaftet',
  symbol: {
    simple: 'https://hub.wodore.com/media/huts/types/symbols/simple/serviced.png',
    detailed: 'https://hub.wodore.com/media/huts/types/symbols/detailed/serviced.png',
  },
};

const mockTypeClosed = {
  slug: 'winter_room',
  name: 'Winterraum',
  symbol: {
    simple: 'https://hub.wodore.com/media/huts/types/symbols/simple/winter_room.png',
    detailed: 'https://hub.wodore.com/media/huts/types/symbols/detailed/winter_room.png',
  },
};

export const Interactive = meta.story({
  args: {},
  render: () => ({
    components: { WdHutOpenMonthly },
    setup() {
      return { mockOpenMonthly, mockTypeOpen, mockTypeClosed };
    },
    template: `
      <div style="max-width: 460px; width: 100%; margin: 0 auto;">
        <WdHutOpenMonthly :open_monthly="mockOpenMonthly" :type_open="mockTypeOpen" :type_closed="mockTypeClosed" />
      </div>
    `,
  }),
});
