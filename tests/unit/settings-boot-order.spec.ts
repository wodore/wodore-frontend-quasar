// @vitest-environment happy-dom
//
// Boot-order contract between the storage boot and the settings stores.
//
// The storage service reads through a memory cache that `initStorage()`
// primes (the Capacitor Preferences web fallback reads localStorage
// ASYNCHRONOUSLY — "web is synchronous" is a myth the boot order once
// relied on). The i18n boot creates the user-settings store: if that
// happens before `initStorage()` has run, the store sees an empty cache,
// treats persisted settings as absent, and — before the fix — wrote its
// DEFAULTS straight back over the persisted payload. Net effect: the
// chosen theme (and language, units, …) reset to the default ('auto' =
// follow system) on every page load. Pinned here so a future boot
// reorder cannot reintroduce it.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// In-memory stand-in for @capacitor/preferences (mirrors storage.spec.ts)
const mockStore = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: mockStore.has(key) ? mockStore.get(key)! : null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      mockStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      mockStore.delete(key);
    }),
    keys: vi.fn(async () => ({ keys: [...mockStore.keys()] })),
    clear: vi.fn(async () => {
      mockStore.clear();
    }),
  },
}));

import { initStorage } from '@services/storage';
import { useUserSettingsStore } from '@stores/user-settings-store';

const STORAGE_KEY = 'wodore:userSettings';

/** Persisted payload as a previous session would have left it. */
function seedPersistedSettings(): void {
  mockStore.set(STORAGE_KEY, JSON.stringify({ ui: { theme: 'light', language: 'en' }, map: {} }));
}

describe('settings boot order', () => {
  beforeEach(() => {
    mockStore.clear();
    setActivePinia(createPinia());
  });

  it('store creation on a cold cache never overwrites persisted settings', () => {
    seedPersistedSettings();

    // Boot-order regression scenario: the store is created BEFORE the
    // storage boot primed the memory cache (i18n boot used to sit in
    // front of it). The store must not write on initialization.
    const store = useUserSettingsStore();

    expect(store.hasStoredSettings).toBe(false); // cold cache — expected…
    expect(store.uiSettings.theme).toBe('auto'); // …and defaults apply
    // …but the persisted payload must survive untouched.
    const persisted = JSON.parse(mockStore.get(STORAGE_KEY)!);
    expect(persisted.ui).toMatchObject({ theme: 'light', language: 'en' });
  });

  it('after initStorage the store reads the persisted theme (reload keeps the choice)', async () => {
    seedPersistedSettings();

    // The storage boot runs before i18n/theme: the cache is primed from
    // the persisted payload before any store is created.
    // (Positive-path validation — the regression detectors for the
    // boot-order bug are the cold-cache test above and the boot-order
    // guard below, both of which fail on the old code.)
    await initStorage();

    const store = useUserSettingsStore();
    expect(store.hasStoredSettings).toBe(true);
    expect(store.uiSettings.theme).toBe('light');
    expect(store.uiSettings.language).toBe('en');
  });

  it('quasar.config.ts runs the storage boot before i18n and theme', () => {
    // Parse the boot array so the contract above is enforced in CI even
    // if no test ever instantiates the boots themselves. (happy-dom's
    // import.meta.url is not a file URL — resolve from the repo root,
    // which is vitest's cwd.)
    const config = readFileSync(resolve(process.cwd(), 'quasar.config.ts'), 'utf8');
    const block = config.slice(
      config.indexOf('boot: ['),
      config.indexOf('],', config.indexOf('boot: ['))
    );
    const boots = [...block.matchAll(/(?:path:\s*)?'([a-z][a-z0-9-]*)'/g)].map(m => m[1]);

    expect(boots).toContain('storage');
    expect(boots).toContain('i18n');
    expect(boots).toContain('theme');
    expect(boots.indexOf('storage')).toBeLessThan(boots.indexOf('i18n'));
    expect(boots.indexOf('storage')).toBeLessThan(boots.indexOf('theme'));
  });
});
