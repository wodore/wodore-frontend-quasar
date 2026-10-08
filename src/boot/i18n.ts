import { boot } from 'quasar/wrappers';
import type { QVueGlobals } from 'quasar';

// The vue-i18n instance itself lives in the locale service; this boot file
// registers it on the app, applies the persisted locale + Quasar lang pack
// and declares the typed message schema (de.json is the master).
import {
  i18n,
  initLocale,
  setLocale,
  bindQuasarForLocale,
  getStoredLocale,
} from '@services/locale';
import { detectSystemLocale, LANG_PREFIXES } from '@/i18n';
import type { Locale } from '@/i18n';
import { useUserSettingsStore } from '@stores/user-settings-store';
import messages from '@/i18n';

export type MessageLanguages = keyof typeof messages;
// Type-define 'de' as the master schema for the resource
export type MessageSchema = (typeof messages)['de'];

// See https://vue-i18n.intlify.dev/guide/advanced/typescript.html#global-resource-schema-type-definition

declare module 'vue-i18n' {
  // define the locale messages schema
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}

  // define the datetime format schema
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineDateTimeFormat {}

  // define the number format schema
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineNumberFormat {}
}

export default boot(({ app, store }) => {
  // $q is registered by the Quasar plugin as a global property.
  // useQuasar() (Vue inject) only works inside component setup — NOT in
  // boot files — so read the global property instead to bind the instance
  // for lang-pack switching.
  bindQuasarForLocale(app.config.globalProperties.$q as QVueGlobals);
  // Initial language, in precedence order (user preference wins):
  // 1. persisted user setting (localStorage-backed) — the source of truth;
  // 2. the URL's locale prefix (/de|/fr|/it) — first visit via a shared
  //    language link or the edge's Accept-Language redirect;
  // 3. detected system language (English fallback) — first bare visit.
  // The language is persisted on first choice; a manual selection always
  // wins. In-app navigation normalizes to bare URLs — the prefix is an
  // entry-point hint (shares, crawlers), display follows the setting.
  const settings = useUserSettingsStore(store);
  const prefixRe = new RegExp(`^/(${LANG_PREFIXES.join('|')})(?:/|$)`);
  const pathLang =
    typeof window !== 'undefined' ? window.location.pathname.match(prefixRe)?.[1] : undefined;
  if (settings.hasStoredSettings) {
    initLocale(getStoredLocale(store));
  } else if (pathLang) {
    setLocale(pathLang as Locale);
  } else {
    setLocale(detectSystemLocale());
  }

  // The ?lang= parameter is stripped from the address bar by the router
  // (src/router/index.ts) after the edge consumed it for the initial
  // HTML meta tags; it also serves as a fallback language hint for the
  // boot precedence below when no path prefix is present.
  if (typeof window !== 'undefined' && window.location.search.includes('lang=')) {
    const urlLang = new URL(window.location.href).searchParams.get('lang') ?? undefined;
    if (
      urlLang &&
      LANG_PREFIXES.includes(urlLang as Locale) &&
      !settings.hasStoredSettings &&
      !pathLang
    ) {
      setLocale(urlLang as Locale);
    }
  }

  // Set i18n instance on app
  app.use(i18n);
  app.config.globalProperties.$t = i18n.global.t;
});
