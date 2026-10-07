import 'core.just'

# ❓ Show help for the project tasks
[private]
help:
    @just-list project

# 🔧 Install dependencies (pnpm, frozen lockfile)
[default]
install:
    #! ./.shell-wrapper.sh
    header "Install dependencies"
    pnpm install --frozen-lockfile
    success "Dependencies installed"

# 🔢 Print the current project version
version:
    #! ./.shell-wrapper.sh
    node -p "require('./package.json').version"

# 🔄 Regenerate the API client (usage: just gen-api source=local — staging | local)
gen-api source="staging":
    #! ./.shell-wrapper.sh
    header "Generate API client ({{source}})"
    if [[ "{{source}}" == "local" ]]; then
        info "Target: local backend 127.0.0.1:8000 (must be running)"
        pnpm gen:api-local
    else
        info "Target: staging"
        pnpm gen:api
    fi
    success "API client generated"

# 🎨 Generate the custom icon set
icons:
    #! ./.shell-wrapper.sh
    header "Icon set"
    pnpm gen:icons
    success "Icons generated"

# 🖼️ Generate favicons (icongenie)
favs:
    #! ./.shell-wrapper.sh
    header "Favicons"
    pnpm gen:favs
    success "Favicons generated"

# 🚀 Release chores: changelog + version bump + tag (interactive)
release *ARGS:
    #! ./.shell-wrapper.sh
    header "Release"
    pnpm release {{ARGS}}
