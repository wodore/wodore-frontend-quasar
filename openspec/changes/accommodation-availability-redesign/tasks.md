# Tasks: Accommodation Availability Redesign

## Phase 1: Shared Components

- [x] **T1: Create WdDayLabel component**
  - File: `src/components/content/place/WdDayLabel.vue`
  - Extract day-label logic from WdWeatherDay
  - Props: `date: string`, `isActive?: boolean`
  - Computes: day name (Heute/Morgen/Gestern/weekday), date (DD.MM.)
  - Bold day name when `isActive` is true
  - No background, no opacity — just text content

- [x] **T2: Refactor WdWeatherDay to use WdDayLabel**
  - File: `src/components/content/place/WdWeatherDay.vue`
  - Replace inline day-name + date template with `<WdDayLabel :date="day.date" :is-active="isSelected" />`
  - Remove the now-redundant computed properties (`dayLabel`, `dateLabel`, `dayDiff`, `isToday`)
  - Keep past-today opacity styling on the wrapper div
  - Keep icon, temps, precip sections unchanged

## Phase 2: Availability Day Component

- [x] **T3: Create WdAccommodationDay component**
  - File: `src/components/huts/WdAccommodationDay.vue`
  - Layout: top stripe → WdDayLabel → availability icon (q-img, 28px) → free (bold) → total (light)
  - Props: `day`, `availabilityIcons`, `isSelected?`, `hutTypeColor?`
  - Hut type color: 2-3px top stripe + subtle bg tint (5-10% opacity)
  - Loading state: skeleton placeholders
  - Unknown state: gray icon + `?`
  - Clickable: wrap in `<a>` tag with `day.link` (matching current behavior)
  - Tooltip: full date, free/total beds, hut type name

## Phase 3: Availability Parent Component

- [x] **T4: Create WdAccommodationAvailabilities component**
  - File: `src/components/huts/WdAccommodationAvailabilities.vue`
  - Fetch availability icons from `/v1/categories/map/availability` on mount
  - Initialize date range (4 days before → 365 days after today)
  - Fetch per-day data from `/v1/huts/{slug}/availability/{date}` with batching
  - Swiper setup: FreeMode + Scrollbar (copy config from WdWeatherForecast)
  - Month selector bar (reuse current chip approach with month gradients)
  - Scroll to selected date on mount
  - Lazy-load data as slides become visible
  - Props: `slug`, `hasAvailability?`
  - Pass per-day `type_color` from API data to WdAccommodationDay (no more manual symbolMap)

## Phase 4: Integration & Comparison

- [x] **T5: Add WdAccommodationAvailabilities to WdPlaceContent**
  - File: `src/components/content/place/WdPlaceContent.vue`
  - Add new component below the existing `WdHutAvailabilities`
  - Pass `slug` and `has_availability` props
  - No need to pass symbolMap (new component fetches its own icons)
  - Both components visible for comparison

## Phase 5: Polish & Verify

- [x] **T6: Visual testing and refinement**
  - Verify Swiper scrolling works smoothly on desktop and mobile
  - Verify availability SVG icons render correctly
  - Verify hut type color stripe shows per day
  - Verify free/total bed numbers are readable
  - Verify WdDayLabel renders identically in weather and availability contexts
  - Check loading states (skeletons)
  - Check tooltips
  - Run `yarn lint` and `npx vue-tsc --noEmit`

## Dependencies

```
T1 ──→ T2 (WdDayLabel must exist before refactoring WdWeatherDay)
T1 ──→ T3 (WdDayLabel must exist before WdAccommodationDay)
T3 ──→ T4 (WdAccommodationDay must exist before parent)
T4 ──→ T5 (Parent component must exist before integration)
T5 ──→ T6 (Integration must be done before visual testing)
```

T2 and T3 can be done in parallel after T1.
