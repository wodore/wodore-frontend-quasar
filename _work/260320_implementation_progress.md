# Implementation Progress: Bottom Sheet & Content System Refactoring

**Date**: 2026-03-20
**Proposal**: `_work/260320_refactoring_architecture_proposal_v2.md`
**Goal**: Create unified, platform-agnostic content display system

---

## Overview

This document tracks the step-by-step implementation of the refactoring proposal.

---

## Phase 1: Store and Composables

### Status: 🔄 IN PROGRESS

#### Steps:

- [ ] 1.1 Create `stores/map/map-content-store.ts`
- [ ] 1.2 Create `composables/usePlace.ts` with request caching
- [ ] 1.3 Create `composables/usePlaceWeather.ts`
- [ ] 1.4 Test store with router integration
- [ ] 1.5 Test composables with API calls

#### Testing:

- [ ] Store correctly tracks contentOpen state
- [ ] Store correctly derives slug from route
- [ ] `openPlace()` action navigates correctly
- [ ] `close()` action navigates correctly
- [ ] Composable returns reactive data
- [ ] Request deduplication works (multiple components = one API call)

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 2: Bottom Sheet Wrapper

### Status: ⏳ PENDING

#### Steps:

- [ ] 2.1 Create `components/utils/WdBottomSheet.vue`
- [ ] 2.2 Add TypeScript declarations `types/pure-web-bottom-sheet.d.ts`
- [ ] 2.3 Test bottom sheet in isolation
- [ ] 2.4 Test snap points and gestures
- [ ] 2.5 Test v-model binding
- [ ] 2.6 Test close events

#### Testing:

- [ ] Bottom sheet opens/closes correctly
- [ ] Snap points work as expected
- [ ] Drag gestures work smoothly
- [ ] Auto-close on minimum snap point
- [ ] v-model syncs correctly
- [ ] Close events fire correctly
- [ ] No memory leaks (event listeners cleaned up)

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 3: Content Components

### Status: ⏳ PENDING

#### Steps:

- [ ] 3.1 Create `components/content/place/` directory
- [ ] 3.2 Create `WdPlaceContent.vue` (extracted from WdHutView)
- [ ] 3.3 Create `WdPlaceHeader.vue`
- [ ] 3.4 Create `WdPlaceFooter.vue`
- [ ] 3.5 Test each component in isolation

#### Testing:

- [ ] Content component renders correctly
- [ ] Header component renders correctly
- [ ] Footer component renders correctly
- [ ] Components receive slug prop correctly
- [ ] Components fetch data via composables
- [ ] Loading states display correctly
- [ ] Error states display correctly
- [ ] Progressive loading works (weather lazy loads)

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 4: Update MainLayout

### Status: ⏳ PENDING

#### Steps:

- [ ] 4.1 Add content drawer (desktop) to MainLayout
- [ ] 4.2 Add bottom sheet (mobile) to MainLayout
- [ ] 4.3 Add component map with markRaw
- [ ] 4.4 Add dynamic header/footer loading
- [ ] 4.5 Remove old WdMapContent component
- [ ] 4.6 Test desktop drawer
- [ ] 4.7 Test mobile bottom sheet

#### Testing:

- [ ] Desktop drawer opens when clicking marker
- [ ] Desktop drawer closes with close button
- [ ] Desktop drawer closes with browser back button
- [ ] Desktop content scrolls properly (q-scroll-area)
- [ ] Desktop header/footer display correctly
- [ ] Mobile bottom sheet opens when clicking marker
- [ ] Mobile bottom sheet drags smoothly
- [ ] Mobile bottom sheet snaps to correct heights
- [ ] Mobile bottom sheet closes with close button
- [ ] Mobile content uses native scroll (no q-scroll-area)
- [ ] Route updates when opening content
- [ ] Direct URL access works (e.g., /place/my-hut)
- [ ] Browser back button navigates correctly
- [ ] Screen resize switches between desktop/mobile correctly

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 5: Update Routes

### Status: ⏳ PENDING

#### Steps:

- [ ] 5.1 Add `meta.contentType` to routes
- [ ] 5.2 Add new `place/:slug` route
- [ ] 5.3 Add new `route/:id` route
- [ ] 5.4 Update route props to pass slug to content
- [ ] 5.5 Test route navigation
- [ ] 5.6 Test direct URL access
- [ ] 5.7 Test browser back button

#### Testing:

- [ ] Navigation to /place/:slug works
- [ ] Navigation to /route/:id works
- [ ] Direct URL access loads content
- [ ] Browser back button closes content
- [ ] Route meta correctly sets contentType
- [ ] Route params correctly passed to components

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 6: Clean Up

### Status: ⏳ PENDING

#### Steps:

- [ ] 6.1 Remove `WdMapContent.vue`
- [ ] 6.2 Remove `WdHutView.vue`
- [ ] 6.3 Update all references
- [ ] 6.4 Run ESLint and fix issues
- [ ] 6.5 Run TypeScript check and fix issues
- [ ] 6.6 Full regression test

#### Testing:

- [ ] No console errors
- [ ] No ESLint warnings
- [ ] No TypeScript errors
- [ ] All features work as before
- [ ] New features work correctly
- [ ] Performance is good

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Phase 7: Rename Routes (Breaking Change)

### Status: ⏳ PENDING

#### Steps:

- [ ] 7.1 Update all route references (hut → place)
- [ ] 7.2 Update map marker click handlers
- [ ] 7.3 Update links in menus
- [ ] 7.4 Test all navigation paths
- [ ] 7.5 Document breaking change

#### Testing:

- [ ] All markers open content correctly
- [ ] All menu links work
- [ ] All deep links work
- [ ] Browser history works correctly
- [ ] SEO URLs are correct

#### Review Agents:

- [ ] Quasar agent review
- [ ] Vue agent review
- [ ] Code review agent review

---

## Overall Progress

| Phase                          | Status         | Completion |
| ------------------------------ | -------------- | ---------- |
| Phase 1: Store and Composables | 🔄 IN PROGRESS | 0%         |
| Phase 2: Bottom Sheet Wrapper  | ⏳ PENDING     | 0%         |
| Phase 3: Content Components    | ⏳ PENDING     | 0%         |
| Phase 4: Update MainLayout     | ⏳ PENDING     | 0%         |
| Phase 5: Update Routes         | ⏳ PENDING     | 0%         |
| Phase 6: Clean Up              | ⏳ PENDING     | 0%         |
| Phase 7: Rename Routes         | ⏳ PENDING     | 0%         |

**Total Progress**: 0%

---

## Issues Found

### Phase 1 Issues

_None yet_

### Phase 2 Issues

_None yet_

### Phase 3 Issues

_None yet_

### Phase 4 Issues

_None yet_

### Phase 5 Issues

_None yet_

### Phase 6 Issues

_None yet_

### Phase 7 Issues

_None yet_

---

## Notes

- Focus on architecture, not design changes
- Test each phase thoroughly before moving to next
- Always run lint and TypeScript checks
- Review with agents after each phase
- Document any deviations from proposal
