/**
 * Generic viewport-scoped MLT tile loader for the fallback map — the
 * fetch → decode → cache → evict → generation-guard loop that the hut
 * and availability tile sources share (it was the same algorithm twice
 * in the component).
 *
 * One `MltTileCache` instance per source. The source-specific parts
 * (URL shape, feature parsing) are injected via the options object, so
 * the loop itself is unit-testable without a tile server: `fetch` is
 * also injectable for tests.
 *
 * Lifecycle: `loadViewport(range)` is called on every map move end
 * (debounced by the caller). Tiles outside the padded viewport are
 * evicted; missing ones are fetched in parallel; results from a
 * superseded call are dropped (latest-wins — a fast pan never applies
 * stale tiles). Failures leave the tile ABSENT so the next move
 * retries it.
 */

import { decodeTile, type FeatureTable } from '@maplibre/mlt';
import { wrapTileX } from './tile-math';

/** Integer tile range covering a padded viewport (from viewportTileRange). */
export interface TileRange {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  tileZoom: number;
}

/** Outcome of one loadViewport call. */
export interface LoadResult {
  /** Tiles whose fetch was attempted (absent ones included). */
  fetched: number;
  /** Cached tiles dropped because they left the viewport. */
  evicted: number;
  /** True when a newer loadViewport call superseded this one — the
   *  caller should skip its post-processing (rebuild/settle). */
  superseded: boolean;
}

export interface MltTileCacheOptions<T> {
  /** Request URL for one tile (includes any query params, e.g. the
   *  availability `?date=…&days=4`). */
  buildUrl(z: number, x: number, y: number): string;
  /** Decode + parse an MLT body into the tile's cached value. May
   *  throw — the tile then stays absent (retried on the next move). */
  parseTile(buf: Uint8Array, z: number, x: number, y: number): T;
  /** Value cached for effectively-empty responses (< 2 bytes), so
   *  empty regions are not re-fetched on every move. */
  emptyValue: T;
  /** Fetch implementation (injectable for tests). */
  fetchImpl?: typeof fetch;
}

export class MltTileCache<T> {
  /** Decoded tiles keyed `z/x/y` (wrapped x). */
  readonly tiles = new Map<string, T>();
  private readonly fetching = new Set<string>();
  private generation = 0;
  /** Keys the NEWEST loadViewport needs — a slow fetch completing after
   *  a supersede still lands when its key is still in view (the
   *  generation alone would drop it with no retry until the next map
   *  move — Opus review #2). Evicted/cleared keys stay dropped. */
  private neededNow = new Set<string>();
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: MltTileCacheOptions<T>) {
    this.doFetch = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  /** Drop every cached tile — call when the URL inputs changed (e.g.
   *  a new availability date swaps every URL). Also invalidates
   *  in-flight results (neededNow emptied). */
  clear(): void {
    this.tiles.clear();
    this.neededNow = new Set();
  }

  /** Fetch missing tiles in `range`, evict out-of-range ones, await
   *  the fetches. The tile cache is updated in place — the caller
   *  reads `tiles` after awaiting (when not superseded). */
  async loadViewport(range: TileRange): Promise<LoadResult> {
    const generation = ++this.generation;
    const n = 2 ** range.tileZoom;
    const needed = new Set<string>();
    const jobs: Array<Promise<void>> = [];
    for (let x = range.x1; x <= range.x2; x++) {
      for (let y = range.y1; y <= range.y2; y++) {
        if (y < 0 || y >= n) continue;
        const wrappedX = wrapTileX(x, range.tileZoom); // globe wrap
        const key = `${range.tileZoom}/${wrappedX}/${y}`;
        needed.add(key);
        if (!this.tiles.has(key) && !this.fetching.has(key)) {
          jobs.push(this.fetchTile(key, range.tileZoom, wrappedX, y));
        }
      }
    }
    let evicted = 0;
    for (const key of this.tiles.keys()) {
      if (!needed.has(key)) {
        this.tiles.delete(key);
        evicted++;
      }
    }
    this.neededNow = needed; // newest viewport owns the write guard
    await Promise.all(jobs);
    return { fetched: jobs.length, evicted, superseded: generation !== this.generation };
  }

  /** Fetch + decode one MLT tile. Failures leave the tile absent (the
   *  next move retries); empty bodies cache as `emptyValue`. A result
   *  lands when its key is still needed by the NEWEST viewport —
   *  superseded-and-evicted keys are dropped (latest-wins). */
  private async fetchTile(key: string, z: number, x: number, y: number): Promise<void> {
    this.fetching.add(key);
    try {
      const res = await this.doFetch(this.opts.buildUrl(z, x, y));
      if (!res.ok) return; // 404/204 = empty region; transient errors retry later
      const buf = new Uint8Array(await res.arrayBuffer());
      const wanted = () => this.neededNow.has(key);
      if (buf.byteLength < 2) {
        if (wanted()) this.tiles.set(key, this.opts.emptyValue);
        return;
      }
      const value = this.opts.parseTile(buf, z, x, y);
      if (wanted()) this.tiles.set(key, value);
    } catch {
      /* decode/network failure — tile stays absent (next move retries) */
    } finally {
      this.fetching.delete(key);
    }
  }
}

/** Find ONE table by name in a decoded MLT body (tiles carry one table
 *  per source; unknown names → undefined). Returns the extent so
 *  callers can scale tile-local coordinates. */
export function findMltTable(buf: Uint8Array, name: string): FeatureTable | undefined {
  for (const table of decodeTile(buf)) {
    if (table.name === name) return table;
  }
  return undefined;
}
