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
```

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
│   ├── App.vue              # Root component
│   └── env.d.ts             # Environment type definitions
├── src-pwa/                 # PWA-specific files
├── scripts/                 # Build and deployment scripts
├── docker/                  # Docker-related files
├── .env                     # Environment variables (committed)
├── .env.local               # Local overrides (gitignored)
├── .env.[dev|prod]          # Environment-specific vars
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
