//
// Error tracking service (openspec: add-error-tracking): DSN-gated
// activation, release/environment/app_version attribution, PII-off,
// tolerant tracing-rate parsing, and tracing wired only when rate > 0.
//
// The runtimeEnv mock simulates the BROWSER reality: getEnv serves only
// runtime-env keys (env.js / EJS inline) and nothing else — build-time
// defines are NOT reachable through it (Vite replaces only static
// process.env.X text; a dynamic lookup hits an empty object in the
// bundle — review finding B1). Tests therefore prove the resolution
// boundary: hash/version MUST come through static process.env reads,
// while DSN/rate/environment flow through getEnv.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const initMock = vi.fn();
const browserTracingIntegrationMock = vi.fn(() => ({ name: 'browserTracing' }));

vi.mock('@sentry/vue', () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: (...args: unknown[]) => browserTracingIntegrationMock(...args),
}));

// Browser-realistic runtime env: only what /env.js (or the inline EJS)
// carries. Tests steer it per case — it never falls back to process.env.
const runtimeEnvValues: Record<string, string | undefined> = {};
vi.mock('@services/runtimeEnv', () => ({
  getEnv: (name: string) => runtimeEnvValues[name],
}));

import { initErrorTracking } from '@services/sentry';

const app = {} as never; // opaque to the service
const router = {} as never;
const initErrorTrackingWith = () => initErrorTracking(app, router);

const STATIC_KEYS = ['WODORE_GIT_HASH', 'WODORE_APP_VERSION'] as const;

beforeEach(() => {
  initMock.mockReset();
  browserTracingIntegrationMock.mockClear();
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

describe('tracing opt-in (errors-only by default)', () => {
  beforeEach(() => {
    runtimeEnvValues.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('attaches no tracing integration and no sample rate by default', () => {
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.integrations).toBeUndefined();
    expect(options.tracesSampleRate).toBeUndefined();
    expect(browserTracingIntegrationMock).not.toHaveBeenCalled();
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
    expect(options.integrations).toEqual([{ name: 'browserTracing' }]);
    expect(browserTracingIntegrationMock).toHaveBeenCalledWith({ router });
  });

  it('falls back to errors-only on non-numeric values', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = 'yes';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].integrations).toBeUndefined();
  });

  it('clamps out-of-range values into [0, 1]', () => {
    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '2.5';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBe(1);

    runtimeEnvValues.WODORE_SENTRY_TRACES_SAMPLE_RATE = '-1';
    initErrorTrackingWith();
    const options = initMock.mock.calls[1][0];
    expect(options.tracesSampleRate).toBeUndefined(); // clamped to 0 = errors-only
    expect(options.integrations).toBeUndefined();
  });
});
