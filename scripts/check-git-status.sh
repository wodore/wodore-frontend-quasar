#!/bin/sh

# Check if there are any uncommitted changes
git_status=$(git status --porcelain)

if [ -n "$git_status" ]; then
    echo "Error: Git working directory is not clean. Please commit or stash your changes."
    echo "Current git status:"
    git status
    exit 1
fi

# Check if there are any untracked files
git_check_untracked=$(git status --porcelain -uall)

if [ -n "$git_check_untracked" ]; then
    echo "Error: There are untracked files. Please add them to git or add them to .gitignore."
    echo "Untracked files:"
    git status --porcelain -uall
    exit 1
fi

exit 0
