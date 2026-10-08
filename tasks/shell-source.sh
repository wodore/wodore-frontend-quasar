#!/usr/bin/env bash
# Console helpers for just recipes (see .shell-wrapper.sh).
# Ported from burgdev/cartoload (tasks/shell-source.sh), trimmed to what
# this repo uses. Format: \033[<attr>;<fg>m — 1=bold, 31=red, 32=green,
# 33=yellow, 34=blue, 36=cyan.

info()    { printf "\033[1;36minfo:\033[0m %s\n" "$1"; }   # bold cyan
success() { printf "\033[1;32mok:\033[0m %s\n" "$1"; }     # bold green
warn()    { printf "\033[1;33mwarn:\033[0m %s\n" "$1"; }   # bold yellow
error()   { printf "\033[1;31merror:\033[0m %s\n" "$1"; }  # bold red

# Header: 80 chars wide, text left-aligned, padded with '='
header() {
    local text="$1" total=80
    local padding_len=$(( total - 6 - ${#text} ))  # "==== " + " ===="
    (( padding_len < 0 )) && padding_len=0
    local padding
    padding=$(printf '=%.0s' $(seq 1 $padding_len))
    printf "\033[1;34m==== %s %s\033[0m\n" "$text" "$padding"
}

# Section: 80 chars wide, left-aligned, padded with '-'
section() {
    local text="$1" total=80
    local padding_len=$(( total - 4 - ${#text} - 4 ))  # "-- " + " --"
    (( padding_len < 0 )) && padding_len=0
    local padding
    padding=$(printf -- '-%.0s' $(seq 1 $padding_len))
    printf "\033[1;33m-- %s %s\033[0m\n" "$text" "$padding"
}

# Colored `just --list` (recipe name blue, group headers yellow)
just-list() {
    local args=("$@")
    BLUE="\033[34m" YELLOW="\033[33m" RESET="\033[0m"
    just --list "${args[@]}" --unsorted 2>/dev/null | tail -n +2 | awk \
        -v yellow="$YELLOW" -v blue="$BLUE" -v reset="$RESET" '
        {
          split($0, parts, "#")
          if ($1 ~ /:$/) { printf "%s%s%s\n", yellow, $0, reset }
          else if (length(parts) > 1) {
            sub(/^#/, "│", $0)
            printf "%s%s%s%s\n", parts[1], blue, parts[2], reset
          } else { print $0 }
        }'
}

is_true() {
    case "${1,,}" in y|yes|true|1|on) return 0 ;; *) return 1 ;; esac
}

is_false() {
    case "${1,,}" in n|no|false|0|off) return 0 ;; *) return 1 ;; esac
}

export -f info success warn error header section just-list is_true is_false
