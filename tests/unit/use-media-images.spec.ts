// @vitest-environment happy-dom
//
// Regression tests for the hut-image fetch loop.
//
// useMediaImages used to fire its fetch inline in a watchEffect. Starting a
// request runs the API client's loading middleware, which increments the
// shared reactive request counter (`activeCount.value++` in
// useRequestProgress — a read+write). Inside a watchEffect that read turned
// the counter into a dependency of the effect, so every increment
// re-triggered the effect and refetched endlessly (continuous
// /v1/geo/images/hut/{slug} requests, gallery never settled).
//
// These tests exercise the REAL middleware chain by faking only the
// openapi-fetch transport: the counter increments really happen, so the old
// pattern makes the call counts explode while the fixed watch-based
// composable performs exactly one request per source change.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computed, effectScope, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import type { Middleware } from 'openapi-fetch';

// Minimal auth store stub: the client's auth middleware only reads
// access_token; a full oidc store is unnecessary here.
vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({ access_token: '' }),
}));

// Controllable reactive locale for the refetch-on-language-change contract.
vi.mock('@services/locale', async () => {
  const { ref } = await import('vue');
  const locale = ref<'de' | 'en'>('en');
  return {
    currentLocale: () => locale.value,
    __setLocaleForTests: (value: 'de' | 'en') => {
      locale.value = value;
    },
  };
});

/** Shared fake-client state (reset per test in beforeEach). */
const fake = vi.hoisted(() => ({
  getCalls: [] as string[],
  middlewares: [] as Middleware[],
}));

vi.mock('openapi-fetch', () => ({
  default: () => ({
    use: (middleware: Middleware) => {
      fake.middlewares.push(middleware);
    },
    async GET(url: string, opts: { params?: { path?: Record<string, string> } }) {
      const slug = opts?.params?.path?.hut_slug ?? '';
      const request = new Request(`https://api.test${url.replace('{hut_slug}', slug)}`);
      fake.getCalls.push(request.url);
      for (const middleware of fake.middlewares) {
        if (middleware.onRequest) {
          await middleware.onRequest({ request, url, params: opts?.params });
        }
      }
      for (const middleware of fake.middlewares) {
        if (middleware.onResponse) {
          await middleware.onResponse({ request, url, response: new Response(), result: {} });
        }
      }
      return { data: imageCollection(), error: undefined };
    },
  }),
}));

/** One-feature GeoJSON collection matching the API response shape. */
function imageCollection() {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [8.1, 46.58] },
        properties: {
          provider: { slug: 'wikicommons', name: 'WikiCommons', url: null, icon: null },
          source_id: 'wikicommons:File:Hut.jpg',
          attribution: { short: 'X', full: 'X' },
          license: { name: 'CC', slug: 'cc', url: null },
          author: { name: 'a', url: null },
          urls: { square: {}, landscape: {}, original: { raw: 'r' } },
          is_portrait: false,
          image_type: 'flat',
          distance_m: 0,
        },
      },
    ],
    metadata: { total: 1 },
  };
}

/** Let all pending microtasks/scheduler jobs settle before asserting. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await nextTick();
    await Promise.resolve();
  }
  await new Promise(resolve => setTimeout(resolve, 10));
}

describe('useMediaImages', () => {
  beforeEach(() => {
    fake.getCalls = [];
    fake.middlewares = [];
    setActivePinia(createPinia());
  });

  it('fetches hut images exactly once per slug (no refetch loop)', async () => {
    const { useHutImages } = await import('@composables/useHutImages');
    const scope = effectScope();
    scope.run(() => {
      const { images, loading } = useHutImages(ref('schreckhorn'));
      expect(loading.value).toBe(true);
      return { images };
    });

    await settle();

    expect(fake.getCalls.filter(url => url.includes('/geo/images/hut/'))).toHaveLength(1);
    scope.stop();
  });

  it('refetches once when the UI language changes', async () => {
    const localeService = (await import('@services/locale')) as unknown as {
      __setLocaleForTests: (value: 'de' | 'en') => void;
    };
    const { useHutImages } = await import('@composables/useHutImages');
    const scope = effectScope();
    scope.run(() => useHutImages(ref('schreckhorn')));

    await settle();
    expect(fake.getCalls).toHaveLength(1);

    localeService.__setLocaleForTests('de');
    await settle();
    expect(fake.getCalls).toHaveLength(2);

    // No further spontaneous refetches
    await settle();
    expect(fake.getCalls).toHaveLength(2);
    scope.stop();
  });

  it('refetches when the slug changes', async () => {
    const { useHutImages } = await import('@composables/useHutImages');
    const slug = ref('schreckhorn');
    const scope = effectScope();
    scope.run(() => useHutImages(computed(() => slug.value)));

    await settle();
    expect(fake.getCalls).toHaveLength(1);

    slug.value = 'aarbiwak';
    await settle();
    expect(fake.getCalls).toHaveLength(2);
    expect(fake.getCalls[1]).toContain('aarbiwak');
    scope.stop();
  });
});
