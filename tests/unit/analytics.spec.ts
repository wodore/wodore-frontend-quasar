// @vitest-environment happy-dom
//
// Umami wiring contract: the script tag is injected only when
// (env vars set) AND (user has not opted out); the recorder.js session
// recording script additionally requires the WODORE_UMAMI_RECORDER=on
// opt-in and a non-DNT browser; the track() wrapper stops custom events
// immediately on a mid-session opt-out.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bootModule = () => import('@boot/analytics');

describe('umami analytics boot', () => {
  beforeEach(() => {
    // Fresh module instance per test: the boot fn carries a module-level
    // injected guard that would no-op every call after the first.
    vi.resetModules();
    localStorage.clear();
    document.head.querySelectorAll('script').forEach(s => s.remove());
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const runIdle = async () => {
    const mod = await bootModule();
    // @ts-expect-error default export is the quasar boot fn
    mod.default({});
    // flush the idle callback (requestIdleCallback absent in happy-dom → setTimeout 0)
    await new Promise(r => setTimeout(r, 5));
  };

  const tracker = () => document.head.querySelector('script[src*="umami.example.com/script.js"]');
  const recorder = () =>
    document.head.querySelector('script[src*="umami.example.com/recorder.js"]');

  it('injects the script when env is set and the user has not opted out', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com/',
    });
    await runIdle();
    const s = tracker();
    expect(s).not.toBeNull();
    expect(s?.getAttribute('data-website-id')).toBe('test-site-id');
    expect(s?.getAttribute('data-do-not-track')).toBe('true');
    expect(s?.getAttribute('data-performance')).toBe('true');
    expect(s?.getAttribute('data-exclude-hash')).toBe('true');
  });

  it('never injects without env vars (telemetry-free builds)', async () => {
    await runIdle();
    expect(tracker()).toBeNull();
    expect(recorder()).toBeNull();
  });

  it('never injects when the user opted out (umami.disabled)', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
      WODORE_UMAMI_RECORDER: 'on',
    });
    localStorage.setItem('umami.disabled', 'true');
    await runIdle();
    expect(tracker()).toBeNull();
    // the opt-out gate must cover the recorder too — it has no own gates
    expect(recorder()).toBeNull();
  });

  it('opts out with the real quasar-encoded toggle value (__q_bool|1)', async () => {
    // The WdUser/WdMapMenu toggles write via quasar LocalStorage, which
    // serializes true as `__q_bool|1` — the gate's raw read must treat
    // that encoded value (any non-null, non-'false' value) as opted out.
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
    });
    localStorage.setItem('umami.disabled', '__q_bool|1');
    await runIdle();
    expect(tracker()).toBeNull();
  });

  it('injects recorder.js only when WODORE_UMAMI_RECORDER is strictly "on"', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
      WODORE_UMAMI_RECORDER: 'on',
    });
    await runIdle();
    const r = recorder();
    expect(r).not.toBeNull();
    expect(r?.getAttribute('data-website-id')).toBe('test-site-id');
    expect(tracker()).not.toBeNull();
  });

  it('never injects recorder.js without the opt-in flag (or an unreplaced docker placeholder)', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
      WODORE_UMAMI_RECORDER: '@@WODORE_UMAMI_RECORDER@@',
    });
    await runIdle();
    expect(tracker()).not.toBeNull();
    expect(recorder()).toBeNull();
  });

  it('skips the recorder for Do-Not-Track browsers (recorder.js has no own DNT support)', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
      WODORE_UMAMI_RECORDER: 'on',
    });
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    await runIdle();
    // the tracker still loads (umami's data-do-not-track attr governs it
    // server-side), but the recorder — which cannot check DNT itself —
    // must never load for these browsers
    expect(tracker()).not.toBeNull();
    expect(recorder()).toBeNull();
  });
});

describe('umami track() opt-out gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('skips umami.track entirely while opted out', async () => {
    localStorage.setItem('umami.disabled', 'true');
    const umami = { track: vi.fn() };
    vi.stubGlobal('umami', umami);
    const { default: track } = await import('@services/analytics');
    track('test-event', { a: 1 });
    expect(umami.track).not.toHaveBeenCalled();
  });

  it('forwards to umami.track when tracking is enabled', async () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal('umami', umami);
    const { default: track } = await import('@services/analytics');
    track('test-event', { a: 1 });
    expect(umami.track).toHaveBeenCalledWith('test-event', { a: 1 });
  });
});

describe('trackWhenUmamiReady — deferred boot-time events', () => {
  // The boot file injects script.js at browser idle; detections that
  // settle earlier (e.g. the GPU tier) must not lose their event.
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const loadModule = () => import('@services/analytics');

  it('fires immediately when the tracker already exists', async () => {
    const umami = { track: vi.fn() };
    vi.stubGlobal('umami', umami);
    const { trackWhenUmamiReady } = await loadModule();
    trackWhenUmamiReady('gpu-tier', { tier: 3 });
    expect(umami.track).toHaveBeenCalledTimes(1);
    expect(umami.track).toHaveBeenCalledWith('gpu-tier', { tier: 3 });
  });

  it('waits for the tracker to load, then fires exactly once', async () => {
    const umami = { track: vi.fn() };
    const { trackWhenUmamiReady } = await loadModule();
    trackWhenUmamiReady('gpu-tier', { tier: 1 });
    // tracker not loaded yet — first polls are silent
    vi.advanceTimersByTime(1500);
    expect(umami.track).not.toHaveBeenCalled();

    vi.stubGlobal('umami', umami);
    vi.advanceTimersByTime(500);
    expect(umami.track).toHaveBeenCalledTimes(1);
    expect(umami.track).toHaveBeenCalledWith('gpu-tier', { tier: 1 });

    // the polling interval must be cleared after firing — no re-fires
    vi.advanceTimersByTime(5000);
    expect(umami.track).toHaveBeenCalledTimes(1);
  });

  it('drops the event silently when the tracker never loads (env-gated builds)', async () => {
    const { trackWhenUmamiReady } = await loadModule();
    expect(() => {
      trackWhenUmamiReady('gpu-tier', { tier: 2 });
      vi.advanceTimersByTime(15_000);
    }).not.toThrow();

    // deadline elapsed → the interval stopped; a late tracker is too late
    const umami = { track: vi.fn() };
    vi.stubGlobal('umami', umami);
    vi.advanceTimersByTime(5000);
    expect(umami.track).not.toHaveBeenCalled();
  });

  it('never starts polling while opted out', async () => {
    localStorage.setItem('umami.disabled', 'true');
    const { trackWhenUmamiReady } = await loadModule();
    trackWhenUmamiReady('gpu-tier', { tier: 3 });
    const umami = { track: vi.fn() };
    vi.stubGlobal('umami', umami);
    vi.advanceTimersByTime(20_000);
    expect(umami.track).not.toHaveBeenCalled();
  });
});
