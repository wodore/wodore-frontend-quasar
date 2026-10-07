# CSS architecture

## Where styles live

| Kind | Location | Rule |
|---|---|---|
| **Quasar theme variables** (brand, radius, typography, breakpoints) | `src/css/quasar.variables.scss` | Quasar's recommended process — this file is auto-injected into every SCSS context. Change Quasar's look HERE, not by overriding component CSS. |
| **App-wide tokens** (accent Sass vars, `--wd-ctl-*` runtime custom properties) | `quasar.variables.scss` (static) + `map-controls/_topbar.scss` (`:root`/`body--light`/`body--dark` blocks) | `--wd-ctl-*` values flip at RUNTIME (theme switch) — they can never be Sass vars. Static accents (`$wd-gold`…) are Sass vars. |
| **Map-chrome feature styles** (topbar, overlay, basemap, zoom, attribution, focus) | `src/css/map-controls/_*.scss` | Only styles that CROSS components or target third-party DOM (Quasar internals, MapLibre, injected popups). Imported in order from `app.scss` — cascade order is load-bearing, append new features as new partials, never interleave. |
| **MapLibre control overrides** | `src/css/maplibre-gl.scss` | MapLibre renders its own DOM — global selectors are the only way in. Keep it theming + sizing only. |
| **Component-internal styles** | `<style scoped>` in the component | If a style is used by exactly one component and doesn't target injected/3rd-party DOM, it belongs in the SFC. New component styles go HERE, not into app.scss. |

## Quasar-first rule

Before writing CSS, check whether Quasar already provides it:

1. **Layout utilities in templates**: `row`, `column`, `items-center`, `justify-end`, `q-pa-sm`, `q-mt-md`… — prefer these over hand-rolled flex/padding CSS.
2. **Component props**: `flat`, `round`, `dense`, `unelevated`, `size`, `color="primary"` — style through props, not overrides.
3. **Theme values**: `text-`/`bg-` color classes generated from the palette (`app.scss` color loop) instead of hardcoded hex.
4. Only style what Quasar cannot do: our instrument chips (q-fab is banned), MapLibre DOM, morph animations.

## Token discipline

- No hardcoded colors in component styles — use `$wd-*` Sass vars (static) or `--wd-ctl-*` custom properties (theme-aware).
- `!important` requires a comment naming what it beats (Quasar `::before` fills, the dark-mode elevation kill). Anything else should be solvable by specificity.
- Radius ramp: 4/8/16 + 999 (see `scripts/check-radius.mjs`, part of `pnpm lint`).

## Parity gate for refactors

`pnpm test:visual` captures 40 state-asserted screenshots (2 schemes × 2 viewports × 10 states) with a WCAG contrast audit. For zero-visual-change refactors: capture a baseline on main, refactor, re-capture — all deterministic chrome states must be pixel-identical (hut/home states render live staging data and vary run-to-run; compare those by eye, not bytes).


## Decision: SFC-scoped vs global (2026-10-01)

**Current state is correct** — every partial's header documents WHY it's global:

| Partial | Why global |
|---|---|
| `_topbar.scss` | Targets 3 components' DOM from one surface (MainLayout pill + WdSelectDate button + WdPlaceSearchMenu q-fields) |
| `_layout.scss` | Focus-mode flies out elements across MULTIPLE components via `body.wd-map-focus` |
| `_dark.scss` | One `body.body--dark` block styles ALL controls — splitting would scatter the theming |
| `_zoom-slider.scss` | Visibility gated on `body.wd-map-focus` + `body.wd-ovl-strip-open` (body classes) |
| `_attribution.scss` | The chip is created by WdMapView JS and appended to `<body>` |

**What IS in SFC scoped blocks already:** `WdOverlayControl`, `WdBasemapControl`, `WdZoomSlider`, `WdSelectDate` (calendar popup). These are correct — component-internal layout.

**The rule going forward:** new component styles go in the component's `<style scoped>`. Only promote to a partial when you need cross-component, injected-DOM, or body-class selectors — and document WHY in the partial header.

## Test infrastructure

| Suite | Runner | Allure | Screenshots | CI |
|---|---|---|---|---|
| Unit | Vitest | ✓ `allure-results/unit/` | n/a | ✓ every PR |
| E2E smoke | Playwright (`tests/e2e/`) | ✓ `allure-results/e2e/` | on failure | ✗ local only |
| **Interaction** | Playwright (`tests/interaction/`) | ✓ (shared with e2e) | ✓ on pass + fail | ✓ every PR |
| Visual matrix | Playwright (`scripts/visual-matrix.mjs`) | ✗ standalone | ✓ always | ✗ manual |

**Tags in Allure:**
- `layer: interaction` — all interaction specs
- `epic: map-controls` — feature grouping
- `theme: light|dark` / `viewport: mobile|desktop` — dimensions
- `@visual` — tests that verify visual output (colors, sizes, filters)

**Generate the full report:** `pnpm allure:generate` (merges unit + e2e/interaction results)

### Suggested improvements (future)
1. **Visual regression** — Playwright's built-in `toHaveScreenshot()` on deterministic chrome states (overlay, basemap, focus) for automatic pixel-level comparison
2. **Parallelize interaction tests** — currently `workers: 1` for the e2e suite; interaction specs are independent and could use `workers: 2+`
3. **Composite `test:ci`** — `yarn test:unit && yarn test:interaction && yarn test:visual` as a single command
4. **Playwright HTML reporter** alongside Allure for local debugging (`npx playwright show-report`)
