# Design: Accommodation Availability Redesign

## Architecture

### Component Tree

```
WdPlaceContent
├── WdHutAvailabilities (existing, kept for comparison)
├── WdAccommodationAvailabilities (NEW)
│   ├── Month selector bar (reuse current chip approach)
│   ├── Swiper (FreeMode + Scrollbar)
│   │   └── WdAccommodationDay (NEW, per slide)
│   │       ├── WdDayLabel (NEW shared)
│   │       ├── Availability icon (detailed SVG, 28px)
│   │       └── Bed counts (two-line)
│   └── (optional legend row)
└── WdWeatherForecast (existing, refactor WdDayLabel into WdWeatherDay)
```

### New Files

| File                                                    | Purpose                          |
| ------------------------------------------------------- | -------------------------------- |
| `src/components/content/place/WdDayLabel.vue`           | Shared day name + date component |
| `src/components/huts/WdAccommodationAvailabilities.vue` | Parent container with Swiper     |
| `src/components/huts/WdAccommodationDay.vue`            | Per-day availability cell        |

### Modified Files

| File                                              | Change                                               |
| ------------------------------------------------- | ---------------------------------------------------- |
| `src/components/content/place/WdWeatherDay.vue`   | Refactor to use WdDayLabel                           |
| `src/components/content/place/WdPlaceContent.vue` | Add WdAccommodationAvailabilities alongside existing |

## Component Designs

### WdDayLabel (shared)

Reusable day header showing contextual day name and formatted date.

```
┌──────────┐
│   Heute   │   ← "Heute"/"Morgen"/"Gestern"/weekday short name
│  12.04.   │   ← date in DD.MM. format
└──────────┘
```

**Props:**

- `date: string` — ISO date string (YYYY-MM-DD)
- `isActive?: boolean` — bold day name when true (selected state)
- No background styling — consumers handle their own backgrounds

**Logic (extracted from WdWeatherDay):**

- Compute `dayDiff` from today
- Return "Heute"/"Morgen"/"Gestern" for ±1 day, otherwise weekday abbreviation
- Format date as DD.MM.
- Use `$q.lang.isoName` for locale

### WdAccommodationDay

Individual day cell showing availability for one date.

```
┌══════════╗  ← 2-3px colored top stripe (hut type color)
│   Mo     │  ← WdDayLabel (day name)
│  12.04.  │  ← WdDayLabel (date)
│          │
│   🟢     │  ← Availability SVG icon (28px, from API)
│          │
│    20    │  ← free beds (bold, colored by occupancy_status)
│    88    │  ← total beds (light gray, smaller)
└──────────┘
   64px wide
```

**Props:**

- `day: AvailabilityDay` — per-day data from API
- `availabilityIcons: Record<string, string>` — maps occupancy_status → SVG URL
- `isSelected?: boolean` — passed to WdDayLabel as isActive
- `hutTypeColor?: string` — for top stripe and background tint

**Visual states:**

- Loading: skeleton placeholders
- Unknown: gray icon + `?` for free count
- Empty/Low/Medium/High/Full: colored availability SVG + numbers
- Selected: bold day name (via WdDayLabel isActive)
- Weekend: no special styling (bold is handled by isActive)

**Styling:**

