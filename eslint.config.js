import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-config-prettier';

export default [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      '_work/**',
      'scripts/interaction-suite.cjs',
      '**/dist/**',
      '**/src-capacitor/**',
      '**/src-cordova/**',
      '**/.quasar/**',
      '**/node_modules/**',
      '**/quasar.config.*.temporary.compiled*',
      // Test results and generated reports
      '**/allure-report/**',
      '**/allure-results/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/coverage/**',
      // Vendored impeccable design skill (installed via `npx impeccable install`)
      '**/.claude/skills/**',
      '**/.github/skills/**',
      '**/.opencode/skills/**',
      '**/.agents/skills/**',
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript config
  ...tseslint.configs.recommended,

  // Vue config
  ...vue.configs['flat/essential'],

  // App-specific overrides
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        PointerEvent: 'readonly',
        KeyboardEvent: 'readonly',
        WheelEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        AbortController: 'readonly',

        // Custom globals
        ga: 'readonly',
        cordova: 'readonly',
        __statics: 'readonly',
        __QUASAR_SSR__: 'readonly',
        __QUASAR_SSR_SERVER__: 'readonly',
        __QUASAR_SSR_CLIENT__: 'readonly',
        __QUASAR_SSR_PWA__: 'readonly',
        process: 'readonly',
        Capacitor: 'readonly',
        chrome: 'readonly',
      },
    },
    rules: {
      'prefer-promise-reject-errors': 'off',
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    },
  },

  // Vue files config - specific parser setup
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        parser: tsParser,
      },
      // Native fetch globals for .vue script blocks (perf/bundle-trim:
      // axios was replaced with fetch). Declared HERE, not in the base
      // block — a base-level `fetch` global collides with `/* global
      // fetch */` comments in .mjs scripts (no-redeclare).
      globals: {
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
        AbortSignal: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off',
      'vue/no-deprecated-slot-attribute': 'off',
    },
  },

  // TypeScript files config
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-unused-vars': 'off',
    },
  },

  // Selection entries boundary (OpenSpec add-place-interactions /
  // capability place-registry): entry modules are store-free DATA
  // modules. The cycle selection-store → registry → entries →
  // selection-store crashes at module-init under dev/HMR (Pinia setup
  // stores call useRouter() at init). Entries may import selection
  // types/taxonomy/map-layer-ids, generated client types, services and
  // lazy component barrels — never stores.
  {
    files: ['src/selection/entries/**/*.ts', 'src/selection/entries/**/*.vue'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@stores/*', '**/stores/*'],
              message:
                'Selection entries must be store-free (selection framework boundary) — fetchers/seeds/surface loaders only.',
            },
          ],
        },
      ],
    },
  },

  // Prettier config (must be last to override other configs)
  prettier,
];
