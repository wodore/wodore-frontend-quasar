import 'core.just'

# ❓ Show help for the test tasks
[private]
help:
    @just-list tests

# 📋 Run unit tests (usage: just tests tests cov=yes)
[default]
tests cov="no":
    #! ./.shell-wrapper.sh
    header "Unit tests"
    if [[ "$(is_true "{{cov}}")" == "true" ]]; then
        pnpm test:unit:coverage
    else
        pnpm test:unit
    fi
    success "Unit tests passed"

# 👀 Run unit tests in watch mode
watch:
    #! ./.shell-wrapper.sh
    header "Unit tests (watch)"
    pnpm test:unit:watch

# 🎭 Run interaction tests (LOCAL ONLY — needs a dev server + backend)
interaction:
    #! ./.shell-wrapper.sh
    header "Interaction tests (local only)"
    warn "Requires a running dev server (just dev) — never runs in CI"
    pnpm test:interaction

# 🚀 Run the full e2e suite (LOCAL ONLY)
e2e:
    #! ./.shell-wrapper.sh
    header "e2e tests (local only)"
    warn "Requires a running dev server (just dev) — never runs in CI"
    pnpm test:e2e

# 📸 Update visual-regression snapshots (LOCAL ONLY)
snapshots:
    #! ./.shell-wrapper.sh
    header "Visual regression snapshots (local only)"
    pnpm test:snapshots-update
