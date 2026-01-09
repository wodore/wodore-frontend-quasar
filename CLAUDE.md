# Claude Development Guide

Quick reference for Claude when working on `wodore-frontend-quasar` (short `wodore-frontend` or `wd-frontend`).

**Note**: This file should be updated whenever important development information, patterns, or infrastructure details are discovered during work on the project.

## Related Projects

The Wodore ecosystem consists of multiple repositories:

- **Frontend** (this repository): `wodore-frontend-quasar/` - Quasar/Vue.js frontend application
- **Backend**: `../wodore-backend/` - Django/Django-Ninja backend
- **Hut Services (Public)**: `../hut-services/` - Public library for hut information schemas and base services
- **Hut Services (Private)**: `../hut-services-private/` - Private implementations for external booking services (HRS, SAC, etc.)

All paths are relative to the repository root (`wodore-frontend-quasar/`).

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

**IMPORTANT**: Always run `yarn lint` after making code changes to verify there are no errors or warnings before committing.

### Docker

```bash
# Build Docker image (includes git hash)
yarn docker:build

# Run with different env configurations
yarn docker:run-dev   # Uses .env + .env.local + .env.dev + .env.local.dev
yarn docker:run-prod  # Uses .env + .env.local + .env.prod + .env.local.prod
yarn docker:run-env   # Uses .env only

# Publish to GitHub Container Registry
yarn docker:publish   # Publish edge tag
yarn release          # Create versioned release (see scripts/release.sh)
```

## Project Structure

```
wodore-frontend-quasar/
├── docs/
│   └── specs/               # Feature specifications and design docs
├── src/
│   ├── assets/              # Static assets (images, icons, etc.)
│   │   ├── icongenie/       # Favicon source files
│   │   ├── stock_images/    # Stock images
│   │   └── wodore-design/   # Design assets
│   ├── boot/                # Quasar boot files (loaded before app starts)
│   │   ├── auth.ts          # Authentication setup
│   │   ├── axios.ts         # Axios configuration
│   │   ├── i18n.ts          # Internationalization
│   │   ├── icons.ts         # Icon configuration
│   │   ├── maplibre.ts      # MapLibre GL setup
│   │   └── vue-stripe.ts    # Stripe integration
│   ├── clients/             # Generated API clients (openapi-ts)
│   │   └── wodore_v1.d.ts   # Auto-generated from backend OpenAPI
│   ├── components/          # Vue components
│   │   ├── feedback/        # User feedback components
│   │   ├── huts/            # Hut-related components
│   │   ├── map/             # Map components
│   │   ├── quasar/          # Quasar component extensions
│   │   ├── support/         # Support components
│   │   ├── toolbar/         # Toolbar components
│   │   ├── utils/           # Utility components
│   │   └── wodore/          # Wodore-specific components
│   ├── composables/         # Vue composition functions
│   │   └── useAuthService.ts
│   ├── css/                 # Global styles
│   │   └── app.scss         # Main SCSS file with custom utilities
│   ├── extras/              # Extra resources
│   │   └── icons/           # Custom icon generation
│   │       ├── svg/source/  # Source SVG files (add-outline.svg, etc.)
│   │       ├── svg/build/   # Fixed SVG files (auto-generated)
│   │       └── dist/        # Generated icon font (fantasticon)
│   ├── i18n/                # Internationalization
│   │   └── locales/         # Translation files
│   ├── layouts/             # Page layouts
│   ├── pages/               # Route pages
│   │   └── auth/            # Authentication pages
│   ├── router/              # Vue Router configuration
│   ├── services/            # Business logic and services
│   ├── stores/              # Pinia stores (state management)
│   │   ├── auth-store.ts    # Authentication state
│   │   ├── huts-store.ts    # Huts data state
│   │   └── map/             # Map-related stores
│   ├── types/               # TypeScript type definitions
│   ├── App.vue              # Root component
│   └── env.d.ts             # Environment type definitions
├── src-pwa/                 # PWA-specific files
│   ├── manifest.json        # PWA manifest
│   └── tsconfig.json        # PWA TypeScript config
├── scripts/                 # Build and deployment scripts
│   ├── check-git-status.sh
│   ├── docker-publish.sh
│   └── release.sh
├── docker/                  # Docker-related files
│   └── replace_vars.go      # Environment variable replacement
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

#### Imagor (Image Processing)

```bash
# Service name: imagor
# Container: django-local-imagor
# Image: shumc/imagor:latest
# Port: 8079 (host network mode)

# Configuration
- Base URL: http://localhost:8079
- Unsafe mode enabled (for testing)
- Auto WebP/AVIF conversion enabled
- Secret key: IMAGOR_KEY from env (default: my_key)

# Volumes
- ./media → /mnt/data/source/media (source images)
- ./media/imagor_data/storage → /mnt/data/storage (cached images)
- ./media/imagor_data/result → /mnt/data/result (processed results)

# URL format: /unsafe/{params}/{path}
# Example: /unsafe/300x200/media/huts/image.jpg
```

**Note**: Use `docker compose` (not `docker-compose`) for all commands.

### Backend Services

The frontend requires the following backend services to be running:

1. **Django Backend** (port 8000): API server
2. **PostgreSQL with PostGIS**: Database (via docker compose in backend)
3. **Imagor** (port 8079): Image processing (via docker compose in backend)

Start backend services:

```bash
cd ../wodore-backend
source .venv/bin/activate
inv docker-compose -c "up -d"  # Start PostgreSQL and Imagor
app migrate                     # Apply database migrations
app run -p 8000                # Start Django server
```

## Environment Variables

Environment files are loaded in this order (later files override earlier ones):

1. `.env` - Base configuration (committed to git)
2. `.env.local` - Local overrides (gitignored)
3. `.env.[dev|prod]` - Environment-specific (committed)
4. `.env.local.[dev|prod]` - Local environment overrides (gitignored)

### Key Variables

See `.env` file for all available variables. Important ones:

```bash
# Domain and URL
WODORE_DOMAIN=localhost:9000
WODORE_URL=http://localhost:9000

