// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { configure } from 'quasar/wrappers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
// import git from 'git-rev-sync';

import { date } from 'quasar';
const { formatDate } = date;

import IconsResolver from 'unplugin-icons/resolver';
import { compression } from 'vite-plugin-compression2';
import { transform } from 'esbuild';
import type { Plugin } from 'vite';

import { execSync } from 'child_process';
let gitHash = process.env.GIT_HASH || '';
if (!gitHash) {
  try {
    gitHash = execSync('git rev-parse HEAD').toString().trim();
  } catch {
    // not a git repo / git unavailable — leave empty
  }
}

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

// Load .env files in order. The base .env must NOT override existing
// process env (CI builds set their env there); later local files may
// override earlier ones.
const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  const filePath = resolve(process.cwd(), file);
  if (existsSync(filePath)) {
    dotenv.config({ path: filePath, override: file !== '.env' });
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
    boot: [
      // Error tracking first (client-only): installs the global error
      // hooks before any later boot file runs — DSN-gated, inert without
      // WODORE_SENTRY_DSN (openspec: add-error-tracking).
      { server: false, path: 'sentry' },
      // eruda + plugins when the debug flag/param is set — fire-and-forget:
      // debug tooling loads in the background and never blocks the app
      // mount (owner report: boot must not wait on it).
      { server: false, path: 'debug-tools' },
      { server: false, path: 'hut-prefetch' },
      'i18n',
      'storage',
      'theme',
      'icons',
      { server: false, path: 'auth' },
      // Umami analytics (client-only): injects the script at browser idle
      // when env + opt-out + DNT gates pass — never on the boot critical
      // path (see boot/analytics.ts).
      { server: false, path: 'analytics' },
      // (No maplibre boot: the plugin's global component registration was
      // unused — WdMapView imports its Mgl* components directly — and the
      // static import put the ~327 kB gz MapLibre chunk on the pre-mount
      // critical path of every route. MapLibre now loads with the
      // WdMapView chunk graph; crawlers never BOOT it (they still
      // download the vendor chunk via the map-store cluster edge —
      // known follow-up), see services/crawler-ua.ts.)
      { server: false, path: 'pwa-update' },
      { server: false, path: 'native' },
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-js#css
    css: ['app.scss'],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    // (fonts ship self-hosted via @fontsource, see src/css/fonts.scss)
    extras: [],

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
        '@types': path.join(__dirname, './src/types'),
      },
      // GH Pages PR previews build with WODORE_ROUTER_MODE=hash (Pages has no
      // SPA rewrite) and a subpath via WODORE_PUBLIC_PATH; unset = production
      // defaults, behavior unchanged.
      vueRouterMode:
        (process.env.WODORE_ROUTER_MODE as 'history' | 'hash' | undefined) || 'history', // available values: 'hash', 'history'
      // vueRouterBase,
      // vueDevtools,
      // vueOptionsAPI: false,

      // Configure Vue to treat web components as custom elements
      viteVuePluginOptions: {
        template: {
          compilerOptions: {
            isCustomElement: (tag: string) =>
              tag === 'bottom-sheet' || tag.startsWith('bottom-sheet'),
          },
        },
      },

      // rebuildCache: true, // rebuilds Vite/linter/etc cache on startup

      publicPath: process.env.WODORE_PUBLIC_PATH || '/',
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
        // Optional CDN base for public/unauthenticated GETs — runtime-
        // swappable in docker via /env.js; `|| ''` keeps the define a
        // string when the var is absent from older env files.
        WODORE_PUBLIC_API_URL: process.env.WODORE_PUBLIC_API_URL || '',
        WODORE_IMAGOR_KEY: process.env.WODORE_IMAGOR_KEY,
        WODORE_IMAGOR_URL: process.env.WODORE_IMAGOR_URL,
        WODORE_IMAGOR_REPLACE_API_HOST_MEDIA: process.env.WODORE_IMAGOR_REPLACE_API_HOST_MEDIA,
        WODORE_UMAMI_WEBSITE_ID: process.env.WODORE_UMAMI_WEBSITE_ID,
        WODORE_UMAMI_WEBSITE_URL: process.env.WODORE_UMAMI_WEBSITE_URL,
        // Session recording (replays/heatmaps) opt-in — 'on' loads
        // recorder.js. Runtime-swappable in docker via /env.js ONLY
        // once the key exists in the committed base env file (the
        // replace_vars template) — until then docker activation
        // requires baking it at build time. The `|| ''` fallback keeps
        // the define a string when the key is absent from older env
        // files (empty = inherit, see services/runtimeEnv.ts).
        WODORE_UMAMI_RECORDER: process.env.WODORE_UMAMI_RECORDER || '',
        WODORE_OICD_ISSUER_URL: process.env.WODORE_OICD_ISSUER_URL,
        WODORE_OICD_CLIENT_ID: process.env.WODORE_OICD_CLIENT_ID,
        WODORE_OICD_RESOURCE_ID: process.env.WODORE_OICD_RESOURCE_ID,
        WODORE_MAPTILER_API_KEY: process.env.WODORE_MAPTILER_API_KEY,
        WODORE_TILE_SERVER_URL: process.env.WODORE_TILE_SERVER_URL,
        // Error tracking (openspec: add-error-tracking) — runtime-swappable
        // in docker via /env.js; empty/unset = fully inert.
        // The `|| ''` fallbacks matter: esbuild's dev-server define
        // requires strings, and these keys are absent from the env
        // defaults until rollout (empty string = fully inert).
        WODORE_SENTRY_DSN: process.env.WODORE_SENTRY_DSN || '',
        WODORE_SENTRY_TRACES_SAMPLE_RATE: process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE || '',
        WODORE_OFFICIAL_URL: process.env.WODORE_OFFICIAL_URL,
        // Build flag, not a runtime value: bakes a robots noindex meta into
        // index.html for static deployments that cannot decide at runtime —
        // set by preview.yml for GitHub Pages PR previews. Read by the EJS
        // condition in index.html (the docker image must NOT set it: it
        // decides per-environment in entrypoint.sh).
        WODORE_SEO_NOINDEX: process.env.WODORE_SEO_NOINDEX || '',
        // Build flag, not a runtime value: opts the PWA build into the
        // external /env.js (docker) — read by the EJS condition in
        // index.html.
        WODORE_EXTERNAL_ENV: process.env.WODORE_EXTERNAL_ENV || '',
      },
      // rawDefine: {}
      // ignorePublicFolder: true,
      // Public source maps (repo is open source, GPL-3.0): Sentry
      // symbolicates stack traces by fetching the .map files referenced
      // by the bundles' sourceMappingURL comments — no upload step, no
      // auth token, no vendor lock-in. Quasar's build.sourcemap would
      // force 'inline' (base64 maps bloat every chunk users download),
      // so the Vite-native external maps are set in extendViteConf
      // below instead. The APK also carries the maps (inert until a
      // future upload-from-CI for Android, which scraping cannot reach).
      minify: true,
      htmlMinifyOptions: {
        removeComments: true,
        collapseWhitespace: false,
        removeAttributeQuotes: false,
        collapseBooleanAttributes: true,
        removeScriptTypeAttributes: true,
        // Terser/clean-css the inline boot <script>s and the splash
        // <style>: removeComments only strips HTML comments — it never
        // touches comment bodies INSIDE script/style, so without these
        // the shipped shell carried the full inline source commentary.
        minifyJS: true,
        minifyCSS: true,
      },
      // polyfillModulePreload: true,
      // distDir

      extendViteConf(viteConf) {
        // External source maps with sourceMappingURL comments (see the
        // comment at build.minify above) — 'true' at the Vite level;
        // quasar.config's build.sourcemap would translate `true` to
        // 'inline' instead.
        viteConf.build ??= {};
        viteConf.build.sourcemap = true;

        // Ship public/env.js comment-free: it is public runtime config,
        // and the served bytes must not carry source commentary (the
        // docs live in the source file and services/runtimeEnv.ts).
        // closeBundle runs after vite copied public/ into the output;
        // safe against the compression plugin (env.js explicitly
        // excluded — no .br/.gz sibling could go stale) and against
        // replace_vars (the @@…@@ placeholders live inside string
        // literals, minification never rewrites them).
        let envJsOutDir = '';
        viteConf.plugins ??= [];
        viteConf.plugins.push({
          name: 'wd-minify-env-js',
          apply: 'build',
          configResolved(config) {
            envJsOutDir = path.resolve(config.root, config.build.outDir);
          },
          async closeBundle() {
            const envPath = path.join(envJsOutDir, 'env.js');
            if (!existsSync(envPath)) return;
            const minified = await transform(readFileSync(envPath, 'utf8'), {
              minify: true,
              legalComments: 'none',
              loader: 'js',
            });
            writeFileSync(envPath, minified.code);
          },
        } satisfies Plugin);

        // Stable long-lived vendor chunks: without pinning, rollup's
        // chunk graph is sensitive — one new dynamic import anywhere
        // rehashes unchanged vendor code, forcing returning visitors to
        // re-download MapLibre/Vue/Quasar after every app deploy. With
        // pinned chunks, app deploys only ship the (small) app chunk
        // delta; the worker file stays excluded so its separate rollup
        // build is untouched.
        viteConf.build.rollupOptions ??= {};
        const chunkFn = (id: string): string | undefined => {
          // Shell map stores (menu + content UI state, no MapLibre deps):
          // MainLayout imports them statically, so rollup would otherwise
          // merge them into the map-store cluster chunk (catalog/basemap/
          // overlay stores — which statically import MapLibre), putting the
          // 327 kB gz vendor chunk on every crawler's download list
          // (follow-up to PR #347). Pinning them to their own chunk keeps
          // the cluster lazy behind the map components. The $ anchor
          // assumes plain .ts ids (no ?query suffixes) — a future plugin
          // adding suffixes would silently regress this split, so verify
          // the map-shell-stores chunk exists in dist after build changes.
          if (/stores\/map\/(map-menu-store|map-content-store)\.ts$/.test(id)) {
            return 'map-shell-stores';
          }
          if (!id.includes('node_modules')) return undefined;
          // Keep rollup's worker builds out of the main graph — a named
          // chunk assignment here would inline/break the separate worker
          // bundle. Match the actual worker artifact patterns, not a bare
          // 'worker' substring (review nit).
          if (id.includes('maplibre-gl-worker') || id.includes('?worker')) {
            return undefined;
          }
          if (id.includes('maplibre-gl') || id.includes('vue-maplibre-gl')) {
            return 'maplibre';
          }
          // Contour protocol lib: its ONLY importer is a dynamic import
          // (outdoorContours.ts) — pinning it to a chunk of its own keeps
          // that boundary lazy. Rollup otherwise merges it into the
          // eager index chunk (verified via sourcemaps), which would put
          // ~20 kB gz on the boot path for a feature no served style
          // uses today.
          if (id.includes('maplibre-contour')) {
            return 'maplibre-contour';
          }
          if (id.includes('@quasar') || /node_modules\/quasar\//.test(id)) {
            return 'quasar';
          }
          if (
            /node_modules\/vue\//.test(id) ||
            id.includes('@vue/') ||
            id.includes('/vue-router/') ||
            id.includes('/pinia/') ||
            id.includes('@intlify') ||
            id.includes('vue-i18n')
          ) {
            return 'vue';
          }
          return undefined;
        };
        const outputs = (viteConf.build.rollupOptions.output ??= {});
        if (Array.isArray(outputs)) {
          outputs.push({ manualChunks: chunkFn });
        } else {
          outputs.manualChunks = chunkFn;
        }

        // Dev server host allowlist: Vite blocks non-localhost Host
        // headers. To expose the dev server on a machine name,
        // list it in WODORE_DEV_ALLOWED_HOSTS
        // (.env.local, comma-separated; subdomain wildcards with a
        // leading dot, e.g. ".ts.net"). IP hosts are always allowed;
        // unset/empty = Vite defaults (localhost only).
        const devHosts = (process.env.WODORE_DEV_ALLOWED_HOSTS ?? '')
          .split(',')
          .map(host => host.trim())
          .filter(Boolean);
        if (devHosts.length > 0) {
          viteConf.server ??= {};
          viteConf.server.allowedHosts = devHosts;
        }

        // Build-time precompression: emit .gz (gzip level 9) and .br
        // siblings next to the hashed js/css (and svg) assets so nginx
        // serves them via `gzip_static on` (docker/nginx-default.conf)
        // instead of compressing on every request. The originals stay in
        // place — index.html and the SW precache reference them — and the
        // precache skips the siblings via globIgnores (see
        // pwa.extendInjectManifestOptions). Web (pwa/spa) builds only:
        // the Capacitor/APK bundle would carry dead weight and SSR output
        // is not served by nginx.
        //
        // SAFETY INVARIANT — only deployment-invariant bytes may be
        // precompressed: replace_vars rewrites @@VAR@@ placeholders in
        // *.js/*.css/*.html/*.json at container start (docker/entrypoint.sh)
        // but never touches .gz/.br siblings, while nginx gzip_static
        // PREFERS the sibling. env.js (hardcoded @@ placeholders),
        // index.html (mutated by the staging noindex sed) and
        // manifest.json (@@WODORE_APP_NAME@@) are therefore excluded —
        // html/json by the include filter, env.js explicitly. Hashed
        // chunks/sw.js only bake build-time constants
        // (WODORE_APP_VERSION/WODORE_GIT_HASH); NEVER add static
        // `process.env.WODORE_*` references to volatile runtime vars in
        // src/ (use services/runtimeEnv.ts getEnv instead) — they would
        // bake @@ placeholders into hashed chunks whose precompressed
        // siblings would then serve stale values forever.
        if (ctx.modeName === 'pwa' || ctx.modeName === 'spa') {
          viteConf.plugins ??= [];
          viteConf.plugins.push(
            compression({
              include: [/\.(js|mjs|css|svg)$/],
              exclude: [/env\.js$/],
              algorithms: [['gzip', { level: 9 }], 'br'],
              deleteOriginalAssets: false,
            })
          );

          // Enforce the SAFETY INVARIANT above at build time: a hashed
          // js/css asset carrying an @@VAR@@ placeholder would get a
          // precompressed sibling that replace_vars never rewrites —
          // nginx gzip_static would then serve stale values forever.
          // Fail the build loudly instead of shipping the footgun.
          // env.js/index.html/manifest.json are not in assets/ and are
          // not scanned (they legitimately carry placeholders).
          let guardOutDir = 'dist';
          viteConf.plugins.push({
            name: 'wodore:assert-no-unrewritten-placeholders',
            apply: 'build',
            configResolved(config) {
              guardOutDir = config.build.outDir;
            },
            closeBundle() {
              const assetsDir = path.join(guardOutDir, 'assets');
              let files: string[];
              try {
                files = readdirSync(assetsDir);
              } catch {
                return; // no assets dir — nothing to assert
              }
              const offenders = files
                .filter(f => /\.(js|mjs|css)$/.test(f))
                // Mirror replace_vars' exact placeholder shape (@@KEY@@);
                // bare '@@' literals are legitimate code (placeholder
                // checks, @@iterator/@@toPrimitive polyfills).
                .filter(f =>
                  /@@[A-Za-z0-9_]+@@/.test(readFileSync(path.join(assetsDir, f), 'utf8'))
                );
              if (offenders.length > 0) {
                throw new Error(
                  'Build invariant violated: hashed assets contain unrewritten @@VAR@@ ' +
                    `placeholders (their stale .gz/.br siblings would be served forever by ` +
                    `nginx gzip_static): ${offenders.join(', ')}. Use ` +
                    'services/runtimeEnv.ts getEnv for volatile values instead of static ' +
                    'process.env reads in src/.'
                );
              }
            },
          });
        }
      },
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
        // Disabled: deeply nested MapLibre store types crash the dev checker
        // [
        //   'vite-plugin-checker',
        //   {
        //     vueTsc: { tsconfigPath: 'tsconfig.vue-tsc.json' },
        //     eslint: { lintCommand: 'eslint "./**/*.{js,ts,mjs,cjs,vue}"', useFlatConfig: true },
        //   },
        //   { server: false },
        // ],
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
      // Dev host allowlist: see extendViteConf → WODORE_DEV_ALLOWED_HOSTS
      // (set in .env.local, e.g. a Tailscale MagicDNS name; unset =
      // localhost only, IPs always allowed).
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
      plugins: ['Dark', 'Notify', 'Dialog', 'LocalStorage', 'Meta'],
      config: {
        // Light default; the theme boot applies the persisted setting
        // ('light' | 'dark' | 'auto' in user settings).
        dark: false,

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
        // This allows the NavigationRoute with NetworkFirst to handle it.
        // Same for env.js (runtime env, rewritten at container start):
        // a precached env.js would serve stale env values to offline/PWA
        // clients — it must always come from the network (no-store).
        // Source maps too: they exist for Sentry symbolication and
        // devtools, not for app runtime — precaching them would make
        // every PWA install download the full map payload. Same for the
        // precompressed .gz/.br siblings (see extendViteConf →
        // vite-plugin-compression2): the precache must reference the
        // original files — caching both doubles the download and defeats
        // nginx gzip_static.
        if (!options.globIgnores) {
          options.globIgnores = [];
        }
        options.globIgnores.push('index.html', 'env.js', '**/*.map', '**/*.gz', '**/*.br');
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

    // IDE / tool binaries. Android Studio is installed as a snap on this
    // machine, so Quasar cannot auto-detect a studio.sh tarball path.
    bin: {
      linuxAndroidStudio: '/snap/bin/android-studio',
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
