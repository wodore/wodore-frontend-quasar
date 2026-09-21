# Place Details Refactoring Summary - 2026-03-21

## Overview

Successfully implemented the place/hut details view refactoring, splitting the monolithic component into modular components with proper desktop drawer and mobile bottom sheet support.

## Completed Work

### 1. Component Architecture

- **WdPlaceTitle.vue**: Header component with hut name, external link, and weather widget
- **WdPlaceActions.vue**: Action toolbar with geo link, source buttons, review badge, and menu
- **WdPlaceContent.vue**: Main content component with gallery, chips, weather, location, and description

### 2. Layout Integration

- Desktop: Nested QLayout with sticky header and scrollable content in drawer
- Mobile: Bottom sheet with header/footer slots and native scrolling
- Route-driven state management for opening/closing

### 3. Critical Fixes

- **QLayout Container CSS**: Fixed wrapper height collapse issue with critical CSS rules in MainLayout.vue (lines 202-213)
- **Height Calculation Pattern**: Proper `height: 100%` cascade for Quasar's layout engine
- **Desktop Height**: `calc(100% - 80px)` to reserve space for close button
- **Pointer Events**: Fixed click-through issues on action toolbar icons

### 4. Bottom Sheet Smart Dismiss Logic

- **File**: `src/components/utils/WdBottomSheet.vue`
- **Implementation**:
  - Added `scroll-snap-stop: always` CSS on index 1 snap point (class="bottom")
  - Forces users to stop at index 1 (header-only) when swiping down
  - Prevents accidental dismisses from index 2 or 3
  - Only allows dismiss when swiping from index 1 to 0
- **Tracking**: `previousSnapIndex` and `currentSnapIndex` refs to detect valid dismiss transitions

### 5. UX Improvements

- **Clickable Coordinates**: Geo link directly on coordinates (no separate icon)
- **Geo Location Button**: Added as first item in action toolbar with `eva-pin-fill` icon
- **Review Status Badge**: Restored in action toolbar
- **Watch Button**: Restored with favorite/fly-to/edit menu

### 6. Styling Fixes

- Fixed chip heights on mobile (30px with `!important` overrides)
- Removed preview gallery z-index overlap
- Added shadow to action toolbar
- Fixed close button pointer events

## Open Issues

### High Priority

#### 1. Title Header Background Still Wrong

**Issue**: Header background color not matching original (grey instead of transparent)  
**Location**: `src/components/content/place/WdPlaceTitle.vue`  
**Note**: Rework of header needed anyway for proper styling

#### 2. Geo Location Icon in Action Bar Not Visible

**Issue**: The geo pin icon in the action toolbar is not showing up properly  
**Location**: `src/components/content/place/WdPlaceActions.vue:24` - `WdToolbarButton` with `icon="eva-pin-fill"`  
**Needs Investigation**: Check if icon name is correct or if there's a rendering issue

#### 3. Header Shadow When Scrolled Down Not Working

**Issue**: Sticky header should show shadow when content is scrolled beneath it  
**Location**: Desktop drawer header in `src/layouts/MainLayout.vue`  
**Possible Solution**: Need scroll event listener or CSS-based solution to add shadow class

### Medium Priority

#### 4. Image Skeleton Not Correct (Full Width)

**Issue**: Loading skeleton for images doesn't match the final image dimensions  
**Location**: `src/components/media/WdMediaPreview.vue` or gallery components  
**Note**: Loading states in general need rework

#### 5. Small Footer Space Visible in Drawer (White)

**Issue**: White space visible at bottom of drawer content area  
**Location**: Desktop drawer in `src/layouts/MainLayout.vue`  
**Likely Cause**: Padding or margin on QLayout/QPage/QScrollArea

#### 6. Too Much Margin/Padding in Mobile View Content

**Issue**: Content has excessive spacing in mobile bottom sheet view  
**Location**: `src/components/content/place/WdPlaceContent.vue` or bottom sheet wrapper  
**Needs**: Review padding classes on mobile vs desktop

## Files Modified

### Core Components

- `src/components/content/place/WdPlaceTitle.vue` (renamed from WdPlaceHeader.vue)
- `src/components/content/place/WdPlaceActions.vue` (renamed from WdPlaceFooter.vue)
- `src/components/content/place/WdPlaceContent.vue`

### Layout & Infrastructure

- `src/layouts/MainLayout.vue` (multiple iterations for layout fixes)
- `src/components/utils/WdBottomSheet.vue` (smart dismiss logic)

### Supporting Components

- `src/components/huts/WdHutTypeChip.vue` (chip height fixes)
- `src/components/media/WdMediaPreview.vue` (z-index removal)

## Technical Decisions

### QLayout Container Mode

```scss
// Critical CSS for nested QLayout in container mode
.q-layout-container > div > div {
  min-height: 0;
  max-height: 100%;
  height: 100%;
}
```

### Bottom Sheet Snap Stop

```scss
/* Force the snap at index 1 (bottom) to always stop */
bottom-sheet [slot='snap'].bottom::before {
  scroll-snap-stop: always;
}
```

### Height Calculation Pattern

```vue
<!-- Desktop drawer height -->
<q-layout :style="`height: ${$q.screen.gt.sm ? 'calc(100% - 80px)' : '100%'}`">
  <!-- Scrollable content -->
  <q-scroll-area style="height: 100%">
    <!-- Content -->
  </q-scroll-area>
</q-layout>
```

## Next Steps

1. **Header Redesign**: Plan and implement proper header component with correct background behavior
2. **Icon Investigation**: Debug geo location icon visibility issue
3. **Scroll Shadow**: Implement header shadow on scroll
4. **Loading States**: Comprehensive rework of image loading and skeleton states
5. **Spacing Audit**: Review and fix padding/margin inconsistencies in mobile view
6. **Footer Space Fix**: Eliminate white space at bottom of drawer

## References

- Original proposal: `_work/260320_refactoring_architecture_proposal_v2.md`
- Bottom sheet implementation: `_work/260320_bottom_sheet_implementation_progress.md`
- Pure Web Bottom Sheet issue on snap-stop: https://github.com/viliket/pure-web-bottom-sheet/issues/6
