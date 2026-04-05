import { defineMain } from '@storybook/vue3-vite/node';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Components from 'unplugin-vue-components/vite';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  const filePath = resolve(process.cwd(), file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: {
        plugin: 'vue-component-meta',
      },
    },
  },
  stories: ['../stories/**/*.stories.@(js|jsx|ts|tsx|vue)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
  staticDirs: ['../public'],
  viteFinal: async config => {
    config.define = {
      ...config.define,
      'process.env.WODORE_API_HOST': JSON.stringify(process.env.WODORE_API_HOST),
      'process.env.WODORE_API_VERSION': JSON.stringify(process.env.WODORE_API_VERSION),
      'process.env.WODORE_IMAGOR_KEY': JSON.stringify(process.env.WODORE_IMAGOR_KEY),
      'process.env.WODORE_IMAGOR_URL': JSON.stringify(process.env.WODORE_IMAGOR_URL),
      'process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA': JSON.stringify(
        process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA
      ),
    };

    config.plugins = [
      ...(config.plugins || []),
      vue({
        template: {
          transformAssetUrls,
          compilerOptions: {
            isCustomElement: (tag: string) =>
              tag === 'bottom-sheet' || tag.startsWith('bottom-sheet'),
          },
        },
      }),
      quasar({
        sassVariables: path.resolve(__dirname, '../src/css/quasar.variables.scss'),
      }),
      VueI18nPlugin({
        include: [path.resolve(__dirname, '../src/i18n')],
        strictMessage: false,
      }),
      Icons({ compiler: 'vue3' }),
      Components({
        resolvers: [IconsResolver({ componentPrefix: 'icon' })],
      }),
      tsconfigPaths(),
    ];

    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': path.join(__dirname, '../src'),
        '@services': path.join(__dirname, '../src/services'),
        '@extras': path.join(__dirname, '../src/extras'),
        '@clients': path.join(__dirname, '../src/clients'),
        '@stores': path.join(__dirname, '../src/stores'),
        '@components': path.join(__dirname, '../src/components'),
        '@composables': path.join(__dirname, '../src/composables'),
        '@layouts': path.join(__dirname, '../src/layouts'),
        '@pages': path.join(__dirname, '../src/pages'),
        '@assets': path.join(__dirname, '../src/assets'),
        '@boot': path.join(__dirname, '../src/boot'),
        '@types': path.join(__dirname, '../src/types'),
        src: path.join(__dirname, '../src'),
      },
    };

    config.css = {
      ...config.css,
      preprocessorOptions: {
        scss: {
          includePaths: [path.resolve(__dirname, '..')],
        },
        sass: {
          includePaths: [path.resolve(__dirname, '..')],
        },
      },
    };

    return config;
  },
});
