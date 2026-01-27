// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { configure } from 'quasar/wrappers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// import git from 'git-rev-sync';

import { date } from 'quasar';
const { formatDate } = date;

import IconsResolver from 'unplugin-icons/resolver';

import { execSync } from 'child_process';
const gitHash = process.env.GIT_HASH || execSync('git rev-parse HEAD').toString().trim();

// export default defineConfig({
//   plugins: [
//     Icons({ /* options */ }),
//   ],
// })

// Manually load .env files for use in quasar.config.ts
// This is required because Quasar loads .env files AFTER processing the config
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env files in the correct order (later files override earlier ones)
const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  const filePath = resolve(process.cwd(), file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

// add any new variable to the 'env' section

export default configure(ctx => {
  const appNameBase = process.env.WODORE_APP_NAME || 'Wodore';
  const appNameDev = () => {
    if (appNameBase.toLowerCase().includes('dore')) {
      return appNameBase.replace(/dore/i, 'dev');
    }
    return `${appNameBase} [dev]`;
  };
  const appName = ctx.dev ? appNameDev() : appNameBase;
  const appEnv = process.env.WODORE_ENV || 'production';

  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    /// axios
    boot: [
      'i18n',
      'icons',
      { server: false, path: 'auth' },
      { server: false, path: 'maplibre' },
      { server: false, path: 'vue-stripe' },
      { server: false, path: 'pwa-update' },
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ['app.scss'],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      'roboto-font', // optional, you are not bound to it
    ],

    // FAVICON version, change manually in src-pwa/manifest.json as well!
    htmlVariables: {
      faviconVersion: 3,
      productName: appName,
      productDescriptionDe: 'Wohin gipfelt deine nächste Tour?',
    },
    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#build
    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },

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
      },
      vueRouterMode: 'history', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      // publicPath: '/',
      // analyze: true,
      env: {
        TIMESTAMP_VERSION_HEX:
          't' +
          parseInt(formatDate(Date.now(), 'YYMMDD')).toString(16).padStart(5, '0') +
          '-' +
          parseInt(formatDate(Date.now(), 'HHmm')).toString(16).padStart(3, '0'),
        WODORE_GIT_HASH: gitHash,
        WODORE_APP_VERSION: process.env.PACKAGE_VERSION || process.env.npm_package_version,
        WODORE_APP_NAME: appName,
        WODORE_ENV: appEnv,
        WODORE_URL: process.env.WODORE_URL,
        WODORE_DOMAIN: process.env.WODORE_DOMAIN,
        WODORE_API_HOST: process.env.WODORE_API_HOST,
        WODORE_API_VERSION: process.env.WODORE_API_VERSION,
        WODORE_IMAGOR_KEY: process.env.WODORE_IMAGOR_KEY,
        WODORE_IMAGOR_URL: process.env.WODORE_IMAGOR_URL,
        WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA,
        WODORE_UMAMI_WEBSITE_ID: process.env.WODORE_UMAMI_WEBSITE_ID,
        WODORE_UMAMI_WEBSITE_URL: process.env.WODORE_UMAMI_WEBSITE_URL,
        WODORE_OICD_ISSUER_URL: process.env.WODORE_OICD_ISSUER_URL,
        WODORE_OICD_CLIENT_ID: process.env.WODORE_OICD_CLIENT_ID,
        WODORE_OICD_RESOURCE_ID: process.env.WODORE_OICD_RESOURCE_ID,
        WODORE_MAPTILER_API_KEY: process.env.WODORE_MAPTILER_API_KEY,
        WODORE_TILE_SERVER_URL: process.env.WODORE_TILE_SERVER_URL,
      },
      // rawDefine: {}
      // ignorePublicFolder: true,
      minify: true,
      htmlMinifyOptions: {
        removeComments: true,
        collapseWhitespace: false,
        removeAttributeQuotes: false,
        collapseBooleanAttributes: true,
        removeScriptTypeAttributes: true,
      },
      // polyfillModulePreload: true,
      // distDir

      // extendViteConf (viteConf) {},
      // viteVuePluginOptions: {},

      vitePlugins: [
        [
          '@intlify/unplugin-vue-i18n/vite',
          {
            // if you want to use Vue I18n Legacy API, you need to set `compositionOnly: false`
            // compositionOnly: false,

            // if you want to use named tokens in your Vue I18n messages, such as 'Hello {name}',
            // you need to set `runtimeOnly: false`
            // runtimeOnly: false,

            ssr: ctx.modeName === 'ssr',

            // you need to set i18n resource including paths !
            include: [fileURLToPath(new URL('./src/i18n', import.meta.url))],

            // Explicitly set strictMessage to false to avoid transform issues
            strictMessage: false,
          },
        ],
        [
          'vite-plugin-checker',
          {
            vueTsc: {
              tsconfigPath: 'tsconfig.vue-tsc.json',
            },
            eslint: {
              lintCommand: 'eslint "./**/*.{js,ts,mjs,cjs,vue}"',
              useFlatConfig: true,
            },
          },
          { server: false },
        ],
        ['unplugin-icons/vite', { compiler: 'vue3' }],
        [
          'unplugin-vue-components/vite',
          { resolvers: [IconsResolver({ componentPrefix: 'icon' })] },
        ],
        ['vite-tsconfig-paths', {}],
        // ['vite-plugin-html-resolve-alias', {}], // still some alias issues
      ],
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#devServer
    devServer: {
      // https: true
      open: false, // opens browser window automatically
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#framework
    framework: {
      //iconSet: 'material-icons', // Quasar icon set
      iconSet: 'svg-eva-icons', // Quasar icon set
      // lang: 'en-US', // Quasar language pack
      lang: 'de-CH', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ['Notify', 'Dialog', 'LocalStorage', 'LoadingBar', 'Meta'],
      config: {
        loadingBar: {
          color: 'accent-700',
          size: '2px',
        },
      },
    },

    animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    // animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-service-worker',
    //   pwaServiceWorker: 'src-pwa/custom-service-worker',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render', // keep this as last one
      ],

      // extendPackageJson (json) {},
      // extendSSRWebserverConf (esbuildConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false,

      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!
      // will mess up SSR

      // pwaExtendGenerateSWOptions (cfg) {},
      // pwaExtendInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'InjectManifest', // 'GenerateSW' or 'InjectManifest'
      injectPwaMetaTags: false,
      extendManifestJson(json) {
        json.name = appName;
        json.short_name = appName;
        return json;
      },
      // Exclude index.html from precache to ensure fresh version via NetworkFirst
      extendInjectManifestOptions(options) {
        // Ignore index.html so it's not added to the precache manifest
        // This allows the NavigationRoute with NetworkFirst to handle it
        if (!options.globIgnores) {
          options.globIgnores = [];
        }
        options.globIgnores.push('index.html');
      },
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json'
      // extendManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPwaMetaTags: false,
      // extendPWACustomSWConf (esbuildConf) {},
      // extendGenerateSWOptions (cfg) {},
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {
      // noIosLegacyBuildFlag: true, // uncomment only if you know what you are doing
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true,
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (esbuildConf) {},
      // extendElectronPreloadConf (esbuildConf) {},

      // extendPackageJson (json) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: ['electron-preload'],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration

        appId: 'wodore',
      },
    },

    // Full list of options: https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    // bex: {
    //   // extendBexScriptsConf (esbuildConf) {},
    //   // extendBexManifestJson (json) {},
    //   contentScripts: ['my-content-script'],
    // },
  };
});
