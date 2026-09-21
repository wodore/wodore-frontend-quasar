## 1. Script: Replace stacked logic

- [x] 1.1 Remove the existing `stackedStyle()` and `stackedClass()` functions
- [x] 1.2 Add a `stackedSegments(monthIndex)` function that returns an array of `{ value: number, color: string }` for all rows with defined, non-zero values at the given month index
- [x] 1.3 Add a `stackedCellStyle(monthIndex)` function that computes the `background-image` CSS using layered `repeating-linear-gradient` — one stripe layer per type with proportional thickness, plus gray for the remainder if sum < 100%. Handle: all-undefined (return {}), single type at 100% (solid fill), multiple types (multi-color stripes), and sum > 100% (normalized)

## 2. Template: Update stacked rendering

- [x] 2.1 Replace the stacked cell's `:style` binding to use the new `stackedCellStyle(mi)` function instead of the old `stackedStyle(mi)`
- [x] 2.2 Ensure stacked cells still use the existing `--unknown` class when all values are undefined

## 3. Styles: Verify stacked cell CSS

- [x] 3.1 Keep the `--stacked` height (12px) for stacked cells
- [x] 3.2 Ensure no conflicting solid-fill styles override the multi-stripe background-image

## 4. Verify

- [x] 4.1 Run `yarn lint` and `npx vue-tsc --noEmit` to check for errors
- [x] 4.2 Verify the component renders correctly in both stacked and non-stacked modes
