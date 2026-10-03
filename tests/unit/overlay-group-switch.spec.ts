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

  it('toggling a layer records the state in every owning group', () => {
    // Pick a layer owned by a NON-active group (promoted-row scenario)
    const active = groups().find(g => g.id === store.groupSettings.activeGroupId)!;
    const owners = groups().filter(g => g.id !== active.id);
    const shared = owners.flatMap(g => g.layerSlugs).find(slug => !active.layerSlugs.includes(slug));
    expect(shared).toBeTruthy();

    const item = overlay(shared!) as unknown as { name: string; active: boolean };
    const wasActive = item.active;
    store.toggleOverlay(item as never);
    expect(item.active).toBe(!wasActive);

    for (const g of groups().filter(g => g.layerSlugs.includes(shared!))) {
      expect(
        g.activeLayerSlugs.includes(shared!),
        `${g.slug} activeLayerSlugs must record the toggle`
      ).toBe(!wasActive);
    }
  });

  it('a layer toggled off while promoted stays off when its group returns', () => {
    const activeId = store.groupSettings.activeGroupId;
    const others = groups().filter(g => g.id !== activeId);
    const owner = others.find(g => g.layerSlugs.length > 0)!;
    const slug = owner.layerSlugs.find(s => overlay(s))!;

    // Cycle until the owner group is active
    for (let i = 0; i < groups().length + 1; i++) {
      if (store.groupSettings.activeGroupId === owner.id) break;
      store.cycleGroup();
    }
    expect(store.groupSettings.activeGroupId).toBe(owner.id);

    // Toggle its layer off
    const item = overlay(slug) as unknown as { name: string; active: boolean };
    if (item.active) store.toggleOverlay(item as never);
    expect(item.active).toBe(false);

    // Cycle away and back — the layer must STAY off
    store.cycleGroup();
    store.cycleGroup();
    while (store.groupSettings.activeGroupId !== owner.id) store.cycleGroup();
    expect(overlay(slug)?.active, 'toggled-off layer resurrected by group cycle').toBe(false);
    expect(owner.activeLayerSlugs.includes(slug)).toBe(false);
  });
});
