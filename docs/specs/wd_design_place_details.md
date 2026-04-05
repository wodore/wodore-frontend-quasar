# Place Detail Design Specification (Mobile)

> Design specification for the mobile bottom-sheet place detail view in the Wodore app.

## Table of Contents

- [Overview](#overview)
- [Terminology](#terminology)
- [Data Model](#data-model)
- [Snap Points](#snap-points)
- [Layout Zones](#layout-zones)
- [Components](#components)
- [Variations](#variations)
- [Design Decisions](#design-decisions)

---

## Overview

The place detail view appears as a **bottom sheet** on mobile, overlaying the map. It is designed to work for any place type (accommodation, train station, water spot, village, etc.) but is currently focused on **accommodations**.

### Key Principles

1. **Progressive disclosure**: Show the most important info first (snap 1), reveal more on drag (snap 2), full detail on scroll (snap 3).
2. **Image resilience**: Images may load slowly or be absent entirely. The layout must not depend on images being present.
3. **Data-first**: Category badges (type + capacity) and monthly status are the most distinctive data and should be visible early.
4. **Action accessibility**: The BOOK button (when available) and source links must be reachable from snap 1 or 2 without scrolling.

---

## Terminology

| Term               | Description                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Sheet**          | The entire bottom-sheet overlay container                                                              |
| **Drag Handle**    | The small horizontal bar at the top of the sheet for dragging                                          |
| **Header**         | The always-visible top area containing place name, owner, weather, and close button                    |
| **Category Badge** | A chip showing accommodation type (hut, bivouac, etc.) + capacity. Can be 1 or 2 (open + closed types) |
| **Monthly Strip**  | Compact row of 12 cells showing open/closed/maybe status per month with a dot for current month        |
| **Status Dot**     | Small colored indicator: green (open/yes), red (closed/no), green-dark (maybe), grey (unknown)         |
| **BOOK Button**    | Prominent CTA button shown when `has_availability` is true. Links to booking source                    |
| **Action Toolbar** | Fixed bottom bar with source links (SAC, OSM, etc.), review badge, watch, and more menu                |
| **Content Scroll** | The scrollable area between header and action toolbar containing image, badges, description, etc.      |
| **Image Area**     | Where the place photo is displayed, or a placeholder "add image" if no images exist                    |
| **Section**        | A titled content block within the scroll area (e.g., "Availability", "Open Status", "Location")        |
| **Elevation Pill** | Small chip or inline text showing elevation in meters                                                  |
| **Owner**          | The organization that operates the place (e.g., "SAC Basel")                                           |

---

## Data Model

### Place (Accommodation)

```typescript
interface PlaceDetail {
  slug: string;
  name: string;
  description?: string;
  description_attribution?: string;
  owner: { name: string; slug: string; url?: string };
  elevation?: number;
  location: { lat: number; lon: number };
  url?: string; // External website

  // Accommodation-specific
  type_open?: CategoryType; // Category when open (e.g., "hut" with 60 beds)
  type_closed?: CategoryType; // Category when closed (e.g., "selfhut" with 16 beds)
  capacity_open?: number; // Beds when attended
  capacity_closed?: number; // Beds when unattended
  open_monthly: MonthlyStatus; // Status per month
  has_availability?: boolean; // Has live booking data
  availability_source?: string; // e.g., "hrs"

  sources: Source[]; // External links (SAC, OSM, etc.)
  images: Image[]; // Gallery images
  review_status: string; // Data quality status
}
```

### Category Type

Accommodation categories (ordered by complexity):

| Slug      | Name           | Typical Capacity | Color     |
| --------- | -------------- | ---------------- | --------- |
| `unknown` | Unknown        | —                | `#dddaec` |
| `closed`  | Closed         | —                | `#4B8E43` |
| `campgr`  | Campground     | —                | `#a08f6d` |
| `shelter` | Basic Shelter  | ~6               | `#ff9801` |
| `camping` | Camping        | —                | `#4B8E43` |
| `bivouac` | Bivouac        | ~6-17            | `#d4d4ff` |
| `selfhut` | Unattended Hut | ~10-30           | `#4B8E43` |
| `hut`     | Attended Hut   | ~20-150          | `#dfebfa` |
| `alp`     | Alp            | ~10-20           | `#d88a55` |
| `bhotel`  | Basic Hotel    | ~20-50           | `#636c77` |
| `hostel`  | Hostel         | ~20-80           | `#cfdfe8` |
| `special` | Special        | varies           | `#a7696a` |
| `hotel`   | Hotel          | ~30+             | `#ffd740` |
| `resta`   | Restaurant     | —                | `#4B8E43` |

### Monthly Status

Each month can be: `yes` | `no` | `maybe` | `unknown`

**Future**: Percentages per month with multiple categories (e.g., Jan: 50% hut + 50% unattended).

---

## Snap Points

Three snap positions, matching the current implementation:

| Snap                   | Height              | What's Visible                                                    | Use Case                                                     |
| ---------------------- | ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| **Snap 1** (collapsed) | ~150px              | Header + Action Toolbar                                           | Quick glance at name, weather, source links                  |
| **Snap 2** (default)   | ~370-420px          | Header + Category Badges + Monthly Strip + Image + Action Toolbar | Main interaction point, drag up for more                     |
| **Snap 3** (full)      | ~calc(100vh - 44px) | Everything, scrollable                                            | Reading description, full monthly details, location, weather |

### Snap Behavior

- **Default open**: Snap 2
- **Swipe down from Snap 1**: Dismiss sheet
- **Auto-expand to Snap 3**: When user scrolls within snap 2 content
- **Drag handle**: Visible at all snap points, centered, 36px wide, 4px tall, grey-400

---

## Layout Zones

```
┌──────────────────────────────┐
│         DRAG HANDLE          │  ← 4px grey bar, centered
├──────────────────────────────┤
│                              │
│           HEADER             │  ← Place name, owner, weather, close btn
│                              │
├──────────────────────────────┤
│                              │
│       CONTENT SCROLL         │  ← Scrollable area
│  ┌────────────────────────┐  │
│  │   CATEGORY BADGES      │  │  ← Type + capacity chips
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   MONTHLY STRIP        │  │  ← Compact 12-month status
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   IMAGE AREA           │  │  ← Photo or placeholder
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   DESCRIPTION          │  │  ← Optional, clamped
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   AVAILABILITY         │  │  ← If has_availability
│  │   [  BOOK BUTTON  ]    │  │  ← Prominent CTA
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   OPEN MONTHLY DETAIL  │  │  ← Expanded monthly view
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   WEATHER              │  │  ← Lazy-loaded forecast
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │   LOCATION             │  │  ← Coordinates + copy
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│                              │
│       ACTION TOOLBAR         │  ← Source links, review badge, more menu
│                              │
└──────────────────────────────┘
```

---

## Components

### Header

**Always visible** at all snap points.

```
┌──────────────────────────────────┐
│ [×]                              │  ← Close button (top-right)
│  Schreckhornhütte SAC       🌤️  │  ← Place name (h5) + Weather
│  SAC Basel · 2530 m              │  ← Owner · Elevation
└──────────────────────────────────┘
```

- **Place name**: `text-h6` on mobile, `text-h5` on tablet. Links to `place.url` if available (with external link icon).
- **Owner**: `text-subtitle2` in `text-accent-700` color.
- **Elevation**: Inline with owner, separated by `·`. `text-caption` in `text-grey-600`.
- **Weather icon**: Small circular button (28px), top-right of header area. Opens weather popover.
- **Close button**: 28px round, top-right corner, `grey-600`, `rgba(0,0,0,0.06)` background.

### Category Badges

Shows the accommodation type(s) and capacity.

**Two badges max** (type_open + type_closed if different):

```
┌──────────────────┐ ┌──────────────────┐
│ [🏠] Hut  60 beds │ │ [🏚️] Unattended 16 │
└──────────────────┘ └──────────────────┘
```

- **Layout**: Horizontal row with gap. Wraps to second line if needed.
- **Badge style**: Rounded chip (8px radius), ~90px wide, 30px tall.
- **Avatar**: 24px square with category symbol (from API), colored background.
- **Text**: Category name + capacity. `text-body2`, 500 weight.
- **Colors**:
  - Open/active type: `bg-positive-200`, avatar `bg-positive-400`
  - Closed/reduced type: `bg-negative-100`, avatar `bg-negative-200`
  - Unknown: `bg-grey-200`, avatar `bg-grey-400`
- **Single badge**: If only type_open exists (no winter type), show just one.

### Monthly Strip

Compact status indicator for all 12 months.

```
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ J │ F │ M │ A │ M │ J●│ J │ A │ S │ O │ N │ D │
│ ✕ │ ✕ │ ~ │ ✓ │ ~ │ ~●│ ✓ │ ✓ │ ✓ │ ✕ │ ✕ │ ✕ │
└───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘
```

- **Layout**: 12 equal-width cells in a row.
- **Cell height**: ~28px. Labels on top row, status on bottom.
- **Colors**:
  - `yes` → `bg-positive-200`, text `text-positive-900`
  - `no` → `bg-negative-100`, text `text-negative-900`
  - `maybe` → `bg-primary-100`, text `text-primary-700`
  - `unknown` → `bg-grey-200`, text `text-grey-500`
- **Current month dot**: A small dot (4px) below the current month cell.
- **Font**: `text-caption` for labels, status symbol (✓/✕/~) slightly larger.

**Future**: When percentages are available, cells show proportional color fills (e.g., top half green for 50% hut, bottom half grey for 50% closed).

### BOOK Button

Prominent call-to-action when `has_availability` is true.

```
┌────────────────────────────────────┐
│           BOOK NOW                 │
│     Check availability →          │
└────────────────────────────────────┘
```

- **Style**: Full-width within content area, `accent-500` background, white text.
- **Border radius**: 12px.
- **Height**: ~44px.
- **Position**: Directly below the category badges (visible in snap 2).
- **Link**: Opens the first source with availability (e.g., HRS/Alpsonline).
- **Hidden**: When `has_availability` is false or null.

### Image Area

Displays the place photo or a placeholder.

**With image**:

- Aspect ratio: 16:10
- Border radius: 12px
- "Add photo" button overlay (top-left, 30px round, semi-transparent)
- Attribution overlay (bottom-right, dark semi-transparent background)
- Max height in snap 2: ~180px (to leave room for badges and monthly strip)

**Without image**:

- Placeholder area: light grey background, centered camera icon + "Add image" text
- Links to MapComplete contribution flow
- Height: ~120px

**Loading state**:

- Skeleton placeholder with shimmer animation
- Height matches image area

### Description

- **Font**: `text-body2`
- **Max lines**: 5 (clamped with "... Show more" link)
- **Attribution**: Small text right-aligned above description, `text-caption` in `text-grey-400`
- **Hidden**: If no description exists

### Availability Section

Only shown when `has_availability` is true.

- Shows availability data per day (implementation depends on API)
- Displayed as a calendar-like grid or simple text summary
- Located below the image in the scroll area

### Open Monthly Detail

Expanded version of the monthly strip, visible in snap 3:

- Shows category symbols per month (using `symbol_simple` from API)
- More spacing between cells
- Full month names (Jan, Feb, ...) instead of single letters

### Location

- **Icon**: Crosshair/pin icon (16px)
- **Coordinates**: Link to `geo:` URI, `text-primary-500` color
- **Copy button**: Small icon button to copy coordinates to clipboard
- **Precision**: 7 digits lat, 6 digits lon

### Action Toolbar

Fixed at the bottom of the sheet, always visible.

```
┌──────────────────────────────────────────────┐
│ 📍  [SAC]  [OSM]  [HRS]     ok   👁  ⋮     │
└──────────────────────────────────────────────┘
```

- **Geo link**: Opens maps app with coordinates
- **Source buttons**: Logo icons for each external source (SAC, OSM, HRS, etc.)
- **Review badge**: Outline badge showing data quality ("ok", "ungeprüft", etc.)
- **Watch button**: Eye icon (currently disabled/placeholder)
- **More menu**: Three-dot menu with: Favorite, Show on map, Edit (editor role only)
- **Border**: Top border `1px solid rgba(0,0,0,0.1)`, subtle top shadow

---

## Variations

Four layout approaches for the place detail sheet. Each variation rearranges the same components with different priorities.

### Variation 1: Compact Data (Recommended for implementation)

Prioritizes category badges and monthly strip over the image. Image is smaller and positioned after the data.

```
Snap 1: [Header + Action Toolbar]
Snap 2: [Header] [Badges] [Monthly Strip] [BOOK btn] [Small Image] [Action Toolbar]
Snap 3: Full scroll with description, availability, weather, location
```

**Rationale**: Most users want to quickly see "what type is it" and "is it open now". Images load slowly and many huts have none. The monthly strip at snap 2 gives an instant seasonal overview.

### Variation 2: Balanced

Equal weight to data and image. Image on the left, badges on the right (like current implementation).

```
Snap 1: [Header + Action Toolbar]
Snap 2: [Header] [Image(left) + Badges(right)] [BOOK btn] [Action Toolbar]
Snap 3: Full scroll with monthly detail, description, etc.
```

**Rationale**: Familiar layout similar to the current implementation. Works well when most places have images.

### Variation 3: Hero Image

Full-width hero image with gradient overlay containing the title.

```
Snap 1: [Plain Header + Action Toolbar]
Snap 2: [Hero Image with title overlay] [Badges overlapping] [Action Toolbar]
Snap 3: Full scroll with all details
```

**Rationale**: Visually striking, but problematic for places without images. Would need a good placeholder state.

### Variation 4: Modern Card

Colored header with stat cards for key numbers.

```
Snap 1: [Colored Header + Action Toolbar]
Snap 2: [Colored Header] [Stat Cards] [Image] [Action Toolbar]
Snap 3: Full scroll
```

**Rationale**: Information-dense, good for quick scanning. The colored header gives visual identity but may clash with different place types.

---

## Design Decisions

### Why badges before image?

1. Images load slowly (fetched from external sources like Wikimedia)
2. Many places have no images at all
3. Category type (hut vs bivouac vs shelter) and capacity are the most distinguishing information
4. Monthly strip tells you at a glance if the place is open when you plan to go

### Why BOOK button is prominent

- For accommodations with booking data, this is the primary user action
- Should be visible from snap 2 without scrolling
- Uses accent color (yellow/gold) for maximum visibility

### Why monthly strip is compact

- 12 months × 2 rows fits in ~28px height
- Can be shown at snap 2 alongside badges
- Future: percentage fills can replace simple yes/no coloring
- Current month indicator (dot) helps users orient instantly

### Weather placement

- Weather icon in the header area (near close button)
- Lazy-loaded forecast section in the scroll area
- Only fetched when the weather section becomes visible (intersection observer)

---

## Accessibility

- All interactive elements must have `aria-label`
- Color is not the only indicator (use ✓/✕/~ symbols + color)
- Minimum touch target: 44×44px for all buttons
- Focus management: When sheet opens, focus the drag handle
- Screen reader: Announce snap changes ("Expanded to show more details")

---

## Responsive Notes

- This spec covers **mobile only** (`$q.screen.xs` / `< 599px`)
- Desktop uses a right-side drawer (460px/380px width) with the same components in a different layout
- Tablet may use either depending on orientation
