#!/usr/bin/env bash
# Idempotent lane teardown — the single cleanup entry shared by every host:
#
#   workz done   → .workz.toml [hooks] pre_done (before worktree removal)
#   paseo        → paseo.json worktree.teardown (workspace archive)
#   manual       → anytime; safe to re-run
#
# A frontend lane owns no database or containers — teardown is stopping the
# dev server and reaping anything else still bound to the lane's ports.
# The workz port allocation itself is reclaimed by `workz doctor --fix`
# once the worktree directory is gone.
set -euo pipefail
cd "$(dirname "$0")/.."

# Not a workz lane (no managed block)? Nothing to clean — exit clean.
if ! grep -q '^PORT=' .env.local 2>/dev/null; then
    echo "lane-teardown: no workz managed block in .env.local — nothing to clean up"
    exit 0
fi

scripts/lane-web.sh stop >/dev/null 2>&1 || true
workz reap -y >/dev/null 2>&1 || true
echo "lane-teardown: done (dev server stopped, ports reaped)"
