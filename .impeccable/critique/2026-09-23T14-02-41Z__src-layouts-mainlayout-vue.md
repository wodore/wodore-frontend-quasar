---
target: app shell, map & hut search, hut detail
total_score: 19
max_score: 40
na_heuristics:
p0_count: 2
p1_count: 2
target_identity: 'file:/home/tobias/git/wodore/wodore-frontend-quasar/src/layouts/MainLayout.vue'
target_fingerprint: 'sha256:059b74902662e64982e57fae557c96d382120a5826c658eee007edf7a62c4291'
target_path: /home/tobias/git/wodore/wodore-frontend-quasar/src/layouts/MainLayout.vue
timestamp: 2026-09-23T14-02-41Z
slug: src-layouts-mainlayout-vue
---

# Wodore Design Critique — Map Shell, Hut Detail & App Shell

Method: dual-agent (A: 97bcd8ed design-director review · B: f906cfa0 detector)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                         |
| --------- | ------------------------------- | --------- | --------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 2         | Availability/map loads have no skeleton; search spinner only after 2 chars        |
| 2         | Match System / Real World       | 3         | Good domain language, but ~12 unlabeled rail icons are jargon                     |
| 3         | User Control and Freedom        | 2         | Hut title = accidental external link; favorites/watch dead at 50% opacity         |
| 4         | Consistency and Standards       | 1         | Light drawer vs dark shell; hardcoded alert-triangle icon on every toolbar button |
| 5         | Error Prevention                | 2         | "validieren" exposed to non-editors; no exit framing on booking links             |
| 6         | Recognition Rather Than Recall  | 2         | Icon-only rail; pin color semantics have no legend                                |
| 7         | Flexibility and Efficiency      | 3         | Keyboard search nav, preview-without-commit, debounced search — genuinely good    |
| 8         | Aesthetic and Minimalist Design | 2         | Raw lat/lon as list row; 5+ competing chips above the fold                        |
| 9         | Error Recovery                  | 1         | Hut load failure = bare red text, no retry                                        |
| 10        | Help and Documentation          | 1         | No legend/onboarding for pins, rail, month scrubber                               |
| **Total** |                                 | **19/40** | **Needs attention**                                                               |

## Design Specificity Verdict

**Split verdict: the map shell is generic; the hut drawer is authored but half-migrated.**

The home screen could be any OSM discovery app — light raster map, dark top bar, a column of ~12 identical circular icon buttons. None of the documented "Alpine Ops Room" vocabulary (tonal pine surfaces, uppercase condensed labels, halo) is visible in the first impression. The hut drawer is where Wodore becomes specific — `▲2731m · ☀ Sunny` briefing header, capacity chips, green/red availability day pills, month scrubber — a genuine instrument panel for bed availability. But it renders light (`bg-grey-3/4` in `WdHutView.vue`), glued onto the dark shell like a different product.

Deterministic scan (2 findings, exit 2): two `side-tab` warnings in `WdAccommodationDay.vue:286,289` — thick `border-left: 4px solid` accent strips, declared twice (looks accidental). The detector caught border vocabulary the design review did not flag line-level. 0 false positives after triage against DESIGN.md: a 4px side strip cuts against both the Tonal Layer Rule and the flat chip vocabulary. (Browser overlay injection skipped: no native browser-automation tool exposed to the assessment.)

## Overall Impression

The system on paper is coherent and good; the app is ~60% of the way there. The best beat in the product is clicking a hut pin: fly-to, drawer slide-in, photo gallery, elevation + weather briefing. The worst beats are the first landing (wall of anonymous icons, no invitation) and the booking hand-off (the moment of highest commitment gets the least care). Biggest opportunity: finish the migration — bring the drawer into the pine system and make the home screen say what the product is.

## What's Working

1. The availability week strip — color-encoded per-day bed truth within the Availability Rule, with capacity bars. The product's soul, done right.
2. Search craft — 300ms debounce, race protection, arrow-key navigation, and the eye-button "preview on map without committing" is a differentiated planner interaction.
3. Header-as-briefing (WdHutHeader) — elevation + weather inline with the name is a correct at-a-glance go/no-go read for the audience.

## Priority Issues

1. [P0] Broken/disabled controls shipped in the primary surface. `WdToolbarButton.vue` hardcodes `icon="eva-alert-triangle"` ignoring its `icon` prop (every rail button renders a warning triangle); favorites/watch render disabled at 50% opacity — promises broken in front of the user. Fix: restore prop binding; hide unshipped affordances instead of disabling them. → /impeccable polish
2. [P0] Hut drawer abandons the dark system. Light greys against the night-pine shell; gold `text-accent` used on section headings (violates the Head-Torch Rule). Fix: migrate to Pine Panel #112119 on Night Pine; gold as scarce overline only. Detector's side-tab strips belong to the same cleanup. → /impeccable colorize
3. [P1] Icon-only 12-button rail. No labels, no grouping, pure recall. Fix: 3 labeled clusters (Huts / Activities / Transport) with uppercase condensed captions; collapse to one "Layers" sheet on mobile. → /impeccable layout
4. [P1] Booking hand-off without reassurance. Bare provider icons: no name, no price hint, no "opens external booking" framing. Fix: a source card per provider: logo, "beds from CHF xx", explicit exit label, availability echo. → /impeccable clarify
5. [P2] Internal QA language and raw data leaked to consumers. "ungeprüft/validieren" badge always visible; raw coordinates as a first-class row. Fix: role-gate the badge; demote coordinates to a copy action. → /impeccable distill

## Persona Red Flags

- Power Planner: no compare trail (opening hut B silently replaces A); fly-to resets a deliberate zoom; favorites (their shortlist) are disabled.
- First-Time Visitor: 12 unlabeled icons and no pin legend are pure guesswork; clicking the hut name exits to sac-cas.ch without warning.
- Outdoor Mobile User: availability pills ~24px tall (below gloved-finger comfort); weather text small and low-contrast on light grey in glare; failed fetch offers no retry on unstable connections.

## Minor Observations

Scrollbar gold #998019 duplicated across 3 files (token it); month scrubber doesn't visually drive the open/closed chips; pins at zoom 8 are multicolored specks (cluster until zoom 11); description clamp cuts mid-sentence with a bare "more"; dead code and legacy `body`/`.card` styles in `WdHutView.vue`.

## Questions to Consider

- If you deleted the left rail entirely and put everything behind one "Layers & Activities" control, what would actually be lost?
- The availability strip is the product's reason to exist — why is it below the photo gallery?
- Is the light drawer a legacy state or a deliberate choice — and if deliberate, what is the documented system for?
