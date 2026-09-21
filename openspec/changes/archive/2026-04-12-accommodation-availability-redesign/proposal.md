# Accommodation Availability Redesign

## Summary

Redesign the hut availability component with Swiper.js for improved desktop/mobile scrolling, official availability SVG icons from the API, clearer free/total bed display, and a shared day-label component with the weather forecast.

## Motivation

The current `WdHutAvailabilities` uses `QVirtualScroll` + `QScrollArea` with manual wheel event handling (~200 lines of scroll management). The per-day cells use a custom vertical occupancy bar with colors hardcoded in the component rather than using the official availability icons from the API. The `20/88` format for beds is ambiguous.

The weather forecast component (`WdWeatherForecast`) recently switched to Swiper.js with a much cleaner pattern. This change applies the same approach to availability while redesigning the day cells.

## Scope

- Create new `WdAccommodationAvailabilities` component (parent, Swiper-based)
- Create new `WdAccommodationDay` component (per-day cell)
- Create shared `WdDayLabel` component (day name + date, reusable)
- Refactor `WdWeatherDay` to use `WdDayLabel`
- Add both old and new availability components to `WdPlaceContent` for visual comparison
- Fetch availability category icons from `/v1/categories/map/availability` API
- Keep existing `WdHutAvailabilities` / `WdHutAvailability` untouched

## Out of Scope

- Removing old availability components (will be done after comparison)
- Changes to the API backend
- Changes to the month selector behavior (kept as-is)

## Key Design Decisions

1. **Swiper.js** with FreeMode + Scrollbar (matching WdWeatherForecast pattern)
2. **Official availability SVGs** (detailed pie-chart icons from API, 28px) as hero element per day
3. **Hut type** indicated via colored top stripe (2-3px) + subtle background tint per day
4. **Bed counts** as two-line display: `20` (bold, status-colored) + `88` (light gray, smaller)
5. **WdDayLabel** shared component with `isActive` prop for bold name (no background)
6. **Month selector** preserved from current design
7. **Cell width** starting at 64px, adjustable if needed
8. **Availability icon mapping** fetched from `/v1/categories/map/availability` API (maps `occupancy_status` → SVG URL)
9. **Hut type per day** using `type_color` and `type_slug` from per-day API data (no more manual symbolMap construction)
