import { definePreview } from '@storybook/vue3-vite';
import addonA11y from '@storybook/addon-a11y';
import addonDocs from '@storybook/addon-docs';
import addonThemes from '@storybook/addon-themes';
import { setup } from '@storybook/vue3';
import { MobileIcon, TabletIcon } from '@storybook/icons';
import { Quasar, Notify, Dialog, LoadingBar, LocalStorage, useQuasar } from 'quasar';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';

import 'quasar/dist/quasar.sass';
import '@quasar/extras/roboto-font/roboto-font.css';
import '@/css/app.scss';
import '@/extras/icons/dist/icons.css';
import '@quasar/extras/material-icons/material-icons.css';
import '@quasar/extras/eva-icons/eva-icons.css';
import './storybook.scss';

import messages from '@/i18n';

const i18n = createI18n({
  locale: 'de',
  legacy: false,
  messages,
});

setup(app => {
  app.use(createPinia());
  app.use(i18n);
  app.use(Quasar, {
    plugins: { Notify, Dialog, LoadingBar, LocalStorage },
    config: {
      loadingBar: {
        color: 'accent-700',
        size: '2px',
      },
    },
  });

  app.config.globalProperties.$q.iconMapFn = (iconName: string) => {
    if (iconName.startsWith('wd-')) {
      return {
        cls: 'wd ' + iconName,
      };
    }
  };
});

const HUT_SLUGS = [
  'aarbiwak',
  'britannia',
  'monte-rosa',
  'arben',
  'alp-de-fora',
  'baita-valmaggia',
];

export default definePreview({
  addons: [addonDocs(), addonA11y(), addonThemes()],
  tags: ['autodocs'],
  parameters: {
    docs: {
      story: {
        inline: true,
      },
      canvas: {
        sourceState: 'shown',
      },
    },
    backgrounds: {
      options: {
        light: { name: 'Light', value: '#ffffff' },
        dark: { name: 'Dark', value: '#1a1a1a' },
      },
    },
    controls: {
      expanded: true,
    },
    viewport: {
      options: {
        desktop: {
          name: 'Desktop (1440px)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
        tablet: {
          name: 'Tablet (768px)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        mobile: {
          name: 'Mobile (375px)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
        mobileSmall: {
          name: 'Mobile Small (320px)',
          styles: { width: '320px', height: '568px' },
          type: 'mobile',
        },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: 'light' },
  },
  globalTypes: {
    platform: {
      description: 'Simulate Quasar $q.platform (mobile detection, touch support)',
      title: 'Platform',
      icon: TabletIcon,
      items: [
        { value: 'desktop', icon: TabletIcon, title: 'Desktop' },
        { value: 'mobile', icon: MobileIcon, title: 'Mobile (touch)' },
      ],
    },
  },
  decorators: [
    (story, context) => ({
      components: { story },
      setup() {
        const mode = context.globals.platform || 'desktop';
        const isMobile = mode === 'mobile';
        const $q = useQuasar();
        if ($q) {
          $q.platform.is.mobile = isMobile;
          $q.platform.is.desktop = !isMobile;
          $q.platform.has.touch = isMobile;
        }
        return {};
      },
      template: '<story />',
    }),
  ],
});

export { HUT_SLUGS };
