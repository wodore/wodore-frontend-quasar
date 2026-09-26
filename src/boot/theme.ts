import { boot } from 'quasar/wrappers';
import { watch } from 'vue';

import { useUserSettingsStore } from '@stores/user-settings-store';
import { applyTheme, bindSystemTheme, resolveTheme } from '@services/theme';

// Applies the persisted theme ('light' | 'dark' | 'auto') before the app
// renders, then keeps the Quasar Dark plugin in sync with the setting and,
// in 'auto' mode, with the OS preference.
export default boot(({ store }) => {
  const settings = useUserSettingsStore(store);
  applyTheme(resolveTheme(settings.uiSettings.theme));
  watch(
    () => settings.uiSettings.theme,
    mode => applyTheme(resolveTheme(mode))
  );
  bindSystemTheme(() => resolveTheme(settings.uiSettings.theme));
});
