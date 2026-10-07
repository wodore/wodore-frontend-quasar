# Wodore frontend — task façade over package.json scripts (pnpm).
#
# `just` is optional ergonomics for humans and agents; CI, Docker and workz
# call pnpm directly. package.json scripts remain the source of truth —
# recipes here are thin one-liners, never a second implementation.

# List recipes
default:
    @just --list

# Dev server (PWA). In a workz lane use scripts/lane-web.sh (port-guarded).
dev *ARGS:
    pnpm run dev {{ARGS}}

# Unit tests (Vitest)
test:
    pnpm test:unit

# Lint (+ radius ramp check)
lint:
    pnpm lint

# Lint with --fix
lint-fix:
    pnpm lint:fix

# Format check
format-check:
    pnpm run format -- --check

# Production PWA build
build:
    pnpm build:pwa

# Serve the production build locally
serve:
    pnpm serve

# Regenerate the API client from staging
gen-api:
    pnpm gen:api

# Regenerate the API client from the local backend (127.0.0.1:8000)
gen-api-local:
    pnpm gen:api-local

# Generate the custom icon set
icons:
    pnpm gen:icons

# Release chores (version bump via cliff + tagging)
release *ARGS:
    pnpm release {{ARGS}}
