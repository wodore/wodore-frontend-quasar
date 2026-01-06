# Development Guide

This document provides detailed information about development workflows, release process, and advanced topics for the Wodore Frontend project.

For a quick start and general overview, see [README.md](README.md). For Claude development assistance, see [CLAUDE.md](CLAUDE.md).

## Table of Contents

- [Release Process](#release-process)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Release Process

The project uses [git-cliff](https://git-cliff.org/) for changelog generation and follows [Semantic Versioning](https://semver.org/).

### Prerequisites

Before creating a release, ensure you have:

1. **GitHub Personal Access Token** with `repo` access
   ```bash
   export GITHUB_TOKEN=your_github_token_here
   ```

2. **Clean working directory** (all changes committed)
   ```bash
   git status  # Should show "nothing to commit, working tree clean"
   ```

3. **Up-to-date main branch**
   ```bash
   git checkout main
   git pull origin main
   ```

### Release Workflow

#### 1. Preview the Release

First, preview what will be included in the changelog:

```bash
# Show unreleased changes that will be included
yarn release --dry --unreleased

# Or show first N lines of the full changelog
yarn release --dry --length 50
```

This is useful to verify that:
- All merged PRs have appropriate labels
- The changelog format looks correct
- The version bump will be correct

#### 2. Create the Release

Run the release script:

```bash
yarn release
```

The script will:
1. Generate the new version number based on commit history
2. Update `CHANGELOG.md` with new entries
3. Open the changelog in your editor for review (uses `$EDITOR` or `vi`)
4. Update `package.json` version
5. Prompt you to commit the changes

**Important**: Review the changelog carefully! Make any necessary edits before saving and exiting the editor.

When prompted, confirm the commit:
```
Do you want to commit these changes? (y/n) y
```

This creates a commit with message: `release: version X.Y.Z`

#### 3. Tag and Push

After committing, create and push the git tag:

```bash
# Tag the release
git tag vX.Y.Z

# Push the commit and tag
git push origin main
git push origin vX.Y.Z
```

Or use the `--add-tag` flag to automatically tag and push:

```bash
yarn release --add-tag
```

#### 4. Automated Build and Publish

Once the release tag is pushed to GitHub, the CI/CD pipeline automatically:
- Builds the Docker image
- Tags it with the version number (e.g., `vX.Y.Z`) and `latest`
- Publishes to GitHub Container Registry

No manual intervention is required for the build and publish process.

### Release Script Options

The `release.sh` script supports several options:

```bash
# Preview release without making changes
yarn release --dry --unreleased

# Preview first 50 lines of changelog
yarn release --dry --length 50

# Create release without committing (manual commit later)
yarn release --no-commit

# Create release and automatically tag + push
yarn release --add-tag

# Show help
yarn release --help
```

### Version Bumping

The version is automatically determined by git-cliff based on:

1. **PR Labels**: Configure in `cliff.toml`
   - `BREAKING` - Major version bump (1.0.0 → 2.0.0)
   - `type:feature` - Minor version bump (1.0.0 → 1.1.0)
   - `type:bug`, `type:refactor`, etc. - Patch version bump (1.0.0 → 1.0.1)

2. **Commit Messages**: Only when no PR labels are found
   - Conventional commit format: `feat:`, `fix:`, `BREAKING CHANGE:`

### Changelog Organization

The changelog groups changes by PR labels (from highest to lowest priority):

1. 🚧 Breaking changes (`BREAKING`)
2. 🚀 Features (`type:feature`)
3. 🐛 Fixes (`type:bug`)
4. 📝 Refactor (`type:refactor`)
5. 📘 Documentation (`type:docs`)
6. 📥 Dependencies (`type:deps`)
7. 💻 Tooling (`type:tooling`)
8. 🩺 Tests (`type:tests`)
9. 🎈 Others (`type:others`)

**Internal changes** (labeled `INTERNAL`) are automatically skipped.

### Pull Request Labeling

To ensure changes appear in the changelog:

1. Add appropriate labels to PRs before merging:
   - `type:feature` - New features
   - `type:bug` - Bug fixes
   - `type:refactor` - Code refactoring
   - `type:docs` - Documentation updates
   - `type:deps` - Dependency updates
   - `type:tooling` - Build/tooling changes
   - `type:tests` - Test updates
   - `BREAKING` - Breaking changes (in addition to type label)
   - `INTERNAL` - Skip changelog entry

2. Write clear, descriptive PR titles (they appear in changelog)

3. PRs without labels will be skipped from the changelog

### Manual Release Steps

If you need to manually create a release without the script:

```bash
# 1. Update changelog
./node_modules/.bin/git-cliff --bump -u --prepend CHANGELOG.md

# 2. Get new version
NEW_VERSION=$(./node_modules/.bin/git-cliff --bumped-version | sed 's/v//')

# 3. Update package.json
yarn version --new-version $NEW_VERSION --no-git-tag-version

# 4. Review and edit CHANGELOG.md
$EDITOR CHANGELOG.md

# 5. Commit changes
git add CHANGELOG.md package.json
git commit -m "release: version $NEW_VERSION"

# 6. Tag and push
git tag v$NEW_VERSION
git push origin main v$NEW_VERSION
```

### Troubleshooting Releases

#### Issue: "Invalid version supplied"

This was a bug in earlier versions of the release script. Update to the latest version where git-cliff is called directly:

```bash
# Should use direct binary path, not yarn run
./node_modules/.bin/git-cliff --bumped-version
```

#### Issue: "GITHUB_TOKEN environment variable is not set"

Set your GitHub personal access token:

```bash
export GITHUB_TOKEN=ghp_your_token_here
```

Create a token at: https://github.com/settings/tokens (needs `repo` scope)

#### Issue: No version bump detected

This happens when:
- No PRs have been merged since last release
- All PRs are labeled `INTERNAL`
- No commit messages follow conventional commit format

Solution: Manually bump version in `package.json` or add appropriate PR labels.

#### Issue: Changelog contains wrong entries

- **Wrong PR title**: Edit the PR title on GitHub, then re-run the release script
- **Wrong grouping**: Add/fix PR labels on GitHub, then re-run
- **Duplicate entries**: Edit `CHANGELOG.md` manually before committing

## Development Workflow

### Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Develop and test**
   ```bash
   yarn dev
   # Make changes, test locally
   ```

3. **Ensure code quality**
   ```bash
   yarn lint:fix
   yarn format
   ```

4. **Commit changes**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub with appropriate labels
   ```

### API Client Updates

When the backend API changes:

```bash
# Ensure backend is running locally
cd ../wodore-backend
app run -p 8000

# In frontend project
cd ../wodore-frontend-quasar
yarn gen:api-local

# Commit the updated types
git add src/clients/wodore_v1.d.ts
git commit -m "Update API client types"
```

### Icon Development

Add custom icons to the project:

```bash
# 1. Add SVG file to source directory
cp my-icon.svg src/extras/icons/svg/source/

# 2. Generate icon font
yarn gen:icons

# 3. Use in components
# <q-icon name="wd-my-icon" />

# 4. Commit both source and generated files
git add src/extras/icons/
git commit -m "Add my-icon to custom icon set"
```

## Testing

### Manual Testing

```bash
# Development server
yarn dev

# Production build testing
yarn build
yarn serve
```

### Browser Testing

Test in multiple browsers and modes:

- Chrome/Edge (Desktop)
- Firefox (Desktop)
- Safari (macOS/iOS)
- Mobile browsers (Chrome/Safari on actual devices)

### PWA Testing

```bash
# Build PWA
yarn build:pwa

# Serve locally
yarn serve:pwa

# Test PWA features:
# - Install app
# - Offline functionality
# - Service worker updates
```

### Docker Testing

```bash
# Build and run Docker container
yarn docker:build
yarn docker:run-dev

# Test with production environment
yarn docker:run-prod

# Test environment variable replacement
docker run -p 9000:8080 \
  -e WODORE_API_HOST=https://test-api.example.com \
  wodore-frontend
```

## Troubleshooting

### Common Development Issues

#### Port Already in Use

If port 9000 is already in use:

```bash
# Find process using port 9000
lsof -i :9000

# Kill the process
kill -9 <PID>

# Or use a different port
quasar dev --port 9001
```

#### API Client Generation Fails

```bash
# Ensure backend is running and accessible
curl http://127.0.0.1:8000/v1/openapi.json

# Clear node_modules cache
rm -rf node_modules/.cache

# Regenerate
yarn gen:api-local
```

#### Icons Not Showing

```bash
# Regenerate icon font
yarn gen:icons

# Check if icon exists in source
ls src/extras/icons/svg/source/

# Verify icon name in component
# <q-icon name="wd-icon-name" />
```

#### Environment Variables Not Applied

```bash
# Restart dev server after changing .env files
# Ctrl+C, then yarn dev

# Check which env files are loaded
cat .env .env.local .env.dev .env.local.dev

# Verify in quasar.config.ts
grep -A 10 "env:" quasar.config.ts
```

### Docker Issues

#### Build Fails

```bash
# Build with verbose output
docker build --progress=plain -t wodore-frontend \
  --build-arg GIT_HASH=$(git rev-parse --short HEAD) .

# Check build logs
docker build --no-cache ...
```

#### Container Won't Start

```bash
# View container logs
docker logs <container-id>

# Run container interactively
docker run -it wodore-frontend /bin/sh

# Check environment variables
docker run wodore-frontend env
```

### Production Issues

#### White Screen / Blank Page

1. Check browser console for errors
2. Verify environment variables are set correctly
3. Check that API backend is accessible
4. Verify CORS settings on backend
5. Check service worker cache (clear if needed)

#### Authentication Not Working

1. Verify OIDC environment variables:
   - `WODORE_OICD_ISSUER_URL`
   - `WODORE_OICD_CLIENT_ID`
   - `WODORE_OICD_RESOURCE_ID`

2. Check redirect URIs in Zitadel match `WODORE_URL`

3. Verify browser has cookies enabled

4. Check browser console for OIDC errors

#### Map Not Loading

1. Verify `WODORE_MAPTILER_API_KEY` is set
2. Check MapTiler account quota
3. Verify internet connection (maps require external resources)
4. Check browser console for map errors

## Additional Resources

- [Git Cliff Documentation](https://git-cliff.org/docs/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Quasar CLI](https://quasar.dev/quasar-cli-vite/)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
