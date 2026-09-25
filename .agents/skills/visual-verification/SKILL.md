---
name: visual-verification
description: "Capture an app's UI in many interaction states (map/menus/dialogs/hover/selected), verify readability and consistency with vision agents plus computed contrast audits, and iterate fixes until clean. Use when redesigning, restyling, theming (light/dark), or validating UI changes across viewports — especially for map-centric or stateful apps. Complements lint/type checks: this verifies what renders, not what compiles."
---

# Visual verification workflow

Ground rules learned the hard way:

1. **A screenshot without a state assertion is worthless.** After every
   interaction, assert the expected selector is visible (`.q-date` for a
   calendar, `.q-fab__actions` for an expanded fab, `.q-dialog__inner` for
   dialogs). If the assertion fails, mark the state FAILED and never save
   the wrong-state screenshot. Wrong-state captures silently corrupt the
   whole review.
2. **Full-resolution first.** Vision agents analyze individual full-res
   PNGs. Contact sheets downscale and hide small-text failures; if used at
   all, they are a human index only — the agent gets the originals.
3. **Device screenshots from the product owner outrank everything.** When
   provided, analyze them first (they include states automation cannot
   reach) and treat their findings as ground truth.
4. **Three evidence layers, all required:**
   - vision agents on full-res captures (catch gestalt, layout, obvious contrast)
   - computed contrast audit: enumerate every visible text node per state,
     WCAG ratio vs blended background, JSON report, fail < 4.5:1
   - computed-style probes for the specific rule under test (e.g. every
     button fill `rgba(0,0,0,0)`, active ring width, thumbnail bg alpha)
5. **Checklist must include non-color failures:** icons that fall back to
   emoji/unicode (missing icon assets), invisible-but-present elements,
   empty fields that look like contrast bugs (verify the value is bound),
   translucent surfaces that bleed content beneath.
6. **Hover and selected/active states are first-class**: capture them
   explicitly; active treatments must satisfy the same rules as rest
   states.
7. **ZONES rule (chrome vs canvas):** header/toolbar icon buttons are
   FLAT — transparent background in every state (hover, active, open);
   active selection is conveyed by icon color (e.g. gold), never a fill.
   Map-floating controls (fabs, overlay toggles, basemap thumbnails,
   compass/zoom) carry SOLID fills (alpha 1) with a visible border, in
   both themes — over imagery a translucent control is unreadable. A
   blanket "no backgrounds" rule regresses one zone; probe both zones.
8. **REGRESSION GATE:** before reporting done, every fix wave must re-run
   the contrast audit AND the zone probes for ALL previously-fixed
   rules. Rule-conflict regressions (a later wave re-breaking an earlier
   fix, e.g. no-bg-everywhere stripping map fabs) are the primary way
   defects return. The gate lives in `scripts/visual-matrix.mjs`
   (`ZONE_PROBE` in report.json, exit 1 on violations).

## Tooling

If the repo has `scripts/visual-matrix.mjs` (Wodore frontend does), use it:

```bash
yarn test:visual            # full matrix: states x themes x viewports
node scripts/visual-matrix.mjs --states home,hut --scheme dark --tag mobile
```

It captures asserted states at full resolution, writes a per-text-node
contrast audit (fails < 4.5:1), and exits non-zero on any failure. See
`scripts/README-visual-tests.md`.

For a repo without tooling, generate it following rule 1–5 (playwright,
per-state assertion map, blended-background contrast walker).

## Review loop

1. Capture the matrix (or collect the owner's device screenshots).
2. Dispatch vision agents IN PARALLEL, one per configuration, each viewing
   the individual full-res PNGs of its states — never one agent for
   everything, never downscaled composites.
3. Merge findings with the contrast JSON; deduplicate; classify:
   real defect / capture artifact (verify before dismissing) / product
   behavior (report, don't fix).
4. Fix at the root cause (color props at call sites beat CSS overrides;
   for Quasar: remove props so components adapt via Dark mode rather than
   fighting them).
5. Re-capture ONLY the affected states; re-run their contrast audit.
6. Stop when one full pass is clean; do not polish beyond that.

## Report format

Per finding: state + element + measured/observed evidence + fix applied +
verification method. Per pass: states captured/asserted/failed, contrast
violations before/after, verdict per configuration.
