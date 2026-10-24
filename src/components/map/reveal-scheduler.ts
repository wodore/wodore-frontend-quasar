/**
 * Splash-reveal scheduling (perf/map-loader-ux).
 *
 * Decides when the map has "rendered" enough to fade the splash away:
 * the first map idle AFTER the overlay compile finished, with a real
 * style applied — plus a safety ladder that never reveals an unpainted
 * (white) canvas before the hard cap, and never holds the splash past
 * the hard cap either (a never-settling map — slow/erroring tiles, or a
 * catalog stuck in 'loading' — can never hold the splash hostage).
 *
 * Extracted from WdMapView so both catalog-vs-idle ORDERINGS are unit
 * tested (the original inline version threw a TDZ ReferenceError when
 * the catalog was already ready at map load — observed live as a
 * frozen splash; see fix/loader-reveal-tdz).
 */

export interface RevealSignals {
  /** True when a real style is applied (>=2 layers — the empty boot
   *  style must not reveal an empty map). */
  styleReady(): boolean;
  /** True when the current view has actually PAINTED: style applied
   *  AND its tiles finished loading. The safety ladder must not
   *  reveal an unpainted (near-white) canvas — on cold starts tiles
   *  legitimately take longer than the safety window. */
  painted(): boolean;
  /** Arm a one-shot map-idle callback (map.once('idle', cb)). */
  onIdleOnce(cb: () => void): void;
}

export interface RevealHandle {
  /** Call when the overlay compile finishes (catalog ready or error) —
   *  idempotent; safe to call synchronously from an immediate watcher. */
  notifyOverlaysDone(): void;
  /** Stop the safety timer (map unmounted). */
  dispose(): void;
}

/**
 * Start the reveal loop. The `reveal` callback fires exactly once, when
 * notifyOverlaysDone() has been called AND an idle fired with
 * styleReady() true (earlier idles re-arm) — or via the safety ladder:
 *
 *  - at safetyMs the splash drops only if the map has PAINTED
 *    (painted() — style + tiles). This covers the catalog-stuck case
 *    (basemap-only reveal) without flashing a white canvas on slow
 *    cold starts.
 *  - if the map has not painted yet, the ladder keeps waiting: it
 *    re-arms the idle listener and re-checks every 2 s.
 *  - at hardCapMs (from start) it reveals unconditionally — a
 *    partial/empty map still beats an infinite splash.
 */
export function startRevealLoop(
  signals: RevealSignals,
  reveal: () => void,
  safetyMs: number = 8000,
  hardCapMs: number = 20000
): RevealHandle {
  let revealed = false;
  let armed = false;
  let disposed = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    reveal();
  };

  const tryReveal = () => {
    // dispose() must stop every path: a stale idle listener armed before
    // teardown must not reveal (and mutate DOM classes) on a torn-down
    // scope — the dispose contract is "no further effects".
    if (revealed || disposed) return;
    if (signals.styleReady()) {
      doReveal();
    } else {
      // Idle of the empty boot style — wait for the next one.
      signals.onIdleOnce(tryReveal);
    }
  };

  const arm = () => {
    if (armed || revealed || disposed) return;
    armed = true;
    signals.onIdleOnce(tryReveal);
  };

  // Safety ladder (see doc comment). The poll interval shrinks near the
  // hard cap so the final tick lands ON the cap — a fixed 2s interval
  // could slip the unconditional reveal by up to one interval (review
  // nit: cap must mean cap).
  const startedAt = Date.now();
  const safetyTick = () => {
    if (revealed || disposed) return;
    const elapsed = Date.now() - startedAt;
    if (signals.painted() || elapsed >= hardCapMs) {
      doReveal();
      return;
    }
    // Not painted yet (cold start, slow tiles): keep the splash. The
    // armed idle fires as soon as the map settles — tryReveal then
    // reveals with the style check alone (idle == painted for MapLibre).
    // review n5: respect `armed` — arm() may already have registered the
    // listener (notifyOverlaysDone), and every 2s tick must not pile on
    // more; at most ONE idle listener is live at any time.
    if (!armed) {
      armed = true;
      signals.onIdleOnce(tryReveal);
    }
    pollTimer = setTimeout(safetyTick, Math.min(2000, hardCapMs - elapsed));
  };
  const safetyTimer = setTimeout(safetyTick, safetyMs);

  return {
    // No deferral dance needed: callers may invoke this synchronously
    // from an immediate watcher — there is no const-under-initialization
    // to trip over (that was the original TDZ regression).
    notifyOverlaysDone: arm,
    dispose: () => {
      disposed = true;
      clearTimeout(safetyTimer);
      if (pollTimer !== undefined) clearTimeout(pollTimer);
    },
  };
}
