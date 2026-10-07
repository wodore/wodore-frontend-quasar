#!/usr/bin/env bash
# Idempotent lane provisioning — the single setup entry shared by every host:
#
#   workz start  → .workz.toml [hooks] post_start
#   paseo        → paseo.json worktree.setup (after `workz sync --isolated`)
#   pi agent     → lane step 1 (the global pi hook runs `workz sync
#                  --isolated`, which fires NO hooks)
#
# workz sync has already copied .env* from the main checkout, mirrored
# node_modules (node_modules = "copy") and allocated the port (managed
# block in .env.local). A `pnpm install --frozen-lockfile` on top is a
# fast no-op when in sync and reconciles drift when the lane's
# package.json/yarn.lock diverge from main's node_modules snapshot.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
    echo "lane-setup: no .env.local — run 'workz sync . --isolated' first (or: not a workz lane)" >&2
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    echo "lane-setup: pnpm not found on PATH" >&2
    exit 1
fi

pnpm install --frozen-lockfile

echo "lane-setup: ready — dev server: scripts/lane-web.sh fg|start (port $(sed -n 's/^PORT=//p' .env.local 2>/dev/null || true))"
