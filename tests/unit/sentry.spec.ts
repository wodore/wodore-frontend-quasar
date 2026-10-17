//
// Error tracking service (openspec: add-error-tracking): DSN-gated
// activation, release/environment/app_version attribution, PII-off,
// tolerant tracing-rate parsing, and tracing wired only when rate > 0.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const initMock = vi.fn();
const browserTracingIntegrationMock = vi.fn(() => ({ name: 'browserTracing' }));

vi.mock('@sentry/vue', () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: (...args: unknown[]) =>
    browserTracingIntegrationMock(...args),
}));

import { initErrorTracking } from '@services/sentry';

// Node env: `window` is undefined, so getEnv reads process.env dynamically
// at call time (services/runtimeEnv.ts) — tests steer it via process.env.
const ENV_KEYS = [
  'WODORE_SENTRY_DSN',
  'WODORE_SENTRY_TRACES_SAMPLE_RATE',
  'WODORE_GIT_HASH',
  'WODORE_ENV',
  'WODORE_APP_VERSION',
] as const;

const app = {} as never; // opaque to the service
const router = {} as never;
const initErrorTrackingWith = () => initErrorTracking(app, router);

beforeEach(() => {
  initMock.mockReset();
  browserTracingIntegrationMock.mockClear();
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe('DSN gate', () => {
  it('never initializes the SDK without a DSN', () => {
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('treats an empty DSN as absent', () => {
    process.env.WODORE_SENTRY_DSN = '';
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('treats an unrewritten @@…@@ placeholder as absent (misconfigured container)', () => {
    process.env.WODORE_SENTRY_DSN = '@@WODORE_SENTRY_DSN@@';
    initErrorTrackingWith();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('initializes once with a usable DSN', () => {
    process.env.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
    initErrorTrackingWith();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock.mock.calls[0][0]).toMatchObject({
      dsn: 'https://key@example.invalid/1',
    });
  });
});

describe('attribution', () => {
  beforeEach(() => {
    process.env.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('passes release = WODORE_GIT_HASH and environment = WODORE_ENV', () => {
    process.env.WODORE_GIT_HASH = '3246f21bf';
    process.env.WODORE_ENV = 'staging';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0]).toMatchObject({
      release: '3246f21bf',
      environment: 'staging',
    });
  });

  it('falls back to development when WODORE_ENV is unset', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].environment).toBe('development');
  });

  it('omits release when WODORE_GIT_HASH is unset (not undefined-tagged)', () => {
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].release).toBeUndefined();
  });

  it('stamps app_version on events via beforeSend', () => {
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
  it('configures v10-parity PII-off data collection (sendDefaultPii successor)', () => {
    process.env.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    });
  });
});

describe('tracing opt-in (errors-only by default)', () => {
  beforeEach(() => {
    process.env.WODORE_SENTRY_DSN = 'https://key@example.invalid/1';
  });

  it('attaches no tracing integration and no sample rate by default', () => {
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.integrations).toBeUndefined();
    expect(options.tracesSampleRate).toBeUndefined();
    expect(browserTracingIntegrationMock).not.toHaveBeenCalled();
  });

  it('stays errors-only for rate 0', () => {
    process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE = '0';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
  });

  it('enables router tracing at a positive rate', () => {
    process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE = '0.05';
    initErrorTrackingWith();
    const options = initMock.mock.calls[0][0];
    expect(options.tracesSampleRate).toBe(0.05);
    expect(options.integrations).toEqual([{ name: 'browserTracing' }]);
    expect(browserTracingIntegrationMock).toHaveBeenCalledWith({ router });
  });

  it('falls back to errors-only on non-numeric values', () => {
    process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE = 'yes';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBeUndefined();
    expect(initMock.mock.calls[0][0].integrations).toBeUndefined();
  });

  it('clamps out-of-range values into [0, 1]', () => {
    process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE = '2.5';
    initErrorTrackingWith();
    expect(initMock.mock.calls[0][0].tracesSampleRate).toBe(1);

    process.env.WODORE_SENTRY_TRACES_SAMPLE_RATE = '-1';
    initErrorTrackingWith();
    const options = initMock.mock.calls[1][0];
    expect(options.tracesSampleRate).toBeUndefined(); // clamped to 0 = errors-only
    expect(options.integrations).toBeUndefined();
  });
});
