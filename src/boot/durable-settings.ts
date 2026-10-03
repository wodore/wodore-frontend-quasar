/**
 * Rehydrate user settings from the durable native copy BEFORE any other
 * boot file (theme!) or store reads them. On native, a WebView data clear
 * wipes localStorage — Capacitor Preferences survives it.
 */
import { boot } from 'quasar/wrappers';
import { rehydrateDurableSettings } from '@services/durableSettings';

export default boot(async () => {
  await rehydrateDurableSettings();
});
