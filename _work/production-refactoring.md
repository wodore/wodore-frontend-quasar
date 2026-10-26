# Production Refactoring: Leaflet Fallback Map

**Branch:** `plan-leaflet-mvt-poi-fallback-opentopo`
**Date:** 2026-10-27
**Status:** REVISED — Opus plan review applied

## Goal

Take the POC fallback map from a 1900-line monolith to a production-ready,
modular architecture with pixel-accurate control parity to MapLibre.

## Current Issues

### Control Layout (from screenshots + Opus plan review)

| #   | Issue                                              | Fix (per review corrections)                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Desktop attribution: links unreadable in dark mode | Theme `a { color: var(--wd-ctl-ink) }` — the LINKS are hardcoded `rgba(0,0,0,0.75)`, not the text (text is already correct via `--wd-ctl-ink`). Mirror the MapLibre fix at `maplibre-gl.scss:128-133`.                                                                                                                              |
| C2  | Desktop MapLibre: no attribution visible           | Main map issue, not this PR's scope                                                                                                                                                                                                                                                                                                 |
| C3  | Mobile: zoom MINUS hidden behind locate            | Restructure bottom-left: locate ABOVE zoom in a merged LIGHT `--wd-ctl-bg` group (NOT dark — MapLibre is light in both themes per `maplibre-gl.scss:168-171`).                                                                                                                                                                      |
| C4  | Mobile: attribution behind zoom panel              | Move attribution ABOVE the control stack; compact ⓘ pill stays.                                                                                                                                                                                                                                                                     |
| C5  | Mobile: focus mode button visible                  | Option (a): ADD a tap-to-focus handler to the fallback (empty-map tap → `toggleFocus()`), THEN remove the scoped override. Without this, mobile users have NO way to enter focus mode (the button is the only entry — the fallback lacks MapLibre's tap gesture). Also fix `::aria-label` → `:aria-label` typo on the focus button. |
| C6  | Scale bar doesn't match MapLibre                   | Use the ACTUAL `.maplibregl-ctrl-scale` values from `maplibre-gl.scss:276-303`: linear-gradient white fade (bottom 30%), 4-way white text-shadow halo, `font-size:15px; font-weight:700`, `border-width: medium 3px 3px`. NOT transparent/2px as originally stated.                                                                 |

### Code Architecture (from Opus full review)

| #   | Issue                                                   | Priority             |
| --- | ------------------------------------------------------- | -------------------- |
| A1  | 1919-line monolith mixing ~8 concerns                   | should-fix           |
| A2  | Hut/avail tile fetch loops are the same algorithm twice | should-fix           |
| A3  | STATUS_COLORS hardcoded copy of MapLibre palette        | should-fix           |
| A4  | Tile-math functions inline (not testable)               | done                 |
| A5  | Sprite sheet management inline                          | should-fix           |
| A6  | WdCanvasDot class + types inline                        | should-fix           |
| A7  | Zoom slider gesture JS duplicated                       | nice-to-have (defer) |

## Implementation Order (per Opus review: controls first)

### Phase A: Control fixes (low-risk, user-visible, independent of extraction)

1. C1: Theme attribution links
2. C3+C4: Mobile bottom-left restructure (light merged group, attribution above)
3. C5: Add tap-to-focus handler, then remove the mobile focus button override; fix `::aria-label` typo
4. C6: Scale bar — copy the actual MapLibre CSS values
5. Visual check: both themes, desktop + mobile

### Phase B: Module extraction (already started)

6. ✅ `tile-math.ts` — extracted
7. ✅ `status-colors.ts` — extracted
8. ✅ `sprite-sheet.ts` — extracted (pure module, no component callback)
9. ✅ `canvas-dot.ts` — extracted (render-state injected via module-level setters)
10. `mlt-tile-loader.ts` — generic fetch/decode/evict/guard loop
11. Rewire `WdFallbackMapView.vue` to import from all modules
12. Split `tests/unit/fallback-map.spec.ts` into separate specs

### Phase C: Verification

13. Unit tests green (existing + new loader/status specs)
14. ESLint + vue-tsc + Prettier clean
15. Build: no new first-load entry, async chunk size unchanged
16. Playwright e2e: all zooms, click → hut, date picker, focus mode (desktop + mobile)
17. Screenshots: z7/z10/z12/z14, desktop + mobile, both themes
18. Opus implementation review

## Key Gotchas (from plan review)

1. **canvas-dot.ts reads live module state** (`shieldPx`, `markerOpacity`) — already handled via exported setters in the extracted module
2. **sprite-sheet.ts must NOT call rebuildMarkers** — the component owns the rebuild trigger
3. **mlt-tile-loader.ts needs an explicit interface** — pass bounds+zoom snapshot + decode callback, return `changed` boolean
4. **Dependency direction**: component → modules; canvas-dot → {sprite-sheet, status-colors}; everything → tile-math. No reverse imports.
5. **`::aria-label` typo** on the focus button (invalid — no accessible name)

## Success Criteria (updated per review)

- [ ] WdFallbackMapView.vue ≤ 500 lines
- [ ] Zero duplicated tile-fetch logic
- [ ] All control positions/sizes/styling match MapLibre
- [ ] Mobile: zoom minus visible, attribution visible, focus mode accessible via tap
- [ ] Desktop: attribution links readable in BOTH themes
- [ ] Scale bar matches actual MapLibre CSS (gradient, 3px, 15px)
- [ ] Existing `tests/unit/fallback-map.spec.ts` still green (repointed, not orphaned)
- [ ] Markers render identically at z8/z11/z14 before vs after canvas extraction
- [ ] No new first-load entry; async chunk size unchanged
- [ ] ESLint + vue-tsc clean
