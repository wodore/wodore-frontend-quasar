// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as allure from 'allure-js-commons';
import { createPinia, setActivePinia } from 'pinia';
import {
  SUPPORTED_LOCALES,
  resolveLocale,
  isLocale,
  LANGUAGE_OPTIONS,
  detectSystemLocale,
} from '@/i18n';
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

  it('falls back to English for invalid, legacy or missing values', () => {
    allure.label('feature', 'language-switch');
    allure.severity('critical');

    expect(isLocale('es')).toBe(false);
    expect(resolveLocale('es')).toBe('en');
    expect(resolveLocale('de-CH')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(42)).toBe('en');
  });

  it('detects the system language with English fallback', () => {
    allure.label('feature', 'language-switch');
    allure.severity('critical');

    // happy-dom default language list
    const originalLanguages = navigator.languages;
    const originalLanguage = navigator.language;

    Object.defineProperty(navigator, 'languages', {
      value: ['fr-CH', 'fr', 'de'],
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('fr');

    Object.defineProperty(navigator, 'languages', {
      value: ['de-CH', 'de'],
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('de');

    Object.defineProperty(navigator, 'languages', {
      value: ['es-ES', 'ja-JP'],
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('en');

    Object.defineProperty(navigator, 'languages', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: 'it-CH',
      configurable: true,
    });
    expect(detectSystemLocale()).toBe('it');

    Object.defineProperty(navigator, 'languages', {
      value: originalLanguages,
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    });
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

  it('falls back to English when the stored value is invalid', () => {
    seedStoredLanguage('klingon');

    expect(getStoredLocale()).toBe('en');
    // The store sanitizes the legacy value on load
    expect(useUserSettingsStore().uiSettings.language).toBe('en');
  });

  it('reports whether stored settings existed (first-visit detection)', () => {
    // Fresh localStorage -> first visit
    expect(useUserSettingsStore().hasStoredSettings).toBe(false);
    // A NEW store instance (fresh pinia, as on the next app boot) sees the
    // defaults the first store wrote on init
    setActivePinia(createPinia());
    expect(useUserSettingsStore().hasStoredSettings).toBe(true);
  });

  it('initLocale applies the locale to the i18n instance', () => {
    expect(initLocale('it')).toBe('it');
    expect(currentLocale()).toBe('it');
    // initLocale must not write back to the store (default language)
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

    expect(currentLocale()).toBe('en');
  });
});
