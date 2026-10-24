// @vitest-environment happy-dom
//
// Umami wiring contract: the script tag is injected only when
// (env vars set) AND (user has not opted out); the track() wrapper
// stops custom events immediately on a mid-session opt-out.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const bootModule = () => import('@boot/analytics');

describe('umami analytics boot', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelectorAll('script[src*="script.js"]').forEach(s => s.remove());
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

  it('injects the script when env is set and the user has not opted out', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com/',
    });
    await runIdle();
    const s = document.head.querySelector('script[src*="umami.example.com/script.js"]');
    expect(s).not.toBeNull();
    expect(s?.getAttribute('data-website-id')).toBe('test-site-id');
    expect(s?.getAttribute('data-do-not-track')).toBe('true');
  });

  it('never injects without env vars (telemetry-free builds)', async () => {
    await runIdle();
    expect(document.head.querySelector('script[src*="script.js"]')).toBeNull();
  });

  it('never injects when the user opted out (umami.disabled)', async () => {
    vi.stubGlobal('__WODORE_RUNTIME_ENV__', {
      WODORE_UMAMI_WEBSITE_ID: 'test-site-id',
      WODORE_UMAMI_WEBSITE_URL: 'https://umami.example.com',
    });
    localStorage.setItem('umami.disabled', 'true');
    await runIdle();
    expect(document.head.querySelector('script[src*="script.js"]')).toBeNull();
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
