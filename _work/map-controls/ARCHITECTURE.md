# Map Controls — Component Architecture (v2, clean rewrite)

## Theme tokens (defined in app.scss, consumed by all controls)
All floating map controls share --wd-ctl-* custom properties.

## Components
WdOverlayControl.vue    — container: toggle + mini strip + expandable panel
WdBasemapControl.vue    — container: toggle + basemap strip
WdMapControlButton.vue  — shared 48px chip button (not a component, CSS class)

## Key rules
- No q-fab. Pure HTML buttons.
- All buttons 48px. Strip buttons 44px (fit inside the box padding).
- Overlay panel expands LEFT from the mini strip (same surface).
- Mobile: panel becomes a fullscreen bottom sheet.
- Active: gold inset ring. Inactive: 55% opacity.
- All colors via theme-aware custom properties.
