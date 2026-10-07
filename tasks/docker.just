import 'core.just'

# ❓ Show help for the docker tasks
[private]
help:
    @just-list docker

# 🐳 Build the production Docker image (GIT_HASH stamped)
[default]
build:
    #! ./.shell-wrapper.sh
    header "Docker build"
    pnpm docker:build
    success "Image built: wodore-frontend"

# 🐳 Build with plain progress output (debug layer cache)
build-plain:
    #! ./.shell-wrapper.sh
    header "Docker build (plain)"
    pnpm docker:build-plain

# ▶️  Run the image against merged local env (.env + .env.local[.dev])
run-dev:
    #! ./.shell-wrapper.sh
    header "Docker run (dev env, port 9002)"
    pnpm docker:run-dev

# ▶️  Run the image against merged prod env
run-prod:
    #! ./.shell-wrapper.sh
    header "Docker run (prod env, port 9003)"
    pnpm docker:run-prod

# 📤 Build + tag + publish to ghcr.io (edge-pwa)
publish:
    #! ./.shell-wrapper.sh
    header "Docker publish"
    pnpm docker:publish
    success "Published: ghcr.io/wodore/wodore-frontend-quasar:edge-pwa"
