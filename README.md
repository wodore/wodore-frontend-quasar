<h3 align="center"><b>Wodore Frontend</b></h3>
<p align="center">
  <a href="https://wodo.re"><img src="https://wodore.com/icons/icon-192x192.png?v=3" alt="Wodore Frontend" width="100" /></a>
</p>
<p align="center">
    <em><b><a href="https://wodo.re" style="color: inherit; text-decoration: none;">wodo.re</a></b> frontend application</em>
</p>
<p align="center">
    <b><a href="https://wodo.re">wodo.re</a></b>
    &#9679; <b><a href="https://hub.wodore.com/">hub.wodore.com</a></b> </br>
    <small><a href="https://github.com/wodore/wodore-frontend-quasar/pkgs/container/wodore-frontend-quasar">docker images</a>
    &ndash; <a href="https://hub.wodore.com/v1/docs">API docs</a></small>
</p><p>&nbsp;</p>

## Used Stack

#### Production

- [Vue 3](https://vuejs.org/) with [Quasar Framework](https://quasar.dev/) for the UI
- [Pinia](https://pinia.vuejs.org/) for state management
- [MapLibre GL](https://maplibre.org/) for interactive maps
- [OIDC Client](https://github.com/authts/oidc-client-ts) for authentication (Zitadel)
- [Stripe](https://stripe.com/) for payments
- [Nginx](https://nginx.org/) for serving static files in production

#### Dev Tools

- [Vite](https://vitejs.dev/) for build tooling
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [openapi-typescript](https://openapi-ts.pages.dev/) for API client generation
- [Yarn](https://yarnpkg.com/) for package management

## Development

### Initial Setup

Check [Prerequisites](#prerequisites) for required tools.

When first cloning the repository:

```bash
# Install dependencies
yarn

# Generate assets (API client, icons, favicons)
yarn gen:api-local  # Requires backend running on localhost:8000
yarn gen:icons      # Generate custom wd icons
yarn gen:favs       # Generate favicons
```

### Setup

Before starting development, ensure the backend services are running:

```bash
# In ../wodore-backend directory
source .venv/bin/activate
inv docker-compose -c "up -d"  # Start PostgreSQL and Imagor
app migrate                     # Apply database migrations
app run -p 8000                # Start Django backend
```

### Environment Configuration

Environment files are loaded in order (later files override earlier ones):

```bash
# .env                    - Base configuration (committed)
# .env.local              - Local overrides (gitignored)
# .env.dev                - Development-specific (committed)
# .env.local.dev          - Local dev overrides (gitignored)
```

Create your local environment file:

```bash
# Copy template
cp .env .env.local

# Edit environment variables
vim .env.local
```

Key environment variables:

```bash
WODORE_DOMAIN=localhost:9000
WODORE_API_HOST=http://127.0.0.1:8000
WODORE_IMAGOR_URL=http://127.0.0.1:8079
WODORE_MAPTILER_API_KEY=your_key_here
```

See `.env` for all available configuration options.

### Development Server

Start the development server (PWA mode by default):

```bash
yarn dev              # PWA mode on port 9000
# or
yarn dev:spa          # SPA mode
yarn dev:ssr          # SSR mode
```

The application will be available at [http://localhost:9000](http://localhost:9000).

### Generate Assets

The application uses several generated assets that need to be regenerated when their sources change:

#### API Client

Generate TypeScript types from the backend OpenAPI schema:

```bash
# From production API
yarn gen:api

# From local backend (recommended during development)
yarn gen:api-local
```

This creates type-safe API client definitions in `src/clients/wodore_v1.d.ts`.

#### Custom Icons

Add SVG files to `src/extras/icons/svg/source/` and generate icon font:

```bash
# One-time generation
yarn gen:icons

# Watch mode (regenerate on changes)
yarn gen:icons:watch
```

Use in components:

```vue
<q-icon name="wd-add-outline" />
<q-icon name="wd-favorite" />
```

#### Favicons

Generate favicons from source files in `src/assets/icongenie/`:

```bash
yarn gen:favs
```

## Build for Production

### Local Build

Build and test the production bundle locally:

```bash
# Build the application
yarn build            # PWA mode
# or
yarn build:spa        # SPA mode
yarn build:ssr        # SSR mode

# Serve the production build locally
yarn serve            # PWA mode on port 9000
```

The build output will be in `dist/pwa/` (or `dist/spa/`, `dist/ssr/`).

### Docker Build

Build and run the Docker container:

```bash
# Build image with git hash
yarn docker:build

# Run with different environment configurations
yarn docker:run-dev   # Development environment
yarn docker:run-prod  # Production environment
yarn docker:run-env   # Using .env only

# View built images
yarn docker:ls
```

Manual Docker build:

```bash
docker build -t wodore-frontend --build-arg GIT_HASH=$(git rev-parse --short HEAD) .

# Run with custom environment
docker run -p 9000:8080 \
  -e WODORE_DOMAIN=wodore.com \
  -e WODORE_API_HOST=https://hub.wodore.com \
  -e WODORE_IMAGOR_KEY=my_secret \
  -e WODORE_MAPTILER_API_KEY=your_key \
  wodore-frontend
```

### Publish Docker Image

Publish to GitHub Container Registry:

```bash
# Login to GitHub Container Registry
export DOCKER_GITHUB_TOKEN=your_token
echo $DOCKER_GITHUB_TOKEN | docker login ghcr.io -u GITHUB_USERNAME --password-stdin

# Publish edge tag
yarn docker:publish

# Create versioned release
yarn release
```

## Code Quality

Maintain code quality with linting and formatting:

```bash
# Check code with ESLint
yarn lint

# Fix linting issues automatically
yarn lint:fix

# Format code with Prettier
yarn format

# Run tests (when implemented)
yarn test
```

## Project Structure

```
src/
├── assets/              # Static assets (images, icons)
├── boot/                # Quasar boot files (loaded before app starts)
├── clients/             # Generated API clients (openapi-ts)
├── components/          # Vue components
│   ├── feedback/        # User feedback components
│   ├── huts/            # Hut-related components
│   ├── map/             # Map components
│   ├── toolbar/         # Toolbar components
│   └── ...
├── composables/         # Vue composition functions
├── css/                 # Global styles
├── extras/              # Extra resources (custom icons)
├── i18n/                # Internationalization
├── layouts/             # Page layouts
├── pages/               # Route pages
├── router/              # Vue Router configuration
├── services/            # Business logic and services
├── stores/              # Pinia stores (state management)
├── types/               # TypeScript type definitions
└── App.vue              # Root component
```

See [CLAUDE.md](CLAUDE.md) for detailed development guide.

## Deployment

### Environment Variables

Required environment variables for production:

- `WODORE_DOMAIN` - Domain name (e.g., `wodore.com`)
- `WODORE_URL` - Full URL with protocol (e.g., `https://wodore.com`)
- `WODORE_API_HOST` - Backend API URL (e.g., `https://hub.wodore.com`)
- `WODORE_IMAGOR_KEY` - Imagor secret key for image signing
- `WODORE_IMAGOR_URL` - Imagor service URL
- `WODORE_MAPTILER_API_KEY` - MapTiler API key
- `WODORE_OICD_ISSUER_URL` - OIDC issuer URL (Zitadel)
- `WODORE_OICD_CLIENT_ID` - OIDC client ID
- `WODORE_STRIPE_ID` - Stripe publishable key
- `WODORE_UMAMI_WEBSITE_ID` - Umami analytics website ID (optional)

### Docker Deployment

The application runs in a multi-stage Docker container:

1. **Stage 0**: Builds Go utility for environment variable replacement
2. **Stage 1**: Builds Quasar PWA application
3. **Stage 2**: Creates minimal Nginx-based production image

The container serves static files via Nginx and replaces environment variables at runtime.

## Prerequisites

Required development tools:

- `node` >= 18 (see `package.json`)
- `yarn` >= 1.21.1
- `docker` with `docker compose`
- Backend services (see `../wodore-backend/README.md`)

Recommended:

- `git`
- Code editor with Vue, TypeScript, and ESLint support (VS Code recommended)

## Related Documentation

- **Development Guide**: [CLAUDE.md](CLAUDE.md) - Comprehensive development patterns and guidelines
- **Backend**: [wodore-backend](https://github.com/wodore/wodore-backend)
- **API Docs**: [hub.wodore.com/v1/docs](https://hub.wodore.com/v1/docs)

## External Documentation

- [Quasar Framework](https://quasar.dev/docs)
- [Vue 3](https://vuejs.org/)
- [MapLibre GL](https://maplibre.org/maplibre-gl-js/docs/)
- [vue-maplibre-gl](https://indoorequal.github.io/vue-maplibre-gl/)
- [Pinia](https://pinia.vuejs.org/)
- [Vue Router](https://router.vuejs.org/)