- Border-radius: 10px (matching weather day)
- Subtle background tint based on hut type color (5-10% opacity)
- Top stripe: 2-3px solid using hut type color
- Free number colored by occupancy status (using API's availability category colors)
- Total number in `rgba(dark, 0.4)` gray, smaller font

### WdAccommodationAvailabilities

Parent container with Swiper, month navigation, and data loading.

**Structure:**

```
┌──────────────────────────────────────────────────────┐
│  Verfügbarkeit                    APR MAI JUN JUL AUG │
│                                    ← ─────────── →   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [slide][slide][slide][slide][slide][slide][slide]   │
│                                                      │
│  ═════════════════════════════════════════ scrollbar  │
└──────────────────────────────────────────────────────┘
```

**Props:**

- `slug: string`
- `hasAvailability?: boolean`
- `hutTypeColors?: Record<string, string>` — maps type_slug → color (optional, for hut type stripe)

**Data flow:**

1. Fetch availability icons from `/v1/categories/map/availability` once (cache in component)
2. Fetch per-day availability from `/v1/huts/{slug}/availability/{date}`
3. Initialize date range (4 days before today → 365 days after)
4. Load data lazily as user scrolls (Swiper `slideChange` event)
5. Scroll to selected date on mount

**Swiper configuration (matching WdWeatherForecast):**

```typescript
{
  modules: [FreeMode, Scrollbar],
  slidesPerView: 'auto',
  spaceBetween: 0,
  freeMode: {
    enabled: true,
    sticky: true,
    momentum: true,
    momentumRatio: 0.02,
    momentumBounce: false,
    minimumVelocity: 0.02,
  },
  scrollbar: {
    draggable: true,
    hide: true,
    snapOnRelease: false,
  },
  grabCursor: true,
}
```

**Month selector:**

- Keep the current chip-bar approach (APR MAI JUN JUL...)
- Styled with month gradient classes
- Scroll Swiper to clicked month via `slideTo()`
- Detect active month from Swiper position

## Availability Icon Mapping

The API at `/v1/categories/map/availability?lang=de&is_active=true&media_mode=absolute` returns:

```json
{
  "empty":  { "symbol_detailed": "http://localhost:8000/media/symbols/empty.svg", ... },
  "low":    { "symbol_detailed": "http://localhost:8000/media/symbols/low.svg", ... },
  "medium": { "symbol_detailed": "http://localhost:8000/media/symbols/medium.svg", ... },
  "high":   { "symbol_detailed": "http://localhost:8000/media/symbols/high.svg", ... },
  "full":   { "symbol_detailed": "http://localhost:8000/media/symbols/full.svg", ... },
  "unknown":{ "symbol_detailed": "http://localhost:8000/media/symbols/unknown.svg", ... }
}
```

Each SVG is a 48x48 pie-chart circle showing fill level. The component maps `occupancy_status` → `symbol_detailed` URL and renders via `q-img`.

## Per-Day Data from API

The `CurrentAvailabilityDaySchema` provides per day:

| Field                | Type   | Use in component                      |
| -------------------- | ------ | ------------------------------------- |
| `date`               | string | WdDayLabel                            |
| `occupancy_status`   | enum   | Select availability SVG icon          |
| `free`               | number | Free beds display (bold line)         |
| `total`              | number | Total beds display (light line)       |
| `hut_type`           | string | Hut type label                        |
| `type_slug`          | string | Hut type identification               |
| `type_color`         | string | Top stripe + background tint color    |
| `type_identifier`    | string | Hut type emoji (unused for now)       |
| `reservation_status` | enum   | Link behavior (possible/not_possible) |
| `link`               | string | Click target URL                      |

The hut type info (`type_color`, `type_slug`) comes per-day, replacing the manual `symbolMap` construction in the parent.

## Lazy Loading Strategy

Unlike the current virtual scroll approach, Swiper renders all slides in the DOM (but off-screen slides are typically not visible). Strategy:

1. Initialize full date range with loading state
2. Pre-load ±14 days around current position
3. On `slideChange` or `sliderMove`, check visible range and load missing data
4. Batch API calls (request 30-day chunks when possible)
5. Update items in-place when data arrives

## Refactoring WdWeatherDay to use WdDayLabel

Extract from WdWeatherDay:

- `dayLabel` computed (Heute/Morgen/Gestern/weekday)
- `dateLabel` computed (DD.MM.)
- `isToday`, `isPast` computed
- Day name + date template section

Replace with:

```vue
<WdDayLabel :date="day.date" :is-active="isSelected" />
```

The styling for past opacity and today boldness will stay in WdWeatherDay (applied to the wrapper), while WdDayLabel only handles the text content and bold prop.

## Styling Notes

- Month gradient classes (`month_XX--gradient`) are NOT used in the new design
- Background tint comes from `type_color` with low opacity
- Availability icon colors come from the SVGs themselves
- Free number color: inherit from occupancy_status (green=available, red=full, etc.)
- The component uses the same border-radius (10px) and padding patterns as WdWeatherDay
