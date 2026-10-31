# Tasks: Place Interactions

Sourced from `_work/place-interactions.md` (rev 3, PR table amended rev 4)

- GLM OpenSpec review (C1–C7, T1–T10, F1–F4). PR slicing: PR1a (framework,
  zero URL change) → PR1b (URL cutover, needs backend PR0) → PR2 (popup
  surface) → PR3 (transport). All tasks land on the lane branch
  `design-geoplace-overlay-architecture`; PR boundaries are commit/tag
  boundaries. Reviewer per step (owner instruction): Opus when available,
  GLM 5.3 max otherwise; visual verification per PR.

## PR1a — Framework (zero URL change, behavior-identical)

### 1. Selection core

- [ ] Create `src/selection/types.ts`: `MapTarget`, `PropsBag`,
      `ComponentLoader`, `MatchSpec`, `LayerClaim`, `FetchCtx`,
      `EntrySurfaces`, `Presentation`, `definePresentation<D>()`,
      `targetKey()` (length-prefixed, collision-free)
- [ ] Create `src/selection/taxonomy.ts`: domain vocabulary,
      `kindParentOf(kind)` (derived from `identifier`), kind equality,
      source-family constants
- [ ] Create `src/selection/map-layer-ids.ts`: style-layer id constants
      (`wd-huts`, `wd-huts-occupation*` family)
- [ ] Create `src/selection/registry.ts`: first-match `resolve(target)`
      memoized by `target.key`, dev warning for unresolved sources,
      `createRegistry(entries)` factory; `matchSpec` pure + exported
- [ ] Register the `@selection` path alias (tsconfig + quasar.config +
      vitest.config)
- [ ] Unit tests: MatchSpec table tests (first-wins, unknown-domain
      fallback, unresolved-source warning, memoization),
      `targetKey` collision/split safety, `definePresentation` erasure

### 2. Selection store

