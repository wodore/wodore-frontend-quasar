// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import { useUserSettingsStore } from '@stores/user-settings-store';

// Quasar's LocalStorage no-ops under happy-dom; back it with the real DOM storage
vi.mock('quasar', async importOriginal => {
  const actual = await importOriginal<typeof import('quasar')>();
  return {
    ...actual,
    LocalStorage: {
      getItem: (key: string) => {
        const raw = window.localStorage.getItem(key);
        if (raw === null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      },
      set: (key: string, value: unknown) => window.localStorage.setItem(key, JSON.stringify(value)),
      removeItem: (key: string) => window.localStorage.removeItem(key),
      hasItem: (key: string) => window.localStorage.getItem(key) !== null,
    },
  };
});

const STORAGE_KEY = 'wodore:userSettings';

function readStored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
}

describe('user-settings-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActivePinia(createPinia());
  });

  it('initializes defaults and ensures the storage key exists', () => {
    allure.label('feature', 'user-settings');
    allure.severity('critical');

    const store = useUserSettingsStore();

    expect(store.uiSettings.theme).toBe('auto');
    expect(store.uiSettings.language).toBe('de');
    expect(store.uiSettings.units).toBe('metric');
    expect(store.mapSettings.defaultZoom).toBe(8);
    expect(store.availableOverlays).toContain('huts');
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('updates UI and map settings', () => {
    const store = useUserSettingsStore();

    store.updateUISetting('theme', 'dark');
    store.updateUISetting('language', 'en');
    store.updateMapSetting('defaultZoom', 10);

    expect(store.uiSettings.theme).toBe('dark');
    expect(store.uiSettings.language).toBe('en');
    expect(store.mapSettings.defaultZoom).toBe(10);
  });

  it('manages available overlays without duplicates', () => {
    const store = useUserSettingsStore();
    const before = store.availableOverlays.length;

    store.addAvailableOverlay('test-overlay');
    store.addAvailableOverlay('test-overlay');
    expect(store.availableOverlays).toHaveLength(before + 1);

    store.removeAvailableOverlay('test-overlay');
    expect(store.availableOverlays).not.toContain('test-overlay');

    // Removing a non-existent overlay is a no-op
    store.removeAvailableOverlay('does-not-exist');
    expect(store.availableOverlays).toHaveLength(before);
  });

  it('manages preferred basemaps without duplicates', () => {
    const store = useUserSettingsStore();

    store.setPreferredBasemaps(['ch-swisstopo-light']);
    expect(store.preferredBasemaps).toEqual(['ch-swisstopo-light']);

    store.addPreferredBasemap('Satellite Hybrid');
    store.addPreferredBasemap('Satellite Hybrid');
    expect(store.preferredBasemaps).toEqual(['ch-swisstopo-light', 'Satellite Hybrid']);

    store.removePreferredBasemap('ch-swisstopo-light');
    expect(store.preferredBasemaps).toEqual(['Satellite Hybrid']);
  });

  it('persists changes and loads them in a fresh store', async () => {
    const store = useUserSettingsStore();
    store.updateUISetting('theme', 'dark');

    // Save is debounced (500ms)
    await vi.waitFor(
      () => {
        const stored = readStored() as { ui?: { theme?: string } };
        expect(stored.ui?.theme).toBe('dark');
      },
      { timeout: 2000 }
    );

    // A new pinia + store instance must read the persisted value
    setActivePinia(createPinia());
    const fresh = useUserSettingsStore();
    expect(fresh.uiSettings.theme).toBe('dark');
  });

  it('resets to defaults', () => {
    const store = useUserSettingsStore();
    store.updateUISetting('theme', 'dark');
    store.updateMapSetting('defaultZoom', 12);

    store.resetToDefaults();

    expect(store.uiSettings.theme).toBe('auto');
    expect(store.mapSettings.defaultZoom).toBe(8);
  });

  it('exports and imports settings', () => {
    const store = useUserSettingsStore();
    store.updateUISetting('theme', 'light');

    const exported = JSON.parse(store.exportSettings()) as { ui: { theme: string } };
    expect(exported.ui.theme).toBe('light');

    const ok = store.importSettings(JSON.stringify({ ui: { theme: 'dark' } }));
    expect(ok).toBe(true);
    expect(store.uiSettings.theme).toBe('dark');

    expect(store.importSettings('not valid json')).toBe(false);
  });
});
