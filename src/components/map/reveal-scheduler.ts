/**
 * Splash-reveal scheduling (perf/map-loader-ux).
 *
 * Decides when the map has "rendered" enough to fade the splash away:
 * the first map idle AFTER the overlay compile finished, with a real
 * style applied — plus a hard safety timer so a never-settling map
 * (slow/erroring tiles, or a catalog stuck in 'loading') can never
 * hold the splash hostage.
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
 * styleReady() true (earlier idles re-arm) — or when safetyMs elapsed
 * (unconditional: a partial map beats an infinite splash).
 */
export function startRevealLoop(
  signals: RevealSignals,
  reveal: () => void,
  safetyMs: number = 8000
): RevealHandle {
  let revealed = false;
  let armed = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    reveal();
  };

  const tryReveal = () => {
    if (revealed) return;
    if (signals.styleReady()) {
      doReveal();
    } else {
      // Idle of the empty boot style — wait for the next one.
      signals.onIdleOnce(tryReveal);
    }
  };

  const arm = () => {
    if (armed || revealed) return;
    armed = true;
    signals.onIdleOnce(tryReveal);
  };

  // Safety: unconditional reveal even if the map never settles.
  const safety = setTimeout(doReveal, safetyMs);

  return {
    // No deferral dance needed: callers may invoke this synchronously
    // from an immediate watcher — there is no const-under-initialization
    // to trip over (that was the original TDZ regression).
    notifyOverlaysDone: arm,
    dispose: () => {
      clearTimeout(safety);
    },
  };
}
