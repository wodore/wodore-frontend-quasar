/**
 * Selection store state machine — OpenSpec `add-place-interactions`
 * (capability `place-interactions`): open/expand/close, via-modes, D12
 * toggle-close vs re-anchor, expand handoff, route-watcher choke point,
 * re-target, cold deep link, popup replacement.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { useSelectionStore } from '@stores/map/selection-store';
import { createRegistry, setDefaultRegistry } from '@selection/registry';
import { definePresentation, targetKey, type MapTarget } from '@selection/types';

function target(id: string, extra: { featureRef?: unknown } = {}): MapTarget {
  return {
    key: targetKey({ source: 'geoplace', id }),
    source: 'geoplace',
    id,
    props: { domain: 'amenity', name: id },
    ...extra,
  };
}

const detailOnly = definePresentation<{ name: string }>({
  id: 'accommodation',
  match: { source: 'geoplace', kindParent: 'accommodation' },
  capabilities: ['detail'],
});

const bothCapable = definePresentation<Record<string, unknown>>({
  id: 'transport',
  match: { source: 'geoplace', domain: 'amenity' },
  capabilities: ['popup', 'detail'],
});

const popupOnly = definePresentation<Record<string, unknown>>({
  id: 'geoplace-default',
  match: { source: 'geoplace' },
  capabilities: ['popup'],
});

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

/** Instantiate the store inside a component setup (useRouter needs the
 *  injection) and return it — the same conditions production gives. */
function instantiate(pinia: Pinia, router: Router): ReturnType<typeof useSelectionStore> {
  let store!: ReturnType<typeof useSelectionStore>;
  const app = createApp({
    setup() {
      store = useSelectionStore();
      return () => null;
    },
  });
  app.use(pinia);
  app.use(router);
  app.mount(document.createElement('div'));
  return store;
}

