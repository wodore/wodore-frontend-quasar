// @vitest-environment happy-dom
//
// Error tracking service (openspec: add-error-tracking): DSN-gated
// activation, release/environment/app_version attribution, PII-off,
// tolerant tracing-rate parsing, and tracing wired only when rate > 0.
//
// perf/defer-sentry-init adds: the wrapper-trimmed integrations (no
// BrowserApiErrors, breadcrumbs without fetch/xhr), the buffered-error
// flush helper, and the boot-file flow — synchronous native buffer,
// requestIdleCallback-deferred dynamic import (setTimeout fallback),
// listeners removed before init, flush after init.
//
// The runtimeEnv mock simulates the BROWSER reality: getEnv serves only
// runtime-env keys (env.js / EJS inline) and nothing else — build-time
// defines are NOT reachable through it (Vite replaces only static
// process.env.X text; a dynamic lookup hits an empty object in the
// bundle — review finding B1). Tests therefore prove the resolution
// boundary: hash/version MUST come through static process.env reads,
// while DSN/rate/environment flow through getEnv.
//
// happy-dom (not node): the boot-file tests need a `window` with
// addEventListener/removeEventListener — and notably WITHOUT
// requestIdleCallback (matching Safari), so the fallback path is the
// default here unless a test stubs an idle callback in.
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

const initMock = vi.fn();
const browserTracingIntegrationMock = vi.fn(() => ({ name: 'browserTracing' }));
const breadcrumbsIntegrationMock = vi.fn(() => ({ name: 'Breadcrumbs' }));
const captureExceptionMock = vi.fn();
const captureMessageMock = vi.fn();

vi.mock('@sentry/vue', () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: (...args: unknown[]) => browserTracingIntegrationMock(...args),
  breadcrumbsIntegration: (...args: unknown[]) => breadcrumbsIntegrationMock(...args),
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

// Browser-realistic runtime env: only what /env.js (or the inline EJS)
// carries. Tests steer it per case — it never falls back to process.env.
const runtimeEnvValues: Record<string, string | undefined> = {};
vi.mock('@services/runtimeEnv', () => ({
  getEnv: (name: string) => runtimeEnvValues[name],
}));

// Platform detection (@capacitor/core): 'web' by default, steerable per
// case to simulate the Android WebView build.
let capacitorPlatform = 'web';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => capacitorPlatform,
  },
}));

// The boot file dynamically imports the service at idle — mocked so the
// boot tests observe init/flush without pulling the real module in.
const initErrorTrackingMock = vi.fn();
const flushBufferedErrorsMock = vi.fn();

import { flushBufferedErrors, initErrorTracking } from '@services/sentry';

const app = {} as never; // opaque to the service
const router = {} as never;
const initErrorTrackingWith = () => initErrorTracking(app, router);

const STATIC_KEYS = ['WODORE_GIT_HASH', 'WODORE_APP_VERSION'] as const;

beforeEach(() => {
  initMock.mockReset();
  browserTracingIntegrationMock.mockClear();
  breadcrumbsIntegrationMock.mockClear();
  captureExceptionMock.mockClear();
  captureMessageMock.mockClear();
  capacitorPlatform = 'web';
  for (const key of Object.keys(runtimeEnvValues)) delete runtimeEnvValues[key];
  // Static-read keys: unset unless a test sets them (simulating the
  // build-time defines Vite bakes in).
  for (const key of STATIC_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of STATIC_KEYS) delete process.env[key];
});

describe('DSN gate', () => {
  it('never initializes the SDK without a DSN', () => {
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('treats an empty DSN as absent', () => {
    runtimeEnvValues.WODORE_SENTRY_DSN = '';
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('treats an unrewritten @@…@@ placeholder as absent (misconfigured container)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    runtimeEnvValues.WODORE_SENTRY_DSN = '@@WODORE_SENTRY_DSN@@';
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
    // Misconfiguration must be visible, not silently inert (review S2).
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/placeholder was not rewritten/);
    warn.mockRestore();
  });

  it('initializes once with a usable DSN', () => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
    initErrorTrackingWith();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0]).toMatchObject({
      dsn: 'https://key@example.invalid/1',
    });
  });
});

