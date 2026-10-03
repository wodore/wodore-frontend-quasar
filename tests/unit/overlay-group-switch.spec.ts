// @vitest-environment happy-dom
//
// Group-switch state regressions — the store side of "switching groups
// must update the overlays on the map".
//
// 1. cycleGroup applies the incoming group's saved active state to the
//    global overlay flags (the component re-applies map visibility from
//    these — if they drift, the map shows stale layers).
// 2. toggleOverlay records the toggle into every OWNING group
//    (activeLayerSlugs), so a layer switched off while promoted stays off
//    when its group comes back — the active state belongs to the group.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@indoorequal/vue-maplibre-gl', () => ({
  useMap: () => ({ map: null }),
}));

// Quasar's LocalStorage no-ops under happy-dom; back it with the real DOM storage
vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  return {
    ...actual,
    LocalStorage: {
      getItem: (key: string) => {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      set: (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value)),
      hasItem: (key: string) => window.localStorage.getItem(key) !== null,
      removeItem: (key: string) => window.localStorage.removeItem(key),
    },
  };
});

describe('overlay group switching (store state)', () => {
  let store: ReturnType<typeof import('@stores/map/overlay-store').useOverlayStore>;

  const overlay = (name: string) =>
    (store.overlays as unknown as Array<{ name: string; active?: boolean; show?: boolean }>).find(
      o => o.name === name
    );

  const groups = () => store.groupSettings.groups.filter(g => !g.removed);

  beforeAll(async () => {
    window.localStorage.clear();
    setActivePinia(createPinia());
    const { useOverlayStore } = await import('@stores/map/overlay-store');
    store = useOverlayStore();
    window.localStorage.clear();
  });

  it('cycleGroup applies the incoming group’s saved active layers', () => {
    const first = store.groupSettings.activeGroupId;
    const next = groups().find(g => g.id !== first && g.layerSlugs.length > 0);
    expect(next).toBeTruthy();

    // Force a KNOWN saved state: only the group's first member is active
    next!.activeLayerSlugs = [next!.layerSlugs[0]];

    // Cycle until that group is active (cycling follows sort order)
    for (let i = 0; i < groups().length + 1; i++) {
      if (store.groupSettings.activeGroupId === next!.id) break;
      store.cycleGroup();
    }
    expect(store.groupSettings.activeGroupId).toBe(next!.id);
    for (const slug of next!.layerSlugs) {
      expect(overlay(slug)?.active, `${slug} flag must mirror the group’s saved state`).toBe(
        slug === next!.layerSlugs[0]
      );
    }

    // …and back: the first group's flags mirror ITS saved state again
    for (let i = 0; i < groups().length + 1; i++) {
      if (store.groupSettings.activeGroupId === first) break;
      store.cycleGroup();
    }
    expect(store.groupSettings.activeGroupId).toBe(first);
    const back = groups().find(g => g.id === first)!;
    for (const slug of back.layerSlugs) {
      expect(overlay(slug)?.active).toBe(back.activeLayerSlugs.includes(slug));
    }
  });

  it('toggling records ONLY in the active group — other owners keep their state', () => {
    const active = groups().find(g => g.id === store.groupSettings.activeGroupId)!;
    // A layer owned by the active group AND at least one other group
    const other = groups().find(g => g.id !== active.id);
    const shared = active.layerSlugs.find(slug => other!.layerSlugs.includes(slug));
    // Fallback: if no layer is shared, any active-group member proves the
    // active-group recording; the “other keeps state” part is covered by
    // the promoted test below.
    const slug = shared ?? active.layerSlugs[0];

    const item = overlay(slug) as unknown as { name: string; active: boolean };
    const wasActive = item.active;
    // Snapshot the OTHER owning groups' saved states — the toggle must not
    // touch them (their state is whatever they saved, independent of the
    // current global flag)
    const otherBefore = new Map(
      groups()
        .filter(g => g.id !== active.id && g.layerSlugs.includes(slug))
        .map(g => [g.slug, g.activeLayerSlugs.includes(slug)] as const)
    );
    store.toggleOverlay(item as never);
    expect(item.active).toBe(!wasActive);

    const activeG = groups().find(g => g.id === active.id)!;
    expect(activeG.activeLayerSlugs.includes(slug), 'active group records the toggle').toBe(
      !wasActive
    );

    if (shared) {
      for (const g of groups().filter(g => g.id !== active.id && g.layerSlugs.includes(slug))) {
        expect(
          g.activeLayerSlugs.includes(slug),
          `${g.slug} must KEEP its own state (no cross-group leak)`
        ).toBe(otherBefore.get(g.slug)!);
      }
    }
  });

  it('a layer toggled off while promoted is RESTORED when its group returns', () => {
    const activeId = store.groupSettings.activeGroupId;
    const others = groups().filter(g => g.id !== activeId);
    const owner = others.find(g => g.layerSlugs.length > 0)!;
    const slug = owner.layerSlugs.find(s => overlay(s))!;

    // Cycle until the owner group is active, make sure the layer is ON
    for (let i = 0; i < groups().length + 1; i++) {
      if (store.groupSettings.activeGroupId === owner.id) break;
      store.cycleGroup();
    }
    const item = overlay(slug) as unknown as { name: string; active: boolean };
    if (!item.active) {
      store.toggleOverlay(item as never);
      expect(item.active).toBe(true);
    }
    expect(owner.activeLayerSlugs.includes(slug)).toBe(true);

    // Cycle AWAY (layer not a member there) and toggle it off — promoted
    // toggle: global only, the owner's saved state must NOT change
    store.cycleGroup();
    expect(store.groupSettings.activeGroupId).not.toBe(owner.id);
    if (item.active) store.toggleOverlay(item as never);
    expect(item.active).toBe(false);
    expect(owner.activeLayerSlugs.includes(slug), 'owner keeps its saved state').toBe(true);

    // Back on the owner group: its state wins — the layer is active again
    while (store.groupSettings.activeGroupId !== owner.id) store.cycleGroup();
    expect(overlay(slug)?.active, 'owning group restores its layer state').toBe(true);
  });

  it('a promoted layer toggled ON survives switching away and back', () => {
    const startId = store.groupSettings.activeGroupId;
    const startGroup = groups().find(g => g.id === startId)!;
    // Pick a NOT-member layer (promoted row material)
    const slug = (store.overlays as unknown as Array<{ name: string; show?: boolean }>)
      .find(o => o.show !== false && !startGroup.layerSlugs.includes(o.name))!.name;

    const item = overlay(slug) as unknown as { name: string; active: boolean };
    if (!item.active) store.toggleOverlay(item as never);
    expect(item.active).toBe(true);
    expect(startGroup.activeLayerSlugs.includes(slug), 'recorded in the active group’s view').toBe(true);

    // Away and back — the promoted layer must STILL be active in this view
    store.cycleGroup();
    expect(store.groupSettings.activeGroupId).not.toBe(startId);
    store.cycleGroup();
    while (store.groupSettings.activeGroupId !== startId) store.cycleGroup();
    expect(overlay(slug)?.active, 'promoted layer lost by the round trip').toBe(true);
  });

  it('stepGroup walks backwards and forwards through the visible groups', () => {
    const visible = groups().filter(g => !g.hidden);
    if (visible.length < 2) return;
    const startIdx = visible.findIndex(g => g.id === store.groupSettings.activeGroupId);
    const before = visible[startIdx].slug;

    store.stepGroup(1);
    expect(store.groupSettings.activeGroupId).toBe(visible[(startIdx + 1) % visible.length].id);

    store.stepGroup(-1);
    expect(store.groupSettings.activeGroupId).toBe(visible[startIdx].id);
    const back = groups().find(g => g.id === store.groupSettings.activeGroupId)?.slug;
    expect(back).toBe(before);

    // wraps: step(-1) from the first lands on the last
    store.setActiveGroup(visible[0].id);
    store.stepGroup(-1);
    expect(store.groupSettings.activeGroupId).toBe(visible[visible.length - 1].id);
  });

  it('setActiveGroup switches directly and applies the target group’s states', () => {
    const from = groups().find(g => g.id === store.groupSettings.activeGroupId)!;
    const target = groups().find(g => g.id !== from.id && !g.hidden && g.layerSlugs.length > 0)!;
    target.activeLayerSlugs = [target.layerSlugs[0]];

    store.setActiveGroup(target.id);
    expect(store.groupSettings.activeGroupId).toBe(target.id);
    for (const slug of target.layerSlugs) {
      expect(overlay(slug)?.active).toBe(slug === target.layerSlugs[0]);
    }

    // Hidden groups are not directly selectable (edit mode passes
    // includeHidden — covered by the component dropdown)
    const hidden = groups().find(g => g.hidden && g.id !== target.id);
    if (hidden) {
      const before = store.groupSettings.activeGroupId;
      store.setActiveGroup(hidden.id);
      expect(store.groupSettings.activeGroupId).toBe(before);
      store.setActiveGroup(hidden.id, true);
      expect(store.groupSettings.activeGroupId).toBe(hidden.id);
    }
  });
});
