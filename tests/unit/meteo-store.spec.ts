// @vitest-environment happy-dom
//
// Regression tests for the weather-code fetch context watcher.
//
// The watcher used to be a watchEffect that started the request inline.
// Starting a request runs the API client's loading middleware, whose
// activeCount.value++ (useRequestProgress) is a reactive read+write; inside
// the effect that made the counter (and the cache refs) tracked
// dependencies, so every fetch re-triggered the effect several wasted
// times. The lastFetchKey guard kept it from refetching the network, but
// each re-run re-read localStorage and recomputed the cache. The watch
// conversion runs the body exactly once per context change — asserted
// here via the localStorage.getItem call count (the old pattern performs
// 2-3 reads per fetch, the fix exactly 1).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@stores/auth-store', () => ({
  useAuthStore: () => ({ access_token: '' }),
}));

vi.mock('openmeteo', () => ({
  fetchWeatherApi: vi.fn(),
}));

vi.mock('@services/locale', async () => {
  const { ref } = await import('vue');
  const locale = ref<'de' | 'en'>('en');
  return {
    currentLocale: () => locale.value,
  };
});

const fake = vi.hoisted(() => ({
  getCalls: [] as string[],
  middlewares: [] as Array<{
    onRequest?: (ctx: { request: Request; url: string }) => Promise<void> | void;
    onResponse?: (ctx: { request: Request; url: string }) => Promise<void> | void;
  }>,
}));

vi.mock('openapi-fetch', () => ({
  default: () => ({
    use: (middleware: (typeof fake)['middlewares'][number]) => {
      fake.middlewares.push(middleware);
    },
    async GET(url: string, opts: { params?: unknown }) {
      fake.getCalls.push(url);
      const request = new Request(`https://api.test${url}`);
      for (const middleware of fake.middlewares) {
        if (middleware.onRequest) {
          await middleware.onRequest({ request, url, params: opts?.params });
        }
      }
      for (const middleware of fake.middlewares) {
        if (middleware.onResponse) {
          await middleware.onResponse({ request, url, response: new Response(), result: {} });
        }
      }
      return { data: { '0': { description: 'Clear' } }, error: undefined };
    },
  }),
}));

async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
  await new Promise(resolve => setTimeout(resolve, 10));
}

function weatherCodeFetches(): number {
  return fake.getCalls.filter(url => url.includes('/meteo/weather_codes')).length;
}

function weatherCodeCacheReads(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter(([key]) => String(key).startsWith('weather_codes:')).length;
}

describe('meteo store weather-code context', () => {
  let getItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fake.getCalls = [];
    fake.middlewares = [];
    localStorage.clear();
    getItemSpy = vi.spyOn(localStorage, 'getItem');
    setActivePinia(createPinia());
  });

  it('runs the fetch context exactly once per store init (no effect re-runs)', async () => {
    const { useMeteoStore } = await import('@stores/meteo-store');
    const store = useMeteoStore();

    await settle();

    expect(weatherCodeFetches()).toBe(1);
    // Exactly two cache reads per context run: one in the watcher, one at
    // the top of getWeatherCodes. The old watchEffect re-ran the watcher
    // body per reactive trigger (>=3 reads per fetch).
    expect(weatherCodeCacheReads(getItemSpy)).toBe(2);
    expect(store.weatherCodes['0'].description).toBe('Clear');
  });

  it('fetches once per language/collection context change', async () => {
    const { useMeteoStore } = await import('@stores/meteo-store');
    const store = useMeteoStore();
    await settle();
    expect(weatherCodeFetches()).toBe(1);

    store.setWeatherCodesContext('de');
    await settle();
    expect(weatherCodeFetches()).toBe(2);
    expect(weatherCodeCacheReads(getItemSpy)).toBe(4);
    expect(store.weatherCodesLang).toBe('de');

    // No further spontaneous runs
    await settle();
    expect(weatherCodeFetches()).toBe(2);
  });
});
