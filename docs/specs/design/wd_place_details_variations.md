# Place Detail Design Variations (Mobile Bottom Sheet)

> Four design variations for the mobile place detail bottom sheet with integrated strip, detailed category symbols, and comprehensive information display.

## Overview

This document presents **4 distinct design variations** for the mobile place details bottom sheet. All variations:

- Use the **integrated monthly strip** (not a separate component)
- Display **detailed category symbols** (not mono/simple when space allows)
- Show **availability over multiple months** and **next 4 days**
- Include **weather forecast** (14 days), **location**, **reviews/stars**
- Use **category names from API** (Hütte, Biwak, Gasthaus, etc.)
- Apply **monthly gradient colors** from existing SCSS
- **Synchronize all 4 snap points** across all variations

---

## Key Requirements Implemented

1. **Integrated Strip**: Monthly status integrated directly into the layout, not as a standalone visual element
2. **Detailed Symbols**: Use `symbol_detailed` from categories (colorful, recognizable icons)
3. **Comprehensive Data**:
   - Description with attribution
   - Availability: Multi-month overview + next 4 days detail
   - Weather: 14-day forecast (lazy loaded)
   - Location: Coordinates + map link
   - Reviews: Star rating + review status badge
4. **4 Snap Positions**:
   - **Snap 0**: Dismissed (swipe down from snap 1)
   - **Snap 1**: Header only (~150px) - Quick glance
   - **Snap 2**: Default (~420px) - Main interaction
   - **Snap 3**: Full (~calc(100vh - 330px)) - All details
5. **Monthly Colors**: Use existing gradient system from `src/css/months.scss`
6. **Category Names**: Display German names from API (Hütte, Biwak, Selbstversorgerhütte, etc.)

---

## Common Elements Across All Variations

### Drag Handle

- Always visible at top
- 36px wide × 4px tall
- Grey-400 color
- 12px margin top/bottom

### Header (Always Visible)

```
┌────────────────────────────────────┐
│ [×]                                │ ← Close button (top-right)
│  Schreckhornhütte SAC         🌤️  │ ← Place name + Weather icon
│  SAC Basel · 2530 m                │ ← Owner · Elevation
└────────────────────────────────────┘
```

### Action Toolbar (Always Visible - Bottom)

```
┌────────────────────────────────────┐
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │
└────────────────────────────────────┘
```

- Geo link (opens maps app)
- Source buttons (SAC, OSM, booking sources)
- Star rating (if reviews available)
- Watch button
- More menu (favorite, show on map, edit)

### Category Chips (Common Design)

```
┌─────────────────────┐
│ [🏠] Hütte    60    │ ← Detailed symbol + name + capacity
│      ✓              │ ← Status badge (yes/no/maybe)
└─────────────────────┘
```

- Width: ~110px, Height: 40px
- Avatar: 32px with detailed category symbol
- Background: Status-dependent (positive-200, negative-100, primary-100)
- Status badge: Small floating badge (✓/✕/?)

### Monthly Strip (Integrated)

Uses gradient colors from `months.scss`:

