#!/bin/bash

# Help function
display_help() {
    echo "Usage: yarn release [options]"
    echo ""
    echo "Options:"
    echo "  -t, --add-tag    Add the new tag and push it to remote"
    echo "  -d, --dry        Show what would be done without making changes"
    echo "  -u, --unreleased Show only unreleased changes"
    echo "  -l, --length     Number of lines to show (mutual exclusive with --unreleased)"
    echo "  -n, --no-commit  Do not commit changes after editing"
    exit 0
}

# Parse arguments
ADD_TAG=false
DRY=false
UNRELEASED=true
LENGTH=-1
NO_COMMIT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--add-tag)
            ADD_TAG=true
            shift
            ;;
        -d|--dry)
            DRY=true
            shift
            ;;
        -u|--unreleased)
            UNRELEASED=true
            shift
            ;;
        -l|--length)
            LENGTH=$2
            UNRELEASED=false
            shift 2
            ;;
        -n|--no-commit)
            NO_COMMIT=true
            shift
            ;;
        -h|--help)
            display_help
            ;;
        *)
            echo "Unknown option: $1"
            display_help
            ;;
    esac
done

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is not set"
    echo "Please set GITHUB_TOKEN with a GitHub personal access token with repo access"
    exit 1
fi

# Get new tag using git-cliff directly from node_modules to avoid yarn output
NEW_TAG=$(./node_modules/.bin/git-cliff --bumped-version)
NEW_VERSION=${NEW_TAG//v/}

if [ "$DRY" = true ]; then
    if [ "$UNRELEASED" = true ] || [ "$LENGTH" -le 0 ]; then
        echo "Showing unreleased changes"
    else
        echo "Showing $LENGTH lines of changelog"
    fi
    
    echo "=== Changelog start ==="
    if [ "$UNRELEASED" = true ]; then
        ./node_modules/.bin/git-cliff --bump --unreleased
    else
        ./node_modules/.bin/git-cliff --bump | head -n $LENGTH
        echo "..."
    fi
    echo "=== Changelog end ==="
else
    # Update changelog and version
    ./node_modules/.bin/git-cliff --bump -u --prepend CHANGELOG.md
    
    # Open changelog in editor for review
    echo "Opening CHANGELOG.md in your editor for review..."
    ${EDITOR:-vi} CHANGELOG.md
    
    # Update package.json version
    yarn version --new-version $NEW_VERSION --no-git-tag-version
    
    if [ -n "$NEW_TAG" ]; then
        echo "Bumped to version '$NEW_VERSION' (tag '$NEW_TAG')."
        echo "Please check the entries in 'CHANGELOG.md' and update it accordingly."
        
        # Commit changes if not --no-commit
        if [ "$NO_COMMIT" = false ]; then
            echo ""
            echo "Changes to commit:" 
            echo "- CHANGELOG.md"
            echo "- package.json"
            echo ""
            read -p "Do you want to commit these changes? (y/n) " -n 1 -r
            echo    # (optional) move to a new line
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git add CHANGELOG.md package.json
                git commit -m "release: version $NEW_VERSION"
            else
                echo "Changes not committed. Please commit them manually if needed."
            fi
        fi
        
        if [ "$ADD_TAG" = true ]; then
            git tag -f "$NEW_TAG"
            git push origin "$NEW_TAG"
        fi
    else
        echo "Warning: Did not update to new version tag."
    fi
fi
