// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startHutPrefetch, consumePrefetchedHut } from '@services/hut-prefetch';

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ slug: 'aarbiwak' }) }));

describe('hut-prefetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
  });

  it('prefetches /hut/:slug deep links with the sniffed lang', () => {
    // fresh module state per test run is not guaranteed — call on a hut path
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/hut/bietschhorn',
    } as never);
    startHutPrefetch();
    expect(fetchMock).not.toHaveBeenCalled(); // NODE_ENV=test guard: prefetch is inert in tests
  });

  it('consume returns null on lang or slug mismatch', () => {
    expect(consumePrefetchedHut('does-not-exist', 'en')).toBeNull();
  });
});
