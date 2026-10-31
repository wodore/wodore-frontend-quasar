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
import type { FeatureRef, MapTarget, Presentation } from '@selection/types';

/** Interim content-type kept for the legacy componentMap (removed with
 *  the PR1a entry/panel-composition task group). */
export type ContentType = 'place' | 'route' | 'admin' | null;

/** Route names — flipped to the /place family with the PR1b cutover. */
const CONTENT_ROUTE = 'map-hut';
const MAP_ROUTE = 'map';

export type OpenVia = 'map' | 'search' | 'link';

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
  const candidates = shallowRef<readonly MapTarget[]>([]);
  /** Expand handoff: the popup target awaiting route adoption. */
  const detailPending = shallowRef<MapTarget | null>(null);
  /** Controller-owned highlight — adapters watch and apply/clear. */
  const highlightRef = shallowRef<FeatureRef | null>(null);

  // ── Routed detail state ─────────────────────────────────────────────
  /** The target whose detail is routed (null on cold deep links — the
   *  host/resolver owns building it from the slug). */
  const routedTarget = shallowRef<MapTarget | null>(null);

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

  function applyHighlight(target: MapTarget | null): void {
    highlightRef.value = (target?.featureRef as FeatureRef | undefined) ?? null;
  }

  // ── Choke point: ONE route watcher clears ephemeral state ───────────
  watch(
    () => [Boolean(route.meta.content), detailSlug.value] as const,
    ([content, slug]) => {
      if (!content) {
        // Left the content family: clear everything, never resurrect.
        setTarget(popupTarget, null);
        popupEntry.value = null;
        candidates.value = [];
        setTarget(detailPending, null);
        setTarget(routedTarget, null);
        highlightRef.value = null;
        return;
      }
      // Content route active.
      if (detailPending.value && detailPending.value.id === slug) {
        // Expand handoff adopted AFTER navigation committed.
        setTarget(routedTarget, detailPending.value);
        setTarget(detailPending, null);
      } else if (routedTarget.value && routedTarget.value.id !== slug) {
        // Re-targeted to a different slug while open: the old target is
        // gone (the host resolver builds the new one from the slug).
        setTarget(routedTarget, null);
      }
      // Detail supersedes the popup world (D2: back → map, no popup).
      setTarget(popupTarget, null);
      popupEntry.value = null;
      candidates.value = [];
      applyHighlight(routedTarget.value);
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

    // Already-routed target (same slug → duplicated navigation, no
    // watcher would fire): D12 — map re-click toggles closed, search
    // re-select re-anchors.
    if (detailOpen.value && detailSlug.value === target.id) {
      if (via === 'map') {
        await close();
      } else {
        setTarget(routedTarget, target);
        applyHighlight(target);
      }
      return;
    }

    const wantsPopup = isCapable(entry, 'popup') && (via === 'map' || !isCapable(entry, 'detail'));
    if (wantsPopup) {
      setTarget(popupTarget, target);
      popupEntry.value = markRaw(entry);
      applyHighlight(target);
      return;
    }

    if (!isCapable(entry, 'detail')) return;
    await openDetail(target);
  }

  /** Route the detail for a target (surface rule resolved by caller). */
  async function openDetail(target: MapTarget): Promise<void> {
    setTarget(routedTarget, target);
    applyHighlight(target);
    await router.push({
      name: CONTENT_ROUTE,
      params: { slug: target.id },
      query: route.query,
      hash: route.hash,
    });
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
    await router.push({
      name: CONTENT_ROUTE,
      params: { slug: target.id },
      query: route.query,
      hash: route.hash,
    });
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
    if (!detailOpen.value) highlightRef.value = null;
  }

  return {
    // Ephemeral
    popupTarget,
    popupEntry,
    candidates,
    detailPending,
    highlightRef,
    // Routed
    routedTarget,
    detailOpen,
    detailSlug,
    mode,
    // Actions
    open,
    openDetail,
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
