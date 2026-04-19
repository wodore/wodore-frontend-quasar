## Why

The existing `stacked` prop on `WdYearStripe` merges all rows by picking the dominant color per month cell — it doesn't actually combine the type information visually. We need a true stacked mode where each month is a **single rectangle** that uses diagonal stripes with multiple colors (one per type), where each color's stripe thickness is proportional to its percentage value.

## What Changes

- Replace the current `stacked` behavior with multi-color stripe rendering in a single rectangle per month
- Each type/category gets its own stripe color, with stripe thickness proportional to its percentage
- If only one type has 100%, the rectangle is a solid fill of that type's color
- If types sum to less than 100%, the remaining portion uses gray stripes (unknown)
- If types sum to more than 100%, values are normalized/clipped so total = 100%
- All types with undefined values are ignored (no stripe for them)

## Capabilities

### New Capabilities

- `stacked-proportional`: Multi-color proportional stripe rendering for stacked year stripe cells, combining all type stripes in a single rectangle

### Modified Capabilities

_(None)_

## Impact

- `src/components/content/place/WdYearStripe.vue` — template, script, and styles updated
- Consumers passing `stacked` prop will see multi-color stripes instead of the old dominant-color behavior
