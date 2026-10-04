/**
 * Storage boot — preload native storage into memory before the app renders.
 * Web: no-op (localStorage is already synchronous).
 * Native: reads all SharedPreferences/UserDefaults into the memory cache
 * so subsequent storageGet() calls are synchronous.
 */
import { boot } from 'quasar/wrappers';
import { initStorage } from '@services/storage';

export default boot(async () => {
  await initStorage();
});