- Jan-Feb: Light blue (#bfefff) - winter
- Mar: Blue→Peach transition
- Apr-May: Warm peach (#ffd699) - spring
- Jun-Jul: Bright yellow (#ffe9a8) - summer
- Aug-Sep: Yellow→Pink transition
- Oct-Nov: Soft pink (#ffcccc) - autumn
- Dec: Pink→Blue transition

Each month cell shows:

- Month abbreviation (Jan, Feb, ...)
- Status (colored background + symbol or detailed icon)
- Current month indicator (dot or highlight)

---

## Variation 1: Compact Data Priority

**Philosophy**: Data-first approach. Categories and monthly status are the hero elements, visible immediately at snap 2.

### Snap 1 (150px) - Header Only

```
┌────────────────────────────────────┐
│         ─────                      │ ← Drag handle
│                                    │
│ [×]                                │
│  Schreckhornhütte SAC         🌤️  │
│  SAC Basel · 2530 m                │
│                                    │
├────────────────────────────────────┤
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │ ← Action toolbar
└────────────────────────────────────┘
```

### Snap 2 (420px) - Categories + Monthly + Small Image

```
┌────────────────────────────────────┐
│         ─────                      │
│ [×]                                │
│  Schreckhornhütte SAC         🌤️  │
│  SAC Basel · 2530 m                │
├────────────────────────────────────┤
│                                    │ ← Scrollable content starts
│  ┌──────────┐ ┌──────────┐        │
│  │🏠 Hütte  │ │🛖 Selbst-│        │ ← Category chips (side by side)
│  │   60  ✓  │ │versorger │        │
│  └──────────┘ │   16  ✕  │        │
│               └──────────┘         │
│                                    │
│  ┌────────────────────────────┐   │
│  │ J F M A M J● J A S O N D   │   │ ← Compact monthly strip
│  │ ✕ ✕ ~ ✓ ✓ ✓● ✓ ✓ ✓ ~ ✕ ✕   │   │   (colored backgrounds)
│  └────────────────────────────┘   │
│                                    │
│  ┌────────────────────────────┐   │
│  │        [Image 16:10]        │   │ ← Smaller image (120px height)
│  │         or                  │   │
│  │    [Add Photo Button]       │   │
│  └────────────────────────────┘   │
│                                    │
│  Die Schreckhornhütte liegt...    │ ← Description (2 lines clamped)
│                                    │
├────────────────────────────────────┤
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │
└────────────────────────────────────┘
```

### Snap 3 (Full) - All Details

Scrollable content includes:

1. **Category Chips + Monthly Strip** (sticky at top)
2. **Image Gallery** (if available)
3. **Description** (full text, expandable)
4. **Availability Section** (if `has_availability`)
   - Multi-month calendar view (next 3 months)
   - Next 4 days detail with icons
   - Book button (prominent, accent color)
5. **Monthly Details** (expanded)
   - Large cells with detailed symbols per month
   - Full month names
   - Category percentages if available
6. **Weather** (14 days, lazy loaded)
7. **Location** (coordinates, elevation, map link)
8. **Reviews** (stars, count, status)

**Rationale**: Most users want to see "what type" and "when open" first. This variation prioritizes that data.

---

## Variation 2: Balanced Image & Data

**Philosophy**: Equal weight to visual (image) and data (categories/monthly). Familiar layout.

### Snap 1 (150px) - Header Only

Same as Variation 1

### Snap 2 (420px) - Image Left, Data Right

```
┌────────────────────────────────────┐
│         ─────                      │
│ [×]                                │
│  Schreckhornhütte SAC         🌤️  │
│  SAC Basel · 2530 m                │
├────────────────────────────────────┤
│                                    │
│  ┌─────────┐  ┌──────────┐        │
│  │         │  │🏠 Hütte  │        │
│  │  Image  │  │   60  ✓  │        │
│  │ 180x120 │  │          │        │
│  │         │  │🛖 Selbst-│        │
│  │         │  │versorger │        │
│  └─────────┘  │   16  ✕  │        │
│               └──────────┘         │
│                                    │
│  ┌────────────────────────────┐   │
│  │ Jan Feb Mar Apr May Jun●...│   │ ← Integrated monthly strip
│  │ [🏠][🏠][🛖][🏠][🏠][🏠]●  │   │   (detailed symbols + gradient)
│  └────────────────────────────┘   │
│                                    │
│  Die Schreckhornhütte liegt...    │ ← Description (2 lines)
│                                    │
├────────────────────────────────────┤
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │
└────────────────────────────────────┘
```

### Snap 3 (Full) - All Details

Similar structure to Variation 1, but with:

- **Image gallery** at top (larger, more prominent)
- **Availability calendar** with visual month grid
- **Next 4 days** as cards with weather integration
- Full sections for weather, location, reviews

**Rationale**: Balanced approach. Good for places with high-quality images. Monthly strip uses detailed symbols directly for quick recognition.

---

## Variation 3: Card-Based Layout

**Philosophy**: Modern, card-based design. Each section is a distinct card with clear separation.

### Snap 1 (150px) - Header Only

Same as Variation 1

### Snap 2 (420px) - Stacked Cards

```
┌────────────────────────────────────┐
│         ─────                      │
│ [×]                                │
│  Schreckhornhütte SAC         🌤️  │
│  SAC Basel · 2530 m                │
├────────────────────────────────────┤
│                                    │
│  ┌────────────────────────────┐   │
│  │ 🏠 Hütte · 60 Plätze    ✓  │   │ ← Type card (open)
│  │ Jun–Sep bewirtet            │   │
│  └────────────────────────────┘   │
│                                    │
│  ┌────────────────────────────┐   │
│  │ 🛖 Selbstversorger · 16 ✕   │   │ ← Type card (closed)
│  │ Okt–Mai Winterraum          │   │
│  └────────────────────────────┘   │
│                                    │
│  ┌────────────────────────────┐   │
│  │ Verfügbarkeit               │   │ ← Availability card
│  │ ┌──┬──┬──┬──┬──┬──┬──┐    │   │
│  │ │J │F │M │A │M │J●│J │... │   │   (monthly cells with
│  │ └──┴──┴──┴──┴──┴──┴──┘    │   │    gradient backgrounds)
│  │                             │   │
│  │ Nächste 4 Tage:            │   │
│  │ Mo Tu We Th                │   │
│  │ 🏠 🏠 🏠 🛖                 │   │   (daily symbols)
│  └────────────────────────────┘   │
│                                    │
│  ┌────────────────────────────┐   │
│  │     [Book Button]           │   │ ← Prominent CTA (if available)
│  └────────────────────────────┘   │
│                                    │
├────────────────────────────────────┤
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │
└────────────────────────────────────┘
```

### Snap 3 (Full) - Card Stack

All sections as cards:

1. **Hero Card**: Image + overlay with name (optional)
2. **Type Cards**: Open & Closed categories (separate cards)
3. **Availability Card**:
   - Monthly grid (next 12 months, scrollable)
   - Next 4 days with weather icons
   - Book button
4. **Description Card**: Full text with attribution
5. **Weather Card**: 14-day forecast, lazy loaded
6. **Location Card**: Coordinates, elevation, map preview
7. **Reviews Card**: Stars, recent reviews, status

**Rationale**: Clean, modern, scannable. Each piece of information is self-contained. Good for mobile-first design.

---

## Variation 4: Timeline / Calendar Focus

**Philosophy**: Calendar-first design. The monthly availability is the central visual element, with everything organized around the timeline.

### Snap 1 (150px) - Header Only

Same as Variation 1

### Snap 2 (420px) - Calendar Hero

```
┌────────────────────────────────────┐
│         ─────                      │
│ [×]                                │
│  Schreckhornhütte SAC         🌤️  │
│  SAC Basel · 2530 m                │
├────────────────────────────────────┤
│                                    │
│  ┌────────────────────────────┐   │
│  │        2025                 │   │
│  │                             │   │
│  │ Jan  Feb  Mar  Apr  May Jun●│   │ ← Timeline view
│  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐│   │   (larger cells with
│  │ │🛖│ │🛖│ │🛖│ │🏠│ │🏠│ │🏠●│   │    detailed symbols +
│  │ │✕│ │✕│ │?│ │✓│ │✓│ │✓●│   │    gradient backgrounds)
│  │ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘│   │
│  │                             │   │
│  │ Jul  Aug  Sep  Oct  Nov Dec │   │
│  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐│   │
│  │ │🏠│ │🏠│ │🏠│ │🛖│ │🛖│ │🛖│   │
│  │ │✓│ │✓│ │✓│ │?│ │✕│ │✕│   │
│  │ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘│   │
│  └────────────────────────────┘   │
│                                    │
│  Heute bis Donnerstag:            │
│  Mo    Tu    We    Th             │
│  ┌──┐  ┌──┐  ┌──┐  ┌──┐          │
│  │🏠│  │🏠│  │🏠│  │🏠│          │ ← Next 4 days
│  │16°│ │18°│ │20°│ │19°│          │   (with weather)
│  └──┘  └──┘  └──┘  └──┘          │
│                                    │
│  🏠 Hütte 60 Plätze               │ ← Legend
│  🛖 Selbstversorger 16 Plätze     │
│                                    │
├────────────────────────────────────┤
│ 📍 [SAC] [OSM] [HRS]    ⭐4.2  👁 ⋮ │
└────────────────────────────────────┘
```

### Snap 3 (Full) - Extended Timeline

1. **Extended Timeline**:
   - Multiple years (current + next year)
   - Horizontal scroll
   - Detailed symbols with capacity info on hover/tap
2. **Daily View**:
   - Next 14 days detail
   - Weather integration
   - Availability status
3. **Image Gallery** (smaller, secondary)
4. **Description** (collapsible)
5. **Booking Section**: Direct links to booking sources
6. **Location & Reviews**: Bottom sections

**Rationale**: Perfect for users planning trips. The calendar is the star. Great for seasonal accommodation where "when is it open" is the primary question.

---

## Detailed Component Specifications

### Integrated Monthly Strip (All Variations)

**Compact Version** (Variation 1, 2):

```
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│J │F │M │A │M │J●│J │A │S │O │N │D │
│✕ │✕ │~ │✓ │✓ │✓●│✓ │✓ │✓ │~ │✕ │✕ │
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

- Height: 32px (16px per row)
- Cell width: ~24px (12 cells across)
- Background: Gradient from `months.scss`
- Symbol: ✓ (yes), ✕ (no), ~ (maybe), ? (unknown)
- Current month: Dot indicator below

**Icon Version** (Variation 2):

```
┌─────┬─────┬─────┬─────┬─────┬─────┐
│Jan  │Feb  │Mar  │Apr  │May  │Jun● │
│ 🏠  │ 🏠  │ 🛖  │ 🏠  │ 🏠  │ 🏠● │
└─────┴─────┴─────┴─────┴─────┴─────┘
```

- Height: 44px
- Cell width: ~50px (scrollable on mobile)
- Detailed category symbol (32x32px)
- Background: Gradient from `months.scss`
- Current month: Highlighted border

**Timeline Version** (Variation 4):

```
┌────────┬────────┬────────┐
│  Jan   │  Feb   │  Mar   │
│  ┌──┐  │  ┌──┐  │  ┌──┐  │
│  │🛖│  │  │🛖│  │  │🛖│  │
│  │✕ │  │  │✕ │  │  │? │  │
│  └──┘  │  └──┘  │  └──┘  │
└────────┴────────┴────────┘
```

- Height: 80px per month
- Cell width: 80px
- Large detailed symbol (48x48px)
- Status badge below symbol
- Background: Full gradient from `months.scss`

### Availability Section

**Multi-Month View** (Snap 3):

- Calendar grid showing next 3 months
- Each day colored by status (available/limited/full)
- Click day for detail

**Next 4 Days** (Snap 2 & 3):

```
┌──────┬──────┬──────┬──────┐
│ Mo   │ Tu   │ We   │ Th   │
│ 🏠   │ 🏠   │ 🏠   │ 🛖   │
│ 12/20│ 15/20│ 18/20│  ✕   │
│ 16°  │ 18°  │ 20°  │ 19°  │
└──────┴──────┴──────┴──────┘
```

- Date + day of week
- Category symbol (what's open)
- Availability (beds available/total) or ✕ if closed
- Weather icon + temperature

### Weather Section (14 days)

Lazy loaded when visible. Displays:

- Daily forecast with icons
- Temperature range (high/low)
- Precipitation probability
- Wind speed
- Integration with availability (show what accommodation type is open that day)

### Reviews Section

```
┌────────────────────────────────┐
│ ⭐⭐⭐⭐⭐ 4.2 (127 reviews)  │
│                                │
│ Neueste Bewertungen:           │
│ • "Tolle Hütte!" - Max, 2 Tage │
│ • "Sehr freundlich" - Anna, 1w │
└────────────────────────────────┘
```

- Average star rating (0-5)
- Review count
- Recent reviews (2-3 latest)
- Link to all reviews

---

## Synchronization Rules (All 4 Variations)

All variations must maintain **identical snap positions**:

| Snap  | Height              | What's Always Visible                                        |
| ----- | ------------------- | ------------------------------------------------------------ |
| **0** | 0px                 | Dismissed (closed)                                           |
| **1** | 150px               | Header + Action Toolbar                                      |
| **2** | 420px               | Header + Main Content (varies by variation) + Action Toolbar |
| **3** | calc(100vh - 330px) | All content, scrollable                                      |

**Swipe Behavior**:

- Swipe up from Snap 2 → Snap 3
- Swipe down from Snap 2 → Snap 1
- Swipe down from Snap 1 → Snap 0 (dismiss)

---

## Implementation Notes

### Category Data from API

Expected fields from `/v1/categories/list/accommodation`:

```typescript
interface Category {
  slug: string; // 'hut', 'bivouac', 'selfhut', etc.
  name: string; // 'Hütte', 'Biwak', 'Selbstversorgerhütte'
  color: string; // '#dfebfa'
  symbol_detailed: string; // URL to detailed icon
  symbol_simple: string; // URL to simple icon
  symbol_mono: string; // URL to monochrome icon
  capacity_typical?: number;
}
```

### Monthly Color Application

Use existing SCSS classes:

- `.month_01--gradient-light` - Background for month cell
- `.month_01--gradient` - Background for month header
- `.month_01--gradient-dark` - Background for selected/active state

Colors automatically transition between months (e.g., March is 50% winter blue + 50% spring peach).

### Responsive Behavior

- **Mobile (< 600px)**: Use snap points as defined
- **Tablet (600-1024px)**: Consider wider bottom sheet (max 500px)
- **Desktop (> 1024px)**: Use side drawer instead (see existing implementation)

### Accessibility

- All interactive elements: min 44x44px touch target
- Color + symbol/text (not color alone)
- Aria labels for all icons
- Screen reader announcements for snap changes
- Keyboard navigation support

---

## Recommendations

**For Initial Implementation**: Start with **Variation 1 (Compact Data Priority)**

- Best data/space ratio
- Works well with or without images
- Progressive disclosure matches user mental model
- Easiest to implement with existing components

**For Best User Experience**: Consider **Variation 3 (Card-Based Layout)**

- Modern, familiar pattern
- Clear information hierarchy
- Easy to scan and interact
- Good for mobile-first users

**For Planning-Focused Users**: Use **Variation 4 (Timeline Focus)**

- Calendar is the hero element
- Perfect for trip planning
- Weather integration makes sense
- Best for seasonal accommodations

**For Balanced Approach**: Choose **Variation 2 (Balanced Image & Data)**

- Familiar layout
- Works well when images are high quality
- Good compromise between visual and data

---

## Next Steps

1. **User Testing**: Test all 4 variations with real users to determine preference
2. **A/B Testing**: Implement 2-3 variations and measure engagement
3. **Performance**: Ensure lazy loading works for weather, images
4. **API Integration**: Verify all required data fields are available
5. **Accessibility Audit**: Test with screen readers and keyboard navigation
6. **Animation**: Smooth transitions between snap points
7. **Edge Cases**: Handle missing data gracefully (no image, no availability, etc.)
