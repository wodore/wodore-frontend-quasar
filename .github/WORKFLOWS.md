# GitHub Workflows Configuration

This project uses GitHub Actions for CI/CD automation.

## Workflows Overview

### Main Workflow (`main.yml`)

**Trigger**: Push to `main` branch, Pull Requests

**Purpose**: Quality checks (linting, formatting, tests)

**Steps**:

- ✅ Reads Node.js version from `.nvmrc` (currently v24)
- ✅ Installs dependencies with caching
- ✅ Runs ESLint
- ✅ Checks Prettier formatting
- ✅ Runs tests

**Cache Strategy**:

- ESLint cache: `.eslintcache`
- node_modules: Based on `yarn.lock` hash

### Docker Build Workflow (`docker.yml`)

**Trigger**:

- Push to `main` (only if PR has `BUILD` label)
- Tag push: `v*.*.*`
- Manual workflow dispatch
- Repository dispatch

**Purpose**: Build and push Docker images to GitHub Container Registry

**Features**:

- ✅ Checks for `BUILD` label on merged PRs
- ✅ Multi-tag support (edge, versioned, latest, timestamp-SHA)
- ✅ Automated tagging based on git tags
- ✅ Manual custom tag support

**Image Tags**:

- `edge-pwa` - Latest main branch builds
- `X.Y.Z-pwa` - Semantic version tags
- `X.Y-pwa` - Minor version tags
- `X-pwa` - Major version tags
- `latest-pwa` - Latest release
- `YYYYMMDDTHHmm-sha-<sha>` - Timestamp + SHA

**Registry**: `ghcr.io/wodore/wodore-frontend-quasar`

### New Version Workflow (`new-version.yml`)

**Trigger**: After successful Docker build

**Purpose**: Auto-create version tags from `package.json`

**Steps**:

1. ✅ Reads Node.js version from `.nvmrc`
2. ✅ Extracts version from `package.json`
3. ✅ Checks if tag `v{version}` exists
4. ✅ Creates tag if it doesn't exist
5. ✅ Triggers release workflow via repository_dispatch

**Example**: If `package.json` has version `0.0.7`, creates tag `v0.0.7`

---

### Release Workflow (`release.yml`)

**Trigger**:

- Tag push: `v*.*.*`
- Repository dispatch: `new-tag-created`

**Purpose**: Create GitHub releases with changelogs

**Steps**:

1. ✅ Reads Node.js version from `.nvmrc`
2. ✅ Installs dependencies (including git-cliff)
3. ✅ Generates changelog using `git-cliff`
4. ✅ Creates GitHub release with:
   - Tag name: `v{version}`
   - Release name: `{version}`
   - Auto-generated changelog body
   - Marked as latest

## Workflow Features

### Smart Docker Builds

**BUILD Label System**:
Only builds Docker images when merged PRs have the `BUILD` label:

```bash
# On a PR, add the BUILD label
gh pr edit 123 --add-label "BUILD"

# When merged, Docker image will be built automatically
```

### Automated Versioning

1. Update version in `package.json`
2. Merge to main
3. Docker workflow builds image
4. New version workflow creates tag
5. Release workflow creates GitHub release
6. Fully automated! 🚀

### Manual Docker Builds

Trigger via workflow dispatch with custom parameters:

```bash
# Via GitHub UI
# Actions → Build Docker → Run workflow
# - custom_tag: "hash" (default) or custom tag
# - build_type: "pwa"
# - add_edge_tag: true/false
```

## Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [setup-node Action](https://github.com/actions/setup-node)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Docker Metadata Action](https://github.com/docker/metadata-action)
