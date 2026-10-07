import 'core.just'

# ❓ Show help for the check tasks
[private]
help:
    @just-list check

# ▶️  Run all checks: lint + format + types
[default]
all: lint format-check types
    @info "All checks passed"

# 🧹 Lint (eslint + radius ramp check)
lint:
    #! ./.shell-wrapper.sh
    header "Lint"
    pnpm lint
    success "Lint passed"

# 🪄 Auto-fix lint issues
lint-fix:
    #! ./.shell-wrapper.sh
    header "Lint (fix)"
    pnpm lint:fix
    success "Lint fixes applied"

# 🎨 Check formatting (prettier)
format-check:
    #! ./.shell-wrapper.sh
    header "Format check"
    pnpm run format -- --check
    success "Formatting OK"

# 🪄 Format with prettier (write)
format:
    #! ./.shell-wrapper.sh
    header "Format (write)"
    pnpm format
    success "Formatted"

# 🔍 Static type checking (vue-tsc)
types:
    #! ./.shell-wrapper.sh
    header "Type check"
    pnpm exec vue-tsc --noEmit
    success "Types OK"
