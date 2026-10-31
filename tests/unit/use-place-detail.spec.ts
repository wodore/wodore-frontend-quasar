import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import {
  __resetPlaceDetailEngine,
  stagePrebuiltSeed,
  usePlaceDetail,
} from '@composables/usePlaceDetail';
import { useOverlayStore } from '@stores/map/overlay-store';
import { targetKey, type MapTarget, type Presentation } from '@selection/types';

function makeTarget(id: string): MapTarget {
  return { key: targetKey({ source: 'geoplace', id }), source: 'geoplace', id, props: {} };
}

/** Entry whose fetch defers EVERY call independently (resolvers in call
 *  order) — lets one entry serve multi-target scenarios. */
function deferringEntry(): {
  entry: Presentation;
  resolvers: Array<(value: { name: string }) => void>;
} {
  const resolvers: Array<(value: { name: string }) => void> = [];
  const entry: Presentation = {
    id: 'test-entry',
    match: { source: 'geoplace' },
    capabilities: ['detail'],
    fetch: () =>
      new Promise<object>(r => {
        resolvers.push(v => r(v));
      }) as Promise<object>,
  };
  return { entry, resolvers };
}

const propsOnlyEntry: Presentation = {
  id: 'props-only',
  match: { source: 'geoplace' },
  capabilities: ['popup'],
  // no fetch — seeds/props are the whole payload
};

beforeEach(() => {
  setActivePinia(createPinia());
  __resetPlaceDetailEngine();
});

describe('usePlaceDetail engine', () => {
  it('dedupes simultaneous identical requests (one fetch, both consumers)', async () => {
    const { entry, resolvers } = deferringEntry();
    const t = ref<MapTarget | null>(makeTarget('x'));
    const a = usePlaceDetail(t, { entry: ref(entry) });
    const b = usePlaceDetail(t, { entry: ref(entry) });
    expect(resolvers.length).toBe(1); // deduped: one fetch for both
    resolvers[0]({ name: 'Shared' });
    await vi.waitFor(() => expect(a.detail.value).toEqual({ name: 'Shared' }));
    await vi.waitFor(() => expect(b.detail.value).toEqual({ name: 'Shared' }));
  });

  it('never aborts a deduped request when one consumer supersedes', async () => {
    const { entry, resolvers } = deferringEntry();
    const tA = ref<MapTarget | null>(makeTarget('x'));
    const a = usePlaceDetail(tA, { entry: ref(entry) });
    const b = usePlaceDetail(ref(makeTarget('x')), { entry: ref(entry) });

    // A supersedes to another target while 'x' is shared with B.
    tA.value = makeTarget('y');
    await nextTick(); // watcher flush is async
    // Two distinct deferred fetches now: x (shared) and y (A's new one).
    expect(resolvers.length).toBe(2);
    // A's supersede must NOT have aborted the shared x request.
    expect(b.error.value).toBeNull();
    resolvers[0]({ name: 'X payload' });
    resolvers[1]({ name: 'Y payload' });
    await vi.waitFor(() => expect(b.detail.value).toEqual({ name: 'X payload' }));
    await vi.waitFor(() => expect(a.detail.value).toEqual({ name: 'Y payload' }));
  });

  it('applies the staged seed instantly, then overwrites with the payload', async () => {
    const t = makeTarget('seeded');
    stagePrebuiltSeed(t.key, { name: 'Seed Hut' });
    const { entry, resolvers } = deferringEntry();
    const { detail } = usePlaceDetail(ref(t), { entry: ref(entry) });
    expect(detail.value).toEqual({ name: 'Seed Hut' }); // painted before fetch resolves
    resolvers[0]({ name: 'Real Hut' });
    await vi.waitFor(() => expect(detail.value).toEqual({ name: 'Real Hut' }));
  });

  it('fires no fetch while no target is present (closed-surface gating)', async () => {
    const { entry, resolvers } = deferringEntry();
    const t = ref<MapTarget | null>(null);
    usePlaceDetail(t, { entry: ref(entry) });
    await Promise.resolve();
    expect(resolvers.length).toBe(0);
    t.value = makeTarget('late');
    await vi.waitFor(() => expect(resolvers.length).toBe(1));
  });

  it('props-only entries render seeds without any fetch', () => {
    const t = makeTarget('water');
    stagePrebuiltSeed(t.key, { name: 'Water Point' });
    const { detail, loading } = usePlaceDetail(ref(t), { entry: ref(propsOnlyEntry) });
    expect(detail.value).toEqual({ name: 'Water Point' });
    expect(loading.value).toBe(false);
  });

  it('LRU-evicts the oldest seed beyond the cap', () => {
    const oldest = makeTarget('seed-0');
    for (let i = 0; i <= 50; i++) {
      const t = makeTarget(`seed-${i}`);
      stagePrebuiltSeed(t.key, { name: `Seed ${i}` });
    }
    // seed-0 was evicted (cap 50); seed-50 survives.
    const evicted = usePlaceDetail(ref(oldest), { entry: ref(propsOnlyEntry) });
    expect(evicted.detail.value).toBeNull();
    const fresh = usePlaceDetail(ref(makeTarget('seed-50')), { entry: ref(propsOnlyEntry) });
    expect(fresh.detail.value).toEqual({ name: 'Seed 50' });
  });

  it('clears the seed cache on overlay-catalog epoch bumps', async () => {
    const t = makeTarget('epoch');
    usePlaceDetail(ref(makeTarget('warmup')), { entry: ref(propsOnlyEntry) }); // installs the epoch watch
    stagePrebuiltSeed(t.key, { name: 'Before' });
    const seeded = usePlaceDetail(ref(t), { entry: ref(propsOnlyEntry) });
    expect(seeded.detail.value).toEqual({ name: 'Before' });
    const store = useOverlayStore();
    store.overlaysEpoch += 1;
    await vi.waitFor(() => {
      const after = usePlaceDetail(ref(t), { entry: ref(propsOnlyEntry) });
      expect(after.detail.value).toBeNull();
    });
  });
});
