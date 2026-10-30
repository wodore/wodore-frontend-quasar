/**
 * Idle-gated application of map-content swaps (tab-focus style
 * revalidation, live-refresh design): a catalog refresh that arrives
 * mid-session must not interrupt the user — the map-visible part of the
 * swap (overlay re-add, basemap setStyle) waits until the app is idle.
 *
 * "Idle" is the MapLibre `idle` event (last frame rendered before the
 * map settles — never fires mid-gesture/animation/tile-load) with a
 * hard deadline as the safety net: a map that never settles (static
 * view with nothing left to render, stalled tiles) must not hold the
 * update forever — same pattern as the staged basemap enhancements in
 * basemap-store's `scheduleStagedAttach`. Sessions without a MapLibre
 * map (Leaflet fallback, native bridge) fall back to `whenIdle`
 * (requestIdleCallback, main-thread idle).
 */
import { whenIdle } from '@services/idle';

/** Structural slice of the MapLibre map the gate uses (duck-typed so
 *  the store's widened mapRef casts stay local — mirrors the
 *  availability sourcedata listener pattern in map-catalog-store). */
export type IdleMapLike =
  | {
      once: (event: string, listener: () => void) => void;
      off?: (event: string, listener: () => void) => void;
    }
  | null
  | undefined;

/** Deadline for the never-idle safety net (ms) — parity with
 *  scheduleStagedAttach's fallback timer. */
const IDLE_FALLBACK_MS = 10_000;

/** Run `task` at the next idle moment. The task runs EXACTLY once
 *  (whichever signal fires first wins); a task that becomes stale
 *  before then is expected to no-op itself (re-resolve the current
 *  state at fire time — see the call sites). */
export function whenMapIdle(map: IdleMapLike, task: () => void): void {
  if (map?.once) {
    let done = false;
    const run = (): void => {
      if (done) return;
      done = true;
      task();
    };
    map.once('idle', run);
    setTimeout(() => {
      // Safety net: 'idle' may never fire again on an already-settled
      // static map (no render, no event) — the deadline guarantees the
      // deferred swap still lands (worst case: it interrupts nothing,
      // because nothing is happening).
      map.off?.('idle', run);
      run();
    }, IDLE_FALLBACK_MS);
    return;
  }
  void whenIdle(task);
}
