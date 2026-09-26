# Agent Guide

Quick reference when working on `wodore-frontend-quasar` (short `wodore-frontend` or `wd-frontend`).

**Note**: This file should be updated whenever important development information, patterns, or infrastructure details are discovered during work on the project.

## Important Development Rules

**DO NOT revert changes made by the user**: When the user has explicitly configured values (constants, icons, styling, etc.), do NOT change them back to what you think they should be.

## Specifications

Feature specifications and design guidelines are located in `docs/specs/`:

- `wd_design.md` - Design system, colors, typography, components
- `wd_hut_search.md` - Hut search feature specification
- Other feature specs as they are added

## PR Preview Workflow

PRs with the `PREVIEW` label get an automatic live preview on GitHub
Pages: `https://wodore.github.io/wodore-frontend-quasar/pr-<N>/`.

**After every push to a preview PR, ALWAYS:**

1. Wait for the `PR Preview` workflow to complete (`gh run watch`)
2. Verify the preview URL returns HTTP 200
3. Show the PR link and preview URL in your summary

```bash
gh run watch $(gh run list --workflow preview.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
curl -s -o /dev/null -w "%{http_code}" "https://wodore.github.io/wodore-frontend-quasar/pr-<N>/"
```

**Per-commit paths:** every build deploys to `pr-<N>/<short-sha>/` (see the
build list in the PR comment - newest first). These URLs are never
CDN-cached; `?ts=` busting is only needed for the legacy `pr-<N>/` root or
pages you have visited before:
`https://wodore.github.io/wodore-frontend-quasar/pr-<N>/<short-sha>/`

**Manual preview builds (when Actions lags):** `.env.local` OVERRIDES env
vars in quasar's dotenv (`override: file !== '.env'`) and would bake LAN/dev
values (192.168.x.x backend, `auth.burgdev.local.gd` -> 127.0.0.1) into the
deploy. Always hide it first:
`mv .env.local .env.local.bak && yarn build:pwa && mv .env.local.bak .env.local`
and pass the full CI env set (staging API/tiles/imagor, empty OIDC vars).

The preview builds with the staging API (`hub.stg.wodore.com`), hash
routing, and a QR-code PR comment. Repo variables/secrets needed:
`WODORE_IMAGOR_URL`, `WODORE_IMAGOR_KEY` (secret), `WODORE_MAPTILER_API_KEY`
(secret). A `404.html` on gh-pages redirects path URLs to the hash
router.

## Impeccable Design Skill

