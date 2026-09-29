# Map Controls Redesign — HTML Mockups (not committed)

Self-contained mockups for the Wodore map controls redesign. English only,
inline CSS, no dependencies. Follows `src/assets/wodore-design/DESIGN.md`
tokens; every screen variant appears in **both Day and Night** (Two-Lights
Rule — the basemap stays light in both themes; only chrome switches).
Barlow / Barlow Semi Condensed are stood in by system sans in these files.
Phone frames ~300 px wide side by side for mobile sections.

## Files

### `groups-panel.html` — the core: layer groups + opening panel
- **Layout**: bottom-right control stack — group fab (56 px) **above** the
  basemap fab (52 px); the panel opens **bottom-to-top** above the stack.
- **Behavior**: one active group at a time. **Short press cycles**
  Winter → Summer → All-huts → …; **long press opens the group picker**
  sheet (all user-defined groups + layer counts); group management
  (reorder / edit / new) lives behind More.
- **Panel variants** (three phones × Day/Night each):
  - **A · Row panel** — toggle rows with inline info + filter buttons (44 px).
  - **B · Chips + slide-out tray** — OWNER FAVORITE. Chip tap toggles; a small
    handle slides out a tray with info + filter (44 px targets).
  - **C · Minimal + More** — bare chips, everything else behind the More button.
- Also: cycling state phone, group picker sheet, management sheet glimpse.

### `focus-mode.html` — map-tap focus (mobile) / fullscreen (desktop)
- Mobile **before** (full chrome) → **after** (all chrome hidden; small green
  exit-focus pill bottom-right; tap map or button restores).
- Transition phone: chrome fades + slides to its edge, 140 ms ease-out.
- Desktop: toolbar stays; classic **Fullscreen** button (toolbar + labeled
  pill) and fullscreen-exit state (Esc + pill).

### `mobile-search-date.html` — mobile chrome without a toolbar
- Large floating top bar; three variants:
  - **A · One split pill 60/40** — RECOMMENDED. Search | date; date segment
    shows selected date + availability state dot (data amber / signal green,
    never brand gold) + text label.
  - **B · Two stacked pills** — full-width search, date pill docked below.
  - **C · Search pill + attached date chip** — chip fused below the pill.
- Menu / profile / theme proposal: 52 px **menu fab top-right** opening a
  popover (Profile, Layer groups, Theme, Settings). Date-segment state
  gallery (free / low / full) included.

### `desktop.html` — desktop adaptation
- Toolbar stays. Layers popover (320 px) replaces the bottom sheet: **group
  tabs** (no cycling/long-press with a mouse) + toggle rows with inline
  info/filter; active-count badge + gold beam ring on the toolbar button.
- **Per-layer tray on hover** (250 ms delay) mirroring the mobile chip tray;
  click info/filter pins it. Desktop sizing: toolbar 46 px, rows 44 px.

## Recommendations

1. **Mobile panel: Variant B (chips + slide-out tray)** — matches the owner's
   stated tendency, keeps the panel compact, and separates on/off (tap) from
   learn/configure (handle → tray) cleanly. Variant A is the fallback if
   usability testing shows the chip handle is missed.
2. **Group model**: adopt cycling (short press) + long-press picker as
   specified; add a first-run hint ("hold for groups") and a brief
   switch-confirmation nametag.
3. **Search/date bar: Variant A (one split pill 60/40)** with availability
   dot + label; menu fab top-right houses profile, groups, theme, settings.
4. **Focus mode mobile-only** via empty-map tap; desktop gets the fullscreen
   button. Guard against triggering on pin taps or pan gestures.
5. **Desktop**: toolbar stays; layers popover with group tabs + hover trays.
6. Sizing: mobile 48–56 px targets; desktop 44–46 px. Gold strictly for the
   active/selected beam; one soft shadow only for chrome over the map.

## Variant D — expandable panel with minimized icon strip (owner mix, added 2026-09-29)

