// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import { SUPPORTED_LOCALES, resolveLocale, isLocale, LANGUAGE_OPTIONS } from '@/i18n';
import { currentLocale, getStoredLocale, initLocale, setLocale } from '@services/locale';
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

function seedStoredLanguage(language: unknown): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui: { language }, map: {} }));
}

describe('locale resolution', () => {
  it('keeps the four supported languages with native display names', () => {
    allure.label('feature', 'language-switch');
    allure.severity('critical');

    expect(SUPPORTED_LOCALES).toEqual(['de', 'en', 'fr', 'it']);
    expect(LANGUAGE_OPTIONS.map(o => o.value)).toEqual(SUPPORTED_LOCALES);
    for (const option of LANGUAGE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it('resolves supported locales unchanged', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(resolveLocale(locale)).toBe(locale);
      expect(isLocale(locale)).toBe(true);
    }
  });

  it('falls back to German for invalid, legacy or missing values', () => {
    allure.label('feature', 'language-switch');
    allure.severity('critical');

    expect(isLocale('es')).toBe(false);
    expect(resolveLocale('es')).toBe('de');
    expect(resolveLocale('de-CH')).toBe('de');
    expect(resolveLocale('')).toBe('de');
    expect(resolveLocale(undefined)).toBe('de');
    expect(resolveLocale(null)).toBe('de');
    expect(resolveLocale(42)).toBe('de');
  });
});

describe('locale service', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setActivePinia(createPinia());
  });

  it('reads the persisted locale from the user settings store', () => {
    seedStoredLanguage('fr');

    expect(getStoredLocale()).toBe('fr');
  });

  it('falls back to German when the stored value is invalid', () => {
    seedStoredLanguage('klingon');

    expect(getStoredLocale()).toBe('de');
    // The store sanitizes the legacy value on load
    expect(useUserSettingsStore().uiSettings.language).toBe('de');
  });

  it('initLocale applies the locale to the i18n instance', () => {
    expect(initLocale('it')).toBe('it');
    expect(currentLocale()).toBe('it');
    // initLocale must not write back to the store
    expect(useUserSettingsStore().uiSettings.language).toBe('de');
  });

  it('setLocale switches i18n and persists the choice in the settings store', async () => {
    setLocale('en');

    expect(currentLocale()).toBe('en');
    const settings = useUserSettingsStore();
    expect(settings.uiSettings.language).toBe('en');
    // The store persists with a 500ms debounce
    await new Promise(resolve => setTimeout(resolve, 600));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').ui.language).toBe('en');
  });

  it('setLocale ignores invalid values', () => {
    setLocale('gsw' as unknown as Parameters<typeof setLocale>[0]);

    expect(currentLocale()).toBe('de');
  });
});
