//
// usePlace error classification: the three failure kinds surfaced to the
// hut detail error state — server answered with an HTTP error status
// (bare status code, no API body text), the server could not be reached
// (network rejection while the browser reports online), and the user is
// offline (navigator.onLine false at failure time).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({ access_token: '' }),
}));

// Prefetch handoff regression coverage: the real service no-ops under
// NODE_ENV=test, so the handoff branch is only reachable via this mock
// (controllable per test; default null = miss → normal fetch).
const consumePrefetch = vi.hoisted(() => vi.fn((): unknown => null));
vi.mock('@services/hut-prefetch', () => ({
  consumePrefetchedHut: consumePrefetch,
}));

// clientWodore captures WODORE_API_HOST and the global fetch at import
// time — both must be in place before the module graph evaluates
// (same pattern as api-version.spec.ts). Tests must mutate THIS mock
// instance (fetchMock), not re-stub globalThis.fetch.
vi.hoisted(() => {
  process.env.WODORE_API_HOST = 'http://test.local';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 }))
  );
});

import { usePlace, seedPlaceFromMap } from '@composables/usePlace';

// The mock instance openapi-fetch actually captured (stubbed in hoisted).
const fetchMock = vi.mocked(globalThis.fetch);

describe('usePlace error classification', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  });

  async function errorForSlug(slug: string) {
    const { error } = usePlace(ref(slug));
    await vi.waitFor(() => expect(error.value).not.toBeNull());
    return error.value;
  }

  it('reports the HTTP status code when the server returns an error', async () => {
    fetchMock.mockImplementation(async () => new Response('{"code":"x"}', { status: 500 }));
    await expect(errorForSlug('spec-http-error')).resolves.toEqual({
      kind: 'http',
      status: 500,
    });
  });

  it('classifies a network rejection as unreachable while online', async () => {
    // Node's own navigator.onLine is false — pin it like a browser would report
    vi.stubGlobal('navigator', { onLine: true });
    fetchMock.mockImplementation(async () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(errorForSlug('spec-unreachable')).resolves.toEqual({ kind: 'unreachable' });
  });

  it('classifies a network rejection as offline when navigator reports offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    fetchMock.mockImplementation(async () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(errorForSlug('spec-offline')).resolves.toEqual({ kind: 'offline' });
  });
});

describe('usePlace MVT identity seed', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  });

  it('paints identity from tile properties before the details request resolves', async () => {
    // Details request never resolves — only the seed may paint
    fetchMock.mockImplementation(() => new Promise(() => {}));

    seedPlaceFromMap(
      'seeded-hut',
      {
        name: 'Aarbiwak SAC',
        name_de: 'Aarbiwak SAC',
        name_en: 'Aarbiwak SAC',
        elevation: '2731.0',
        owner_name: 'SAC Pilatus',
        type_standard_slug: 'bivouac',
        type_standard_color: '#6B46C1',
      },
      { lat: 46.555, lon: 8.152 }
    );

    const { place, loading } = usePlace(ref('seeded-hut'));
    await nextTick();

    expect(place.value?.name).toBe('Aarbiwak SAC');
    expect(place.value?.elevation).toBe(2731);
    expect(place.value?.owner?.name).toBe('SAC Pilatus');
    expect(place.value?.location?.lat).toBeCloseTo(46.555);
    expect(place.value?.location?.lon).toBeCloseTo(8.152);
    expect(place.value?.type_open?.color).toBe('#6B46C1');
    // Guarded fields stay unset — icons/badges still wait for the payload
    expect(place.value?.type_open?.name).toBeUndefined();
    expect(place.value?.type_open?.symbol).toBeUndefined();
    // The real request is still pending
    expect(loading.value).toBe(true);
  });

  it('is overwritten by the real payload when it arrives', async () => {
    seedPlaceFromMap(
      'overwritten-hut',
      { name: 'Seed Name', elevation: '1000.0' },
      { lat: 1, lon: 2 }
    );

    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ name: 'Real Name', elevation: 2000 }), {
          status: 200,
        })
    );

    const { place, loading } = usePlace(ref('overwritten-hut'));
    await nextTick();
    expect(place.value?.name).toBe('Seed Name'); // seed paints first

    await vi.waitFor(() => expect(loading.value).toBe(false));
    expect(place.value?.name).toBe('Real Name'); // payload wins
    expect(place.value?.elevation).toBe(2000);
  });

  it('does not paint a seed for a different slug', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    seedPlaceFromMap('other-hut', { name: 'Other Hut' }, { lat: 1, lon: 2 });

    const { place } = usePlace(ref('unseeded-hut'));
    await nextTick();
    expect(place.value).toBeUndefined();
  });
});

describe('deep-link prefetch handoff', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
    consumePrefetch.mockReset();
    consumePrefetch.mockReturnValue(null);
  });

  it('unwraps the prefetched promise into the place payload (regression: the live Promise object was passed through as data)', async () => {
    consumePrefetch.mockReturnValue(Promise.resolve({ name: 'Prefetched Hut', elevation: 2500 }));
    const { place, loading } = usePlace(ref('prefetched-hut'));

    await vi.waitFor(() => expect(loading.value).toBe(false));
    expect(place.value).toEqual({ name: 'Prefetched Hut', elevation: 2500 });
    expect(place.value instanceof Promise).toBe(false);
  });

  it('falls back to a normal fetch when the prefetch request itself failed', async () => {
    consumePrefetch.mockReturnValue(Promise.reject(new Error('Hut prefetch HTTP 500')));
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ name: 'Fallback Hut' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const { place, loading, error } = usePlace(ref('fallback-hut'));

    await vi.waitFor(() => expect(loading.value).toBe(false));
    expect(error.value).toBeNull();
    expect((place.value as { name?: string })?.name).toBe('Fallback Hut');
  });
});
