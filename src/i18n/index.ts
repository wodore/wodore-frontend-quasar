import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

export default {
  de: de,
  en: en,
  fr: fr,
  it: it,
};

export type Locale = 'de' | 'en' | 'fr' | 'it';
export type Locales = Locale[];

/**
 * The app's supported UI languages. Keep in sync with the backend
 * `lang` query parameter (de, en, fr, it — backend falls back internally).
 */
export const SUPPORTED_LOCALES: Locales = ['de', 'en', 'fr', 'it'];

/** Fallback locale if none stored / stored value is invalid. */
export const FALLBACK_LOCALE: Locale = 'de';

/**
 * Language picker options with native names.
 * Native names are shown regardless of the active UI language (standard
 * language-picker pattern) and are therefore constants, not i18n messages.
 */
export const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value);
}

/**
 * Validate a (possibly persisted, possibly legacy) value as a supported
 * locale, falling back to German for anything unknown.
 */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : FALLBACK_LOCALE;
}
