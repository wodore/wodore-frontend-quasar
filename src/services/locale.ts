/**
 * Locale service — single source of truth for the active UI language.
 *
 * Responsibilities:
 * - Own the vue-i18n instance (legacy: false, fallback: 'de').
 * - Apply the persisted user setting at boot (`initLocale`).
 * - Switch the language at runtime (`setLocale`): vue-i18n + user settings
 *   store (localStorage-persisted) + Quasar framework lang pack.
 * - Expose the reactive locale so stores/components can refetch localized
 *   remote data when the language changes.
 *
 * The language is intentionally NOT encoded in the URL (see OpenSpec change
 * `add-language-switch`); persistence happens via the user settings store.
 */
import { createI18n } from 'vue-i18n';
import type { QVueGlobals } from 'quasar';
import type { QuasarLanguage } from 'quasar';
import quasarLangDeCH from 'quasar/lang/de-CH';
import quasarLangEnUS from 'quasar/lang/en-US';
import quasarLangFr from 'quasar/lang/fr';
import quasarLangIt from 'quasar/lang/it';

import messages, { FALLBACK_LOCALE, resolveLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import { useUserSettingsStore } from '@stores/user-settings-store';

/** Quasar framework lang pack per app locale (component-internal texts). */
const QUASAR_LANG_PACKS: Record<Locale, QuasarLanguage> = {
  de: quasarLangDeCH,
  en: quasarLangEnUS,
  fr: quasarLangFr,
  it: quasarLangIt,
};

/**
 * The shared vue-i18n instance. Created here (not in the boot file) so the
 * service can manage it; `src/boot/i18n.ts` only registers it on the app.
 */
export const i18n = createI18n({
  legacy: false,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  // Master message schema is de.json (see boot/i18n.ts type augmentation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: messages as any,
});

// Quasar instance is bound from the boot file (works in boot files and
// components; guarded so the service also works without it, e.g. unit tests).
let quasarInstance: QVueGlobals | undefined;

/**
 * Bind the Quasar instance so `setLocale` can switch the framework lang pack.
 * Called once from the i18n boot file.
 */
export function bindQuasarForLocale($q: QVueGlobals): void {
  quasarInstance = $q;
}

function applyQuasarLangPack(locale: Locale): void {
  quasarInstance?.lang.set(QUASAR_LANG_PACKS[locale]);
}

/** Reactive read of the active locale. */
export function currentLocale(): Locale {
  return resolveLocale(i18n.global.locale.value);
}

/** Read the persisted locale from the user settings store (localStorage). */
export function getStoredLocale(pinia?: Parameters<typeof useUserSettingsStore>[0]): Locale {
  const settings = useUserSettingsStore(pinia);
  return resolveLocale(settings.uiSettings.language);
}

/**
 * Apply a locale at boot without writing it back to the store.
 * (The stored value is already the source of truth; avoid a pointless
 * debounced save + sync marking on startup.)
 */
export function initLocale(locale: unknown): Locale {
  const resolved = resolveLocale(locale);
  i18n.global.locale.value = resolved;
  applyQuasarLangPack(resolved);
  return resolved;
}

/**
 * Switch the active language: updates vue-i18n, persists the choice in the
 * user settings store (localStorage via debounced write) and switches the
 * Quasar framework lang pack. Stores/components watching `currentLocale()`
 * refetch language-dependent remote data.
 */
export function setLocale(locale: Locale): void {
  const resolved = resolveLocale(locale);
  i18n.global.locale.value = resolved;
  applyQuasarLangPack(resolved);
  const settings = useUserSettingsStore();
  if (settings.uiSettings.language !== resolved) {
    settings.updateUISetting('language', resolved);
  }
}
