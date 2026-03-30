import { defineSetupVue3 } from '@histoire/plugin-vue';
import { Quasar, Notify, Dialog, LoadingBar, LocalStorage } from 'quasar';
import { createPinia } from 'pinia';
import { createI18n, type I18nOptions } from 'vue-i18n';

// Import Quasar styles
import 'quasar/dist/quasar.sass';
import '@quasar/extras/roboto-font/roboto-font.css';

// Import custom styles
import '@/css/app.scss';
import '@/extras/icons/dist/icons.css';

// Import Material Icons (used by Quasar)
import '@quasar/extras/material-icons/material-icons.css';

// Import Eva Icons
import '@quasar/extras/eva-icons/eva-icons.css';

import messages from '@/i18n';

// Custom styles for Histoire to override default gray text
const histoireStyles = document.createElement('style');
histoireStyles.textContent = `
  /* Override Histoire's default gray text color */
  .htw-story-variant-single {
    color: #1a1a1a !important;
  }
  /* Set default color for headings in stories */
  .htw-story-variant-single h1,
  .htw-story-variant-single h2,
  .htw-story-variant-single h3,
  .htw-story-variant-single h4,
  .htw-story-variant-single h5,
  .htw-story-variant-single h6,
  .htw-story-variant-single .text-h1,
  .htw-story-variant-single .text-h2,
  .htw-story-variant-single .text-h3,
  .htw-story-variant-single .text-h4,
  .htw-story-variant-single .text-h5,
  .htw-story-variant-single .text-h6 {
    color: #346751 !important; /* Primary color */
  }
`;
document.head.appendChild(histoireStyles);

export const setupVue3 = defineSetupVue3(({ app }) => {
  // Setup Pinia store
  app.use(createPinia());

  // Setup i18n
  const i18n = createI18n({
    locale: 'de',
    legacy: false,
    messages,
  } as I18nOptions);
  app.use(i18n);

  // Setup Quasar
  app.use(Quasar, {
    plugins: { Notify, Dialog, LoadingBar, LocalStorage },
    config: {
      loadingBar: {
        color: 'accent-700',
        size: '2px',
      },
    },
  });

  // Setup custom icon mapping for wd- icons
  app.config.globalProperties.$q.iconMapFn = (iconName: string) => {
    if (iconName.startsWith('wd-')) {
      return {
        cls: 'wd ' + iconName,
      };
    }
  };
});