# Backend API
WODORE_API_HOST=http://127.0.0.1:8000
WODORE_API_VERSION=v1

# Image Processing (Imagor)
WODORE_IMAGOR_KEY=my_key
WODORE_IMAGOR_URL=http://127.0.0.1:8079
WODORE_IMAGOR_REPLACE_API_HOST_MEDIA=disabled

# Authentication (Zitadel OIDC)
WODORE_OICD_ISSUER_URL=
WODORE_OICD_CLIENT_ID=
WODORE_OICD_RESOURCE_ID=

# Maps
WODORE_MAPTILER_API_KEY=get_maptiler_key

# Analytics (Umami)
WODORE_UMAMI_WEBSITE_ID=
WODORE_UMAMI_WEBSITE_URL=

# Payments
WODORE_STRIPE_ID=StripeID
```

### Production/Docker Deployment

- **GIT_HASH**: Set this build argument when building Docker images to include git version info.

```bash
docker build --build-arg GIT_HASH=$(git rev-parse --short HEAD) -t wodore-frontend .
```

## Common Patterns

### Icons

The project uses multiple icon systems:

#### 1. Quasar Built-in Icons

```vue
<q-icon name="add" />
<!-- Material Icons -->
<q-icon name="fas fa-home" />
<!-- Font Awesome -->
<q-icon name="img:path/to/icon.svg" />
<!-- Custom SVG -->
```

#### 2. Custom `wd` Icons (Fantasticon)

Add SVG files to `src/extras/icons/svg/source/` and run `yarn gen:icons`:

```vue
<q-icon name="wd-add-outline" />
<q-icon name="wd-favorite" />
<q-icon name="wd-calendar" />
```

Available custom icons: add-outline, add, arrowhead-\*, arrow-up-down, at, bell-outline, bell, calendar, checkmark, close, edit-outline, edit, eye-outline, eye, favorite-outline, favorite, gift, info-outline, info, link, location-question, menu-arrow, menu, message, more-vertical, question-mark, subject, text-outline

#### 3. Iconify Icons (Unplugin Icons)

Auto-imported from any Iconify collection:

```vue
<i-mdi-home />
<i-carbon-arrow-right />
```

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

#### SCSS Variables

Access Quasar's SCSS variables and functions:

```scss
// In .vue files or .scss files
.my-component {
  color: color('primary');
  background: color('accent', 500);
}
```

### Components

#### Component Organization

- `components/huts/` - Hut display, cards, details
- `components/map/` - Map components, controls, layers
- `components/feedback/` - User feedback, notifications
- `components/toolbar/` - Toolbar and navigation
- `components/utils/` - Reusable utilities
- `components/wodore/` - Brand-specific components

#### Component Naming

Use PascalCase for component files and registration:

```
WdHutCard.vue
WdMapControl.vue
WdUserAvatar.vue
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

### Authentication

Uses OIDC (Zitadel) via `oidc-client-ts`:

```typescript
import { useAuthStore } from 'stores/auth-store';

const auth = useAuthStore();

// Check if authenticated
if (auth.isAuthenticated) {
  // Access user info
  console.log(auth.user);
}

// Login/logout
await auth.login();
await auth.logout();
```

### Routing

Router configuration in `src/router/`:

```typescript
// Use router in components
import { useRouter } from 'vue-router';

const router = useRouter();
router.push({ name: 'hut-detail', params: { id: '123' } });
```

## Development Workflow

### Adding a New Feature

1. Create components in appropriate `src/components/` subdirectory
2. Add types to `src/types/` if needed
3. Create/update store in `src/stores/` for state management
4. Add services to `src/services/` for business logic
5. Update router in `src/router/` if new pages are needed
6. Add translations to `src/i18n/locales/`

### Updating API Types

When backend API changes:

```bash
# Make sure backend is running locally
cd ../wodore-backend
app run -p 8000

# In frontend project
yarn gen:api-local
```

### Adding Custom Icons

1. Add SVG file to `src/extras/icons/svg/source/`
2. Run `yarn gen:icons` to generate icon font
3. Use in components: `<q-icon name="wd-your-icon" />`

### Building for Production

```bash
# Build
yarn build

# Test locally
yarn serve

# Build and publish Docker image
yarn docker:build
yarn docker:publish
```

## Troubleshooting

### Common Issues

1. **API Types Not Updating**: Run `yarn gen:api-local` after backend changes
2. **Icons Not Showing**: Run `yarn gen:icons` after adding SVG files
3. **Environment Variables Not Working**: Check `quasar.config.ts` env section and restart dev server
4. **Docker Build Fails**: Ensure `GIT_HASH` build arg is provided
5. **Authentication Issues**: Check OIDC configuration in `.env.local`

### Development Tips

- Use `console.log()` sparingly; prefer Vue DevTools for debugging
- Use TypeScript strictly - avoid `any` types
- Follow Vue 3 Composition API patterns
- Use Quasar components when possible before creating custom ones
- Keep components small and focused (Single Responsibility Principle)

## Additional Resources

- [Wodore API Docs](https://hub.wodore.com/v1/docs)
- [Backend Repository](https://github.com/wodore/wodore-backend)
- [Quasar Documentation](https://quasar.dev/docs)
- [Vue 3 Documentation](https://vuejs.org/)
- [MapLibre GL Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [vue-maplibre-gl](https://indoorequal.github.io/vue-maplibre-gl/)
