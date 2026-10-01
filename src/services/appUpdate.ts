import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } from '@capawesome/capacitor-app-update';

/**
 * Native app update flows (Android/Capacitor, via Google Play):
 *
 * 1. Startup auto-update (`checkForAppUpdateOnStartup`): when Play reports
 *    an available update, the flexible update downloads silently in the
 *    background (Play handles network policy — typically unmetered). When
 *    the download completes, the caller is notified and can offer a
 *    restart (`completeFlexibleUpdate`). Apps more than
 *    STALENESS_ESCALATION_DAYS behind additionally escalate to a
 *    persistent banner — see WdAppUpdateBanner.
 *
 * 2. Banner remedy (`triggerNativeAppUpdate`): Play in-app immediate
 *    update when allowed, app store entry otherwise (side-loaded
 *    preview/RC builds report no update and land here).
 *
 * Production app id, matching the banner's remedy (update the real app;
 * preview variants are not listed in the store).
 */
const PLAY_APP_ID = 'com.wodore.app';

/** Escalate to the persistent banner after this many days behind. */
export const STALENESS_ESCALATION_DAYS = 14;

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

export interface StartupUpdateCheck {
  /** Play reports a newer version than the installed one. */
  available: boolean;
  /** Installed version is >= STALENESS_ESCALATION_DAYS behind — show the banner. */
  escalated: boolean;
  /** Background download started (or already finished). */
  flexibleStarted: boolean;
}

/**
 * Check for updates on app start and auto-download in the background.
 * `onDownloaded` fires once the update is ready to install — immediately
 * when a previous run already downloaded it.
 */
export async function checkForAppUpdateOnStartup(
  onDownloaded: () => void,
): Promise<StartupUpdateCheck> {
  const silent: StartupUpdateCheck = { available: false, escalated: false, flexibleStarted: false };
  let info: Awaited<ReturnType<typeof AppUpdate.getAppUpdateInfo>>;
  try {
    info = await AppUpdate.getAppUpdateInfo();
  } catch {
    return silent; // Play services unavailable / plugin not implemented (web)
  }

  if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
    return silent; // up to date, or side-loaded build Play does not know
  }

  // A previous run may already have downloaded the update (the download
  // survives app restarts) — offer the restart right away.
  if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
    onDownloaded();
    return {
      available: true,
      escalated: isStale(info.clientVersionStalenessDays),
      flexibleStarted: true,
    };
  }

  if (info.flexibleUpdateAllowed) {
    // startFlexibleUpdate resolves when the download finished; Play runs
    // the download under its own network policy (background-safe).
    void AppUpdate.startFlexibleUpdate()
      .then(onDownloaded)
      .catch(() => {
        // download failed/canceled — the next app start retries
      });
  }

  return {
    available: true,
    escalated: isStale(info.clientVersionStalenessDays),
    flexibleStarted: info.flexibleUpdateAllowed === true,
  };
}

function isStale(stalenessDays: number | undefined): boolean {
  return (stalenessDays ?? 0) >= STALENESS_ESCALATION_DAYS;
}