In groups-panel.html after variant C: open the full menu (names, counts, trays, More), then minimize to an icon-only strip above the group fab. The strip keeps one-tap-per-layer toggling (today's rail muscle memory) and shows only the active group's layers; long-press still opens the info/filter tray; the chevron re-expands the menu; cycling groups swaps the strip contents.

- Pros: fastest resting state for map work; full menu one tap away; familiar toggle model
- Cons: two states to learn (animate the collapse, keep the chevron anchored); cap the strip at ~5 icons + overflow into the menu

**Recommendation update:** D is the strongest mobile panel direction — it merges the owner's icon-per-layer model with the menu's power. B's chip+tray remains the expanded-state treatment inside D.

## morph-box.html — INTERACTIVE (2026-09-29, owner's unified-box refinement)

Open in a browser; toolbar switches D1/D2/D3 and Day/Night. All gestures work with mouse and touch:

- **Closed → mini**: tap the ＋ (the box itself is the toggle)
- **Mini ↔ full**: tap or drag the grabber; swipe up anywhere in mini (no scroll conflict — mini has nothing to scroll)
- **Layer toggle**: tap an icon/row (first-ever tap teaches expansion once, with hint bubble)
- **Info/filter tray**: long-press (450ms) a layer icon/row — tray slides out with 40px buttons; in full state rows also carry visible info/filter buttons (tap-equivalent for a11y)
- **Group cycling**: ‹ › at the box bottom; long-press › opens the group picker sheet
- **More/settings**: ⋮ in the header (top) — sheet with all layers, manage groups, options
- **Close**: ✕ in the grabber (full) — the box morphs back to the ＋ fab

### The three versions
- **D1 Morph column** (recommended): vertical box, bottom-right above the basemap fab; icons are 52px rows with hidden labels — the morph only animates width + label reveal (one axis, reads as one object)
- **D2 Docked rail**: mini is a horizontal rail spanning above the basemap row (nav-bar reading); full rises as a near-full-width sheet. Wins in landscape / wide thumbs; costs map width
- **D3 Peek**: column morph, but full caps at ~3 rows with a scroll-hint glow. Lighter, safer one-handed reach; shows less at a glance

### Design-agent synthesis baked in
- Gesture zones are DISJOINT: grabber (22px, touch-action:none) = expand/collapse; below it full scrolls freely; mini has no scroll so swipe works everywhere — no velocity arbitration needed
- Long-press vs drag disambiguated by movement: >8px cancels long-press; after 450ms stationary the touch owns the tray
- The open/close toggle lives INSIDE the box in every state (＋ when closed, ✕ morphing with the grabber when open) — no external buttons
- Gold ring on active layers is the continuity anchor between states (the only gold)
- Every gesture has a tap equivalent (grabber tap, visible info/filter buttons in full rows); ARIA: group + aria-expanded, rows as checkboxes, reduced-motion = crossfades

## morph-column-v2.html — INTERACTIVE (owner improvement round, 2026-09-29)

Implements the full improvement list on the morph column:

- **Scrollable both states**: mini caps at 5 icons (fade + scroll), full at max-height
- **Layer order when open**: group layers → other active layers → rest (dimmed, behind an expandable "Other layers · N" header)
- **Add/remove from group** per row (＋ group / − group); removal asks first (confirm dialog)
- **Row detail inline** (recommended flow): tap ⌄ or long-press — info meta, filter chips, opacity slider, scope toggle (this group / global), group membership. Long-press jumps straight here
- **No counts** — turquoise funnel badge = active filter (gold stays the active-layer ring only)
- **Layers button** (below the box) toggles the FULL menu, animated; ✕ still collapses to the ＋ fab
- **One control style**: box column, Layers, basemap, GPS, zoom — all 52px, same chrome; basemap keeps its rail behavior (not per group), restyled to match
- **Focus mode**: tap empty map → all chrome fades, exit chip remains (interactive)
- Known mockup gap: the "show rest" toggle re-renders naively; the real build folds it into the virtual list

### Open question answered — filter/info flow
Recommended and implemented: **shown directly in the layer field** (inline row expansion). One surface to learn, keeps layer context, box already scrolls; sheets/dialogs reserved as escalation for anything that outgrows the row (e.g. future date-range filters). Desktop reuses the same expansion inside its popover.

### v2 refinements (2026-09-29, owner round 2)
- **Layers button** = open/close the whole box (mini/full stays with the grabber + swipe)
- **Detail-open grows the box** to 374px while a row's filter/detail is expanded (wider than the menu's 320px resting width), returns on collapse

## morph-column-v3.html (owner round 3: filter as its own view)

- **Filter and Info/Legend are dedicated views**, not inline row content — matching the current WdOverlayConfig (tabs Info/Filter/Settings, server-defined multi-select filters like hut types) but with fast access from the main control column instead of tiny per-item buttons
- **Column gains two 52px buttons** above the layer box: Info/Legend and Filter (turquoise count badge = active filters) — same style/size family as everything else
- The view panel anchors above the column (slides in from the right, 330px, scrollable): header = layer selector ▾ + Info/Filter tabs + ✕; body = per-layer filter groups (hut type symbols, availability states, amenities) or legend rows; footer = Reset/Apply
- The row detail inside the box keeps only the light stuff (meta, opacity/scope, group membership) — heavy filter content escalates to the view
- Long-press tray in the real build jumps to the view scoped to that layer

### v3 addition (owner round 4): in-menu filter drill-down
- Each layer row gets a **quick funnel button** (ringed when that layer has an active filter) and the row detail carries a "Filter ›" chip — both open the filter **inside the same menu**: the box drills into a filter view for that layer (‹ back + "LAYER · FILTER" + ✕, groups, Reset/Apply), at the widened 374px
- The **global column button** still opens the dedicated view with the layer switcher — same filter component, two scoped entries:
  - per-layer entry → drill-down in place (you already have the context)
  - global entry → external view (no layer chosen yet)
- The grabber ✕ hides in filter mode (the nav has its own)
