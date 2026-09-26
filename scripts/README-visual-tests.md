# Visual test workflow

One consolidated approach for capture-based UI verification, built from
the 2026-09 dual-theme review sessions. The hard lessons are baked into
the tool:

1. **Never save a wrong-state screenshot.** Every interaction state is
   _asserted_ (the expected selector must be visible) before capturing.
   A screenshot of the wrong state is worse than no screenshot: analysts
   trust it.
2. **Analyse full-resolution captures individually.** Vision analysis
   always uses the per-state PNGs at full resolution — never downscaled
   composites (small-text contrast failures vanish in sheets). Contact
   sheets are OPTIONAL (`--sheet`, default off) and serve as a human
   index only.
3. **Contrast is computed, not eyeballed.** Every visible text node is
   WCAG-audited against its blended background per state
   (4.5:1 normal, 3:1 large text) and violations land in a JSON report.
4. **Vision agents review the full-res PNGs** with a concrete checklist
   (readability, no icon backgrounds, solid map-control fills, hover and
   selected states). Their verdicts are cross-checked against the
   computed audit — vision misjudges (e.g. "map not dimmed" twice, while
   computed styles proved it was); computed styles misjudge nothing they
   can query, but only what you query.

## Run

```bash
yarn dev -p 9000                # dev server must run (or set VISUAL_BASE_URL)
yarn test:visual                # all: light/dark x desktop/mobile x 14 states
node scripts/visual-matrix.mjs --scheme dark --tag mobile   # subset
node scripts/visual-matrix.mjs --sheet   # additionally emit human contact sheets
```

Default run = full-res PNGs + contrast JSON only.

Output in `.visual-tests/<timestamp>/`:

| File                           | Content                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| `<scheme>-<tag>-<state>.png`   | full-resolution, state-asserted capture (**primary artifacts**) |
| `contrast-<scheme>-<tag>.json` | WCAG violations per state (text, ratio, class)                  |
| `report.json`                  | assertion results + violation summary                           |
| `SHEET-<scheme>-<tag>.png`     | optional (`--sheet`): labeled contact sheet, human index only   |

**Exit code 1** on any failed assertion or contrast violation. `.visual-tests/` is gitignored.

## Review flow

1. `yarn test:visual` (or the subset you need)
2. Inspect `report.json` first: assertion failures mean the interaction
   script needs fixing; contrast violations are code defects.
3. Have a vision agent review the individual full-res PNGs of states you
   changed, with an explicit checklist. Cross-check anything it reports
   against the computed audit before acting on it.
4. Add new states to the `STATES` array in `scripts/visual-matrix.mjs`
   (id + interaction + assertion selector; `optional: true` when the
   selector is brittle and a capture is still useful).
