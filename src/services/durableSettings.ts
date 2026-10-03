/**
 * Durable settings storage — survives WebView cache/data clears on native.
 *
 * localStorage stays the synchronous source the stores read; Capacitor
 * Preferences (SharedPreferences on Android, UserDefaults on iOS) mirrors
 * the whole user-settings blob and re-seeds localStorage on boot when it
 * was wiped. Web is unchanged (localStorage only).
 *
 * The blob is deliberately one JSON value (UserSettings incl. overlay
 * groups and their icons) — when the backend grows a settings endpoint,
 * the same blob can be uploaded verbatim.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const DURABLE_SETTINGS_KEY = 'wodore:userSettings';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** Boot-time rehydration (native): if localStorage was cleared but the
 *  durable copy exists, seed localStorage BEFORE the stores read it. */
export async function rehydrateDurableSettings(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    if (window.localStorage.getItem(DURABLE_SETTINGS_KEY) !== null) return;
    const { value } = await Preferences.get({ key: DURABLE_SETTINGS_KEY });
    if (value) {
      window.localStorage.setItem(DURABLE_SETTINGS_KEY, value);
    }
  } catch {
    // durable copy unavailable — defaults apply
  }
}

/** Write-behind mirror (fire and forget, native only). */
export function mirrorDurableSettings(settings: unknown): void {
  if (!isNativePlatform()) return;
  void Preferences.set({
    key: DURABLE_SETTINGS_KEY,
    value: JSON.stringify(settings),
  }).catch(() => {
    // non-fatal: localStorage still holds the value
  });
}
