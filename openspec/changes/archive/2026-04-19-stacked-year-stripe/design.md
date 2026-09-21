## Context

`WdYearStripe` renders a 12-month row where each cell is a colored square with diagonal stripe patterns. The current `stacked` implementation picks the dominant row's color per cell — it doesn't combine types.

In stacked mode, each month should remain a **single rectangle** but with **multi-color diagonal stripes** — one stripe color per type, where the stripe thickness is proportional to that type's percentage. This creates a compact overview where you can see all type distributions at a glance in one row.

The component receives `rows: WdYearStripeRow[]` where each row has a `color` and `months: (number | undefined)[]` with percentage values (0–100).

## Goals / Non-Goals

**Goals:**

- Single rectangle per month with overlapping diagonal stripe patterns
- Each type gets its own stripe color, with thickness proportional to its percentage
- One type at 100% = solid fill of that color (no stripes needed)
- Sum < 100% = remaining portion rendered as gray stripes
- Sum > 100% = normalize values so total = 100%

**Non-Goals:**

- Changing the non-stacked (multi-row) mode behavior
- Splitting the cell into separate side-by-side segments
- Adding interactivity (hover tooltips, click handlers)
- Changing the data shape (`WdYearStripeRow` interface)

## Decisions

### 1. Rendering approach: layered repeating-linear-gradient

Use CSS `background-image` with multiple `repeating-linear-gradient` layers — one per type. Each layer defines a stripe of its color with thickness proportional to the value. A final gray layer fills the remainder.

**How it works**: A `repeating-linear-gradient` at -45deg with cycle size = sum of all stripe widths. Each color gets `stripeWidth` pixels of its color, then transparent for the rest of the cycle. Multiple backgrounds layer on top of each other.

**Rationale**: This is the same technique already used for single-row cells (just extended to multiple colors). Pure CSS, no extra DOM elements.

**Alternative considered**: Multiple overlapping `<div>` elements with individual stripe patterns. Rejected because it adds DOM complexity and alignment issues when the stripes should appear as one unified pattern.

### 2. Stripe cycle calculation

Total cycle width = sum of all stripe widths + gray remainder width. Each type's stripe width = `(value / 100) * basePx` where `basePx` scales so the cycle stays readable (e.g. 10px base). Gray remainder = `(100 - totalValue) / 100 * basePx`.

**Rationale**: Keeping the same ~10px base as the non-stacked mode ensures visual consistency.

### 3. Normalization for > 100%

When values sum to > 100, normalize each value to `value / totalSum * 100` so they fit within one cycle. No clipping needed.

**Rationale**: Proportional normalization is simpler and more visually meaningful than clipping.

## Risks / Trade-offs

- **Many types = complex gradient**: With 4+ types the gradient string gets long, but CSS handles this fine. → Acceptable.
- **Very thin stripes may be hard to see**: A type at 5% gets a very thin stripe. → Acceptable for a compact overview; the non-stacked mode remains for detail.
- **Breaking existing stacked consumers**: The current `stacked` behavior will be replaced. → Low risk since the prop is not passed in `WdPlaceContent.vue`.
