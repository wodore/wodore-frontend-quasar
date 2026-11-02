/**
 * useActiveDetailEntry — the three-zone feeder (place-interactions spec
 * "Detail surface composition"; Opus consolidated review #4): entry
 * resolution order (routedEntry → registry → interim route-meta
 * binding), zone loading from the entry's ONE barrel, staleness token
 * (a late-settling surfaces promise for a previous entry must not
 * clobber the current zones).
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { useActiveDetailEntry } from '@composables/useActiveDetailEntry';
import { useSelectionStore } from '@stores/map/selection-store';
import { createRegistry, setDefaultRegistry } from '@selection/registry';
import { definePresentation, targetKey } from '@selection/types';
import { accommodationEntry } from '@selection/entries/accommodation';

const StubTitle = defineComponent({ name: 'StubTitle', render: () => null });
const StubBody = defineComponent({ name: 'StubBody', render: () => null });
const StubActions = defineComponent({ name: 'StubActions', render: () => null });

const OtherBody = defineComponent({ name: 'OtherBody', render: () => null });

/** A deferred-surfaces entry lets the staleness test control settling. */
function deferredEntry(id: string): {
  entry: ReturnType<typeof definePresentation<Record<string, unknown>>>;
  resolve: (body: unknown) => void;
} {
  let resolve!: (value: { detail: unknown }) => void;
  const entry = definePresentation<Record<string, unknown>>({
    id,
    match: { source: 'geoplace' },
    capabilities: ['detail'],
    surfaces: () =>
      new Promise(res => {
        resolve = res;
      }) as never,
  });
  return { entry, resolve: v => resolve(v) };
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'map', component: { render: () => null } },
      {
        path: '/hut/:slug',
        name: 'map-hut',
        meta: { content: true, contentType: 'place' },
        component: { render: () => null },
      },
    ],
  });
}

function instantiate(pinia: Pinia, router: Router) {
  let result!: ReturnType<typeof useActiveDetailEntry>;
  let store!: ReturnType<typeof useSelectionStore>;
  const app = createApp({
    setup() {
      store = useSelectionStore();
      result = useActiveDetailEntry();
      return () => null;
    },
  });
  app.use(pinia);
  app.use(router);
  app.mount(document.createElement('div'));
  return { active: result, store };
}

describe('useActiveDetailEntry', () => {
  let pinia: Pinia;
  let router: Router;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = makeRouter();
  });

  it('interim route-meta binding resolves accommodation on a cold content route', async () => {
    await router.push('/hut/cold-one');
    setDefaultRegistry(createRegistry([]));
    try {
      const { active } = instantiate(pinia, router);
      await nextTick();
      expect(active.entry.value?.id).toBe(accommodationEntry.id);
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('prefers the registry-resolved routed target over the meta binding', async () => {
    await router.push('/hut/registry-hut');
    const other = deferredEntry('other');
    setDefaultRegistry(createRegistry([other.entry]));
    try {
      const { active, store } = instantiate(pinia, router);
      // A routed target (registry-resolved by open — no MatchSpec
      // overrides via an explicit entry).
      await store.open(
        {
          key: targetKey({ source: 'geoplace', id: 'registry-hut' }),
          source: 'geoplace',
          id: 'registry-hut',
          props: {},
        },
        { via: 'link' }
      );
      await nextTick();
      expect(active.entry.value?.id).toBe('other');
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('loads the three zones from the entry barrel and survives staleness', async () => {
    await router.push('/');
    const slow = deferredEntry('slow');
    const fast = deferredEntry('fast');
    setDefaultRegistry(createRegistry([slow.entry, fast.entry]));
    try {
      const { active, store } = instantiate(pinia, router);
      await store.open(
        {
          key: targetKey({ source: 'geoplace', id: 'a' }),
          source: 'geoplace',
          id: 'a',
          props: {},
        },
        { via: 'link', entry: slow.entry }
      );
      await nextTick(); // slow entry pending
      await store.open(
        {
          key: targetKey({ source: 'geoplace', id: 'b' }),
          source: 'geoplace',
          id: 'b',
          props: {},
        },
        { via: 'link', entry: fast.entry }
      );
      await nextTick();
      // fast settles FIRST; slow resolves LAST — the token must keep it
      // from clobbering the fast zones.
      fast.resolve({ detail: OtherBody });
      await nextTick();
      await Promise.resolve();
      expect(active.body.value).toBe(OtherBody);
      slow.resolve({ detail: StubBody });
      await nextTick();
      await Promise.resolve();
      expect(active.body.value).toBe(OtherBody); // stale slow ignored
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('resolves null zones when the entry has no barrel', async () => {
    await router.push('/hut/plain');
    const bare = definePresentation<Record<string, unknown>>({
      id: 'bare',
      match: { source: 'geoplace' },
      capabilities: ['detail'],
    });
    setDefaultRegistry(createRegistry([bare]));
    try {
      const { active, store } = instantiate(pinia, router);
      await store.open(
        {
          key: targetKey({ source: 'geoplace', id: 'plain' }),
          source: 'geoplace',
          id: 'plain',
          props: {},
        },
        { via: 'link' }
      );
      await nextTick();
      await Promise.resolve();
      expect(active.entry.value?.id).toBe('bare');
      expect(active.title.value).toBeNull();
      expect(active.body.value).toBeNull();
      expect(active.actions.value).toBeNull();
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  it('full surfaces swap all three zones atomically', async () => {
    await router.push('/hut/full');
    const full = definePresentation<Record<string, unknown>>({
      id: 'full',
      match: { source: 'geoplace' },
      capabilities: ['detail'],
      surfaces: () =>
        Promise.resolve({
          detail: StubBody,
          detailTitle: StubTitle,
          detailActions: StubActions,
        }),
    });
    setDefaultRegistry(createRegistry([full]));
    try {
      const { active, store } = instantiate(pinia, router);
      await store.open(
        {
          key: targetKey({ source: 'geoplace', id: 'full' }),
          source: 'geoplace',
          id: 'full',
          props: {},
        },
        { via: 'link' }
      );
      await nextTick();
      await Promise.resolve();
      await nextTick();
      expect(active.title.value).toBe(StubTitle);
      expect(active.body.value).toBe(StubBody);
      expect(active.actions.value).toBe(StubActions);
      expect(active.loading.value).toBe(false);
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  void StubActions;
});
