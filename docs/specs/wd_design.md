# Wodore Design System

Comprehensive guide for design patterns, colors, components, and styling in the Wodore frontend application.

## Table of Contents

- [Color System](#color-system)
- [Typography](#typography)
- [Icons](#icons)
- [Components](#components)
- [Spacing & Layout](#spacing--layout)
- [Interactive Elements](#interactive-elements)
- [Animations & Transitions](#animations--transitions)
- [Responsive Design](#responsive-design)

---

## Assets Repository

[wodore-design](https://github.com/wodore/wodore-design)

## [Color System](https://quasar.dev/style/color-palette)

### Color Palette

The Wodore design system uses a comprehensive color palette based on Quasar's color system, extended with custom shades (100-900).

#### Primary Colors

**Primary (Green)** - Main brand color

- `primary-100`: #8fd6b7 (lightest)
- `primary-500`: #346751 (base)
- `primary-900`: #133426 (darkest)

**Accent (Yellow/Gold)** - Highlight color

- `accent-100`: #e8c563
- `accent-500`: #bfab25 (base)
- `accent-900`: #6f5610

**Secondary (Turquoise)** - Secondary brand color

- `secondary-100`: #b2d7e1
- `secondary-500`: #9dd9d2 (base)
- `secondary-900`: #153037

#### Semantic Colors

**Positive (Green)** - Success, open, available

- `positive-100`: #8ce9c7
- `positive-500`: #25bf5e
- `positive-900`: #156b4b

**Negative (Red)** - Error, closed, unavailable

- `negative-100`: #f2acab
- `negative-500`: #bf211e
- `negative-900`: #6e1311

**Info (Blue)** - Information

- `info-100`: #abcff2
- `info-500`: #2673bf
- `info-900`: #0b2b4b

**Warning (Orange/Red)** - Warnings, alerts

- `warning-100`: #ff8593
- `warning-500`: #ff3c38
- `warning-900`: #8f0011

#### Neutral Colors

**Dark** - Dark backgrounds and text

- `dark-200`: #315e47
- `dark-500`: #112119 (base)
- `dark-700`: #0e1b14
- `dark-page`: #0a140f (page background)

**Black**

- `black-100`: #575757
- `black-500`: #1c1c1c
- `black-700`: #000000

**White**

- `white-500`: #ffffff
- `white-800`: #f7f7f7

**Icon** - Special icon color

- `icon`: #a9f0d2

### Using Colors

#### CSS Classes

```vue
<!-- Text colors -->
<div class="text-primary">Primary text</div>
<div class="text-primary-700">Darker primary text</div>
<div class="text-accent">Accent text</div>
<div class="text-positive">Success text</div>

<!-- Background colors -->
<div class="bg-primary">Primary background</div>
<div class="bg-dark-500">Dark background</div>
<div class="bg-accent-100">Light accent background</div>

<!-- Special effects -->
<div class="text-primary--halo">Text with halo effect</div>
```

#### SCSS Functions

```scss
// In .vue files or .scss files
.my-component {
  color: color('primary'); // Returns primary-500
  background: color('accent', 700); // Returns accent-700
  border-color: color('positive', 200);
}
```

### Color Usage Guidelines

**Primary Color** - Use for:

- Main navigation elements
- Primary actions
- Brand elements
- Hut status "maybe"

**Accent Color** - Use for:

- Call-to-action buttons
- Important highlights
- Selected states
- Active elements

**Semantic Colors** - Use for:

- `positive`: Success messages, "open" status, availability
- `negative`: Error messages, "closed" status, unavailability
- `info`: Informational messages, neutral status
- `warning`: Warning messages, alerts

**Dark/Light** - Use for:

- `dark`: Background in dark mode, overlays
- `white`: Background in light mode, text on dark backgrounds
- `icon`: Special icon tint color (#a9f0d2)

---

## [Typography])<https://quasar.dev/style/typography>)

### Font Families

- **Headings**: `Roboto Condensed`
- **Body**: `Roboto`
- Fallbacks: `-apple-system`, `Helvetica Neue`, `Helvetica`, `Arial`, `sans-serif`

### Type Scale

#### Headings

```vue
<div class="text-h1">Heading 1</div>
<!-- 6rem, 300 weight - NOT USED -->
<div class="text-h2">Heading 2</div>
<!-- 3.75rem, 300 weight - NOT USED-->
<div class="text-h3">Heading 3</div>
<!-- 3rem, 400 weight - NOT USED -->
<div class="text-h4">Heading 4</div>
<!-- 2.125rem, 400 weight - MAIN HEADER -->
<div class="text-h5">Heading 5</div>
<!-- 1.5rem, 400 weight -->
<div class="text-h6">Heading 6</div>
<!-- 1.25rem, 500 weight -->
```

#### Body Text

```vue
<div class="text-subtitle1">Subtitle 1</div>
<!-- 1rem, 400 weight -->
<div class="text-subtitle2">Subtitle 2</div>
<!-- 0.875rem, 500 weight -->
<div class="text-body1">Body 1</div>
<!-- 1rem, 400 weight -->
<div class="text-body2">Body 2</div>
<!-- 0.875rem, 400 weight -->
<div class="text-caption">Caption</div>
<!-- 0.75rem, 400 weight -->
<div class="text-overline">Overline</div>
<!-- 0.75rem, 500 weight, uppercase -->
```

### Typography Guidelines

- Use **headings** (`text-h1` to `text-h6`) for page titles, section headers
- Use **subtitle** for section subtitles, card headers
- Use **body1** for main content
- Use **body2** for secondary content, descriptions
- Use **caption** for small text, metadata (elevation, location)
- Use **overline** for labels, categories

---

## Icons

Wodore uses three icon systems:

### 1. Quasar Built-in Icons

The [eva icon set](https://akveo.github.io/eva-icons/) is used (see `quasar.config.ts` and `wd-icons.ts`)

```vue
<q-icon name="eva-chevron-down" />
<q-icon name="eva-close" />
```

### 2. Custom `wd` Icons (Fantasticon)

Custom icon font generated from SVG files in `src/extras/icons/svg/source/`:

```vue
<q-icon name="wd-calendar" />
<q-icon name="wd-favorite" />
<q-icon name="wd-location-question" />
<q-icon name="wd-add-outline" />
<q-icon name="wd-close" />
```

**Adding New Custom Icons:**

1. Add SVG file to `src/extras/icons/svg/source/`
2. Run `yarn gen:icons`
3. Use with `wd-{filename}` prefix

### 3. Iconify Icons (Unplugin Icons)

Auto-imported from any [Iconify](https://icon-sets.iconify.design/) collection:

```vue
<IconEvaSearchOutline />
<IconEvaCloseOutline />
<IconEvaCheckmarkFill />
```

**Pattern:** `Icon{Collection}{Name}` in PascalCase

**Common Collections:**

- `eva` - Eva Icons (outline and fill variants)
- `mdi` - Material Design Icons
- `carbon` - IBM Carbon Icons

### Icon Guidelines

- Use **Quasar icons** for common UI elements (home, search, close)
- Use **custom `wd` icons** for branded, Wodore-specific elements
- Use **Iconify** for specific icons not available in other sets
- Icon sizes: `xs`, `sm`, `md` (default), `lg`, `xl`
- For toolbar icons, use `text-icon` class (color: #a9f0d2)

---

## Components

### Input Fields

Standard input field pattern (dark mode):

```vue
<q-input v-model="value" dense dark standout readonly placeholder="Placeholder text">
  <template v-slot:append>
    <q-icon name="icon-name" class="text-icon cursor-pointer" size="sm" />
  </template>
</q-input>
```

**Properties:**

- `dense` - Compact height (40px)
- `dark` - Dark mode styling
- `standout` - Raised appearance
- `readonly` - For button-like inputs (calendar, search dropdown)

- Icon color: `text-icon` (#a9f0d2)

### Chips

Status chips for hut information:

```vue
<q-chip
  size="md"
  :class="'bg-' + color_bg"
  style="min-width: 90px; max-width: 90px; max-height: 30px"
>
  <q-avatar :class="'bg-' + color_bg_avatar" text-color="white">
    <q-icon size="24px" :name="icon" />
  </q-avatar>
  <span class="text-accent-900">Content</span>
</q-chip>
```

**Color Patterns:**

- Open (yes): `bg-positive-200`, avatar: `bg-positive-400`
- Closed (no): `bg-negative-100`, avatar: `bg-negative-200`
- Maybe: `bg-primary-100`, avatar: `bg-primary-200`

### Cards & Dialogs

```vue
<q-card class="dialog-radius bg-dark-500">
  <!-- Content -->
</q-card>
```

**Properties:**

- `dialog-radius` - Rounded corners (20px)
- Border radius: `$generic-border-radius: 6px` for general use
- Border radius: `$dialog-border-radius: 20px` for dialogs/modals

### Quasar Spacing

```vue
<!-- Margin -->
<div class="q-ma-xs">Extra small margin (4px)</div>
<div class="q-ma-sm">Small margin (8px)</div>
<div class="q-ma-md">Medium margin (16px)</div>
<div class="q-ma-lg">Large margin (24px)</div>
<div class="q-ma-xl">Extra large margin (48px)</div>

<!-- Padding -->
<div class="q-pa-xs">Extra small padding</div>
<div class="q-pa-sm">Small padding</div>
<div class="q-pa-md">Medium padding</div>

<!-- Directional -->
<div class="q-ml-md q-mr-md">Left and right margin</div>
<div class="q-pt-lg q-pb-lg">Top and bottom padding</div>
```

### Gap Spacing

Use CSS `gap` for flex/grid layouts:

```vue
<div class="row" style="gap: 12px">
  <!-- Items with 12px spacing -->
</div>
```

### Container Sizing

```vue
<div style="max-width: 250px; max-height: 40px">
  <!-- Toolbar input width -->
</div>
```

---

## Interactive Elements

### Buttons

```vue
<!-- Primary action -->
<q-btn color="accent" label="Action" />

<!-- Secondary action -->
<q-btn color="secondary" flat label="Cancel" />

<!-- Icon button -->
<q-btn flat round dense class="text-icon">
  <q-icon><IconEvaSearchOutline /></q-icon>
</q-btn>

<!-- Toolbar button -->
<q-btn flat round dense class="text-icon">
  <q-icon name="wd-calendar" size="sm" />
</q-btn>
```

**Properties:**

- `flat` - No background
- `round` - Circular shape
- `dense` - Compact size
- `no-caps` - Disable uppercase transformation

### Hover States

```scss
.interactive-element {
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  &:active {
    opacity: 0.7;
  }
}
```

---

## Animations & Transitions

### Standard Transitions

```scss
.element {
  transition: all 0.2s ease; // General
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease; // Specific
}
```

### Vue Transitions

```vue
<!-- Fade -->
<Transition name="fade">
  <div v-if="show">Content</div>
</Transition>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<!-- Slide -->
<Transition name="mobile-search-overlay">
  <div v-if="expanded">Content</div>
</Transition>

<style>
.mobile-search-overlay-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-search-overlay-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.6, 1);
}

.mobile-search-overlay-enter-from {
  transform: translateX(100%) scale(0);
  opacity: 0;
}

.mobile-search-overlay-leave-to {
  transform: translateX(100%) scale(0);
  opacity: 0;
}
</style>
```

### Easing Functions

- **Ease**: `ease` - General purpose
- **Ease-out**: `cubic-bezier(0.4, 0, 0.2, 1)` - Entering animations
- **Ease-in**: `cubic-bezier(0.4, 0, 0.6, 1)` - Exiting animations

### Durations

- **Fast**: `0.15s - 0.2s` - Hover, small changes
- **Standard**: `0.25s - 0.3s` - Page transitions, modals
- **Slow**: `0.5s+` - Special effects, complex animations

---

## Responsive Design

### Breakpoints

```scss
$breakpoint-xs: 599px; // Mobile
$breakpoint-sm: 769px; // Small tablet
$breakpoint-md: 1439px; // Tablet/Desktop
$breakpoint-lg: 1919px; // Large desktop
```

### Responsive Classes

```vue
<!-- Visibility -->
<div class="xs">Only on mobile</div>
<div class="gt-xs">Not on mobile</div>
<div class="lt-md">Below tablet</div>

<!-- Using computed properties -->
<template>
  <div v-if="$q.screen.xs">Mobile view</div>
  <div v-else>Desktop view</div>
</template>

<script setup>
import { useQuasar } from 'quasar';
import { computed } from 'vue';

const $q = useQuasar();
const isMobile = computed(() => $q.screen.xs);
</script>
```

### Mobile-First Patterns

**Conditional rendering:**

```vue
<WdHutSearchMobile v-if="isMobile" />
<WdHutSearchInput v-else />
```

**Responsive styling:**

```vue
<div
  :class="{
    'q-ml-md': !isMobile,
    'q-ml-xs': isMobile,
  }"
  :style="isMobile ? 'max-width: 130px; max-height: 40px' : 'max-width: 210px; max-height: 40px'"
></div>
```

### Touch Gestures

```vue
<div v-touch-swipe.mouse.horizontal="handleSwipe">
  <!-- Swipeable content -->
</div>

<script setup>
import { TouchSwipeValue } from 'quasar';

const handleSwipe: TouchSwipeValue = (e) => {
  e.evt?.preventDefault();
  if (e.direction == 'right') {
    // Handle right swipe
  }
  if (e.direction == 'left') {
    // Handle left swipe
  }
};
</script>
```

---

## Best Practices

### Component Styling

1. **Use scoped styles** with `<style scoped>`
2. **Use SCSS** for complex styles
3. **Access Quasar variables** via `color()` function
4. **Follow BEM-like naming** for custom classes
5. **Use Quasar utility classes** when possible

### Color Usage

1. **Be consistent** with semantic colors (positive = success, negative = error)
2. **Use shades** for depth and hierarchy (100 = lightest, 900 = darkest)
3. **Consider dark mode** by default
4. **Use `text-icon`** for toolbar icons

### Accessibility

1. **Provide clear focus states** for keyboard navigation
2. **Use semantic HTML** elements
3. **Provide alt text** for images
4. **Ensure sufficient color contrast** (especially with custom colors)
5. **Support keyboard navigation** in interactive components

### Performance

1. **Use CSS transforms** for animations (GPU accelerated)
2. **Avoid layout thrashing** in animations
3. **Debounce** user input (search, scroll)
4. **Use `v-show` vs `v-if`** appropriately
5. **Lazy load** images and heavy components

---

## Additional Resources

- [Quasar Color System](https://quasar.dev/style/color-palette)
- [Quasar Typography](https://quasar.dev/style/typography)
- [Quasar Spacing](https://quasar.dev/style/spacing)
- [Quasar Icons](https://quasar.dev/vue-components/icon)
- [Iconify Icon Sets](https://icon-sets.iconify.design/)
- [Material Design Guidelines](https://material.io/design)
