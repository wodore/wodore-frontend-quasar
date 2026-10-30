/**
 * Storage boot — preload native storage into memory before the app renders.
 * Web: the Capacitor Preferences web fallback ALSO reads asynchronously
 * (localStorage behind the plugin's API), so this boot is required there
 * too — it must complete before the first store reads `storageGet()`.
 * Native: reads all SharedPreferences/UserDefaults into the memory cache
 * so subsequent storageGet() calls are synchronous.
 *
 * Boot-order contract: every boot that touches a settings store (i18n,
 * theme, …) must come AFTER this one, or the store reads an unprimed
 * memory cache and treats persisted settings as absent — pinned by
 * tests/unit/settings-boot-order.spec.ts.
 */
import { boot } from 'quasar/wrappers';
import { initStorage } from '@services/storage';

export default boot(async () => {
  await initStorage();
});
