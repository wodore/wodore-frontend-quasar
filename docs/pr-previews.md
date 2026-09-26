# PR Previews (GitHub Pages)

Static previews of pull requests, deployed when the `preview` label is
added, removed when the PR closes or the label is taken off.

- URL scheme: `https://wodore.github.io/wodore-frontend-quasar/pr-<N>/`
- Read-only: **no login** (Zitadel redirect URIs are exact-match; a
  per-PR origin cannot authenticate). API calls go to the public
  staging API (`https://hub.stg.wodore.com` unless overridden), read
  paths only.
- Anything needing login or write flows belongs on the docker staging
  environment, not on previews.

## How it works

`.github/workflows/preview.yml`:

1. On `pull_request` (opened/synchronize/reopened/labeled/unlabeled/closed)
   a gate step resolves the PR number and whether the `preview` label is
   present. No label, no build.
2. Builds the PWA with `WODORE_ROUTER_MODE=hash` (GitHub Pages has no
   SPA rewrite) and `WODORE_PUBLIC_PATH=/wodore-frontend-quasar/pr-<N>/`
   so assets resolve under the PR subpath. Production builds are
   untouched (both default to today's values when unset).
3. Publishes `dist/pwa` into `pr-<N>/` on the `gh-pages` branch with
   `keep_files: true` (other PRs' folders stay).
4. Comments the URL plus a QR code (handy for phone testing) and the
   commit SHA on the PR; re-uses one comment per PR.
5. Cleanup on close/unlabel removes only `pr-<N>/` and updates the
   comment.

## One-time setup

1. **GitHub Pages**: repo Settings → Pages → Source: _Deploy from a
   branch_ → Branch: `gh-pages`, folder `/ (root)`. The branch appears
   after the first preview deploy (or push an empty initial commit).
2. **Repository variables** (Settings → Secrets and variables → Actions
   → Variables; these are public-by-design client values, they ship in
   every production bundle anyway — hence variables, not secrets):
   - `WODORE_API_HOST` — API host (optional; defaults to
     `https://hub.stg.wodore.com`)
   - `WODORE_TILE_SERVER_URL` — Martin tile server (optional; defaults
     to `https://tiles.stg.wodore.com`)
   - `WODORE_MAPTILER_API_KEY`
   - `WODORE_IMAGOR_URL`, `WODORE_IMAGOR_KEY`,
     `WODORE_IMAGOR_REPLACE_API_HOST_MEDIA`
   - `WODORE_OICD_ISSUER_URL`, `WODORE_OICD_CLIENT_ID`
     The values are whatever the production docker environment injects at
     runtime (see the `.env` placeholder pattern in the Dockerfile).
3. **Backend CORS**: previews call the API (hub.stg.wodore.com by
   default) and the Martin tile server from a new origin. Add exactly
   one origin to each service's CORS allow-list (all PR subpaths share
   it):

   ```text
   https://wodore.github.io
   ```

   In the backend environment this is the `CORS_ALLOWED_ORIGINS` list
   (django-cors-headers). Since previews are read-only, no CSRF/redirect
   changes are needed.

## Notes and limits

- Previews are public (GitHub Pages). No secrets are used in the
  workflow; `GITHUB_TOKEN` only.
- The service worker registers per subpath scope; stale preview caches
  age out on their own after a PR folder is deleted.
- Map tiles run against the staging Martin server by default
  (`https://tiles.stg.wodore.com`); Imagor images and analytics run
  against whatever the repo variables point at.

## Per-commit preview paths (2026-09)

Every build deploys to its own subpath `pr-<N>/<short-sha>/` (e.g.
`https://wodore.github.io/wodore-frontend-quasar/pr-150/a1b2c3d/`). A fresh
path per push can never be served stale from the Pages CDN, and all builds of
a PR stay online and comparable until the PR closes (cleanup removes the
whole `pr-<N>/` tree). The PR comment maintains the list:
`[sha](commit-link) (build date): preview url` - newest first, capped at 15
entries. The QR code always points at the latest build.
