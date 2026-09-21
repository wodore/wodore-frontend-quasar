import preview from '../../../../.storybook/preview';
import WdHutWeatherForecast from '@/components/huts/WdHutWeatherForecast.vue';

const meta = preview.meta({
  title: 'Content/WdHutWeatherForecast (Live)',
  component: WdHutWeatherForecast,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Weather forecast for a hut location. Shows temperature, weather icons, and day labels in a horizontal scrollable table. Fetches data from Open-Meteo API.',
      },
      source: {
        code: '<WdHutWeatherForecast :latitude="46.02" :longitude="7.75" :elevation="2508" />',
      },
    },
  },
  argTypes: {
    latitude: {
      control: 'number',
      description: 'Latitude of the location',
      table: {
        type: { summary: 'number' },
      },
    },
    longitude: {
      control: 'number',
      description: 'Longitude of the location',
      table: {
        type: { summary: 'number' },
      },
    },
    elevation: {
      control: 'number',
      description: 'Elevation in meters',
      table: {
        type: { summary: 'number' },
      },
    },
  },
});

export default meta;

export const Aarbiwak = meta.story({
  args: {
    latitude: 46.0208,
    longitude: 7.7534,
    elevation: 2508,
  },
  render: args => ({
    components: { WdHutWeatherForecast },
    setup() {
      return { args };
    },
    template: `
      <div style="max-width: 460px; width: 100%; margin: 0 auto;">
        <WdHutWeatherForecast :latitude="args.latitude" :longitude="args.longitude" :elevation="args.elevation" />
      </div>
    `,
  }),
});
