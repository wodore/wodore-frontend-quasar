# Chunk Issue Investigation

## Status

- Status: pending
- Last updated: 2026-01-14

## Context

Build output reports one or more "large" chunks. Suspected primary contributor is MapLibre (heavy dependency), but not confirmed.

## Current Hypothesis

- Likely candidates: MapLibre GL bundle and related map assets.
- The chunk may not be easily reducible if MapLibre is required on initial routes.

## Notes To Capture

- Environment: browser, device, build target (spa/pwa/ssr)
- Build warnings (chunk size, file name, size)
- Affected routes or features
- Whether the large chunk is loaded on initial route or only on map routes
- Frequency and impact
- Related deploy/version info

## Questions

- Which chunk(s) are flagged as large in the build output?
- Are the map views lazy-loaded or included in the initial bundle?
- Are any additional large libs being pulled into the same chunk?

## Next Actions

- Capture the build report output with chunk names and sizes
- Confirm whether MapLibre is bundled into the initial chunk
- Evaluate code splitting opportunities for map-heavy routes
