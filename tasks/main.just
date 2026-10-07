import 'core.just'

# ⚡ Code quality tasks (lint, fix, format, types, ...)
mod check
# 📋 Run tests (unit, watch, interaction, ...)
mod tests
# 🚀 Dev server, build, serve, Histoire
mod dev
# 📦 Project tasks (install, gen-api, icons, ...)
mod project
# 🐳 Docker tasks (build, publish, run, ...)
mod docker
# 🛣️ Workz agent-lane tasks (setup, web, teardown, ...)
mod lane

# ❓ Show help
[default]
help:
    #! ./.shell-wrapper.sh
    echo "Run tasks with 'just <group> <task> [params]' — or 'just <alias>'."
    echo ""
    echo "Examples:"
    echo "    just check               # lint + format check + types"
    echo "    just tests cov=yes       # unit tests with coverage"
    echo "    just dev mode=ssr        # dev server in another mode"
    echo "    just gen-api source=local"
    echo "    just lane status         # workz lane state"
    echo ""
    just-list

# 🔧 Alias for 'just project install'
[group('aliases')]
install:
    just project install

# 🚀 Alias for 'just project release'
[group('aliases')]
release *ARGS:
    just project release {{ARGS}}
