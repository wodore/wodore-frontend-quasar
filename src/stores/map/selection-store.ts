/**
 * Selection store — the interaction state machine (OpenSpec
 * `add-place-interactions`, capability `place-interactions`).
 *
 * Surfaces: `popup` (ephemeral store state, never routed — D2) and
 * `detail` (the route, single source of truth). ONE route watcher is the
 * choke point clearing ephemeral state on content-slug change/leave.
 *
 * Reactivity discipline (capability `place-registry`): targets are
 * immutable wire data — markRaw'd at construction, held in shallowRefs,
 * never cloned. The highlight `featureRef` stays opaque here; map
 * adapters watch `highlightRef` and apply/clear engine state.
 *
 * PR1a compat surface: `contentOpen`/`contentType`/`contentSlug`/
 * `contentId`/`close` mirror the retired `map-content-store` API so the
 * MainLayout migration is a two-line change; the routed entry binds via
 * route meta until the PR1b probe chain (work doc T1). Map clicks keep
 * routing directly in PR1a — `open()` is exercised from PR1b/PR2.
 */
import { defineStore } from 'pinia';
import { computed, markRaw, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { defaultRegistry } from '@selection/registry';
// Registry installation side effect: populates the default registry
// (ordered entries) before any open() can resolve. Import direction is
// store → entries (entries are store-free — eslint-enforced boundary).
import '@selection/entries';
import { stageSeed } from '@composables/usePlaceDetail';
import type { FeatureRef, MapTarget, Presentation } from '@selection/types';

/** Interim content-type kept for the legacy componentMap (removed with
 *  the PR1a entry/panel-composition task group). */
export type ContentType = 'place' | 'route' | 'admin' | null;

/** Route names — flipped to the /place family with the PR1b cutover. */
const CONTENT_ROUTE = 'map-hut';
const MAP_ROUTE = 'map';

export type OpenVia = 'map' | 'search' | 'link';

/** Click-pipeline item: a deduplicated target plus its CLAIM-resolved
 *  entry (map clicks know the claiming entry directly — no MatchSpec
 *  needed, tile props carry no taxonomy; Opus consolidated review #1). */
export interface FromMapItem {
  target: MapTarget;
  entry?: Presentation;
}

/** Surface capability read off the entry (sync — `capabilities` flag),
 *  defaulting to detail for entries that only declare a barrel. */
function isCapable(entry: Presentation, surface: 'popup' | 'detail'): boolean {
  const caps = entry.capabilities;
  if (!caps) return surface === 'detail';
  return caps.includes(surface);
}

export const useSelectionStore = defineStore('selection', () => {
  const router = useRouter();
  const route = useRoute();

  // ── Ephemeral state (popup world — UI lands PR2, machine lands now) ──
  const popupTarget = shallowRef<MapTarget | null>(null);
  /** Entry resolved for the open popup — travels with the target so
   *  expand() never re-resolves (no drift, works with entry overrides). */
  const popupEntry = shallowRef<Presentation | null>(null);
  const candidates = shallowRef<readonly FromMapItem[]>([]);
  /** Index of the open candidate (minimal `1/n` cycling switcher). */
  const candidateIndex = shallowRef(0);
  /** Expand handoff: the popup target awaiting route adoption. */
  const detailPending = shallowRef<MapTarget | null>(null);
  /** Controller-owned highlights — adapters watch and apply/clear.
   *  DETAIL highlight persists while the detail route is active (a hut
   *  stays highlighted even when a popup opens on top — owner
   *  2026-11-01). POPUP highlight is ephemeral (cleared on popup close). */
  const detailHighlightRef = shallowRef<FeatureRef | null>(null);
  const popupHighlightRef = shallowRef<FeatureRef | null>(null);
  /** All active highlights (detail first — higher precedence). */
  const highlightRef = computed(() => [detailHighlightRef.value, popupHighlightRef.value].filter(Boolean) as FeatureRef[]);

  // ── Routed detail state ─────────────────────────────────────────────
  /** The target whose detail is routed (null on cold deep links — the
   *  host/resolver owns building it from the slug). */
  const routedTarget = shallowRef<MapTarget | null>(null);
  /** Entry RESOLVED for the routed target (Opus consolidated review #1):
   *  carries the CLAIM-resolved entry of map-clicked details — a hut's
   *  tile props carry no kind/domain, so MatchSpec re-resolution would
   *  mis-resolve to geoplace-default and render a blank panel. Mirrors
   *  popupEntry; adopted with the pending handoff, cleared on leave. */
  const routedEntry = shallowRef<Presentation | null>(null);
  /** Entry for the expand handoff (popupEntry at expand time). */
  const detailPendingEntry = shallowRef<Presentation | null>(null);

  const detailOpen = computed(() => Boolean(route.meta.content));
  const detailSlug = computed(() =>
    detailOpen.value ? ((route.params.slug as string | undefined) ?? undefined) : undefined
  );

  const mode = computed<'closed' | 'popup' | 'detail'>(() => {
    if (detailOpen.value) return 'detail';
    return popupTarget.value ? 'popup' : 'closed';
  });

  function setTarget(ref: { value: MapTarget | null }, target: MapTarget | null): void {
    // markRaw at the boundary: props/featureRef are wire data / live
    // engine objects — never deep-proxied (place-registry requirement).
    ref.value = target ? (markRaw(target) as MapTarget) : null;
  }

  function applyDetailHighlight(target: MapTarget | null): void {
    detailHighlightRef.value = (target?.featureRef as FeatureRef | undefined) ?? null;
  }

  function applyPopupHighlight(target: MapTarget | null): void {
    popupHighlightRef.value = (target?.featureRef as FeatureRef | undefined) ?? null;
  }

  // ── Choke point: ONE route watcher clears ephemeral state ───────────
  // MULTI-SOURCE watch (GLM review F1): a single getter returning a
  // fresh array would fire on EVERY route mutation (vue-router swaps the
  // route object on query/hash-only pushes too), killing the popup
  // world on unrelated navigations. Per-element sources fire only when
  // the content flag or slug actually changes.
  watch(
    [() => Boolean(route.meta.content), detailSlug],
    ([content, slug]) => {
      if (!content) {
        // Left the content family: clear everything, never resurrect.
        setTarget(popupTarget, null);
        popupEntry.value = null;
        candidates.value = [];
        setTarget(detailPending, null);
        routedEntry.value = null;
        detailPendingEntry.value = null;
        setTarget(routedTarget, null);
        detailHighlightRef.value = null;
        popupHighlightRef.value = null;
        return;
      }
      // Content route active.
      if (detailPending.value && detailPending.value.id === slug) {
        // Expand handoff adopted AFTER navigation committed.
        setTarget(routedTarget, detailPending.value);
        routedEntry.value = detailPendingEntry.value;
        setTarget(detailPending, null);
        detailPendingEntry.value = null;
      } else if (routedTarget.value && routedTarget.value.id !== slug) {
        // Re-targeted to a different slug while open: the old target is
        // gone (the host resolver builds the new one from the slug).
        setTarget(routedTarget, null);
        routedEntry.value = null;
      }
      // Detail supersedes the popup world (D2: back → map, no popup).
      setTarget(popupTarget, null);
      popupEntry.value = null;
      // Candidates SURVIVE the detail they caused (the switcher's
      // purpose: swap between stacked targets while the detail is
      // open) — but a slug outside the candidate list (search open,
      // unrelated navigation) clears them.
      if (candidates.value.length > 0 && !candidates.value.some(item => item.target.id === slug)) {
        candidates.value = [];
        candidateIndex.value = 0;
      }
      applyDetailHighlight(routedTarget.value);
    },
    { immediate: true }
  );

  // ── Actions ──────────────────────────────────────────────────────────

  /** Open a target on its entry's surface. Via picks the surface when
   *  the entry declares both (map → popup, search/link → detail); a
   *  single declared surface opens regardless of via. Already-routed
   *  targets: map toggles closed (D12), search/link re-anchor. */
  async function open(
    target: MapTarget,
    opts: { via?: OpenVia; entry?: Presentation } = {}
  ): Promise<void> {
    const via: OpenVia = opts.via ?? 'map';
    const entry = opts.entry ?? defaultRegistry().resolve(target);
    if (!entry) return; // registry dev-warns on unresolved sources

    // POPUP toggle (owner 2026-11-01: "click the same layer again →
    // close, like outside click"): clicking the feature whose popup
    // is already open dismisses it.
    if (popupTarget.value && popupTarget.value.key === target.key && via === 'map') {
      closePopup();
      return;
    }

    // Already-routed target (same slug → duplicated navigation, no
    // watcher would fire): D12 — map re-click toggles closed, search
    // re-select re-anchors.
    if (detailOpen.value && detailSlug.value === target.id) {
      if (via === 'map') {
        await close();
      } else {
        // D12 re-anchor: stage the fresh props (reseed) so a later cold
        // load paints them (GLM review F3 — the data layer's key watch
        // does not refire on an unchanged slug).
        stageSeed(target, entry);
        setTarget(routedTarget, target);
        routedEntry.value = markRaw(entry);
        applyDetailHighlight(target);
      }
      return;
    }

    const wantsPopup = isCapable(entry, 'popup') && (via === 'map' || !isCapable(entry, 'detail'));
    if (wantsPopup) {
      setTarget(popupTarget, target);
      popupEntry.value = markRaw(entry);
      applyPopupHighlight(target);
      return;
    }

    if (!isCapable(entry, 'detail')) return;
    await openDetail(target, entry);
  }

  /** Click-pipeline entry point: the adapter supplies the deduplicated
   *  items (topmost first). One item opens directly; several become
   *  `candidates` with the first open (minimal `1/n` cycling switcher). */
  /** Generic importance heuristic for sorting stacked click candidates:
   *  stops with more routes (parsed from the Transitland routes JSON)
   *  first — Zürich HB with 17 lines outranks its transliterated feed
   *  duplicates. Fallback: alphabetical by stop_name. */
  function candidateImportance(item: FromMapItem): number {
    const routes = item.target.props.routes;
    if (typeof routes !== 'string') return 0;
    try {
      const parsed: unknown = JSON.parse(routes);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }

  function candidateSortLabel(item: FromMapItem): string {
    const props = item.target.props as Record<string, unknown>;
    return String(props.stop_name ?? props.name ?? item.target.id);
  }

  function openFromMap(items: readonly FromMapItem[]): void {
    if (items.length === 0) return;
    // Sort by importance BEFORE opening: most routes first (the main
    // station), then alphabetical (stable tie-break). Render-order
    // (topmost-first) puts whichever tile feature draws last on top —
    // not the one the user wants (owner 2026-11-01: "Zurich HB is
    // still last in the list").
    const sorted =
      items.length > 1
        ? [...items].sort(
            (a, b) =>
              candidateImportance(b) - candidateImportance(a) ||
              candidateSortLabel(a).localeCompare(candidateSortLabel(b))
          )
        : items;
    if (sorted.length > 1) {
      candidates.value = sorted.map(item => ({
        target: markRaw(item.target) as MapTarget,
        entry: item.entry,
      }));
      candidateIndex.value = 0;
    } else {
      candidates.value = [];
      candidateIndex.value = 0;
    }
    void open(sorted[0].target, { via: 'map', entry: sorted[0].entry });
  }

  /** Cycle the disambiguation switcher to the next candidate (wraps).
   *  No-op without candidates. */
  async function cycleCandidates(): Promise<void> {
    const list = candidates.value;
    if (list.length < 2) return;
    candidateIndex.value = (candidateIndex.value + 1) % list.length;
    const item = list[candidateIndex.value];
    await open(item.target, { via: 'map', entry: item.entry });
  }

  /** Jump directly to candidate i (collapsible-list click). */
  async function selectCandidate(i: number): Promise<void> {
    const list = candidates.value;
    if (i < 0 || i >= list.length) return;
    candidateIndex.value = i;
    const item = list[i];
    await open(item.target, { via: 'map', entry: item.entry });
  }

  /** Route the detail for a target (surface rule resolved by caller).
   *  The resolved entry travels with the routed target (Opus #1) —
   *  claim-resolved map clicks keep their entry across the routing. */
  async function openDetail(target: MapTarget, entry?: Presentation): Promise<void> {
    setTarget(routedTarget, target);
    routedEntry.value = entry ? markRaw(entry) : null;
    applyDetailHighlight(target);
    const failure = await router.push({
      name: CONTENT_ROUTE,
      params: { slug: target.id },
      query: route.query,
      hash: route.hash,
    });
    if (failure) {
      // Navigation cancelled (guard): the route watcher never fires —
      // undo the optimistic routed/highlight state (GLM review F4).
      setTarget(routedTarget, null);
      routedEntry.value = null;
      applyDetailHighlight(null);
    }
  }

  /** Expand a popup to its detail — HAND OFF, never abort: the pending
   *  target is adopted by the route watcher after navigation commits,
   *  then the popup world clears (place-interactions requirement). */
  async function expand(): Promise<void> {
    const target = popupTarget.value;
    if (!target) return;
    const entry = popupEntry.value ?? defaultRegistry().resolve(target);
    if (!entry || !isCapable(entry, 'detail')) return;
    setTarget(detailPending, target);
    const failure = await router.push({
      name: CONTENT_ROUTE,
      params: { slug: target.id },
      query: route.query,
      hash: route.hash,
    });
    if (failure) {
      // Navigation cancelled: the watcher never adopts — drop the
      // handoff, the popup stays open (GLM review F4).
      setTarget(detailPending, null);
    }
  }

  /** Close the detail (content family leave), preserving query/hash. */
  async function close(): Promise<void> {
    await router.push({ name: MAP_ROUTE, query: route.query, hash: route.hash });
  }

  /** Clear the popup world directly (popup ✕, engine swap). */
  function closePopup(): void {
    setTarget(popupTarget, null);
    popupEntry.value = null;
    candidates.value = [];
    // POPUP highlight cleared; the DETAIL highlight persists while
    // the detail route is active (owner: hut stays highlighted).
  }

  return {
    // Ephemeral
    popupTarget,
    popupEntry,
    candidates,
    candidateIndex,
    detailPending,
    detailHighlightRef,
    popupHighlightRef,
    highlightRef,
    // Routed
    routedTarget,
    routedEntry,
    detailOpen,
    detailSlug,
    mode,
    // Actions
    open,
    openDetail,
    openFromMap,
    cycleCandidates,
    selectCandidate,
    expand,
    close,
    closePopup,

    // ── PR1a compat surface (retired with the panel-composition group) ─
    contentOpen: detailOpen,
    contentType: computed(() => (route.meta.contentType as ContentType | undefined) ?? null),
    contentSlug: detailSlug,
    contentId: computed(() =>
      route.meta.content ? ((route.params.id as string | undefined) ?? undefined) : undefined
    ),
  };
});
