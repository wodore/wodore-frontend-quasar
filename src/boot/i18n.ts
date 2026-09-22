import { boot } from 'quasar/wrappers';
import { useQuasar } from 'quasar';

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
import { detectSystemLocale } from '@/i18n';
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
  bindQuasarForLocale(useQuasar());
  // Initialize from the persisted user setting (localStorage-backed); the
  // language is intentionally never read from or written to the URL.
  // First visit: detect the system language (English fallback) and persist
  // it as the initial choice — a later manual selection always wins.
  const settings = useUserSettingsStore(store);
  if (settings.hasStoredSettings) {
    initLocale(getStoredLocale(store));
  } else {
    setLocale(detectSystemLocale());
  }

  // Set i18n instance on app
  app.use(i18n);
  app.config.globalProperties.$t = i18n.global.t;
});
