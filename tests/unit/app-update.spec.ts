//
// Native app update flow (API version banner): Play in-app immediate
// update when available, store entry otherwise, cancel-safe.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above imports — the mock fns must be
// created in vi.hoisted so the factory can reference them.
const { getAppUpdateInfo, performImmediateUpdate, openAppStore, startFlexibleUpdate, completeFlexibleUpdate } = vi.hoisted(() => ({
  getAppUpdateInfo: vi.fn(),
  performImmediateUpdate: vi.fn(),
  openAppStore: vi.fn(),
  startFlexibleUpdate: vi.fn(),
  completeFlexibleUpdate: vi.fn(),
}));

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdate: { getAppUpdateInfo, performImmediateUpdate, openAppStore, startFlexibleUpdate, completeFlexibleUpdate },
  AppUpdateAvailability: { UNKNOWN: 0, UPDATE_NOT_AVAILABLE: 1, UPDATE_AVAILABLE: 2, UPDATE_IN_PROGRESS: 3 },
  FlexibleUpdateInstallStatus: { UNKNOWN: 0, PENDING: 1, DOWNLOADING: 2, INSTALLING: 3, INSTALLED: 4, FAILED: 5, CANCELED: 6, DOWNLOADED: 11 },
}));

import {
  triggerNativeAppUpdate,
  checkForAppUpdateOnStartup,
  STALENESS_ESCALATION_DAYS,
} from '@services/appUpdate';

const info = (overrides: Record<string, unknown> = {}) =>
  ({
    updateAvailability: 2, // UPDATE_AVAILABLE
    immediateUpdateAllowed: true,
    flexibleUpdateAllowed: true,
    ...overrides,
  }) as never;

describe('triggerNativeAppUpdate', () => {
  beforeEach(() => {
    getAppUpdateInfo.mockReset();
    performImmediateUpdate.mockReset();
    openAppStore.mockReset();
    startFlexibleUpdate.mockReset();
    completeFlexibleUpdate.mockReset();
  });

  it('runs the in-app immediate update when Play allows it', async () => {
    getAppUpdateInfo.mockResolvedValue(info({}));
    performImmediateUpdate.mockResolvedValue({ code: 0 });
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('in-app');
    expect(performImmediateUpdate).toHaveBeenCalledTimes(1);
    expect(openAppStore).not.toHaveBeenCalled();
  });

  it('opens the store when an update exists but immediate is not allowed', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ immediateUpdateAllowed: false }));
    openAppStore.mockResolvedValue(undefined);
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('store');
    expect(performImmediateUpdate).not.toHaveBeenCalled();
    expect(openAppStore).toHaveBeenCalledWith({ androidPackageName: 'com.wodore.app' });
  });

  it('opens the store when no update is available (side-loaded builds)', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ updateAvailability: 1 }));
    openAppStore.mockResolvedValue(undefined);
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
    expect(openAppStore).toHaveBeenCalledTimes(1);
  });

  it('opens the store when Play services are unavailable', async () => {
    getAppUpdateInfo.mockRejectedValue(new Error('UNAVAILABLE'));
    openAppStore.mockResolvedValue(undefined);
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
  });

  it('does nothing more when the user cancels the immediate update', async () => {
    getAppUpdateInfo.mockResolvedValue(info({}));
    performImmediateUpdate.mockRejectedValue(new Error('Result code: 1'));
    const outcome = await triggerNativeAppUpdate();
    expect(outcome).toBe('canceled');
    expect(openAppStore).not.toHaveBeenCalled();
  });

  it('still reports store when opening the store itself fails', async () => {
    getAppUpdateInfo.mockRejectedValue(new Error('UNAVAILABLE'));
    openAppStore.mockRejectedValue(new Error('not implemented'));
    await expect(triggerNativeAppUpdate()).resolves.toBe('store');
  });
});

describe('checkForAppUpdateOnStartup', () => {
  beforeEach(() => {
    getAppUpdateInfo.mockReset();
    startFlexibleUpdate.mockReset();
  });

  it('stays silent when no update is available (or side-loaded)', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ updateAvailability: 1 }));
    const onDownloaded = vi.fn();
    const check = await checkForAppUpdateOnStartup(onDownloaded);
    expect(check).toEqual({ available: false, escalated: false, flexibleStarted: false });
    expect(startFlexibleUpdate).not.toHaveBeenCalled();
    expect(onDownloaded).not.toHaveBeenCalled();
  });

  it('stays silent when Play services are unavailable', async () => {
    getAppUpdateInfo.mockRejectedValue(new Error('UNAVAILABLE'));
    const check = await checkForAppUpdateOnStartup(vi.fn());
    expect(check.available).toBe(false);
  });

  it('auto-downloads in the background when fresh, without escalating', async () => {
    getAppUpdateInfo.mockResolvedValue(
      info({ clientVersionStalenessDays: 2, installStatus: undefined }),
    );
    const downloadDone = Promise.resolve();
    startFlexibleUpdate.mockReturnValue(downloadDone);
    const onDownloaded = vi.fn();
    const check = await checkForAppUpdateOnStartup(onDownloaded);
    expect(check).toEqual({ available: true, escalated: false, flexibleStarted: true });
    expect(startFlexibleUpdate).toHaveBeenCalledTimes(1);
    await downloadDone;
    expect(onDownloaded).toHaveBeenCalledTimes(1);
  });

  it('escalates when more than two weeks behind', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ clientVersionStalenessDays: STALENESS_ESCALATION_DAYS }));
    startFlexibleUpdate.mockReturnValue(new Promise(() => {})); // still downloading
    const check = await checkForAppUpdateOnStartup(vi.fn());
    expect(check.escalated).toBe(true);
    expect(check.flexibleStarted).toBe(true);
  });

  it('notifies immediately when a previous run already downloaded the update', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ clientVersionStalenessDays: 1, installStatus: 11 })); // DOWNLOADED
    const onDownloaded = vi.fn();
    const check = await checkForAppUpdateOnStartup(onDownloaded);
    expect(onDownloaded).toHaveBeenCalledTimes(1);
    expect(check.flexibleStarted).toBe(true);
    expect(startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it('tolerates a failed background download (retried on next start)', async () => {
    getAppUpdateInfo.mockResolvedValue(info({ clientVersionStalenessDays: 1 }));
    startFlexibleUpdate.mockRejectedValue(new Error('download failed'));
    const onDownloaded = vi.fn();
    const check = await checkForAppUpdateOnStartup(onDownloaded);
    expect(check.available).toBe(true);
    expect(check.flexibleStarted).toBe(true);
    await Promise.resolve(); // let the rejection settle
    expect(onDownloaded).not.toHaveBeenCalled();
  });

  it('escalates even when the flexible download is not allowed', async () => {
    getAppUpdateInfo.mockResolvedValue(
      info({ clientVersionStalenessDays: 30, flexibleUpdateAllowed: false }),
    );
    const check = await checkForAppUpdateOnStartup(vi.fn());
    expect(check.escalated).toBe(true);
    expect(check.flexibleStarted).toBe(false);
    expect(startFlexibleUpdate).not.toHaveBeenCalled();
  });
});
