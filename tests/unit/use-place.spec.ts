//
// usePlace error classification: the three failure kinds surfaced to the
// hut detail error state — server answered with an HTTP error status
// (bare status code, no API body text), the server could not be reached
// (network rejection while the browser reports online), and the user is
// offline (navigator.onLine false at failure time).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({ access_token: '' }),
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

import { usePlace } from '@composables/usePlace';

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
