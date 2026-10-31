/**
 * useActiveDetailEntry — the three-zone feeder (place-interactions spec,
 * "Detail surface composition"). Resolves the active detail entry and
 * feeds the panel shells' EXISTING zones (header title / body / pinned
 * footer actions) from the entry's ONE barrel import — never a
 * monolithic host, never async components inside a computed.
 *
 * Entry resolution order:
 * 1. routedTarget (opened via selection-store `open()`) → registry
 *    (claim/route-aware) resolution;
 * 2. INTERIM route-meta binding (PR1a T1): contentType 'place' →
 *    accommodation — replaced by the PR1b probe chain.
 *
 * Surfaces are memoized per entry id (module scope): a re-target within
 * the same entry NEVER swaps components (no remount flicker); swapping
 * entries swaps all three zones atomically.
 */
import { computed, markRaw, ref, shallowRef, watch, type Component, type Ref, type ShallowRef } from 'vue';
import { useSelectionStore } from '@stores/map/selection-store';
import { defaultRegistry } from '@selection/registry';
import type { EntrySurfaces, Presentation } from '@selection/types';
import { accommodationEntry } from '@selection/entries/accommodation';

/** PR1a interim: route contentType → entry (the registry equivalent of
 *  the retired componentMap; PR1b's probe chain replaces this). */
const META_BOUND_ENTRIES: Record<string, Presentation> = {
  place: accommodationEntry,
};

const surfacesCache = new Map<string, Promise<EntrySurfaces>>();

function loadSurfaces(entry: Presentation): Promise<EntrySurfaces> | null {
  if (!entry.surfaces) return null;
  let promise = surfacesCache.get(entry.id);
  if (!promise) {
    promise = entry.surfaces();
    surfacesCache.set(entry.id, promise);
    // A failed import must not poison the cache — retry on next use.
    promise.catch(() => surfacesCache.delete(entry.id));
  }
  return promise;
}

export interface ActiveDetailEntry {
  entry: Ref<Presentation | null>;
  title: ShallowRef<Component | null>;
  body: ShallowRef<Component | null>;
  actions: ShallowRef<Component | null>;
  /** Surfaces barrel in flight (skeleton gate for the zones). */
  loading: Ref<boolean>;
}

export function useActiveDetailEntry(): ActiveDetailEntry {
  const selection = useSelectionStore();

  const entry = computed<Presentation | null>(() => {
    const routed = selection.routedTarget;
    if (routed) {
      const resolved = defaultRegistry().resolve(routed);
      if (resolved) return resolved;
    }
    const type = selection.contentType;
    return type ? (META_BOUND_ENTRIES[type] ?? null) : null;
  });

  const title = shallowRef<Component | null>(null);
  const body = shallowRef<Component | null>(null);
  const actions = shallowRef<Component | null>(null);
  const loading = ref(false);

  watch(
    entry,
    async e => {
      const surfaces = e ? loadSurfaces(e) : null;
      if (!surfaces) {
        title.value = null;
        body.value = null;
        actions.value = null;
        loading.value = false;
        return;
      }
      loading.value = true;
      try {
        const s = await surfaces;
        // Missing zones fall back to NULL for now — the generic geoplace
        // title/actions defaults land with PR2's geoplace-default
        // surfaces. (Accommodation, the only PR1a detail, supplies all
        // three; the panel hides absent zones.)
        title.value = s.detailTitle ? markRaw(s.detailTitle) : null;
        body.value = s.detail ? markRaw(s.detail) : null;
        actions.value = s.detailActions ? markRaw(s.detailActions) : null;
      } catch {
        title.value = null;
        body.value = null;
        actions.value = null;
      } finally {
        loading.value = false;
      }
    },
    { immediate: true }
  );

  return { entry, title, body, actions, loading };
}
