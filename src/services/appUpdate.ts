import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

/**
 * Native app update remedy for the API version banner (Android/Capacitor,
 * via Google Play).
 *
 * Deliberately the ONLY place update UI is triggered: silent updates are
 * left to Google Play's own auto-update mechanism (the Play in-app update
 * API cannot download without a consent dialog, which would nag users who
 * don't need anything). When the API contract forces an update
 * (deprecated/retired pin), preference order is:
 * 1. Google Play in-app immediate update — full-screen native flow — when
 *    Play reports an available update that allows it
 * 2. Otherwise open the app's Play Store entry (side-loaded preview/RC
 *    builds report no update; they land here too)
 *
 * A canceled immediate update (user backed out of the full-screen flow)
 * does NOT fall through to the store — the user already declined.
 *
 * Production app id, matching the banner's remedy (update the real app;
 * preview variants are not listed in the store).
 */
const PLAY_APP_ID = 'com.wodore.app';

export type NativeAppUpdateOutcome = 'in-app' | 'store' | 'canceled';

export async function triggerNativeAppUpdate(): Promise<NativeAppUpdateOutcome> {
  let immediateAllowed = false;
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    immediateAllowed =
      info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE &&
      info.immediateUpdateAllowed === true;
  } catch {
    // Play services unavailable / plugin not implemented (web) — store entry
  }

  if (immediateAllowed) {
    try {
      await AppUpdate.performImmediateUpdate();
      return 'in-app';
    } catch {
      return 'canceled'; // user dismissed the full-screen update flow
    }
  }

  try {
    await AppUpdate.openAppStore({ androidPackageName: PLAY_APP_ID });
  } catch {
    // never block the user on a store-open failure
  }
  return 'store';
}