- [ ] Create `src/stores/map/selection-store.ts` (setup store):
      `popupTarget`/`candidates` as `shallowRef` (markRaw'd targets),
      detail derived from route, `open(target, {via})` surface rule,
      already-routed detection, expand handoff (`detailPending`), route
      watcher as the single ephemeral-cleanup choke point, popup-abort +
      highlight-clear ownership, sequence-token latest-wins
- [ ] **Interim routed-entry binding (T1)**: until the PR1b probe chain,
      the routed target's entry binds via route meta (`contentType:
    'place'` → accommodation entry — the registry equivalent of
      today's `componentMap`); a cold `/hut/:slug` resolves the
      accommodation entry with ZERO probe requests (unit test)
- [ ] Migrate `map-content-store` consumers (`MainLayout`
      `contentDrawerOpen`/`:slug`/`close()`/re-target scroll watch,
      `openContentPanelMaximized` route gate) — behavior-identical,
      still at `/hut/:slug`
- [ ] Delete `map-content-store.ts` once consumerless (verified safe:
      only MainLayout imports it)
- [ ] Unit tests: state machine with in-memory `createRouter` —
      open/expand/close, via-modes, rapid A→B clicks, expand-mid-fetch
      handoff (no abort), same-slug reopen: map re-click toggles close,
      search re-select re-anchors (D12),
      back-closes-without-popup

### 3. Data layer

- [ ] Create `src/composables/usePlaceDetail.ts` from `usePlace`:
      per-entry `fetch(ctx)`/`seed(props)`, token + abort (deduped
      promises never aborted), dedup Map keyed `${entry.id}:${id}:${lang}`
      (fixes slug-only key), locale refetch only-while-open, seed cache
      LRU (~50) + epoch-bump clear, test-reset hook
- [ ] Create the shared `propsFromFeature` helper (canonical id per
      `LayerClaim.idProp`, geometry location, `name_${locale}` family) and
      move `seedPlaceFromMap`'s hardcoded property names into it; keep
      `usePlace` as a thin compatibility wrapper — `use-place.spec.ts`
      keeps passing unchanged (update it only if the wrapper signature
      genuinely must move, in the same PR)
- [ ] Unit tests: dedup key, never-abort-shared, seed overwrite, locale
      refetch gating (open vs closed), LRU eviction + epoch clear,
      `consumePrefetchedHut` handoff SURVIVES the wrapper (prefetch chain
      unit test)

### 4. Entries + panel composition

- [ ] Create `src/selection/entries/accommodation/` (match
      `source: 'geoplace' && kindParentOf(kind) === 'accommodation'`;
      map clicks resolve via the LayerClaim binding — C7, see design):
      `surfaces.ts` barrel re-exporting the existing WdPlaceContent-family
      components (slug-prop legacy components adapted by the host — C2),
      fetch chain (probe → `sources[wodore].source_id` → `/v1/huts/{…}`),
      seed from props
- [ ] Create `src/selection/entries/geoplace-default/` minimal entry
      with stubbed surface loaders (fail-open resolution needs it in
      PR1a — deviation recorded in the work doc PR table, C5; component
      stories come in PR2, T9)
- [ ] Create `src/selection/entries/index.ts` ordered array
      (accommodation before geoplace-default)
- [ ] Create `src/selection/projector.ts` module singleton scaffold
      (registerProjector/unregister — moved to PR1a per work doc PR
      table, C4; consumed in PR2)
- [ ] Create `src/composables/useActiveDetailEntry.ts` +
      `src/components/content/WdDetailBodyHost.vue`; replace
      `MainLayout.componentMap` with registry-fed three-slot composition
      (keyed `shallowRef` async components via markRaw +
      defineAsyncComponent — NEVER inside a computed; generic
      title/actions defaults); preserve route.path keying, fade
      transition, `onContentChanged` scroll reset; the host adapts
      target → slug props for the legacy components
- [ ] eslint `no-restricted-paths` boundary: entries must not import
      stores
- [ ] Histoire story: accommodation entry detail parity with today's
      panel; registry-resolution story (`createRegistry` with mock
      entries) — NOT the geoplace-default component (stub, T9)
- [ ] `pnpm lint` + `npx vue-tsc --noEmit` + full unit suite green
- [ ] **Visual verification**: accommodation detail parity vs main
      (desktop minimized/maximized, mobile sheet snaps, re-target in
      place, cold `/hut/:slug` deep link incl. maximized entry state,
      title/actions without remount flicker on re-target)

## PR1b — URL cutover (after backend PR0: /place SEO + tile geoplace-slug)

- [ ] Add `/place/:slug` route record (`meta.source: 'geoplace'`,
      crawler-stubbed `menuView` AND `contentView`, `props: {content:
    true}`); delete ALL legacy hut route records incl. the
      `/m/hut/:slug` redirect (redirect-to-deleted-name would throw, T2)
      — no redirect, D1
- [ ] Replace the interim route-meta entry binding (T1) with the probe
      chain: sparse probe (`GET /v1/geo/places/{slug}`, fields
      domain/kind/sources), registry match from probe props, seed
      skeleton, `‖(barrel, entry.fetch)`
- [ ] Create the geoplace-default minimal DETAIL component (probe
      payload render, D8 — needed for non-accommodation cold links, T5) + Histoire story
- [ ] i18n keys for the geoplace-default detail labels + legacy-hut
      not-found copy (all 4 locales in lockstep, T6)
- [ ] Boot prefetch adaptation: `/place/` path regex, probe via client
      header set (`Api-Version`), hut GET handoff; update
      `hut-prefetch.spec.ts` accordingly (T4)
- [ ] Search last hop: add `sources` to `SEARCH_FIELDS` (D11), select →
      `open(target, {via: 'search'})` with `source_id` in props
- [ ] Transitional: probe falls back to `/v1/huts/{slug}` on geoplace
      404 until the tile property ships (mixed id-space; removal tracked
      under Later, T8)
- [ ] Update the e2e hut deep-link test to `/place/:slug` with the
      geoplace slug semantics for `E2E_HUT_SLUG` (aarbiwak's geoplace
      slug, T3)
- [ ] Unit tests: probe chain call order + abort re-check between GETs,
      cold-link → accommodation via probe, village cold-link →
      geoplace-default detail (0 extra requests), search select
      1-request path, crawler stub resolution, maximized deep-link entry
      state
- [ ] **Visual verification**: cold `/place/:slug` load (skeleton →
      panel), search select flow, legacy `/hut` + `/m/hut` 404

## PR2 — Popup surface (both engines)

- [ ] Global MapLibre click handler + derived interactive layers
      (reactive getter, epoch-recompute, `LayerClaim.idProp` target
      building via `propsFromFeature`, `wd-huts` + occupation claims
      with current minZoom — NOTE intended behavior change: occupation
      circles become clickable, T10); retire `onHutLayerClick`; keep
      style-not-loaded guard; tap guard consumes the derived list
      (update `interactive-layers.spec.ts`, T4)
- [ ] **Spike**: `WdMapPopup.vue` — teleport-to-body card, canvas-rect
      offset via the PR1a projector, dirty-flag `move` + single rAF loop
      (start/stop/pause), imperative transform writes, pure
      `clampToViewport()`
- [ ] Popup-aware flyTo padding (pin + popup bbox, not drawer reuse)
- [ ] Leaflet adapter: marker click → target (marker `featureRef`) →
      `open(via: 'map')`; popup anchoring via `latLngToContainerPoint`;
      no disambiguation (markers don't stack)
- [ ] Engine-swap/projector-unregister closes popup + clears highlight
- [ ] `geoplace-default` popup component (props-only, reactive locale
      incl. mid-session language switch of an OPEN popup) + minimal
      `1/n` switcher chip (`WdResultChip`) + its a11y i18n key (T6)
- [ ] Same-layer stacked-feature dedup (one target per `key`) as a
      tested SHALL (F4)
- [ ] Drift-warning dev guard (claims vs applied style layers)
- [ ] Unit tests: derived interactive list + epoch recompute, drift
      warning, `clampToViewport` math, rAF start/stop (fake timers),
      same-layer dedup
- [ ] Histoire stories: geoplace-default popup + minimal detail,
      result chip
- [ ] **Visual verification**: popup anchored + clamped (mobile
      viewport), glued through flyTo, engine swap closes, disambiguation
      cycling (synthetic stacked features), fallback parity

## PR3 — Transport entry

- [ ] Integrate the existing transport popup (WIP) via its
      `surfaces.ts` barrel; entry matches `source === 'transport'`
- [ ] `LayerClaim`s for the transport layer (external id prop); verify
      catalog serving (external style/tile URLs)
- [ ] Footprint size-check for SW precache; precache entry chunks
      (explicit decision, all entries)
- [ ] Histoire story + **visual verification**: transport popup from tile
      props, no network on open

## Wrap-up (any PR, before archiving the change)

- [ ] Update AGENTS.md (project structure: `src/selection/` tree;
      common patterns: selection framework + registry + eslint boundary)
      and `docs/specs/` pointer (T7)
- [ ] Work doc `_work/place-interactions.md` review log entry per PR

## Later (out of scope here)

Rich switcher UI; routes/areas/`my/*` entity entries; huts→geoplace
backend swap (entry-local); per-entry `searchEntry` overrides;
popup↔detail morph; REMOVE the transitional `/v1/huts/{slug}` probe
fallback once tile props ship (T8).
