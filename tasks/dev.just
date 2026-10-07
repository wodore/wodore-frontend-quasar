import 'core.just'

# ❓ Show help for the dev tasks
[private]
help:
    @just-list dev

# 🚀 Dev server (usage: just dev dev mode=ssr — spa | pwa | ssr)
# In a workz lane prefer 'just lane web' (port-guarded, workz-allocated port).
[default]
dev mode="pwa" *ARGS:
    #! ./.shell-wrapper.sh
    header "Dev server ({{mode}})"
    info "In a workz lane: just lane web (guarded, own port)"
    PACKAGE_VERSION="$(node -p 'require("./package.json").version')" \
        pnpm exec quasar dev -m {{mode}} {{ARGS}}

# 🏗️ Production build (usage: just dev build mode=pwa)
build mode="pwa":
    #! ./.shell-wrapper.sh
    header "Build ({{mode}})"
    pnpm exec quasar build -m {{mode}}
    success "Build finished: dist/{{mode}}"

# 📦 Serve the production build locally (usage: just dev serve mode=pwa)
serve mode="pwa":
    #! ./.shell-wrapper.sh
    header "Serve dist/{{mode}}"
    pnpm exec quasar serve --history --port 9000 -H localhost --cors dist/{{mode}}/

# 📚 Histoire component workbench (dev server)
story:
    #! ./.shell-wrapper.sh
    header "Histoire dev server"
    pnpm story:dev

# 📚 Build the Histoire site
story-build:
    #! ./.shell-wrapper.sh
    header "Histoire build"
    pnpm story:build