describe('attribution', () => {
  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('reads release from the STATIC build define, not getEnv (regression: review B1)', () => {
    // Browser reality: WODORE_GIT_HASH is absent from the runtime env…
    expect(runtimeEnvValues.WODORE_GIT_HASH).toBeUndefined();
    // …and only exists as a build-time define (static process.env read).
    process.env.WODORE_GIT_HASH = '3246f21bf';
    initErrorTrackingWith();
    // If the service ever reverts to getEnv('WODORE_GIT_HASH'), release
    // resolves to undefined in the real bundle — this test fails first.
    expect(initMock.mock.calls[0][0].release).toBe('3246f21bf');
  });

  it('omits release when the build define is unset (not undefined-tagged)', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].release).toBeUndefined();
  });

  it('passes environment from the runtime env (per-deployment value)', () => {
    runtimeEnvValues.WODORE_ENV = 'staging';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].environment).toBe('staging');
  });

  it('falls back to development when WODORE_ENV is unset', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].environment).toBe('development');
  });

  it('tags events with the runtime platform (web by default)', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].initialScope).toEqual({
      tags: { platform: 'web' },
    });
  });

  it('tags events with the platform on Capacitor builds (android)', () => {
    capacitorPlatform = 'android';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].initialScope).toEqual({
      tags: { platform: 'android' },
    });
  });

  it('stamps app_version from the STATIC build define via beforeSend (regression: review B1)', () => {
    process.env.WODORE_APP_VERSION = '0.0.6';
    initErrorTrackingWith();
    const { beforeSend } = initMock.mock.calls[0][0];
    const event = beforeSend({ message: 'boom' });
    expect(event.tags).toEqual({ app_version: '0.0.6' });
  });

  it('stamps app_version on transaction events via beforeSendTransaction', () => {
    process.env.WODORE_APP_VERSION = '0.0.6';
    initErrorTrackingWith();
    const { beforeSendTransaction } = initMock.mock.calls[0][0];
    const event = beforeSendTransaction({ type: 'transaction', tags: {} });
    expect(event.tags).toEqual({ app_version: '0.0.6' });
  });

  it('leaves events tag-less when WODORE_APP_VERSION is unset', () => {
    initErrorTrackingWith();
    const { beforeSend } = initMock.mock.calls[0][0];
    const event = beforeSend({ message: 'boom' });
    expect(event.tags).toBeUndefined();
  });

  it('preserves existing tags when stamping', () => {
    process.env.WODORE_APP_VERSION = '0.0.6';
    initErrorTrackingWith();
    const { beforeSend } = initMock.mock.calls[0][0];
    const event = beforeSend({ message: 'boom', tags: { route: '/hut/x' } });
    expect(event.tags).toEqual({ route: '/hut/x', app_version: '0.0.6' });
  });
});

describe('privacy', () => {
  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('configures the v10-parity PII-off dataCollection (sendDefaultPii successor)', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: {
        // OIDC authorization params must be filtered from captured URLs
        // (review S1): code/state/iss ride in window.location right
        // after the OIDC redirect and the SDK's built-in filter misses
        // them.
        deny: ['forwarded', '-ip', 'remote-', 'via', '-user', 'code', 'state', 'iss'],
      },
    });
  });
});

