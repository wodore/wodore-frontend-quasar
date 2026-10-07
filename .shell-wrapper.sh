#!/usr/bin/env bash
set -eu -o pipefail
# just shell wrapper: source the console helpers, run from the repo root.
# Used both as just's shell (`set shell` in tasks/core.just) and as the
# shebang interpreter for multi-line recipes (`#! ./.shell-wrapper.sh`).
export TERM="${TERM:-xterm-256color}"
cd "$(dirname "$(readlink -f "$0")")"
source "tasks/shell-source.sh"
bash "$@"
