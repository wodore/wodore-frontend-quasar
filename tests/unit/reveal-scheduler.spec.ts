import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startRevealLoop, type RevealSignals } from '@components/map/reveal-scheduler';

/** Fakes for the map signals — every test drives one ordering of the
 *  catalog-vs-idle race plus the safety ladder. */
function makeSignals(opts: {
  styleReady: boolean;
  /** Default: mirrors styleReady (a style-ready fake map counts as
   *  painted unless the test overrides it). */
  painted?: boolean;
}): {
  signals: RevealSignals;
  fireIdle: () => void;
  setStyleReady: (v: boolean) => void;
  setPainted: (v: boolean) => void;
} {
  let idleCb: (() => void) | null = null;
  const state = { styleReady: opts.styleReady, painted: opts.painted ?? opts.styleReady };
  const signals: RevealSignals = {
    styleReady: () => state.styleReady,
    painted: () => state.painted,
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
    setStyleReady: v => {
      state.styleReady = v;
    },
    setPainted: v => {
      state.painted = v;
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

  it('safety reveals at safetyMs when the map has painted (catalog stuck)', () => {
    // The safety ladder's primary case: style + tiles painted, but the
    // overlay catalog never finishes — reveal a basemap-only map.
    const { signals } = makeSignals({ styleReady: true, painted: true });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000, 20000);

    vi.advanceTimersByTime(7999);
    expect(reveal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('safety does NOT reveal an unpainted map at safetyMs (cold start, slow tiles)', () => {
    // Owner-reported regression: on a cold start the splash dropped at
    // 8s while the map canvas was still blank (near-white). The ladder
    // must keep the splash until the map paints or the hard cap hits.
    const { signals } = makeSignals({ styleReady: false, painted: false });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000, 20000);

    vi.advanceTimersByTime(8000 + 5 * 2000); // safety + several poll ticks
    expect(reveal).not.toHaveBeenCalled();
  });

  it('the ladder reveals as soon as the map paints during the polling phase', () => {
    const { signals, setPainted } = makeSignals({ styleReady: false, painted: false });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000, 20000);

    vi.advanceTimersByTime(8000); // safety tick 1 — not painted, keeps polling
    expect(reveal).not.toHaveBeenCalled();

    setPainted(true);
    vi.advanceTimersByTime(2000); // next poll tick
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('an idle that fires during the polling phase reveals (style-ready check only)', () => {
    // MapLibre idle == tiles settled: the re-armed idle listener is
    // the fast path out of the ladder, no 2s poll wait.
    const { signals, fireIdle, setStyleReady } = makeSignals({ styleReady: false, painted: false });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000, 20000);

    vi.advanceTimersByTime(8000); // ladder armed a fresh idle listener
    setStyleReady(true);
    fireIdle();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('hard cap reveals unconditionally even if the map never paints', () => {
    // Never-trap guarantee: a fundamentally broken map (no style, no
    // tiles, no idle) still cannot hold the splash forever.
    const { signals } = makeSignals({ styleReady: false, painted: false });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000, 20000);

    vi.advanceTimersByTime(19999);
    expect(reveal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('armed listener + safety ticks never stack idle listeners (review n5)', () => {
    // notifyOverlaysDone() arms an idle listener BEFORE the safety
    // ladder kicks in; every 2s poll tick must NOT register another
    // one (MapLibre allows duplicate once() registrations — the
    // doReveal guard hid the accumulation). At most ONE listener may
    // be live at any time.
    let listeners = 0;
    let fired = 0;
    const state = { styleReady: false, painted: false };
    const signals: RevealSignals = {
      styleReady: () => state.styleReady,
      painted: () => state.painted,
      onIdleOnce: cb => {
        listeners++;
        queue.push(() => {
          listeners--;
          fired++;
          cb();
        });
      },
    };
    const queue: (() => void)[] = [];
    const reveal = vi.fn();
    const handle = startRevealLoop(signals, reveal, 8000, 20000);

    handle.notifyOverlaysDone(); // arms the first listener
    expect(listeners).toBe(1);

    vi.advanceTimersByTime(8000 + 5 * 2000); // safety + 5 poll ticks, still unpainted
    expect(listeners).toBe(1); // no stacking — the invariant this test guards
    expect(reveal).not.toHaveBeenCalled();

    // The single armed listener fires → reveals via the style check.
    state.styleReady = true;
    queue.splice(0).forEach(fn => fn());
    expect(fired).toBe(1);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('reveals exactly once even if idle and safety race', () => {
    const { signals, fireIdle } = makeSignals({ styleReady: true, painted: true });
    const reveal = vi.fn();
    startRevealLoop(signals, reveal, 8000).notifyOverlaysDone();

    fireIdle();
    vi.advanceTimersByTime(20000);
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('dispose stops the safety ladder (no reveal after unmount)', () => {
    const { signals } = makeSignals({ styleReady: false, painted: false });
    const reveal = vi.fn();
    const sched = startRevealLoop(signals, reveal, 8000, 20000);

    sched.dispose();
    vi.advanceTimersByTime(30000);
    expect(reveal).not.toHaveBeenCalled();
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