The repo carries the [impeccable](https://impeccable.style/) design skill
(`.claude/skills/impeccable/`, linked for other harnesses via
`.agents/skills/impeccable`, `.github/`, `.opencode/`). Update it with
`npx impeccable@latest install --project`; engine binaries under
`**/skills/impeccable/scripts/bin/` are gitignored (the launcher downloads
them per machine).

The design context files (`PRODUCT.md`, `DESIGN.md`) live in the
**wodore-design** repo, not here. They are linked via
`IMPECCABLE_CONTEXT_DIR`:

```bash
# sibling checkout of wodore-design (default local layout)
IMPECCABLE_CONTEXT_DIR=../wodore-design .claude/skills/impeccable/scripts/impeccable context

# or via the git submodule (after the design branch is merged to main and
# the submodule pointer is updated)
IMPECCABLE_CONTEXT_DIR=src/assets/wodore-design .claude/skills/impeccable/scripts/impeccable context
```

Any agent doing design work in this repo should load context that way before
critiquing or building UI.

## Essential Commands

Use `yarn run` command. Check `package.json` for details.

### Development

```bash
# Install dependencies
yarn

# Generate assets (API client, icons, favicons)
yarn gen:api          # OpenAPI client from backend
yarn gen:api-local    # OpenAPI client from local backend
yarn gen:icons        # Custom wd icons from SVG files
yarn gen:favs         # Favicons from icongenie

# Development server (default: PWA mode on port 9000)
yarn dev              # or yarn dev:pwa
yarn dev:spa          # SPA mode
yarn dev:ssr          # SSR mode

# Build for production
yarn build            # or yarn build:pwa
yarn build:spa        # SPA build
yarn build:ssr        # SSR build

# Serve production build locally
yarn serve            # or yarn serve:pwa
yarn serve:spa
yarn serve:ssr

# Code quality
yarn lint             # Check code
yarn lint:fix         # Fix linting issues
yarn format           # Format with Prettier

# Component development (Histoire)
yarn story:dev        # Start Histoire dev server
yarn story:build      # Build static Histoire site
yarn story:preview    # Preview built Histoire site
```

### Testing

```bash
# Unit tests (Vitest) — run in CI on every PR, Allure report posted to the PR
yarn test:unit            # run once
yarn test:unit:watch      # watch mode
yarn test:unit:coverage   # with coverage

# E2E smoke suite (Playwright) — LOCAL ONLY, never in CI
yarn dev                  # 1. start the dev server (required!)
yarn test:e2e             # 2. run the suite (mobile-chrome project)

# Allure reports
yarn allure:generate      # merge unit + e2e results, generate report
yarn allure:open          # open the generated report in a browser
yarn allure:clean         # remove all results and reports
```

**Test structure**: `tests/unit/` (Vitest, node env; store specs use happy-dom via a
`// @vitest-environment happy-dom` docblock) and `tests/e2e/` (Playwright).

**Test structure**: `tests/unit/` (Vitest, node env; store specs use happy-dom via a
`// @vitest-environment happy-dom` docblock) and `tests/e2e/` (Playwright).

**Dev server ports & worktree testing**: Quasar's PWA mode defaults to port **9200**
when no port is passed — always pass one explicitly: `yarn dev:pwa -p 9000`. When
working in git worktrees (parallel branches/PRs), use ports **9001-9010** so multiple
dev servers can run side by side. Note:
`.env.local` is gitignored and does not propagate to new worktrees — copy it
from the main checkout, or API hosts / map keys will be missing. Also run
`git submodule update --init` in new worktrees — `src/assets/wodore-design`
(the map/overlay icon assets) is a submodule; without it the overlay and
map-picker icons 404.

**Status reporting convention**: when a dev server is running, always tell the
user where it is (full URL and which branch it serves). Always show active PRs
in the summary as markdown links (e.g. `[PR #138](…/pull/138)`).

**E2E preconditions**: dev server on `http://localhost:9000` (`yarn dev`) and a reachable
backend (`E2E_API_HOST`, default `http://127.0.0.1:8000`). The hut deep-link test uses
`E2E_HUT_SLUG` (default `aarbiwak`) and skips when the hut is not found. E2E is
intentionally not part of CI (deterministic CI is handled by the unit suite).

**CI**: `.github/workflows/test.yml` runs the unit suite on every PR and posts the Allure
report via `allure-framework/allure-action` (same pattern as wodore-backend).

**IMPORTANT**: Always run both `yarn lint` and `npx vue-tsc --noEmit` after making code changes to verify there are no ESLint warnings or TypeScript errors before committing.

**CRITICAL**: Check ESLint for all modified files to catch:

- Unused imports (e.g., `Platform` imported but never used)
- Unused variables in catch blocks (use empty `catch {}` for silent error handling)
- Other code quality issues

Example ESLint check for specific files:

```bash
npx eslint src/stores/user-settings-store.ts src/stores/local-properties-store.ts
```

## Related Projects

The Wodore ecosystem consists of multiple repositories:

- **Frontend** (this repository): `wodore-frontend-quasar/` - Quasar/Vue.js frontend application
- **Backend**: `../wodore-backend/` - Django/Django-Ninja backend
- **Hut Services (Public)**: `../hut-services/` - Public library for hut information schemas and base services
- **Hut Services (Private)**: `../hut-services-private/` - Private implementations for external booking services (HRS, SAC, etc.)

All paths are relative to the repository root (`wodore-frontend-quasar/`).

## Project Structure

```
wodore-frontend-quasar/
├── docs/
│   └── specs/               # Feature specifications and design docs
├── stories/                 # Histoire component stories
│   ├── components/          # Component stories (mirrors src/components/)
│   └── README.md            # Stories documentation
├── src/
│   ├── assets/              # Static assets (images, icons, etc.)
│   ├── boot/                # Quasar boot files (loaded before app starts)
│   ├── clients/             # Generated API clients (openapi-ts)
│   ├── components/          # Vue components
│   ├── composables/         # Vue composition functions
│   ├── css/                 # Global styles
│   ├── extras/              # Extra resources
│   │   └── icons/           # Custom icon generation
│   ├── i18n/                # Internationalization
│   ├── layouts/             # Page layouts
│   ├── pages/               # Route pages
│   ├── router/              # Vue Router configuration
│   ├── services/            # Business logic and services
│   ├── stores/              # Pinia stores (state management)
│   ├── types/               # TypeScript type definitions
│   ├── histoire-setup.ts    # Histoire configuration/setup
│   ├── App.vue              # Root component
│   └── env.d.ts             # Environment type definitions
├── src-pwa/                 # PWA-specific files
├── scripts/                 # Build and deployment scripts
├── docker/                  # Docker-related files
├── .env                     # Environment variables (committed)
├── .env.local               # Local overrides (gitignored)
├── .env.[dev|prod]          # Environment-specific vars
├── histoire.config.ts       # Histoire configuration
├── quasar.config.ts         # Quasar framework configuration
├── Dockerfile               # Multi-stage Docker build
└── package.json             # Dependencies and scripts
```

## API Documentation

OpenAPI schema available at:

- **Local**: <http://localhost:8000/v1/openapi.json>
- **Production**: <https://hub.wodore.com> (may not be up-to-date during development)

Generate TypeScript types from OpenAPI schema:

```bash
yarn gen:api        # Production API
yarn gen:api-local  # Local development API
```

## Tech Stack

### Core Framework

- **Framework**: [Vue 3](https://vuejs.org/) with [Quasar Framework](https://quasar.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: TypeScript
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **i18n**: [Vue I18n](https://vue-i18n.intlify.dev/)

**Specialized Agents Available:**

- **quasar agent** (`.claude/agents/quasar.md`) - Quasar components, styling, theming
- **vueuse agent** (`.claude/agents/vueuse.md`) - VueUse composables and utilities
- **iconify agent** (`.claude/agents/iconify.md`) - Icon selection and implementation
- **maplibre agent** (`.claude/agents/maplibre.md`) - MapLibre GL implementation
- **code-review agent** (`.claude/agents/code-review.md`) - Code review and best practices

### Key Libraries

- **API Client**: [openapi-fetch](https://openapi-ts.pages.dev/) with auto-generated types
- **Maps**: [MapLibre GL](https://maplibre.org/) with [vue-maplibre-gl](https://github.com/indoorequal/vue-maplibre-gl)
- **Authentication**: [oidc-client-ts](https://github.com/authts/oidc-client-ts) (Zitadel)
- **Payments**: [Stripe](https://stripe.com/) with [@vue-stripe/vue-stripe](https://vuestripe.com/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Utilities**: [@vueuse/core](https://vueuse.org/)

### Development Tools

- **Package Manager**: Yarn
- **Linting**: ESLint with TypeScript and Vue plugins
- **Formatting**: Prettier
- **Component Development**: [Histoire](https://histoire.dev/) - Component story/playground tool
- **Icons**:
  - [Quasar Icons](https://quasar.dev/vue-components/icon) (Material Icons, etc.)
  - Custom `wd` icons via [Fantasticon](https://github.com/tancredi/fantasticon)
  - [Iconify](https://iconify.design/) via [unplugin-icons](https://github.com/unplugin/unplugin-icons)
- **Favicons**: [Icongenie](https://quasar.dev/icongenie/introduction/)

## Infrastructure

### Docker Compose Services

Services are defined in `../wodore-backend/docker-compose.yml`:

- Imagor (Image Processing)

## Environment Variables

Environment files are loaded in this order (later files override earlier ones):

1. `.env` - Base configuration (committed to git)
2. `.env.local` - Local overrides (gitignored)
3. `.env.[dev|prod]` - Environment-specific (committed)
4. `.env.local.[dev|prod]` - Local environment overrides (gitignored)

### Key Variables

See `.env` file for all available variables

## Common Patterns

### i18n / Language Switch

- Supported UI languages: `de`, `en`, `fr`, `it` (see `src/i18n/index.ts`; German is the master message schema, English is the fallback locale).
- First visit: the system/browser language is detected (`detectSystemLocale`, English fallback) and persisted; a manually selected language always wins. The active locale is persisted in the user settings store (`ui.language`, localStorage `wodore:userSettings`) — never in the URL.
- `src/services/locale.ts` owns the vue-i18n instance: `setLocale()` switches vue-i18n + Quasar lang pack + persists the setting; `currentLocale()` is the reactive read.
- Localized API calls pass `lang: currentLocale()` (the backend supports `lang` on data endpoints with fallback).
- Stores/components holding localized remote data watch `currentLocale` and refetch on language change.
- User-visible strings belong in `src/i18n/locales/*.json`; all four files must keep an identical key set (de.json is the master schema — vue-i18n typing flags drift).

### Best Practices

**IMPORTANT Development Guidelines:**

1. **Use VueUse composables whenever possible**: The project uses `@vueuse/core` extensively. Before implementing manual solutions (timers, watchers, event listeners, etc.), check if VueUse provides a composable for that use case.
   - Examples: `useDebounceFn`, `useThrottleFn`, `useLocalStorage`, `useIntersectionObserver`, `useEventListener`, etc.
   - See: <https://vueuse.org/>

2. **Prefer Quasar components without manual modifications**: Use Quasar's built-in components and props as much as possible. Avoid adding custom styles or HTML unless absolutely necessary for specific custom functionality.
   - Quasar provides extensive theming and styling options through props and CSS variables
   - Only add custom styles when implementing truly unique designs not covered by Quasar

3. **Minimize custom styling**: Keep custom CSS/SCSS to a minimum. Only add styles when:
   - Implementing custom brand-specific designs
   - Working with unique layouts not provided by Quasar
   - Fine-tuning specific edge cases

### Icons

The project uses a custom icon system based on `wd` prefixed icons.

**When you need to find or add an icon, use the iconify agent** (`.claude/agents/iconify.md`).

The iconify agent will:

- Search existing custom `wd` icons first
- Download and integrate new icons from Iconify if needed
- Verify icon licenses (MIT, Apache 2.0, CC0 only)
- Provide implementation guidance

Quick syntax reference:

```vue
<q-icon name="wd-add-outline" />
<!-- Custom wd icon (preferred) -->
<q-icon name="add" />
<!-- Quasar built-in -->
```

See `.claude/agents/iconify.md` for detailed workflow and usage examples.

**Icon-name / CSS-class namespace**: every icon generates a `.wd-<name>:before`
glyph rule. Never give a non-icon element a class named like an icon
(`wd-menu` on a card collides with the `wd-menu` icon). `yarn gen:icons`
post-runs `scripts/scope-icon-selectors.mjs`, which scopes glyph rules to
`<i>` elements and warns about class collisions — treat its warnings as
rename requests. Legacy collisions are guarded with `:not(i)` in `app.scss`.

### CSS and Styling

#### Quasar Color System

Quasar provides a comprehensive color system. The project extends it in `src/css/app.scss`:

```vue
<!-- Use Quasar color classes -->
<div class="text-primary bg-secondary">...</div>
<div class="text-positive bg-negative">...</div>

<!-- Custom shade classes (100-900) -->
<div class="text-primary-700 bg-accent-100">...</div>
<div class="bg-white text-black">...</div>

<!-- Custom effects -->
<div class="text-primary--halo">Text with halo effect</div>
```

### Components

#### Naming

Use PascalCase for component files and registration:

```
WdHutCard.vue
```

### State Management (Pinia)

Stores are located in `src/stores/`:

```typescript
// In a component
import { useAuthStore } from 'stores/auth-store';
import { useHutsStore } from 'stores/huts-store';

const authStore = useAuthStore();
const hutsStore = useHutsStore();
```

### API Calls

Use the auto-generated OpenAPI client:

```typescript
import createClient from 'openapi-fetch';
import type { paths } from 'clients/wodore_v1';

const client = createClient<paths>({ baseUrl: 'https://api.wodore.com' });

// Type-safe API calls
const { data, error } = await client.GET('/v1/huts/{id}', {
  params: { path: { id: '123' } },
});
```

### Routing

Router configuration in `src/router/`:

```typescript
// Use router in components
import { useRouter } from 'vue-router';

const router = useRouter();
router.push({ name: 'hut-detail', params: { id: '123' } });
```

## Troubleshooting

### Common Issues

1. **API Types Not Updating**: Run `yarn gen:api-local` after backend changes
2. **Icons Not Showing**: Run `yarn gen:icons` after adding SVG files
3. **Environment Variables Not Working**: Check `quasar.config.ts` env section and restart dev server
4. **Docker Build Fails**: Ensure `GIT_HASH` build arg is provided
5. **Authentication Issues**: Check OIDC configuration in `.env.local`

## Additional Resources

- [Wodore API Docs](https://hub.wodore.com/v1/docs)
- [Backend Repository](https://github.com/wodore/wodore-backend)
- [Quasar Documentation](https://quasar.dev/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [vue-maplibre-gl](https://indoorequal.github.io/vue-maplibre-gl/)
