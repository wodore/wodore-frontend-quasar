/**
 * Storage — the ONE place persistence lives.
 *
 * Uses @capacitor/preferences exclusively:
 *   Web: localStorage (the plugin's built-in fallback)
 *   Native: SharedPreferences (Android) / UserDefaults (iOS)
 *
 * The plugin API is async; our stores read synchronously at boot.
 * We solve this with a memory cache + async write-through.
 * Boot: `initStorage()` preloads the cache before stores read.
 */

const memoryCache = new Map<string, unknown>();
let initialized = false;

type PreferencesPlugin = {
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
  clear(): Promise<void>;
};

let plugin: PreferencesPlugin | null = null;

async function getPlugin(): Promise<PreferencesPlugin> {
  if (plugin) return plugin;
  const { Preferences } = await import('@capacitor/preferences');
  plugin = Preferences as PreferencesPlugin;
  return plugin;
}

/** Boot-time preload — call once before stores read */
export async function initStorage(): Promise<void> {
  if (initialized) return;
  const p = await getPlugin();
  const { keys } = await p.keys();
  for (const key of keys) {
    const { value } = await p.get({ key });
    if (value !== null) {
      try {
        memoryCache.set(key, JSON.parse(value));
      } catch {
        memoryCache.set(key, value);
      }
    }
  }
  initialized = true;
}

/** Sync read from memory cache */
export function storageGet<T>(key: string): T | null {
  return (memoryCache.get(key) as T) ?? null;
}

/** Sync existence check */
export function storageHas(key: string): boolean {
  return memoryCache.has(key);
}

/** Write to cache immediately + persist async */
export function storageSet(key: string, value: unknown): void {
  memoryCache.set(key, value);
  getPlugin()
    .then(p => p.set({ key, value: JSON.stringify(value) }))
    .catch(() => {});
}

/** Remove a key */
export function storageRemove(key: string): void {
  memoryCache.delete(key);
  getPlugin()
    .then(p => p.remove({ key }))
    .catch(() => {});
}

/** Clear everything */
export function storageClear(): void {
  memoryCache.clear();
  getPlugin()
    .then(p => p.clear())
    .catch(() => {});
}