describe('integrations trimmed (perf/defer-sentry-init)', () => {
  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  // Shape of the installed @sentry/vue 11.8 defaults (name-identified
  // integration objects; the list from @sentry/browser sdk.js plus
  // vueIntegration). The default Breadcrumbs instance is kept as a
  // distinct reference so identity asserts it is REPLACED, not kept.
  const defaultBreadcrumbs = { name: 'Breadcrumbs' };
  const fakeDefaults = [
    { name: 'EventFilters' },
    { name: 'FunctionToString' },
    { name: 'BrowserApiErrors' },
    defaultBreadcrumbs,
    { name: 'Console' },
    { name: 'GlobalHandlers' },
    { name: 'Dedupe' },
    { name: 'Vue' },
  ];

  const resolveIntegrations = (): Array<{ name?: string }> => {
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(typeof options.integrations).toBe('function');
    return options.integrations(fakeDefaults);
  };

  it('removes the timers/rAF/addEventListener-wrapping integration (BrowserApiErrors)', () => {
    const names = resolveIntegrations().map(integration => integration.name);
    expect(names).not.toContain('BrowserApiErrors');
  });

  it('keeps the unrelated defaults (vueIntegration, global handlers, console, dedupe)', () => {
    const names = resolveIntegrations().map(integration => integration.name);
    for (const kept of [
      'EventFilters',
      'FunctionToString',
      'Console',
      'GlobalHandlers',
      'Dedupe',
      'Vue',
    ]) {
      expect(names).toContain(kept);
    }
  });

  it('replaces the default breadcrumbs with a fetch/xhr-disabled instance', () => {
    const resolved = resolveIntegrations();
    // The DEFAULT instance is dropped (identity, not just name)…
    expect(resolved).not.toContain(defaultBreadcrumbs);
    // …and the replacement is configured to leave fetch/XHR alone —
    // dom/history/console breadcrumbs stay on.
    expect(breadcrumbsIntegrationMock).toHaveBeenCalledWith({ fetch: false, xhr: false });
    expect(resolved).toContain(breadcrumbsIntegrationMock.mock.results[0].value);
  });
});

describe('flushBufferedErrors (pre-init buffer drain)', () => {
  it('routes Error instances through captureException (stack preserved)', () => {
    const boom = new Error('boom');
    flushBufferedErrors([{ message: 'boom', error: boom, timeStamp: 1 }]);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0][0]).toBe(boom);
    expect(captureMessageMock).not.toHaveBeenCalled();
  });

  it('routes script errors without an Error through captureMessage with location extras', () => {
    flushBufferedErrors([
      { message: 'script fail', filename: 'app.js', lineno: 3, colno: 7, timeStamp: 2 },
    ]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock.mock.calls[0]).toEqual([
      'script fail',
      { extra: { timeStamp: 2, filename: 'app.js', lineno: 3, colno: 7 } },
    ]);
  });

  it('routes non-Error rejection reasons through captureMessage with the reason as extra', () => {
    flushBufferedErrors([{ message: 'nope', reason: 'nope', timeStamp: 3 }]);
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock.mock.calls[0]).toEqual([
      'nope',
      { extra: { timeStamp: 3, reason: 'nope' } },
    ]);
  });

  it('preserves order across mixed entries', () => {
    flushBufferedErrors([
      { message: 'a', error: new Error('a'), timeStamp: 1 },
      { message: 'b', reason: 'b', timeStamp: 2 },
    ]);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    expect(captureMessageMock.mock.calls[0][0]).toBe('b');
  });

  it('accepts an empty buffer without touching the SDK', () => {
    flushBufferedErrors([]);
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(captureMessageMock).not.toHaveBeenCalled();
  });
});

describe('tracing opt-in (errors-only by default)', () => {
  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('attaches no tracing integration and no sample rate by default', () => {
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.tracesSampleRate).toBeUndefined();
    expect(browserTracingIntegrationMock).not.toHaveBeenCalled();
    // Integrations are always the trimming filter (function form); with
    // tracing off its resolved list carries no tracing integration.
    const resolved = options.integrations([{ name: 'GlobalHandlers' }]);
    expect(resolved).not.toContainEqual({ name: 'browserTracing' });
  });

  it('stays errors-only for rate 0', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '0';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
  });

  it('enables router tracing at a positive rate', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '0.05';
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.tracesSampleRate).toBe(0.05);
    // The tracing integration is appended to the trimmed defaults —
    // it is created inside the integrations filter, so resolve first.
    const resolved = options.integrations([{ name: 'GlobalHandlers' }]);
    expect(browserTracingIntegrationMock).toHaveBeenCalledWith({ router });
    expect(resolved).toContainEqual({ name: 'browserTracing' });
  });

  it('falls back to errors-only on non-numeric values', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = 'yes';
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.tracesSampleRate).toBeUndefined();
    expect(browserTracingIntegrationMock).not.toHaveBeenCalled();
  });

  it('clamps out-of-range values into [0, 1]', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '2.5';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBe(1);

    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '-1';
    initErrorTrackingWith();
    const options = initMock.mock.calls[1][0];
    expect(options.tracesSampleRate).toBeUndefined(); // clamped to 0 = errors-only
    expect(browserTracingIntegrationMock).not.toHaveBeenCalled();
  });
});

