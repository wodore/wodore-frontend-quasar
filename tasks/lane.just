import 'core.just'

# ❓ Show help for the workz lane tasks
[private]
help:
    @just-list lane

# Workz agent-lane helpers — thin wrappers over scripts/lane-*.sh
# (AGENTS.md § Worktrees / workz). They read the lane's PORT from the
# workz-managed block in .env.local; workz is the only port allocator.

# 🔧 Provision this lane (venv-free equivalent: pnpm install; idempotent)
[default]
setup:
    #! ./.shell-wrapper.sh
    header "Lane setup"
    scripts/lane-setup.sh
    success "Lane ready — just lane web"

# 🌐 Lane dev server, guarded foreground (paseo service / workz run)
web:
    #! ./.shell-wrapper.sh
    scripts/lane-web.sh fg

# ▶️  Lane dev server, detached via workz run
start:
    #! ./.shell-wrapper.sh
    scripts/lane-web.sh start

# ⏹️  Stop the lane dev server (workz run --stop)
stop:
    #! ./.shell-wrapper.sh
    scripts/lane-web.sh stop

# 📊 Lane dev server status (port listening? ours? URL?)
status:
    #! ./.shell-wrapper.sh
    scripts/lane-web.sh status

# 📜 Tail the lane dev server logs (workz run --logs)
logs:
    #! ./.shell-wrapper.sh
    scripts/lane-web.sh logs

# 🧹 Lane teardown (dev server stop + workz reap; idempotent)
teardown:
    #! ./.shell-wrapper.sh
    header "Lane teardown"
    scripts/lane-teardown.sh
    success "Lane cleaned up"
