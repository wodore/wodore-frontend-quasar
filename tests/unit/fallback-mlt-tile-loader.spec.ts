/**
 * Unit tests for the generic MLT tile loader (fallback/mlt-tile-loader.ts)
 * — the fetch → decode → cache → evict → generation-guard loop shared by
 * the hut and availability tile sources. Fetch is injected, so these run
 * without a tile server.
 */
import { describe, expect, it } from 'vitest';
import { MltTileCache, type MltTileCacheOptions } from '@components/map/fallback/mlt-tile-loader';

/** Empty-value marker for the generic cache under test. */
const EMPTY: string[] = [];

function makeCache(
  fetchImpl: typeof fetch,
  parseTile: (buf: Uint8Array) => string[] = buf => [String.fromCharCode(...buf)]
): MltTileCache<string[]> {
  const opts: MltTileCacheOptions<string[]> = {
    buildUrl: (z: number, x: number, y: number) => `https://t.test/tiles/${z}/${x}/${y}.mlt`,
    emptyValue: EMPTY,
    parseTile,
    fetchImpl,
  };
  return new MltTileCache(opts);
}

const okBody = (bytes: number[]) => new Response(new Uint8Array(bytes), { status: 200 });

const range = (x1: number, x2: number, y1: number, y2: number, tileZoom = 9) => ({
  x1,
  x2,
  y1,
  y2,
  tileZoom,
});

describe('MltTileCache.loadViewport', () => {
  it('fetches missing tiles and caches parsed values', async () => {
    const urls: string[] = [];
    const cache = makeCache(async (input: RequestInfo | URL, _init?: RequestInit) => {
      urls.push(String(input));
      return okBody([1, 2, 3, 4]);
    });
    const res = await cache.loadViewport(range(0, 1, 0, 0));
    expect(res.fetched).toBe(2);
    expect(res.evicted).toBe(0);
    expect(res.superseded).toBe(false);
    expect(cache.tiles.size).toBe(2);
    expect(cache.tiles.get('9/0/0')).toEqual(['\u0001\u0002\u0003\u0004']);
    expect(urls).toHaveLength(2);
  });

  it('caches empty bodies (< 2 bytes) as the empty value — no refetch', async () => {
    let calls = 0;
    const cache = makeCache(async () => {
      calls++;
      // NOTE: undici forbids Response(body, {status: 204}); a body-less
      // 200 exercises the same byteLength=0 path a network 204 takes.
      return new Response(new Uint8Array(0), { status: 200 });
    });
    const r1 = await cache.loadViewport(range(0, 0, 0, 0));
    expect(r1.fetched).toBe(1);
    expect(cache.tiles.get('9/0/0')).toBe(EMPTY);
    // Second load: served from the cache (empty tiles are cached too)
    const r2 = await cache.loadViewport(range(0, 0, 0, 0));
    expect(r2.fetched).toBe(0);
    expect(calls).toBe(1);
  });

  it('failed responses (non-ok) leave the tile absent — next move retries', async () => {
    let calls = 0;
    const cache = makeCache(async () => {
      calls++;
      return new Response('nope', { status: 404 });
    });
    await cache.loadViewport(range(0, 0, 0, 0));
    expect(cache.tiles.size).toBe(0);
    // Absent tiles retry on the next loadViewport
    await cache.loadViewport(range(0, 0, 0, 0));
    expect(calls).toBe(2);
  });

  it('evicts tiles that left the viewport', async () => {
    const cache = makeCache(async () => okBody([1, 2, 3, 4]));
    await cache.loadViewport(range(0, 2, 0, 0));
    expect(cache.tiles.size).toBe(3);
    const res = await cache.loadViewport(range(2, 2, 0, 0)); // only x=2 needed
    expect(res.evicted).toBe(2);
    expect([...cache.tiles.keys()]).toEqual(['9/2/0']);
  });

  it('skips y outside the pyramid (y < 0 or y >= 2^z)', async () => {
    const cache = makeCache(async () => okBody([1, 2, 3, 4]));
    await cache.loadViewport(range(0, 0, -2, 2, 9));
    expect(cache.tiles.size).toBe(3); // y ∈ {0, 1, 2} valid, -2/-1 skipped
    expect(cache.tiles.has('9/0/0')).toBe(true);
  });

  it('wraps x around the globe (antimeridian)', async () => {
    const urls: string[] = [];
    const cache = makeCache(async input => {
      urls.push(String(input));
      return okBody([1, 2, 3, 4]);
    });
    // x=512 ≡ 0 at z9 (one globe east of the tile space)
    await cache.loadViewport(range(511, 512, 0, 0));
    expect(cache.tiles.has('9/511/0')).toBe(true);
    expect(cache.tiles.has('9/0/0')).toBe(true); // wrapped, not raw 512
    expect(urls.some(u => u.includes('/512/'))).toBe(false);
  });

  it('a parse throw leaves the tile absent (decode failure semantics)', async () => {
    const cache = makeCache(
      async () => okBody([1, 2, 3, 4]),
      () => {
        throw new Error('bad mlt');
      }
    );
    await cache.loadViewport(range(0, 0, 0, 0));
    expect(cache.tiles.size).toBe(0);
  });

  it('generation guard: a still-needed tile lands even when its fetch was superseded', async () => {
    // Regression (Opus review #2): gen N fetches 9/0/0 (slow), gen N+1
    // (viewport top-up covering the SAME key) supersedes it and completes
    // first. The slow fetch still lands — its key is still in view.
    const cache = makeCache(async input => {
      const url = String(input);
      if (url.includes('/0/0')) await new Promise(r => setTimeout(r, 80));
      return okBody([9, 9, 9]);
    });
    const first = cache.loadViewport(range(0, 0, 0, 0));
    await new Promise(r => setTimeout(r, 10)); // let the first start
    const second = cache.loadViewport(range(0, 1, 0, 0)); // supersedes, needs BOTH keys
    const r1 = await first;
    const r2 = await second;
    expect(r1.superseded).toBe(true);
    expect(r2.superseded).toBe(false);
    expect(cache.tiles.get('9/1/0')).toEqual(['\u0009\u0009\u0009']); // newer call's own
    expect(cache.tiles.get('9/0/0')).toEqual(['\u0009\u0009\u0009']); // late, still needed → lands
  });

  it('generation guard: tiles that LEFT the viewport stay dropped', async () => {
    const cache = makeCache(async input => {
      const url = String(input);
      if (url.includes('/0/0')) await new Promise(r => setTimeout(r, 80));
      return okBody([9, 9, 9]);
    });
    const first = cache.loadViewport(range(0, 0, 0, 0));
    await new Promise(r => setTimeout(r, 10));
    const second = cache.loadViewport(range(1, 1, 0, 0)); // pans AWAY from x=0
    await first;
    await second;
    // 9/0/0 left the viewport — the slow fetch result is discarded
    expect(cache.tiles.has('9/0/0')).toBe(false);
    expect(cache.tiles.has('9/1/0')).toBe(true);
  });
});