describe('boot file: deferred init (perf/defer-sentry-init)', () => {
  // happy-dom ships no requestIdleCallback (Safari-like): remember the
  // native own-property state so each test can stub it and restore it.
  const hadOwnIdleCallback = Object.prototype.hasOwnProperty.call(window, 'requestIdleCallback');
  const originalIdleCallback = window.requestIdleCallback;

  /** Fresh boot module with '@services/sentry' do-mocked (module-level buffer/flag must not leak between tests). */
  const importBoot = async () => {
    vi.resetModules();
    vi.doMock('@services/sentry', () => ({
      initErrorTracking: initErrorTrackingMock,
      flushBufferedErrors: flushBufferedErrorsMock,
    }));
    const bootModule = await import('../../src/boot/sentry');
    return bootModule.default as unknown as (ctx: { app: unknown; router: unknown }) => void;
  };

  const stubIdleCallback = (): vi.Mock => {
    const idle = vi.fn();
    window.requestIdleCallback = idle as unknown as typeof window.requestIdleCallback;
    return idle;
  };

  const removeIdleCallbackStub = (): void => {
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  };

  /** The handler registered for `type`, captured via the addEventListener spy. */
  const registeredHandler = (
    addSpy: MockInstance<(type: string, listener: EventListenerOrEventListenerObject) => void>,
    type: string
  ): ((event: unknown) => void) => {
    const call = addSpy.mock.calls.find(([registered]) => registered === type);
    expect(call).toBeDefined();
    return call![1] as (event: unknown) => void;
  };

  const fireError = (handler: (event: unknown) => void, event: Record<string, unknown>): void => {
    handler(event as unknown as ErrorEvent);
  };

  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
    initErrorTrackingMock.mockReset();
    flushBufferedErrorsMock.mockReset();
  });

  afterEach(() => {
    vi.doUnmock('@services/sentry');
    if (hadOwnIdleCallback) {
      window.requestIdleCallback = originalIdleCallback;
    } else {
      removeIdleCallbackStub();
    }
  });

  it('skips the SDK import entirely without a DSN (dev/test/CI/preview)', async () => {
    delete runtimeEnvValues.WODORE_SENTRY_DSN;
    const idle = stubIdleCallback();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const boot = await importBoot();
    boot({ app, router });

    idle.mock.calls[0][0]({ didTimeout: false, timeRemaining: () => 16 });

    expect(initErrorTrackingMock).not.toHaveBeenCalled();
    expect(flushBufferedErrorsMock).not.toHaveBeenCalled();
    // Buffer listeners are torn down again — nothing keeps collecting
    // into a buffer that will never be consumed.
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('installs the native buffer synchronously and defers the SDK to idle', async () => {
    const idle = stubIdleCallback();
    const addSpy = vi.spyOn(window, 'addEventListener');

    const boot = await importBoot();
    boot({ app, router });

    // Buffer listeners: registered synchronously, before anything async.
    expect(addSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    // SDK init: scheduled for idle with a 2s worst-case timeout…
    expect(idle).toHaveBeenCalledTimes(1);
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
    // …and NOT run synchronously at boot.
    expect(initErrorTrackingMock).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('initializes via dynamic import at idle, removes listeners before init, flushes after', async () => {
    const idle = stubIdleCallback();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const boot = await importBoot();
    boot({ app, router });

    // Two pre-init errors, one per listener.
    fireError(registeredHandler(addSpy, 'error'), {
      message: 'sync boom',
      filename: 'boot.js',
      lineno: 7,
      colno: 13,
      error: new Error('sync boom'),
      timeStamp: 100,
    });
    registeredHandler(addSpy, 'unhandledrejection')({ reason: 'rejected', timeStamp: 101 });

    // Fire the idle callback: dynamic import → remove listeners → init → flush.
    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(initErrorTrackingMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(flushBufferedErrorsMock).toHaveBeenCalledTimes(1));

    expect(initErrorTrackingMock).toHaveBeenCalledWith(app, router);

    // Ordering: buffer listeners are removed BEFORE init (nothing is
    // captured twice), the buffer flushes AFTER init (SDK receives it).
    const removeOrder = removeSpy.mock.invocationCallOrder;
    const initOrder = initErrorTrackingMock.mock.invocationCallOrder[0];
    const flushOrder = flushBufferedErrorsMock.mock.invocationCallOrder[0];
    expect(removeSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    expect(Math.max(...removeOrder)).toBeLessThan(initOrder);
    expect(initOrder).toBeLessThan(flushOrder);

    // Both buffered entries flushed, normalized per source.
    const flushed = flushBufferedErrorsMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(flushed).toHaveLength(2);
    expect(flushed[0]).toMatchObject({
      message: 'sync boom',
      filename: 'boot.js',
      lineno: 7,
      colno: 13,
      timeStamp: 100,
    });
    expect(flushed[0].error).toBeInstanceOf(Error);
    expect(flushed[1]).toMatchObject({ message: 'rejected', reason: 'rejected', timeStamp: 101 });
    expect(flushed[1].error).toBeUndefined();

    // Listeners gone: a post-init error neither grows the flush nor
    // reaches the buffer twice.
    fireError(registeredHandler(addSpy, 'error'), { message: 'after init', timeStamp: 999 });
    expect(flushBufferedErrorsMock).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('normalizes Error rejection reasons into the error field (stack preserved)', async () => {
    const idle = stubIdleCallback();
    const addSpy = vi.spyOn(window, 'addEventListener');

    const boot = await importBoot();
    boot({ app, router });

    const reason = new Error('async boom');
    registeredHandler(addSpy, 'unhandledrejection')({ reason, timeStamp: 42 });

    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(flushBufferedErrorsMock).toHaveBeenCalledTimes(1));
    const flushed = flushBufferedErrorsMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toMatchObject({ message: 'async boom', timeStamp: 42 });
    expect(flushed[0].error).toBe(reason);
    expect(flushed[0].reason).toBeUndefined();
    addSpy.mockRestore();
  });

  it('caps the buffer at 20 entries, dropping the oldest', async () => {
    const idle = stubIdleCallback();
    const addSpy = vi.spyOn(window, 'addEventListener');

    const boot = await importBoot();
    boot({ app, router });

    const handler = registeredHandler(addSpy, 'error');
    for (let i = 0; i < 25; i++) {
      fireError(handler, { message: `boom ${i}`, timeStamp: i });
    }

    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(flushBufferedErrorsMock).toHaveBeenCalledTimes(1));
    const flushed = flushBufferedErrorsMock.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(flushed).toHaveLength(20);
    expect(flushed[0]).toMatchObject({ message: 'boom 5' }); // 0–4 dropped
    expect(flushed[19]).toMatchObject({ message: 'boom 24' });
    addSpy.mockRestore();
  });

  it('falls back to setTimeout when requestIdleCallback is unavailable (Safari)', async () => {
    removeIdleCallbackStub();
    const timerSpy = vi
      .spyOn(window, 'setTimeout')
      // Do NOT call through: the real 0ms timer would re-run the same
      // callback next to the manual invocation below (test artifact,
      // not a production path — the timer fires exactly once there).
      .mockImplementation(() => 0);

    const boot = await importBoot();
    boot({ app, router });

    expect(timerSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    expect(initErrorTrackingMock).not.toHaveBeenCalled();

    // window.setTimeout may also serve unrelated internals — find the
    // boot call (delay 0) rather than trusting call order.
    const call = timerSpy.mock.calls.find(([, delay]) => delay === 0);
    expect(call).toBeDefined();
    call![0]();
    await vi.waitFor(() => expect(initErrorTrackingMock).toHaveBeenCalledTimes(1));
    timerSpy.mockRestore();
  });

  it('never schedules the pipeline twice (module-level double-boot guard)', async () => {
    const idle = stubIdleCallback();

    const boot = await importBoot();
    boot({ app, router });
    boot({ app, router }); // HMR/re-entry: must be a no-op

    expect(idle).toHaveBeenCalledTimes(1);
    idle.mock.calls[0][0]();
    await vi.waitFor(() => expect(initErrorTrackingMock).toHaveBeenCalledTimes(1));
    expect(flushBufferedErrorsMock).toHaveBeenCalledTimes(1);
  });
});