describe('selection store state machine', () => {
  let pinia: Pinia;
  let router: Router;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = makeRouter();
  });

  it('via map + both-capable entry opens the POPUP (no route change)', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('water-x'), { via: 'map', entry: bothCapable });
    expect(store.mode).toBe('popup');
    expect(store.popupTarget?.id).toBe('water-x');
    expect(router.currentRoute.value.name).toBe('map');
  });

  it('via map + detail-only entry opens the ROUTED detail', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    const marker = { engine: 'maplibre', handle: { id: 7 } };
    await store.open(target('planing', { featureRef: marker }), {
      via: 'map',
      entry: detailOnly,
    });
    expect(router.currentRoute.value.name).toBe('map-hut');
    expect(router.currentRoute.value.params.slug).toBe('planing');
    expect(store.routedTarget?.id).toBe('planing');
    expect(store.mode).toBe('detail');
    expect(store.highlightRef).toBe(marker);
  });

  it('via search prefers the detail when both surfaces exist', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('stop-1'), { via: 'search', entry: bothCapable });
    expect(store.mode).toBe('detail');
    expect(router.currentRoute.value.params.slug).toBe('stop-1');
  });

  it('single popup surface opens regardless of via', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('peak-9'), { via: 'search', entry: popupOnly });
    expect(store.mode).toBe('popup');
  });

  it('D12: map re-click of the routed target toggles it CLOSED', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('planing'), { via: 'map', entry: detailOnly });
    expect(store.mode).toBe('detail');
    await store.open(target('planing'), { via: 'map', entry: detailOnly });
    expect(router.currentRoute.value.name).toBe('map');
    expect(store.mode).toBe('closed');
    expect(store.routedTarget).toBeNull();
    expect(store.highlightRef).toBeNull();
  });

  it('D12: search re-select of the routed target re-anchors (stays open)', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    const first = target('planing');
    await store.open(first, { via: 'search', entry: detailOnly });
    const reanchored = target('planing', { featureRef: { engine: 'maplibre', handle: 42 } });
    await store.open(reanchored, { via: 'search', entry: detailOnly });
    expect(router.currentRoute.value.name).toBe('map-hut');
    expect(store.routedTarget).toBe(reanchored);
    expect(store.highlightRef).toBe(reanchored.featureRef);
  });

  it('rapid popup A→B replaces the target and the highlight', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    const a = target('a', { featureRef: { engine: 'maplibre', handle: 1 } });
    const b = target('b', { featureRef: { engine: 'maplibre', handle: 2 } });
    await store.open(a, { via: 'map', entry: popupOnly });
    await store.open(b, { via: 'map', entry: popupOnly });
    expect(store.popupTarget?.id).toBe('b');
    expect(store.highlightRef).toBe(b.featureRef);
    expect(store.candidates).toEqual([]);
  });

  it('expand hands the popup target off to the routed detail', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    const t = target('stop-1', { featureRef: { engine: 'maplibre', handle: 9 } });
    await store.open(t, { via: 'map', entry: bothCapable });
    expect(store.mode).toBe('popup');
    await store.expand();
    expect(store.mode).toBe('detail');
    expect(store.routedTarget).toBe(t);
    expect(store.popupTarget).toBeNull();
    expect(store.highlightRef).toBe(t.featureRef);
  });

  it('back/leave clears detail state without resurrecting the popup', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    const t = target('planing', { featureRef: { engine: 'maplibre', handle: 3 } });
    await store.open(t, { via: 'map', entry: detailOnly });
    await router.push({ name: 'map' });
    await nextTick();
    expect(store.mode).toBe('closed');
    expect(store.routedTarget).toBeNull();
    expect(store.highlightRef).toBeNull();
    expect(store.popupTarget).toBeNull();
  });

  it('re-target while open drops the stale routed target (host rebuilds)', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('a'), { via: 'map', entry: detailOnly });
    // Direct navigation to another slug (e.g. legacy deep-link path)
    await router.push({ name: 'map-hut', params: { slug: 'other' } });
    await nextTick();
    expect(store.routedTarget).toBeNull();
    expect(store.detailSlug).toBe('other');
    expect(store.mode).toBe('detail');
  });

  it('cold deep link: routedTarget stays null for the host resolver', async () => {
    const store = instantiate(pinia, router);
    await router.push('/hut/cold-one');
    await nextTick();
    expect(store.mode).toBe('detail');
    expect(store.routedTarget).toBeNull();
    expect(store.contentSlug).toBe('cold-one');
    expect(store.popupTarget).toBeNull();
  });

  it('closePopup clears the popup world and (outside detail) the highlight', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('w', { featureRef: { engine: 'maplibre', handle: 5 } }), {
      via: 'map',
      entry: popupOnly,
    });
    store.closePopup();
    expect(store.mode).toBe('closed');
    expect(store.highlightRef).toBeNull();
  });

  it('open resolves through the installed default registry', async () => {
    setDefaultRegistry(createRegistry([detailOnly, popupOnly]));
    try {
      await router.push('/');
      const store = instantiate(pinia, router);
      const hut = {
        ...target('registry-hut'),
        props: { domain: 'amenity', kind: { identifier: 'accommodation.hut' } },
      };
      await store.open(hut, { via: 'map' });
      expect(router.currentRoute.value.params.slug).toBe('registry-hut');
    } finally {
      setDefaultRegistry(createRegistry([]));
    }
  });

  // ── GLM review F1: choke point fires only on CONTENT changes ──────

  it('a query-only navigation does not kill the open popup', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('w'), { via: 'map', entry: bothCapable });
    expect(store.mode).toBe('popup');
    await router.push({ path: '/', query: { x: '2' } });
    await nextTick();
    expect(store.mode).toBe('popup');
    expect(store.popupTarget?.id).toBe('w');
    await router.push('/#foo');
    await nextTick();
    expect(store.mode).toBe('popup');
  });

  it('a hash-only navigation does not kill the open detail', async () => {
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('h'), { via: 'map', entry: detailOnly });
    expect(store.mode).toBe('detail');
    await router.push('/hut/h#zoom');
    await nextTick();
    expect(store.mode).toBe('detail');
    expect(store.routedTarget?.id).toBe('h');
  });

  // ── GLM review F4: cancelled navigation must not leak state ────────

  it('a cancelled expand drops the handoff and keeps the popup', async () => {
    router.beforeEach(() => false); // cancel every navigation
    await router.push('/');
    const store = instantiate(pinia, router);
    await store.open(target('stop'), { via: 'map', entry: bothCapable });
    expect(store.mode).toBe('popup');
    await store.expand();
    expect(store.mode).toBe('popup'); // detail route never landed
    expect(store.detailPending).toBeNull();
    expect(store.popupTarget?.id).toBe('stop');
  });

  it('a cancelled openDetail undoes the optimistic routed/highlight state', async () => {
    router.beforeEach(() => false); // cancel every navigation
    await router.push('/');
    const store = instantiate(pinia, router);
    const marker = { engine: 'maplibre' as const, handle: { id: 11 } };
    await store.open(target('planing', { featureRef: marker }), {
      via: 'search',
      entry: detailOnly,
    });
    expect(store.mode).toBe('closed'); // route never landed
    expect(store.routedTarget).toBeNull();
    expect(store.highlightRef).toBeNull();
  });
});
