import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startRevealLoop, type RevealSignals } from '@components/map/reveal-scheduler';

/** Fakes for the map signals — every test drives one ordering of the
 *  catalog-vs-idle race plus the safety path. */
function makeSignals(opts: { styleReady: boolean }): {
  signals: RevealSignals;
  fireIdle: () => void;
} {
  let idleCb: (() => void) | null = null;
  const signals: RevealSignals = {
    styleReady: () => opts.styleReady,
    onIdleOnce: cb => {
      idleCb = cb;
    },
  };
  return {
    signals,
    fireIdle: () => {
      const cb = idleCb;
      idleCb = null;
      cb?.();
    },
  };
}

describe('reveal scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals on the first idle after overlays are done (overlays-first ordering)', () => {
    const { signals, fireIdle } = makeSignals({ styleReady: true });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal).notifyOverlaysDone();

    fireIdle();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('does NOT reveal before notifyOverlaysDone — catalog wins the race late', () => {
    // Catalog LOSES the race: map idles first (with a real style), the
    // scheduler is not armed yet, the idle is not observed at all; the
    // NEXT idle after notifyOverlaysDone reveals.
    const { signals, fireIdle } = makeSignals({ styleReady: true });
    const reveal = vi.fn();
    const sched = startRevealLoop(signals, reveal);

    fireIdle(); // stray idle before arming — unobserved
    expect(reveal).not.toHaveBeenCalled();

    sched.notifyOverlaysDone();
    fireIdle();
    expect(reveal).toHaveBeenCalledTimes(1);
    sched.dispose();
  });

  it('re-arms on idles of the empty boot style (style not ready)', () => {
    const { signals, fireIdle } = makeSignals({ styleReady: false });
    const reveal = vi.fn();
    const sched = startRevealLoop(signals, reveal);
    sched.notifyOverlaysDone();

    fireIdle(); // empty style idle — re-armed, no reveal
    expect(reveal).not.toHaveBeenCalled();
    sched.dispose();
  });

  it('reveals via the safety timer when the map never settles', () => {
    const { signals } = makeSignals({ styleReady: false });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000);

    vi.advanceTimersByTime(7999);
    expect(reveal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('reveals exactly once even if idle and safety race', () => {
    const { signals, fireIdle } = makeSignals({ styleReady: true });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000).notifyOverlaysDone();

    fireIdle();
    vi.advanceTimersByTime(20000);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('never throws when overlays are already done at start (the TDZ regression)', () => {
    // Regression spec for the live staging crash: an immediate
    // synchronous overlaysDone() path must not explode (the original
    // inline version threw "Cannot access 'stopStatusWatch' before
    // initialization" and killed the whole reveal chain).
    const { signals, fireIdle } = makeSignals({ styleReady: true });
    const reveal = vi.fn();
    const sched = startRevealLoop(signals, reveal);
    // The live-staging crash was on this exact synchronous path.
    expect(() => sched.notifyOverlaysDone()).not.toThrow();
    fireIdle();
    expect(reveal).toHaveBeenCalledTimes(1);
  });
});
