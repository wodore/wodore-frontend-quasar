import { defineConfig } from 'histoire';
import { HstVue } from '@histoire/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quasar, transformAssetUrls } from '@quasar/vite-plugin';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Components from 'unplugin-vue-components/vite';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Load .env files (same as quasar.config.ts)
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  const filePath = resolve(process.cwd(), file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

export default defineConfig({
  plugins: [HstVue()],
  setupFile: './src/histoire-setup.ts',
  storyMatch: ['**/*.story.vue'],
  theme: {
    title: 'Wodore Components',
    colors: {
      primary: {
        50: '#8fd6b7',
        100: '#8fd6b7',
        200: '#6dc59f',
        300: '#4db286',
        400: '#408c6b',
        500: '#346751',
        600: '#2a5b46',
        700: '#224e3b',
        800: '#1a4231',
        900: '#133426',
      },
    },
  },
  vite: {
    root: process.cwd(),
    define: {
      'process.env.WODORE_API_HOST': JSON.stringify(process.env.WODORE_API_HOST),
      'process.env.WODORE_API_VERSION': JSON.stringify(process.env.WODORE_API_VERSION),
      'process.env.WODORE_IMAGOR_KEY': JSON.stringify(process.env.WODORE_IMAGOR_KEY),
      'process.env.WODORE_IMAGOR_URL': JSON.stringify(process.env.WODORE_IMAGOR_URL),
      'process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA': JSON.stringify(
        process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA
      ),
    },
    plugins: [
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
        sassVariables: path.resolve(__dirname, './src/css/quasar.variables.scss'),
      }),
      VueI18nPlugin({
        include: [fileURLToPath(new URL('./src/i18n', import.meta.url))],
        strictMessage: false,
      }),
      Icons({ compiler: 'vue3' }),
      Components({
        resolvers: [IconsResolver({ componentPrefix: 'icon' })],
      }),
      tsconfigPaths(),
    ],
    resolve: {
      alias: {
        '@': path.join(__dirname, './src'),
        '@services': path.join(__dirname, './src/services'),
        '@extras': path.join(__dirname, './src/extras'),
        '@clients': path.join(__dirname, './src/clients'),
        '@stores': path.join(__dirname, './src/stores'),
        '@components': path.join(__dirname, './src/components'),
        '@composables': path.join(__dirname, './src/composables'),
        '@layouts': path.join(__dirname, './src/layouts'),
        '@pages': path.join(__dirname, './src/pages'),
        '@assets': path.join(__dirname, './src/assets'),
        '@boot': path.join(__dirname, './src/boot'),
        '@types': path.join(__dirname, './src/types'),
        // Add alias for src to help with Sass imports
        src: path.join(__dirname, './src'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [__dirname],
        },
        sass: {
          includePaths: [__dirname],
        },
      },
    },
  },
});
