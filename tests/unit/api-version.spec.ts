//
// API version pinning: constant shape, middleware header, error surfacing,
// and the lifecycle store states (registry check + live 410 signal).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({ access_token: '' }),
}));

// clientWodore captures WODORE_API_HOST at import time — set it before the
// module graph evaluates (baseUrl undefined → relative URLs → node fetch
// cannot parse them). Same for the fetch stub: openapi-fetch resolves the
// global at its own import time, so it must be replaced before then.
vi.hoisted(() => {
  process.env.WODORE_API_HOST = 'http://test.local';
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

// The mock instance openapi-fetch actually captured (stubbed in hoisted).
const fetchMock = vi.mocked(globalThis.fetch);

import { clientWodore } from '@clients/index';
import {
  PINNED_API_VERSION,
  onApiVersionError,
  emitApiVersionError,
} from '@services/apiVersion';
import { useApiVersionStore } from '@stores/api-version-store';

const versionResponse = (supported: unknown[] = []) =>
  Response.json({ api: { current: '2026-10-01', default: '2026-10-01', supported } });

describe('PINNED_API_VERSION', () => {
  // gen:api pins the backend's CURRENT version (schema info.version) — the
  // literal "unreleased" while a breaking change is unfrozen. Carries
  // unreleased contract features (e.g. the gallery static-map fallback);
  // the next coordinated backend api-release re-pins via a routine gen:api.
  it('is pinned to the backend current version (unreleased tip)', () => {
    expect(PINNED_API_VERSION).toBe('unreleased');
  });
});

describe('apiVersionMiddleware (clientWodore)', () => {
  it('sets the Api-Version header on every request', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await clientWodore.GET('/v1/version', {});
    const [req] = fetchMock.mock.lastCall as [Request];
    expect(req.headers.get('Api-Version')).toBe(PINNED_API_VERSION);
  });

  it('emits api_version_sunset on a 410 with the matching code', async () => {
    const listener = vi.fn();
    const off = onApiVersionError(listener);
    fetchMock.mockResolvedValueOnce(
      Response.json({ code: 'api_version_sunset' }, { status: 410 }),
    );
    await clientWodore.GET('/v1/version', {});
    expect(listener).toHaveBeenCalledWith('api_version_sunset');
    off();
  });

  it('does not emit on other 410 bodies', async () => {
    const listener = vi.fn();
    const off = onApiVersionError(listener);
    fetchMock.mockResolvedValueOnce(Response.json({ code: 'other' }, { status: 410 }));
    await clientWodore.GET('/v1/version', {});
    expect(listener).not.toHaveBeenCalled();
    off();
  });
});

describe('useApiVersionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('{}', { status: 200 }));
  });

  it('classifies a current pin as ok', async () => {
    fetchMock.mockResolvedValueOnce(
      versionResponse([{ version: PINNED_API_VERSION, status: 'current', sunset: null }]),
    );
    const store = useApiVersionStore();
    await store.checkApiVersion();
    expect(store.check.state).toBe('ok');
  });

  it('classifies a deprecated pin with its sunset date', async () => {
    fetchMock.mockResolvedValueOnce(
      versionResponse([
        { version: PINNED_API_VERSION, status: 'deprecated', sunset: '2027-04-01' },
      ]),
    );
    const store = useApiVersionStore();
    await store.checkApiVersion();
    expect(store.check.state).toBe('deprecated');
    if (store.check.state === 'deprecated') {
      expect(store.check.entry.sunset).toBe('2027-04-01');
    }
  });

  it('classifies an unknown pin as unsupported', async () => {
    fetchMock.mockResolvedValueOnce(
      versionResponse([{ version: '2099-01-01', status: 'current', sunset: null }]),
    );
    const store = useApiVersionStore();
    await store.checkApiVersion();
    expect(store.check.state).toBe('unsupported');
  });

  it('classifies a sunset pin as unsupported', async () => {
    fetchMock.mockResolvedValueOnce(
      versionResponse([{ version: PINNED_API_VERSION, status: 'sunset', sunset: '2026-01-01' }]),
    );
    const store = useApiVersionStore();
    await store.checkApiVersion();
    expect(store.check.state).toBe('unsupported');
  });

  it('fails soft on fetch errors (state error, no throw)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    const store = useApiVersionStore();
    await expect(store.checkApiVersion()).resolves.toBeUndefined();
    expect(store.check.state).toBe('error');
  });

  it('checks only once per session', async () => {
    fetchMock.mockResolvedValueOnce(
      versionResponse([{ version: PINNED_API_VERSION, status: 'current', sunset: null }]),
    );
    const store = useApiVersionStore();
    await store.checkApiVersion();
    await store.checkApiVersion();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('flags sunset when the middleware reports a live 410', () => {
    const store = useApiVersionStore();
    expect(store.sunsetErrorSeen).toBe(false);
    emitApiVersionError('api_version_sunset');
    expect(store.sunsetErrorSeen).toBe(true);
  });
});
