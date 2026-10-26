//
// Public API base selection (CDN split, WODORE_PUBLIC_API_URL):
// publicApiBase() and the clientWodore publicBaseMiddleware — which
// requests go through the optional CDN base and which keep the direct
// WODORE_API_HOST (see src/services/apiBase.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Controllable auth state: authMiddleware reads access_token at request
// time, so the getter must resolve dynamically per request.
const auth = vi.hoisted(() => ({ accessToken: '' }));
vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({
    get access_token() {
      return auth.accessToken;
    },
  }),
}));

// clientWodore captures WODORE_API_HOST at import time (baseUrl), and
// openapi-fetch resolves the global fetch at its own import time — both
// must be in place before the module graph evaluates (api-version.spec
// pattern). WODORE_PUBLIC_API_URL is read dynamically per request.
vi.hoisted(() => {
  process.env.WODORE_API_HOST = 'http://api.test';
  process.env.WODORE_PUBLIC_API_URL = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 }))
  );
});

const fetchMock = vi.mocked(globalThis.fetch);

import { clientWodore } from '@clients/index';
import { publicApiBase } from '@services/apiBase';

/** The Request openapi-fetch handed to (the stubbed) fetch. */
const lastRequest = (): Request => (fetchMock.mock.lastCall as unknown as [Request])[0]!;

beforeEach(() => {
  fetchMock.mockClear();
  auth.accessToken = '';
  process.env.WODORE_PUBLIC_API_URL = '';
});

describe('publicApiBase()', () => {
  it('falls back to WODORE_API_HOST when WODORE_PUBLIC_API_URL is unset', () => {
    delete process.env.WODORE_PUBLIC_API_URL;
    expect(publicApiBase()).toBe('http://api.test');
  });

  it('falls back to WODORE_API_HOST when WODORE_PUBLIC_API_URL is empty', () => {
    expect(publicApiBase()).toBe('http://api.test');
  });

  it('returns the CDN base when set, trailing slash trimmed', () => {
    process.env.WODORE_PUBLIC_API_URL = 'https://cdn.test/';
    expect(publicApiBase()).toBe('https://cdn.test');
  });
});

describe('publicBaseMiddleware (clientWodore)', () => {
  it('rewrites unauthenticated GETs to the CDN origin, preserving path, query and headers', async () => {
    process.env.WODORE_PUBLIC_API_URL = 'https://cdn.test';
    await clientWodore.GET('/v1/huts/huts', { params: { query: { lang: 'de' } } });
    const req = lastRequest();
    expect(req.url).toBe('https://cdn.test/v1/huts/huts?lang=de');
    expect(req.method).toBe('GET');
    expect(req.headers.get('Api-Version')).toBeTruthy();
    expect(req.headers.get('Authorization')).toBeNull();
  });

  it('keeps the direct API host for authenticated GETs (Bearer attached)', async () => {
    process.env.WODORE_PUBLIC_API_URL = 'https://cdn.test';
    auth.accessToken = 'token123';
    await clientWodore.GET('/v1/huts/huts', {});
    const req = lastRequest();
    expect(req.url).toBe('http://api.test/v1/huts/huts');
    expect(req.headers.get('Authorization')).toBe('Bearer token123');
  });

  it('keeps the direct API host for non-GET requests (auth flows, mutations)', async () => {
    process.env.WODORE_PUBLIC_API_URL = 'https://cdn.test';
    await clientWodore.POST('/v1/feedback/', {
      body: { email: 'a@b.c', subject: 's', message: 'm', get_updates: false, urls: null },
    });
    expect(lastRequest().url).toBe('http://api.test/v1/feedback/');
  });

  it('never rewrites when WODORE_PUBLIC_API_URL is unset (single-host behavior)', async () => {
    delete process.env.WODORE_PUBLIC_API_URL;
    await clientWodore.GET('/v1/huts/huts', {});
    expect(lastRequest().url).toBe('http://api.test/v1/huts/huts');
  });

  it('skips the rewrite when the CDN origin already equals the API origin', async () => {
    process.env.WODORE_PUBLIC_API_URL = 'http://api.test';
    await clientWodore.GET('/v1/huts/huts', {});
    expect(lastRequest().url).toBe('http://api.test/v1/huts/huts');
  });

  it('routes /v1/version through the CDN like every unauthenticated GET (backend serves CDN-safe headers)', async () => {
    process.env.WODORE_PUBLIC_API_URL = 'https://cdn.test';
    await clientWodore.GET('/v1/version', {});
    expect(lastRequest().url).toBe('https://cdn.test/v1/version');
  });
});
